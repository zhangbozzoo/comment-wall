"""
main.py — FastAPI application for the 实时评论墙 backend.

Refactored to use CloudBase HTTP API (PostgREST) via httpx
instead of direct asyncpg PostgreSQL connections.

WebSocket listens on port **9000** per CloudBase requirements.
"""

import os
import random
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from passlib.context import CryptContext
from dotenv import load_dotenv

from models import CommentCreate, LoginRequest
import database as db
from websocket_manager import manager

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── JWT ──────────────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── Sentiment Analysis ───────────────────────────────────────────────────────

NEGATIVE_WORDS = {"慢", "累", "差", "糟", "坏", "烂", "烦", "痛苦", "失望", "垃圾", "坑", "难受"}
POSITIVE_WORDS = {"赞", "好", "顺利", "棒", "优秀", "不错", "满意", "开心", "舒服", "完美", "给力", "牛"}


def analyze_sentiment(text: str) -> tuple[str, str]:
    neg = sum(1 for w in NEGATIVE_WORDS if w in text)
    pos = sum(1 for w in POSITIVE_WORDS if w in text)
    if neg > pos:
        return "negative", "#fee2e2"
    elif pos > neg:
        return "positive", "#dcfce7"
    return "neutral", "#fef3c7"


# ── Permission Helpers ───────────────────────────────────────────────────────


async def _require_user(token: Optional[str]) -> str:
    """Extract and validate user_id from JWT token. Raises 401 if invalid."""
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


async def _check_comment_ownership(comment_id: str, user_id: str) -> dict:
    """
    Verify the current user owns the comment.
    Fetches the comment via HTTP, then checks author_name against the user.
    Raises 403/404 on failure. Returns the comment dict on success.
    """
    comment = await db.get_comment_owner(comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")

    user = await db.get_user_by_id(user_id)
    if not user or user["username"] != comment.get("author_name"):
        raise HTTPException(status_code=403, detail="Can only edit your own comments")

    return comment


# ── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(title="实时评论墙", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Starting server — using CloudBase HTTP API (no direct DB connection)")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await db.close_client()


# ── REST Routes ──────────────────────────────────────────────────────────────


@app.post("/api/login")
async def login(req: LoginRequest):
    user = await db.get_user(req.username)
    if user and pwd_context.verify(req.password, user["password_hash"]):
        token = create_access_token({"sub": user["id"], "username": user["username"]})
        return {
            "token": token,
            "user": {"id": user["id"], "username": user["username"], "avatar": user.get("avatar")},
        }

    # Auto-register on first login
    new_id = str(uuid.uuid4())
    pw_hash = pwd_context.hash(req.password)
    avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={req.username}"
    await db.create_user(new_id, req.username, pw_hash, avatar)
    token = create_access_token({"sub": new_id, "username": req.username})
    return {
        "token": token,
        "user": {"id": new_id, "username": req.username, "avatar": avatar},
    }


@app.get("/api/comments")
async def list_comments(token: Optional[str] = None):
    user_id = None
    if token:
        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub")
    comments = await db.fetch_comments(user_id)
    return {"comments": comments}


@app.post("/api/comments")
async def create_new_comment(comment: CommentCreate, token: Optional[str] = None):
    user_id = None
    if token:
        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub")

    sentiment, color = analyze_sentiment(comment.content)
    data = comment.model_dump()
    data["color"] = color
    data["sentiment"] = sentiment
    data["rotate"] = round(random.uniform(-3.0, 3.0), 4)
    if user_id:
        data["user_id"] = user_id

    created = await db.create_comment(data)
    await manager.broadcast({"type": "NEW_COMMENT", "payload": created})
    return created


@app.put("/api/comments/{comment_id}/position")
async def update_position(comment_id: str, x: float, y: float, token: Optional[str] = None):
    user_id = await _require_user(token)
    await _check_comment_ownership(comment_id, user_id)

    updated = await db.update_comment_position(comment_id, x, y)
    if updated:
        await manager.broadcast({
            "type": "COMMENT_MOVED",
            "payload": {"id": comment_id, "x": x, "y": y},
        })
    return updated


@app.post("/api/comments/{comment_id}/like")
async def do_like(comment_id: str, token: Optional[str] = None):
    user_id = await _require_user(token)
    liked, likes = await db.like_comment(comment_id, user_id)
    await manager.broadcast({
        "type": "COMMENT_LIKED",
        "payload": {"id": comment_id, "likes": likes, "liked_by_me": liked},
    })
    return {"liked": liked, "likes": likes}


# ── WebSocket ────────────────────────────────────────────────────────────────


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id: Optional[str] = None
    try:
        await websocket.accept()
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            payload = data.get("payload", {})

            # ── Auth ────────────────────────────────────────────────────
            if msg_type == "AUTH":
                token = payload.get("token")
                if token:
                    decoded = verify_token(token)
                    if decoded:
                        user_id = decoded["sub"]
                        await manager.connect(websocket, user_id, {
                            "id": user_id,
                            "username": decoded.get("username"),
                            "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={decoded.get('username', 'user')}",
                        })
                    else:
                        await websocket.send_json({"type": "AUTH_FAILED", "payload": {}})
                continue

            # ── Heartbeat ───────────────────────────────────────────────
            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "payload": {}})
                continue

            # ── Guard: must be authenticated ────────────────────────────
            if user_id is None:
                await websocket.send_json({
                    "type": "ERROR",
                    "payload": {"message": "Not authenticated"},
                })
                continue

            # ── CREATE_COMMENT ──────────────────────────────────────────
            if msg_type == "CREATE_COMMENT":
                content = payload.get("content", "")
                sentiment, color = analyze_sentiment(content)
                comment_data = {
                    "content": content,
                    "author_name": payload.get("author_name", "Anonymous"),
                    "author_avatar": payload.get("author_avatar"),
                    "x": payload.get("x", random.uniform(200, 600)),
                    "y": payload.get("y", random.uniform(150, 400)),
                    "color": color,
                    "rotate": round(random.uniform(-3.0, 3.0), 4),
                    "sentiment": sentiment,
                    "user_id": user_id,
                }
                created = await db.create_comment(comment_data)
                await manager.broadcast({"type": "NEW_COMMENT", "payload": created})

            # ── MOVE_COMMENT ────────────────────────────────────────────
            elif msg_type == "MOVE_COMMENT":
                cid = payload.get("id")
                x = payload.get("x")
                y = payload.get("y")
                if not cid or x is None or y is None:
                    continue
                # Permission: only owner can move
                owner = await db.get_comment_owner(cid)
                user = await db.get_user_by_id(user_id)
                if user and owner and user["username"] == owner.get("author_name"):
                    updated = await db.update_comment_position(cid, x, y)
                    if updated:
                        await manager.broadcast({
                            "type": "COMMENT_MOVED",
                            "payload": {"id": cid, "x": x, "y": y},
                        })

            # ── LIKE_COMMENT ────────────────────────────────────────────
            elif msg_type == "LIKE_COMMENT":
                cid = payload.get("id")
                if not cid:
                    continue
                liked, likes = await db.like_comment(cid, user_id)
                await manager.broadcast({
                    "type": "COMMENT_LIKED",
                    "payload": {"id": cid, "likes": likes, "liked_by_me": liked},
                })

            # ── UPDATE_COMMENT ──────────────────────────────────────────
            elif msg_type == "UPDATE_COMMENT":
                cid = payload.get("id")
                if not cid:
                    continue
                owner = await db.get_comment_owner(cid)
                user = await db.get_user_by_id(user_id)
                if user and owner and user["username"] == owner.get("author_name"):
                    content = payload.get("content", "")
                    sentiment, color = analyze_sentiment(content)
                    updated = await db.update_comment_content(cid, content, color, sentiment)
                    if updated:
                        await manager.broadcast({
                            "type": "COMMENT_UPDATED",
                            "payload": updated,
                        })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: user=%s", user_id)
    except Exception as e:
        logger.error("WebSocket error: %s", e, exc_info=True)
    finally:
        if user_id:
            await manager.disconnect(user_id)


# ── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    # CloudBase requires WebSocket on port 9000
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)
