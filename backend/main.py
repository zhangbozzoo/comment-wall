import os
import random
import re
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from passlib.context import CryptContext
from dotenv import load_dotenv

from models import CommentCreate, CommentUpdate, LoginRequest, User
from database import (
    init_db, close_pool, fetch_comments, create_comment, update_comment_position,
    update_comment_content, like_comment, get_comment_author, get_user, create_user
)
from websocket_manager import manager

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

def analyze_sentiment(text: str) -> tuple[str, str]:
    negative_words = {"慢", "累", "差", "糟", "坏", "烂", "烦", "痛苦", "失望", "垃圾", "坑", "难受"}
    positive_words = {"赞", "好", "顺利", "棒", "优秀", "不错", "满意", "开心", "舒服", "完美", "给力", "牛"}
    neg_count = sum(1 for w in negative_words if w in text)
    pos_count = sum(1 for w in positive_words if w in text)
    if neg_count > pos_count:
        return "negative", "#fee2e2"
    elif pos_count > neg_count:
        return "positive", "#dcfce7"
    else:
        return "neutral", "#fef3c7"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

app = FastAPI(title="实时评论墙", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await init_db()

@app.on_event("shutdown")
async def on_shutdown():
    await close_pool()

@app.post("/api/login")
async def login(req: LoginRequest):
    user = await get_user(req.username)
    if user and pwd_context.verify(req.password, user["password_hash"]):
        token = create_access_token({"sub": user["id"], "username": user["username"]})
        return {"token": token, "user": {"id": user["id"], "username": user["username"], "avatar": user.get("avatar")}}

    new_id = str(uuid.uuid4())
    pw_hash = pwd_context.hash(req.password)
    await create_user(new_id, req.username, pw_hash, f"https://api.dicebear.com/7.x/avataaars/svg?seed={req.username}")
    token = create_access_token({"sub": new_id, "username": req.username})
    return {"token": token, "user": {"id": new_id, "username": req.username, "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={req.username}"}}

@app.get("/api/comments")
async def list_comments(token: Optional[str] = None):
    user_id = None
    if token:
        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub")
    comments = await fetch_comments(user_id)
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
    data["rotate"] = random.uniform(-3.0, 3.0)
    if user_id:
        data["user_id"] = user_id

    created = await create_comment(data)
    await manager.broadcast({
        "type": "NEW_COMMENT",
        "payload": created
    })
    return created

@app.put("/api/comments/{comment_id}/position")
async def update_position(comment_id: str, x: float, y: float, token: Optional[str] = None):
    user_id = None
    if token:
        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    author = await get_comment_author(comment_id)
    if author is None:
        raise HTTPException(status_code=404, detail="Comment not found")

    user = await get_user_by_id(user_id)
    if not user or user["username"] != author:
        raise HTTPException(status_code=403, detail="Can only edit your own comments")

    updated = await update_comment_position(comment_id, x, y)
    if updated:
        await manager.broadcast({
            "type": "COMMENT_MOVED",
            "payload": {"id": comment_id, "x": x, "y": y}
        })
    return updated

@app.post("/api/comments/{comment_id}/like")
async def do_like(comment_id: str, token: Optional[str] = None):
    user_id = None
    if token:
        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    liked, likes = await like_comment(comment_id, user_id)
    await manager.broadcast({
        "type": "COMMENT_LIKED",
        "payload": {"id": comment_id, "likes": likes, "liked_by_me": liked}
    })
    return {"liked": liked, "likes": likes}

async def get_user_by_id(user_id: str):
    pool = await __import__("database").get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE id=$1", user_id)
        return dict(row) if row else None

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = None
    try:
        await websocket.accept()
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            payload = data.get("payload", {})

            if msg_type == "AUTH":
                token = payload.get("token")
                if token:
                    decoded = verify_token(token)
                    if decoded:
                        user_id = decoded["sub"]
                        await manager.connect(websocket, user_id, {
                            "id": user_id,
                            "username": decoded.get("username"),
                            "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={decoded.get('username', 'user')}"
                        })
                    else:
                        await websocket.send_json({"type": "AUTH_FAILED", "payload": {}})
                continue

            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "payload": {}})
                continue

            if user_id is None:
                await websocket.send_json({"type": "ERROR", "payload": {"message": "Not authenticated"}})
                continue

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
                    "rotate": random.uniform(-3.0, 3.0),
                    "sentiment": sentiment
                }
                created = await create_comment(comment_data)
                await manager.broadcast({
                    "type": "NEW_COMMENT",
                    "payload": created
                })

            elif msg_type == "MOVE_COMMENT":
                cid = payload.get("id")
                x = payload.get("x")
                y = payload.get("y")
                author = await get_comment_author(cid)
                user = await get_user_by_id(user_id)
                if user and author and user["username"] == author:
                    updated = await update_comment_position(cid, x, y)
                    if updated:
                        await manager.broadcast({
                            "type": "COMMENT_MOVED",
                            "payload": {"id": cid, "x": x, "y": y}
                        })

            elif msg_type == "LIKE_COMMENT":
                cid = payload.get("id")
                liked, likes = await like_comment(cid, user_id)
                await manager.broadcast({
                    "type": "COMMENT_LIKED",
                    "payload": {"id": cid, "likes": likes, "liked_by_me": liked}
                })

            elif msg_type == "UPDATE_COMMENT":
                cid = payload.get("id")
                author = await get_comment_author(cid)
                user = await get_user_by_id(user_id)
                if user and author and user["username"] == author:
                    content = payload.get("content", "")
                    sentiment, color = analyze_sentiment(content)
                    updated = await update_comment_content(cid, content, color, sentiment)
                    if updated:
                        await manager.broadcast({
                            "type": "COMMENT_UPDATED",
                            "payload": updated
                        })
    except WebSocketDisconnect:
        if user_id:
            await manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if user_id:
            await manager.disconnect(user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)