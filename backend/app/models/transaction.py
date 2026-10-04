import uuid
import enum
from sqlalchemy import Column, Integer, DateTime, func, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

class TransactionStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    HANDED_OVER = "HANDED_OVER"
    BORROWED = "BORROWED"
    RETURN_REQUESTED = "RETURN_REQUESTED"
    RETURN_MEETUP = "RETURN_MEETUP"
    RETURNED = "RETURNED"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    borrower_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.REQUESTED)
    notes = Column(Text, nullable=True)
    
    # State Machine Timestamps
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    handover_date = Column(DateTime(timezone=True), nullable=True)
    expected_return_date = Column(DateTime(timezone=True), nullable=True)
    actual_return_date = Column(DateTime(timezone=True), nullable=True)
    
    # Financial tracking (in cents/paise)
    late_fee = Column(Integer, default=0)
    
    book = relationship("Book", backref="transactions")
    borrower = relationship("User", foreign_keys=[borrower_id])
    lender = relationship("User", foreign_keys=[lender_id])
