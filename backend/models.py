from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class User(BaseModel):
    id: str
    username: str
    avatar: Optional[str] = None

class CommentCreate(BaseModel):
    content: str
    author_name: str
    author_avatar: Optional[str] = None
    x: float = 0.0
    y: float = 0.0
    color: Optional[str] = None
    rotate: Optional[float] = None

class CommentUpdate(BaseModel):
    content: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None

class Comment(BaseModel):
    id: str
    content: str
    author_name: str
    author_avatar: Optional[str] = None
    x: float
    y: float
    color: str
    rotate: float
    likes: int = 0
    sentiment: str = "neutral"
    created_at: datetime

class CommentResponse(Comment):
    liked_by_me: bool = False

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: User

class WSMessage(BaseModel):
    type: str
    payload: dict