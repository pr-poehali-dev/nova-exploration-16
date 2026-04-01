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

    # GET /channels - список публичных каналов
    if path.endswith("/channels") and request.method == "GET":
        try:
            user = get_user_from_token(token) if token else None
            user_id = user["id"] if user else None

            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""SELECT c.id, c.name, c.username, c.description, c.avatar_url,
                            c.subscribers_count, c.created_at,
                            CASE WHEN cs.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_subscribed
                        FROM {SCHEMA}.channels c
                        LEFT JOIN {SCHEMA}.channel_subscribers cs ON c.id = cs.channel_id AND cs.user_id = %s
                        WHERE c.is_public = TRUE
                        ORDER BY c.subscribers_count DESC""",
                        (user_id,),
                    )
                    rows = cur.fetchall()

            channels = [
                {
                    "id": r[0],
                    "name": r[1],
                    "username": r[2],
                    "description": r[3],
                    "avatar_url": r[4],
                    "subscribers_count": r[5],
                    "created_at": r[6].isoformat() if r[6] else None,
                    "is_subscribed": r[7],
                }
                for r in rows
            ]

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"channels": channels}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # GET /channels/my - мои подписки
    if path.endswith("/channels/my") and request.method == "GET":
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
                        f"""SELECT c.id, c.name, c.username, c.description, c.avatar_url,
                            c.subscribers_count, c.created_at,
                            (SELECT cp.text FROM {SCHEMA}.channel_posts cp WHERE cp.channel_id = c.id ORDER BY cp.created_at DESC LIMIT 1) as last_post,
                            (SELECT cp.created_at FROM {SCHEMA}.channel_posts cp WHERE cp.channel_id = c.id ORDER BY cp.created_at DESC LIMIT 1) as last_post_at
                        FROM {SCHEMA}.channel_subscribers cs
                        JOIN {SCHEMA}.channels c ON cs.channel_id = c.id
                        WHERE cs.user_id = %s
                        ORDER BY last_post_at DESC NULLS LAST""",
                        (user["id"],),
                    )
                    rows = cur.fetchall()

            channels = [
                {
                    "id": r[0],
                    "name": r[1],
                    "username": r[2],
                    "description": r[3],
                    "avatar_url": r[4],
                    "subscribers_count": r[5],
                    "created_at": r[6].isoformat() if r[6] else None,
                    "last_post": r[7],
                    "last_post_at": r[8].isoformat() if r[8] else None,
                }
                for r in rows
            ]

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"channels": channels}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # GET /channels/{id}/posts
    import re
    m = re.match(r".*/channels/(\d+)/posts$", path)
    if m and request.method == "GET":
        channel_id = int(m.group(1))
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""SELECT cp.id, cp.text, cp.media_url, cp.media_type, cp.views_count, cp.created_at,
                            u.first_name, u.last_name, u.username
                        FROM {SCHEMA}.channel_posts cp
                        LEFT JOIN {SCHEMA}.users u ON cp.author_id = u.id
                        WHERE cp.channel_id = %s
                        ORDER BY cp.created_at DESC
                        LIMIT 50""",
                        (channel_id,),
                    )
                    rows = cur.fetchall()

            posts = [
                {
                    "id": r[0],
                    "text": r[1],
                    "media_url": r[2],
                    "media_type": r[3],
                    "views_count": r[4],
                    "created_at": r[5].isoformat() if r[5] else None,
                    "author": {
                        "first_name": r[6],
                        "last_name": r[7],
                        "username": r[8],
                    },
                }
                for r in rows
            ]

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"posts": posts}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # POST /channels/{id}/subscribe
    m = re.match(r".*/channels/(\d+)/subscribe$", path)
    if m and request.method == "POST":
        channel_id = int(m.group(1))
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
                    # Проверяем подписку
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.channel_subscribers WHERE channel_id = %s AND user_id = %s",
                        (channel_id, user["id"]),
                    )
                    existing = cur.fetchone()

                    if existing:
                        # Отписываемся
                        cur.execute(
                            f"UPDATE {SCHEMA}.channel_subscribers SET subscribed_at = NOW() WHERE channel_id = %s AND user_id = %s",
                            (channel_id, user["id"]),
                        )
                        subscribed = True
                    else:
                        # Подписываемся
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.channel_subscribers (channel_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                            (channel_id, user["id"]),
                        )
                        cur.execute(
                            f"UPDATE {SCHEMA}.channels SET subscribers_count = subscribers_count + 1 WHERE id = %s",
                            (channel_id,),
                        )
                        subscribed = True
                conn.commit()

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"success": True, "subscribed": subscribed}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # POST /channels/create
    if path.endswith("/channels/create") and request.method == "POST":
        user = get_user_from_token(token)
        if not user:
            return {
                "statusCode": 401,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Не авторизован"}),
            }

        name = body.get("name", "").strip()
        username = body.get("username", "").strip()
        description = body.get("description", "").strip()

        if not name:
            return {
                "statusCode": 400,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Название канала обязательно"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.channels (name, username, description, owner_id, is_public, subscribers_count)
                        VALUES (%s, NULLIF(%s, ''), NULLIF(%s, ''), %s, TRUE, 1)
                        RETURNING id, name, username, description, subscribers_count""",
                        (name, username, description, user["id"]),
                    )
                    row = cur.fetchone()
                    channel_id = row[0]

                    # Автоподписываем создателя
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.channel_subscribers (channel_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (channel_id, user["id"]),
                    )
                conn.commit()

            channel = {
                "id": row[0],
                "name": row[1],
                "username": row[2],
                "description": row[3],
                "subscribers_count": row[4],
            }

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({"success": True, "channel": channel}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": cors_headers(),
                "body": json.dumps({"error": str(e)}),
            }

    # POST /channels/{id}/post - создать пост
    m = re.match(r".*/channels/(\d+)/post$", path)
    if m and request.method == "POST":
        channel_id = int(m.group(1))
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
                "body": json.dumps({"error": "Текст поста обязателен"}),
            }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Проверяем что пользователь - владелец канала
                    cur.execute(
                        f"SELECT owner_id FROM {SCHEMA}.channels WHERE id = %s",
                        (channel_id,),
                    )
                    ch = cur.fetchone()
                    if not ch or ch[0] != user["id"]:
                        return {
                            "statusCode": 403,
                            "headers": cors_headers(),
                            "body": json.dumps({"error": "Нет прав"}),
                        }

                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.channel_posts (channel_id, author_id, text)
                        VALUES (%s, %s, %s) RETURNING id, text, created_at""",
                        (channel_id, user["id"], text),
                    )
                    row = cur.fetchone()
                conn.commit()

            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps({
                    "success": True,
                    "post": {
                        "id": row[0],
                        "text": row[1],
                        "created_at": row[2].isoformat() if row[2] else None,
                    }
                }),
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
