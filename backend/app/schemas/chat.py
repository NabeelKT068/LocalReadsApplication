from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime, date, time
from typing import Optional
from app.models.chat import MeetupStatus

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: UUID
    transaction_id: UUID
    sender_id: UUID
    is_read: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class MeetupBase(BaseModel):
    date: date
    time: time
    location_notes: str

class MeetupCreate(MeetupBase):
    pass

class MeetupResponse(MeetupBase):
    id: UUID
    transaction_id: UUID
    proposed_by_id: UUID
    status: MeetupStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
