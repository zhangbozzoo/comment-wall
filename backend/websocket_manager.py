import asyncio
import json
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_presence: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, user_data: dict):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_presence[user_id] = user_data
        await self.broadcast_presence()

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_presence:
            del self.user_presence[user_id]
        await self.broadcast_presence()

    async def broadcast(self, message: dict):
        dead = []
        for uid, ws in self.active_connections.items():
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.active_connections.pop(uid, None)
            self.user_presence.pop(uid, None)

    async def broadcast_presence(self):
        await self.broadcast({
            "type": "presence:update",
            "payload": {
                "users": list(self.user_presence.values())
            }
        })

    async def send_personal(self, user_id: str, message: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()