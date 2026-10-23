"""
database.py — CloudBase HTTP API (PostgREST) data access layer.

Replaces asyncpg with httpx.AsyncClient.
All DB operations are async HTTP calls to the CloudBase gateway.
"""

import os
import logging
from typing import Optional, Any

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

TCB_ENV_ID = os.getenv("TCB_ENV_ID", "")
TCB_API_KEY = os.getenv("TCB_API_KEY", "")

if not TCB_ENV_ID or not TCB_API_KEY:
    logger.warning(
        "TCB_ENV_ID or TCB_API_KEY not set. "
        "Set them via environment variables before starting the server."
    )

BASE_URL = f"https://{TCB_ENV_ID}.api.tcloudbasegateway.com"

HEADERS = {
    "Authorization": f"Bearer {TCB_API_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# Shared async HTTP client (created lazily on first use)
_client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    """Return a shared httpx.AsyncClient, creating it on first call."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers=HEADERS,
            timeout=httpx.Timeout(15.0, connect=5.0),
        )
    return _client


async def close_client() -> None:
    """Gracefully close the shared HTTP client."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
    _client = None


# ── Helpers ──────────────────────────────────────────────────────────────────


def _raise_on_error(resp: httpx.Response, context: str = "") -> None:
    """Raise an informative error for non-2xx responses."""
    if resp.is_success:
        return
    detail = resp.text[:500]
    logger.error("HTTP %s %s: %s", resp.status_code, context, detail)
    resp.raise_for_status()


def _safe_uuid(raw: Any) -> str:
    """Coerce a possibly-UUID value to a plain string."""
    return str(raw)


# ── Comments CRUD ────────────────────────────────────────────────────────────


async def fetch_comments(user_id: Optional[str] = None) -> list[dict]:
    """
    GET /v1/rdb/rest/comments?select=*&order=created_at.desc

    Optionally annotates each row with `liked_by_me` for the given user.
    """
    client = await get_client()
    resp = await client.get(
        "/v1/rdb/rest/comments",
        params={"select": "*", "order": "created_at.desc"},
    )
    _raise_on_error(resp, "fetch_comments")
    rows: list[dict] = resp.json()

    # Annotate liked_by_me
    if user_id and rows:
        comment_ids = [r["id"] for r in rows]
        # Batch-fetch likes for this user across all comments
        id_filter = ",".join(comment_ids)
        like_resp = await client.get(
            "/v1/rdb/rest/likes",
            params={
                "select": "comment_id",
                "comment_id": f"in.({id_filter})",
                "user_id": f"eq.{user_id}",
            },
        )
        _raise_on_error(like_resp, "fetch_comments/likes")
        liked_ids = {item["comment_id"] for item in like_resp.json()}
        for row in rows:
            row["liked_by_me"] = row["id"] in liked_ids
    else:
        for row in rows:
            row["liked_by_me"] = False

    return rows


async def create_comment(comment: dict) -> dict:
    """
    POST /v1/rdb/rest/comments
    Body: full comment JSON dict.
    Returns the inserted row (via Prefer: return=representation).
    """
    client = await get_client()
    resp = await client.post("/v1/rdb/rest/comments", json=comment)
    _raise_on_error(resp, "create_comment")
    rows = resp.json()
    if not rows:
        raise RuntimeError("create_comment: server returned no rows")
    return rows[0]


async def update_comment_position(
    comment_id: str, x: float, y: float
) -> Optional[dict]:
    """
    PATCH /v1/rdb/rest/comments?id=eq.{comment_id}
    Body: { "x": ..., "y": ... }
    """
    client = await get_client()
    resp = await client.patch(
        "/v1/rdb/rest/comments",
        params={"id": f"eq.{comment_id}"},
        json={"x": x, "y": y},
    )
    _raise_on_error(resp, "update_comment_position")
    rows = resp.json()
    return rows[0] if rows else None


async def update_comment_content(
    comment_id: str, content: str, color: str, sentiment: str
) -> Optional[dict]:
    """
    PATCH /v1/rdb/rest/comments?id=eq.{comment_id}
    Body: { "content": ..., "color": ..., "sentiment": ... }
    """
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
    """
    GET /v1/rdb/rest/comments?id=eq.{comment_id}&select=*
    Returns the full comment row so callers can check author_name / user_id.
    """
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
    """
    Toggle a like.  Returns (liked: bool, new_like_count: int).

    Steps:
    1. Check if a like row already exists.
    2. If yes → DELETE it and decrement comment.likes.
    3. If no  → INSERT it and increment comment.likes.
    4. Read back the current like count.
    """
    client = await get_client()

    # 1. Check existing like
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
        # 2a. Remove the like row
        del_resp = await client.delete(
            "/v1/rdb/rest/likes",
            params={"comment_id": f"eq.{comment_id}", "user_id": f"eq.{user_id}"},
        )
        _raise_on_error(del_resp, "like_comment/delete")

        # 2b. Decrement likes (read current, subtract 1, patch)
        comment = await get_comment_owner(comment_id)
        current_likes = max((comment or {}).get("likes", 1) - 1, 0)
        await client.patch(
            "/v1/rdb/rest/comments",
            params={"id": f"eq.{comment_id}"},
            json={"likes": current_likes},
        )
        liked = False
        new_likes = current_likes
    else:
        # 3a. Insert like row
        ins_resp = await client.post(
            "/v1/rdb/rest/likes",
            json={"comment_id": comment_id, "user_id": user_id},
        )
        _raise_on_error(ins_resp, "like_comment/insert")

        # 3b. Increment likes
        comment = await get_comment_owner(comment_id)
        current_likes = (comment or {}).get("likes", 0) + 1
        await client.patch(
            "/v1/rdb/rest/comments",
            params={"id": f"eq.{comment_id}"},
            json={"likes": current_likes},
        )
        liked = True
        new_likes = current_likes

    return liked, new_likes


# ── Users ────────────────────────────────────────────────────────────────────


async def get_user(username: str) -> Optional[dict]:
    """
    GET /v1/rdb/rest/users?username=eq.{username}&select=*
    """
    client = await get_client()
    resp = await client.get(
        "/v1/rdb/rest/users",
        params={"username": f"eq.{username}", "select": "*"},
    )
    _raise_on_error(resp, "get_user")
    rows = resp.json()
    return rows[0] if rows else None


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """
    GET /v1/rdb/rest/users?id=eq.{user_id}&select=*
    """
    client = await get_client()
    resp = await client.get(
        "/v1/rdb/rest/users",
        params={"id": f"eq.{user_id}", "select": "*"},
    )
    _raise_on_error(resp, "get_user_by_id")
    rows = resp.json()
    return rows[0] if rows else None


async def create_user(
    user_id: str,
    username: str,
    password_hash: str,
    avatar: Optional[str] = None,
) -> dict:
    """
    POST /v1/rdb/rest/users
    """
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
