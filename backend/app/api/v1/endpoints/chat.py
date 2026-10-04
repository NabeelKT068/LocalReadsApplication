from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any, List
from uuid import UUID
import json
import asyncio

from app.core.database import get_db, AsyncSessionLocal
from app.api.deps import get_current_user
from app.core.redis import redis_client
from app.models.user import User
from app.models.transaction import Transaction, TransactionStatus
from app.models.chat import Message, Meetup, MeetupStatus
from app.schemas.chat import MessageResponse, MessageCreate, MeetupResponse, MeetupCreate
from jose import jwt
from app.core.config import settings

router = APIRouter()

# Simple Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, transaction_id: str):
        await websocket.accept()
        if transaction_id not in self.active_connections:
            self.active_connections[transaction_id] = []
        self.active_connections[transaction_id].append(websocket)

    def disconnect(self, websocket: WebSocket, transaction_id: str):
        if transaction_id in self.active_connections:
            self.active_connections[transaction_id].remove(websocket)
            if not self.active_connections[transaction_id]:
                del self.active_connections[transaction_id]

    async def broadcast_to_room(self, transaction_id: str, message: dict):
        if transaction_id in self.active_connections:
            for connection in self.active_connections[transaction_id]:
                await connection.send_json(message)

manager = ConnectionManager()

# Redis PubSub listener for horizontal scaling
async def redis_listener():
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe("chat:*")
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                channel = message['channel']
                transaction_id = channel.split(":")[1]
                data = json.loads(message['data'])
                await manager.broadcast_to_room(transaction_id, data)
            await asyncio.sleep(0.01)
    except Exception as e:
        print(f"Redis listener error: {e}")

@router.websocket("/ws/{transaction_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    transaction_id: UUID,
    token: str
):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = UUID(payload.get("sub"))
    except:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
        tx = result.scalars().first()
        
        if not tx or (tx.lender_id != user_id and tx.borrower_id != user_id):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        if tx.status == TransactionStatus.REQUESTED:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect(websocket, str(transaction_id))
    try:
        while True:
            data = await websocket.receive_text()
            
            async with AsyncSessionLocal() as db:
                msg = Message(
                    transaction_id=transaction_id,
                    sender_id=user_id,
                    content=data
                )
                db.add(msg)
                await db.commit()
                await db.refresh(msg)
                
                payload_data = {
                    "id": str(msg.id),
                    "sender_id": str(msg.sender_id),
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat()
                }
                try:
                    await redis_client.publish(f"chat:{transaction_id}", json.dumps(payload_data))
                except Exception:
                    # Fallback if redis is down
                    await manager.broadcast_to_room(str(transaction_id), payload_data)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, str(transaction_id))

@router.get("/{transaction_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    transaction_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    tx = result.scalars().first()
    
    if not tx or (tx.lender_id != current_user.id and tx.borrower_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    messages_result = await db.execute(
        select(Message).where(Message.transaction_id == transaction_id).order_by(Message.created_at.asc())
    )
    return messages_result.scalars().all()

@router.post("/{transaction_id}/meetups", response_model=MeetupResponse)
async def propose_meetup(
    transaction_id: UUID,
    meetup_in: MeetupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    tx = result.scalars().first()
    
    if not tx or (tx.lender_id != current_user.id and tx.borrower_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    meetup = Meetup(
        **meetup_in.model_dump(),
        transaction_id=transaction_id,
        proposed_by_id=current_user.id
    )
    db.add(meetup)
    await db.commit()
    await db.refresh(meetup)
    return meetup
