import json
import os
import psycopg

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p8426475_nova_exploration_16")
DATABASE_URL = os.environ.get("DATABASE_URL")


def get_conn():
    return psycopg.connect(DATABASE_URL)


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json",
    }


def get_user_from_token(token):
    if not token:
        return None
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT u.id, u.phone, u.username, u.first_name, u.last_name
                FROM {SCHEMA}.sessions s
                JOIN {SCHEMA}.users u ON s.user_id = u.id
                WHERE s.token = %s AND s.expires_at > NOW()""",
                (token,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "phone": row[1], "username": row[2], "first_name": row[3], "last_name": row[4]}


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

    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()

    import re

    # GET /messages/chats - список чатов пользователя
    if path.endswith("/messages/chats") and request.method == "GET":
        user = get_user_from_token(token)
        if not user:
            return {
                "statusCode": 401,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Не авторизован"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""SELECT c.id, c.chat_type, c.name, c.avatar_url, c.created_at,
                            (SELECT m.text FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_msg,
                            (SELECT m.created_at FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_msg_at,
                            (SELECT u2.first_name || ' ' || COALESCE(u2.last_name, '') FROM {SCHEMA}.chat_members cm2
                                JOIN {SCHEMA}.users u2 ON cm2.user_id = u2.id
                                WHERE cm2.chat_id = c.id AND cm2.user_id != %s LIMIT 1) as other_name,
                            (SELECT cm2.user_id FROM {SCHEMA}.chat_members cm2 WHERE cm2.chat_id = c.id AND cm2.user_id != %s LIMIT 1) as other_id
                        FROM {SCHEMA}.chats c
                        JOIN {SCHEMA}.chat_members cm ON c.id = cm.chat_id
                        WHERE cm.user_id = %s
                        ORDER BY last_msg_at DESC NULLS LAST""",
                        (user["id"], user["id"], user["id"]),
                    )
                    rows = cur.fetchall()

            chats = [
                {
                    "id": r[0],
                    "type": r[1],
                    "name": r[2] if r[2] else r[7],
                    "avatar_url": r[3],
                    "created_at": r[4].isoformat() if r[4] else None,
                    "last_message": r[5],
                    "last_message_at": r[6].isoformat() if r[6] else None,
                    "other_user_id": r[8],
                }
                for r in rows
            ]

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"chats": chats}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # GET /messages/{chat_id} - сообщения чата
    m = re.match(r".*/messages/(\d+)$", path)
    if m and request.method == "GET":
        chat_id = int(m.group(1))
        user = get_user_from_token(token)
        if not user:
            return {
                "statusCode": 401,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Не авторизован"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Проверяем участие в чате
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s",
                        (chat_id, user["id"]),
                    )
                    if not cur.fetchone():
                        return {
                            "statusCode": 403,
                            "headers": cors_headers(),
                            "body": json.dumps({"error": "Нет доступа к чату"}),
                        }

                    cur.execute(
                        f"""SELECT m.id, m.text, m.created_at, m.sender_id, m.is_edited,
                            u.first_name, u.last_name, u.username
                        FROM {SCHEMA}.messages m
                        LEFT JOIN {SCHEMA}.users u ON m.sender_id = u.id
                        WHERE m.chat_id = %s
                        ORDER BY m.created_at ASC
                        LIMIT 100""",
                        (chat_id,),
                    )
                    rows = cur.fetchall()

            messages = [
                {
                    "id": r[0],
                    "text": r[1],
                    "created_at": r[2].isoformat() if r[2] else None,
                    "sender_id": r[3],
                    "is_edited": r[4],
                    "sender": {
                        "first_name": r[5],
                        "last_name": r[6],
                        "username": r[7],
                    },
                    "is_mine": r[3] == user["id"],
                }
                for r in rows
            ]

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"messages": messages}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # POST /messages/{chat_id}/send - отправить сообщение
    m = re.match(r".*/messages/(\d+)/send$", path)
    if m and request.method == "POST":
        chat_id = int(m.group(1))
        user = get_user_from_token(token)
        if not user:
            return {
                "statusCode": 401,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Не авторизован"}),
            }

        text = body.get("text", "").strip()
        if not text:
            return {
                "statusCode": 400,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Текст сообщения обязателен"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s",
                        (chat_id, user["id"]),
                    )
                    if not cur.fetchone():
                        return {
                            "statusCode": 403,
                            "headers": cors_headers(),
                            "body": json.dumps({"error": "Нет доступа к чату"}),
                        }

                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text)
                        VALUES (%s, %s, %s) RETURNING id, text, created_at""",
                        (chat_id, user["id"], text),
                    )
                    row = cur.fetchone()
                conn.commit()

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({
                    "success": True,
                    "message": {
                        "id": row[0],
                        "text": row[1],
                        "created_at": row[2].isoformat() if row[2] else None,
                        "sender_id": user["id"],
                        "is_mine": True,
                    }
                }),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # POST /messages/create-chat - создать или найти личный чат
    if path.endswith("/messages/create-chat") and request.method == "POST":
        user = get_user_from_token(token)
        if not user:
            return {
                "statusCode": 401,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Не авторизован"}),
            }

        other_user_id = body.get("user_id")
        if not other_user_id:
            return {
                "statusCode": 400,
                "headers": cors_headers(),
                "body": json.dumps({"error": "user_id обязателен"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Ищем существующий приватный чат
                    cur.execute(
                        f"""SELECT cm1.chat_id FROM {SCHEMA}.chat_members cm1
                        JOIN {SCHEMA}.chat_members cm2 ON cm1.chat_id = cm2.chat_id
                        JOIN {SCHEMA}.chats c ON cm1.chat_id = c.id
                        WHERE cm1.user_id = %s AND cm2.user_id = %s AND c.chat_type = 'private'""",
                        (user["id"], other_user_id),
                    )
                    existing = cur.fetchone()

                    if existing:
                        chat_id = existing[0]
                    else:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.chats (chat_type, created_by) VALUES ('private', %s) RETURNING id",
                            (user["id"],),
                        )
                        chat_id = cur.fetchone()[0]
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s), (%s, %s)",
                            (chat_id, user["id"], chat_id, other_user_id),
                        )
                conn.commit()

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"success": True, "chat_id": chat_id}),
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
