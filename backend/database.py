"""
database.py — CloudBase HTTP API (PostgREST) data access layer.
"""

import os
import logging
from typing import Optional, Any

import httpx

logger = logging.getLogger(__name__)

TCB_ENV_ID = os.getenv("TCB_ENV_ID", "")
TCB_API_KEY = os.getenv("TCB_API_KEY", "")

if not TCB_ENV_ID or not TCB_API_KEY:
    logger.warning("TCB_ENV_ID or TCB_API_KEY not set.")

BASE_URL = f"https://{TCB_ENV_ID}.api.tcloudbasegateway.com"

HEADERS = {
    "Authorization": f"Bearer {TCB_API_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

_client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers=HEADERS,
            timeout=httpx.Timeout(15.0, connect=5.0),
        )
    return _client


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
    _client = None


def _raise_on_error(resp: httpx.Response, context: str = "") -> None:
    if resp.is_success:
        return
    detail = resp.text[:500]
    logger.error("HTTP %s %s: %s", resp.status_code, context, detail)
    resp.raise_for_status()


# ── Comments CRUD ────────────────────────────────────────────────────────────

async def fetch_comments(user_id: Optional[str] = None) -> list[dict]:
    client = await get_client()
    resp = await client.get(
        "/v1/rdb/rest/comments",
        params={"select": "*", "order": "created_at.desc"},
    )
    _raise_on_error(resp, "fetch_comments")
    rows: list[dict] = resp.json()

    if user_id and rows:
        comment_ids = [r["id"] for r in rows]
        id_filter = ",".join(comment_ids)
        like_resp = await client.get(
            "/v1/rdb/rest/likes",
            params={
                "select": "comment_id",
                "comment_id": f"in.({id_filter})",
                "user_id": f"eq.{user_id}",
            },
        )
        if like_resp.is_success:
            liked_ids = {item["comment_id"] for item in like_resp.json()}
            for row in rows:
                row["liked_by_me"] = row["id"] in liked_ids
        else:
            for row in rows:
                row["liked_by_me"] = False
    else:
        for row in rows:
            row["liked_by_me"] = False

    return rows


async def create_comment(comment: dict) -> dict:
    client = await get_client()
    resp = await client.post("/v1/rdb/rest/comments", json=comment)
    _raise_on_error(resp, "create_comment")
    rows = resp.json()
    if not rows:
        raise RuntimeError("create_comment: server returned no rows")
    return rows[0]


async def update_comment_position(comment_id: str, x: float, y: float) -> Optional[dict]:
    client = await get_client()
    resp = await client.patch(
        "/v1/rdb/rest/comments",
        params={"id": f"eq.{comment_id}"},
        json={"x": x, "y": y},
    )
    _raise_on_error(resp, "update_comment_position")
    rows = resp.json()
    return rows[0] if rows else None


# ⚠️ 支持同时更新内容、颜色和情感
async def update_comment_content(comment_id: str, content: str, color: str, sentiment: str) -> Optional[dict]:
    client = await get_client()
    resp = await client.patch(
        "/v1/rdb/rest/comments",
        params={"id": f"eq.{comment_id}"},
        json={"content": content, "color": color, "sentiment": sentiment},
    )
    _raise_on_error(resp, "update_comment_content")
    rows = resp.json()
    return rows[0] if rows else None


async def get_comment_owner(comment_id: str) -> Optional[dict]:
    client = await get_client()
    resp = await client.get(
        "/v1/rdb/rest/comments",
        params={"id": f"eq.{comment_id}", "select": "*"},
    )
    _raise_on_error(resp, "get_comment_owner")
    rows = resp.json()
    return rows[0] if rows else None


# ── Likes ────────────────────────────────────────────────────────────────────

async def like_comment(comment_id: str, user_id: str) -> tuple[bool, int]:
    client = await get_client()

    check_resp = await client.get(
        "/v1/rdb/rest/likes",
        params={
            "select": "*",
            "comment_id": f"eq.{comment_id}",
            "user_id": f"eq.{user_id}",
        },
    )
    _raise_on_error(check_resp, "like_comment/check")
    existing = check_resp.json()

    if existing:
        del_resp = await client.delete(
            "/v1/rdb/rest/likes",
            params={"comment_id": f"eq.{comment_id}", "user_id": f"eq.{user_id}"},
        )
        _raise_on_error(del_resp, "like_comment/delete")

        comment = await get_comment_owner(comment_id)
        current_val = comment.get("likes") if comment else 0
        new_likes = max((current_val or 1) - 1, 0)
        
        await client.patch(
            "/v1/rdb/rest/comments",
            params={"id": f"eq.{comment_id}"},
            json={"likes": new_likes},
        )
        return False, new_likes
    else:
        ins_resp = await client.post(
            "/v1/rdb/rest/likes",
            json={"comment_id": comment_id, "user_id": user_id},
        )
        _raise_on_error(ins_resp, "like_comment/insert")

        comment = await get_comment_owner(comment_id)
        current_val = comment.get("likes") if comment else 0
        new_likes = (current_val or 0) + 1
        
        await client.patch(
            "/v1/rdb/rest/comments",
            params={"id": f"eq.{comment_id}"},
            json={"likes": new_likes},
        )
        return True, new_likes


# ── Users ────────────────────────────────────────────────────────────────────

async def get_user(username: str) -> Optional[dict]:
    client = await get_client()
    resp = await client.get(
        "/v1/rdb/rest/users",
        params={"username": f"eq.{username}", "select": "*"},
    )
    _raise_on_error(resp, "get_user")
    rows = resp.json()
    return rows[0] if rows else None


async def get_user_by_id(user_id: str) -> Optional[dict]:
    client = await get_client()
    resp = await client.get(
        "/v1/rdb/rest/users",
        params={"id": f"eq.{user_id}", "select": "*"},
    )
    _raise_on_error(resp, "get_user_by_id")
    rows = resp.json()
    return rows[0] if rows else None


async def create_user(user_id: str, username: str, password_hash: str, avatar: Optional[str] = None) -> dict:
    client = await get_client()
    body: dict = {
        "id": user_id,
        "username": username,
        "password_hash": password_hash,
    }
    if avatar:
        body["avatar"] = avatar
    resp = await client.post("/v1/rdb/rest/users", json=body)
    _raise_on_error(resp, "create_user")
    rows = resp.json()
    if not rows:
        raise RuntimeError("create_user: server returned no rows")
    return rows[0]
