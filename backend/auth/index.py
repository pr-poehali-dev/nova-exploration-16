import json
import random
import string
import hashlib
import os
from datetime import datetime, timedelta
import psycopg

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p8426475_nova_exploration_16")
DATABASE_URL = os.environ.get("DATABASE_URL")


def get_conn():
    return psycopg.connect(DATABASE_URL)


def generate_otp():
    return "".join(random.choices(string.digits, k=6))


def generate_token():
    return hashlib.sha256(os.urandom(32)).hexdigest()


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json",
    }


def handler(request):
    if request.method == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    path = request.path.rstrip("/")
    body = {}
    if request.body:
        try:
            body = json.loads(request.body)
        except Exception:
            body = {}

    # POST /auth/send-code
    if path.endswith("/send-code") and request.method == "POST":
        phone = body.get("phone", "").strip()
        if not phone:
            return {
                "statusCode": 400,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Номер телефона обязателен"}),
            }

        code = generate_otp()
        expires_at = datetime.now() + timedelta(minutes=10)

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Инвалидируем старые коды
                    cur.execute(
                        f"UPDATE {SCHEMA}.otp_codes SET used = TRUE WHERE phone = %s AND used = FALSE",
                        (phone,),
                    )
                    # Создаём новый код
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.otp_codes (phone, code, expires_at) VALUES (%s, %s, %s)",
                        (phone, code, expires_at),
                    )
                conn.commit()
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

        # В реальном приложении здесь отправляем SMS
        # Для демо возвращаем код в ответе (только в dev!)
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": json.dumps(
                {
                    "success": True,
                    "message": "Код отправлен",
                    "demo_code": code,  # Убрать в продакшене
                }
            ),
        }

    # POST /auth/verify-code
    if path.endswith("/verify-code") and request.method == "POST":
        phone = body.get("phone", "").strip()
        code = body.get("code", "").strip()
        first_name = body.get("first_name", "").strip()
        last_name = body.get("last_name", "").strip()

        if not phone or not code:
            return {
                "statusCode": 400,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Телефон и код обязательны"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Проверяем код
                    cur.execute(
                        f"""SELECT id FROM {SCHEMA}.otp_codes
                        WHERE phone = %s AND code = %s AND used = FALSE AND expires_at > NOW()
                        ORDER BY created_at DESC LIMIT 1""",
                        (phone, code),
                    )
                    otp_row = cur.fetchone()

                    if not otp_row:
                        return {
                            "statusCode": 400,
                            "headers": cors_headers(),
                            "body": json.dumps(
                                {"error": "Неверный или просроченный код"}
                            ),
                        }

                    otp_id = otp_row[0]

                    # Помечаем код как использованный
                    cur.execute(
                        f"UPDATE {SCHEMA}.otp_codes SET used = TRUE WHERE id = %s",
                        (otp_id,),
                    )

                    # Ищем или создаём пользователя
                    cur.execute(
                        f"SELECT id, phone, username, first_name, last_name, bio, avatar_url, is_verified FROM {SCHEMA}.users WHERE phone = %s",
                        (phone,),
                    )
                    user_row = cur.fetchone()

                    is_new_user = False
                    if not user_row:
                        is_new_user = True
                        cur.execute(
                            f"""INSERT INTO {SCHEMA}.users (phone, first_name, last_name, is_verified)
                            VALUES (%s, %s, %s, TRUE) RETURNING id, phone, username, first_name, last_name, bio, avatar_url, is_verified""",
                            (phone, first_name or "Пользователь", last_name or ""),
                        )
                        user_row = cur.fetchone()
                    else:
                        # Обновляем last_seen
                        cur.execute(
                            f"UPDATE {SCHEMA}.users SET last_seen = NOW() WHERE id = %s",
                            (user_row[0],),
                        )

                    user_id = user_row[0]

                    # Создаём сессию
                    token = generate_token()
                    expires_at = datetime.now() + timedelta(days=30)
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
                        (user_id, token, expires_at),
                    )

                conn.commit()

            user = {
                "id": user_row[0],
                "phone": user_row[1],
                "username": user_row[2],
                "first_name": user_row[3],
                "last_name": user_row[4],
                "bio": user_row[5],
                "avatar_url": user_row[6],
                "is_verified": user_row[7],
            }

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps(
                    {
                        "success": True,
                        "token": token,
                        "user": user,
                        "is_new_user": is_new_user,
                    }
                ),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # GET /auth/me
    if path.endswith("/me") and request.method == "GET":
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip()

        if not token:
            return {
                "statusCode": 401,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Не авторизован"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""SELECT u.id, u.phone, u.username, u.first_name, u.last_name, u.bio, u.avatar_url, u.is_verified
                        FROM {SCHEMA}.sessions s
                        JOIN {SCHEMA}.users u ON s.user_id = u.id
                        WHERE s.token = %s AND s.expires_at > NOW()""",
                        (token,),
                    )
                    row = cur.fetchone()

            if not row:
                return {
                    "statusCode": 401,
                    "headers": cors_headers(),
                    "body": json.dumps({"error": "Сессия истекла"}),
                }

            user = {
                "id": row[0],
                "phone": row[1],
                "username": row[2],
                "first_name": row[3],
                "last_name": row[4],
                "bio": row[5],
                "avatar_url": row[6],
                "is_verified": row[7],
            }

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"user": user}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # POST /auth/update-profile
    if path.endswith("/update-profile") and request.method == "POST":
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip()

        if not token:
            return {
                "statusCode": 401,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Не авторизован"}),
            }

        first_name = body.get("first_name", "").strip()
        last_name = body.get("last_name", "").strip()
        username = body.get("username", "").strip()
        bio = body.get("bio", "").strip()

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s AND expires_at > NOW()",
                        (token,),
                    )
                    sess = cur.fetchone()
                    if not sess:
                        return {
                            "statusCode": 401,
                            "headers": cors_headers(),
                            "body": json.dumps({"error": "Сессия истекла"}),
                        }
                    user_id = sess[0]

                    cur.execute(
                        f"""UPDATE {SCHEMA}.users SET
                            first_name = %s,
                            last_name = %s,
                            username = NULLIF(%s, ''),
                            bio = NULLIF(%s, '')
                        WHERE id = %s
                        RETURNING id, phone, username, first_name, last_name, bio, avatar_url, is_verified""",
                        (first_name, last_name, username, bio, user_id),
                    )
                    row = cur.fetchone()
                conn.commit()

            user = {
                "id": row[0],
                "phone": row[1],
                "username": row[2],
                "first_name": row[3],
                "last_name": row[4],
                "bio": row[5],
                "avatar_url": row[6],
                "is_verified": row[7],
            }

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"success": True, "user": user}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    return {
        "statusCode": 404,
        "headers": cors_headers(),
        "body": json.dumps({"error": "Not found"}),
    }
