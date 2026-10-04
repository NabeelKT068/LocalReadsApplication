from typing import Optional
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from app.models.transaction import TransactionStatus

class UserBasic(BaseModel):
    id: UUID
    name: str
    model_config = ConfigDict(from_attributes=True)

class BookBasic(BaseModel):
    id: UUID
    title: str
    image_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TransactionBase(BaseModel):
    book_id: UUID
    notes: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: UUID
    borrower_id: UUID
    lender_id: UUID
    status: TransactionStatus
    book: Optional[BookBasic] = None
    borrower: Optional[UserBasic] = None
    lender: Optional[UserBasic] = None
    
    requested_at: datetime
    approved_at: Optional[datetime] = None
    handover_date: Optional[datetime] = None
    expected_return_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    
    late_fee: int
    
    model_config = ConfigDict(from_attributes=True)
