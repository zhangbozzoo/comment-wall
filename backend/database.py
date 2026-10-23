import os
import asyncpg
from typing import Optional

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/commentwall")

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=10)
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                content TEXT NOT NULL,
                author_name TEXT NOT NULL,
                author_avatar TEXT,
                x FLOAT DEFAULT 0.0,
                y FLOAT DEFAULT 0.0,
                color TEXT DEFAULT '#fef3c7',
                rotate FLOAT DEFAULT 0.0,
                likes INT DEFAULT 0,
                sentiment TEXT DEFAULT 'neutral',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS likes (
                comment_id UUID NOT NULL,
                user_id TEXT NOT NULL,
                PRIMARY KEY (comment_id, user_id),
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                avatar TEXT
            );
        """)

async def fetch_comments(user_id: Optional[str] = None) -> list:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM comments ORDER BY created_at DESC")
        result = []
        for row in rows:
            liked = False
            if user_id:
                liked = await conn.fetchval(
                    "SELECT 1 FROM likes WHERE comment_id=$1 AND user_id=$2",
                    row["id"], user_id
                ) is not None
            result.append(dict(row) | {"liked_by_me": liked})
        return result

async def create_comment(comment: dict) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO comments (content, author_name, author_avatar, x, y, color, rotate, sentiment)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            comment["content"], comment["author_name"], comment.get("author_avatar"),
            comment.get("x", 0.0), comment.get("y", 0.0), comment.get("color", "#fef3c7"),
            comment.get("rotate", 0.0), comment.get("sentiment", "neutral")
        )
        return dict(row)

async def update_comment_position(comment_id: str, x: float, y: float) -> Optional[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE comments SET x=$1, y=$2 WHERE id=$3 RETURNING *",
            x, y, comment_id
        )
        return dict(row) if row else None

async def update_comment_content(comment_id: str, content: str, color: str, sentiment: str) -> Optional[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE comments SET content=$1, color=$2, sentiment=$3 WHERE id=$4 RETURNING *",
            content, color, sentiment, comment_id
        )
        return dict(row) if row else None

async def like_comment(comment_id: str, user_id: str) -> tuple[bool, int]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchval(
                "SELECT 1 FROM likes WHERE comment_id=$1 AND user_id=$2",
                comment_id, user_id
            )
            if existing:
                await conn.execute(
                    "DELETE FROM likes WHERE comment_id=$1 AND user_id=$2",
                    comment_id, user_id
                )
                await conn.execute(
                    "UPDATE comments SET likes = likes - 1 WHERE id=$1",
                    comment_id
                )
                liked = False
            else:
                await conn.execute(
                    "INSERT INTO likes (comment_id, user_id) VALUES ($1, $2)",
                    comment_id, user_id
                )
                await conn.execute(
                    "UPDATE comments SET likes = likes + 1 WHERE id=$1",
                    comment_id
                )
                liked = True
            likes = await conn.fetchval("SELECT likes FROM comments WHERE id=$1", comment_id)
            return liked, likes

async def get_comment_author(comment_id: str) -> Optional[str]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT author_name FROM comments WHERE id=$1", comment_id)

async def get_user(username: str) -> Optional[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE username=$1", username)
        return dict(row) if row else None

async def create_user(user_id: str, username: str, password_hash: str, avatar: Optional[str] = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO users (id, username, password_hash, avatar) VALUES ($1, $2, $3, $4)",
            user_id, username, password_hash, avatar
        )