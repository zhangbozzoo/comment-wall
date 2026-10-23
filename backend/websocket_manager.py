import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # 存储：user_id -> 多个 WebSocket 连接
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # 存储：user_id -> 用户信息
        self.user_presence: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, user_data: dict):
        # ⚠️ 注意：这里绝对不要写 await websocket.accept()，因为 main.py 已经写过了
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
        self.user_presence[user_id] = user_data
        await self.broadcast_presence()

    async def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            
            # 只有当这个用户的所有网页都关闭了，才把他从在线列表移除
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]
                if user_id in self.user_presence:
                    del self.user_presence[user_id]
                
        await self.broadcast_presence()

    async def broadcast(self, message: dict):
        for uid, ws_list in list(self.active_connections.items()):
            for ws in ws_list:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    async def broadcast_presence(self):
        await self.broadcast({
            "type": "presence:update",
            "payload": {
                "users": list(self.user_presence.values())
            }
        })

manager = ConnectionManager()
