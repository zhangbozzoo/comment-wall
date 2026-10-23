import os
import random
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, Depends
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

COLORS = {
    "positive": "#dcfce7", 
    "negative": "#ffe4e6", 
    "neutral": "#fef3c7"   
}

NEGATIVE_WORDS = {"慢", "累", "差", "糟", "坏", "烂", "烦", "痛苦", "失望", "垃圾", "坑", "难受"}
POSITIVE_WORDS = {"赞", "好", "顺利", "棒", "优秀", "不错", "满意", "开心", "舒服", "完美", "给力", "牛"}

def analyze_sentiment(text: str) -> tuple[str, str]:
    neg = sum(1 for w in NEGATIVE_WORDS if w in text)
    pos = sum(1 for w in POSITIVE_WORDS if w in text)
    
    if neg > pos:
        return "negative", COLORS["negative"]
    elif pos > neg:
        return "positive", COLORS["positive"]
    else:
        return "neutral", COLORS["neutral"]

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
    logger.info("Starting server")

@app.on_event("shutdown")
async def on_shutdown() -> None:
    await db.close_client()

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的 Authorization Header")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    return payload.get("sub")

@app.post("/api/login")
async def login(req: LoginRequest):
    user = await db.get_user(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="账号不存在，请先注册")
    
    if pwd_context.verify(req.password, user["password_hash"]):
        token = create_access_token({"sub": user["id"], "username": user["username"]})
        return {
            "token": token,
            "user": {"id": user["id"], "username": user["username"], "avatar": user.get("avatar")},
        }
    else:
        raise HTTPException(status_code=401, detail="密码错误")

@app.post("/api/register")
async def register(req: LoginRequest):
    user = await db.get_user(req.username)
    if user:
        raise HTTPException(status_code=409, detail="该账号已被注册")
    
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
async def list_comments(authorization: Optional[str] = Header(None)):
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        payload = verify_token(authorization.split(" ")[1])
        if payload: user_id = payload.get("sub")
    comments = await db.fetch_comments(user_id)
    return {"comments": comments}

@app.post("/api/comments")
async def create_new_comment(comment: CommentCreate, user_id: str = Depends(get_current_user)):
    sentiment, color = analyze_sentiment(comment.content)
    data = comment.model_dump()
    data["color"] = color
    data["sentiment"] = sentiment
    data["rotate"] = round(random.uniform(-4.0, 4.0), 2)
    data["user_id"] = user_id
    data["likes"] = 0

    created = await db.create_comment(data)
    await manager.broadcast({"type": "NEW_COMMENT", "payload": created})
    return created

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id: Optional[str] = None
    decoded_user = None
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
                        decoded_user = decoded
                        await manager.connect(websocket, user_id, {
                            "id": user_id,
                            "username": decoded.get("username"),
                            "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={decoded.get('username', 'user')}",
                        })
                    else:
                        await websocket.send_json({"type": "AUTH_FAILED", "payload": {}})
                continue

            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "payload": {}})
                continue

            if user_id is None:
                continue

            if msg_type == "CREATE_COMMENT":
                content = payload.get("content", "")
                sentiment, color = analyze_sentiment(content)
                comment_data = {
                    "content": content,
                    "author_name": payload.get("author_name", "Anonymous"),
                    "author_avatar": payload.get("author_avatar"),
                    "x": payload.get("x", 200),
                    "y": payload.get("y", 200),
                    "color": color,
                    "rotate": round(random.uniform(-4.0, 4.0), 2),
                    "sentiment": sentiment,
                    "user_id": user_id,
                    "likes": 0
                }
                created = await db.create_comment(comment_data)
                await manager.broadcast({"type": "NEW_COMMENT", "payload": created})

            elif msg_type == "MOVE_COMMENT":
                cid = payload.get("id")
                x = payload.get("x")
                y = payload.get("y")
                if cid and x is not None and y is not None:
                    # 移动的权限校验
                    comment = await db.get_comment_owner(cid)
                    if comment and comment.get("author_name") == decoded_user.get("username"):
                        updated = await db.update_comment_position(cid, x, y)
                        if updated:
                            await manager.broadcast({"type": "COMMENT_MOVED", "payload": {"id": cid, "x": x, "y": y}})

            elif msg_type == "LIKE_COMMENT":
                cid = payload.get("id")
                if not cid: continue
                liked, likes = await db.like_comment(cid, user_id)
                await manager.broadcast({
                    "type": "COMMENT_LIKED", 
                    "payload": {"id": cid, "likes": likes, "liked_by_me": liked}
                })
                
            elif msg_type == "UPDATE_COMMENT":
                cid = payload.get("id")
                new_content = payload.get("content")
                if not cid or not new_content: continue
                
                # ⚠️ 编辑内容的权限校验
                comment = await db.get_comment_owner(cid)
                if comment and comment.get("author_name") == decoded_user.get("username"):
                    updated = await db.update_comment_content(cid, new_content)
                    if updated:
                        await manager.broadcast({
                            "type": "COMMENT_UPDATED", 
                            "payload": {"id": cid, "content": new_content}
                        })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS Error: {e}")
    finally:
        if user_id:
            await manager.disconnect(user_id, websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)
