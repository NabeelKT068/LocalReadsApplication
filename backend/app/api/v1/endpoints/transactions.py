from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from typing import Any, List
from uuid import UUID
from datetime import datetime, timedelta

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.book import Book, BookStatus
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.transaction import TransactionCreate, TransactionResponse

router = APIRouter()

@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    tx_in: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Validate book
    result = await db.execute(select(Book).where(Book.id == tx_in.book_id))
    book = result.scalars().first()
    
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot borrow your own book")
    if book.status != BookStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail="Book is not available")
        
    # Create transaction
    tx = Transaction(
        book_id=book.id,
        borrower_id=current_user.id,
        lender_id=book.owner_id,
        notes=tx_in.notes,
        status=TransactionStatus.REQUESTED
    )
    
    db.add(tx)
    await db.commit()
    
    query = select(Transaction).options(
        selectinload(Transaction.book),
        selectinload(Transaction.borrower),
        selectinload(Transaction.lender)
    ).where(Transaction.id == tx.id)
    result = await db.execute(query)
    return result.scalars().first()

@router.get("/", response_model=List[TransactionResponse])
async def get_my_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = select(Transaction).where(
        or_(
            Transaction.borrower_id == current_user.id,
            Transaction.lender_id == current_user.id
        )
    ).options(
        selectinload(Transaction.book),
        selectinload(Transaction.borrower),
        selectinload(Transaction.lender)
    ).order_by(Transaction.requested_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{id}/approve", response_model=TransactionResponse)
async def approve_request(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = select(Transaction).options(
        selectinload(Transaction.book),
        selectinload(Transaction.borrower),
        selectinload(Transaction.lender)
    ).where(Transaction.id == id)
    result = await db.execute(query)
    tx = result.scalars().first()
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.lender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if tx.status != TransactionStatus.REQUESTED:
        raise HTTPException(status_code=400, detail="Transaction is not in REQUESTED state")
        
    tx.status = TransactionStatus.APPROVED
    tx.approved_at = datetime.utcnow()
    
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx

@router.patch("/{id}/reject", response_model=TransactionResponse)
async def reject_request(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = select(Transaction).options(
        selectinload(Transaction.book),
        selectinload(Transaction.borrower),
        selectinload(Transaction.lender)
    ).where(Transaction.id == id)
    result = await db.execute(query)
    tx = result.scalars().first()
    
    if not tx or tx.lender_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found or not authorized")
    if tx.status != TransactionStatus.REQUESTED:
        raise HTTPException(status_code=400, detail="Invalid state transition")
        
    tx.status = TransactionStatus.REJECTED
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx

@router.patch("/{id}/handover", response_model=TransactionResponse)
async def confirm_handover(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = select(Transaction).options(
        selectinload(Transaction.book),
        selectinload(Transaction.borrower),
        selectinload(Transaction.lender)
    ).where(Transaction.id == id)
    result = await db.execute(query)
    tx = result.scalars().first()
    
    if not tx or (tx.lender_id != current_user.id and tx.borrower_id != current_user.id):
        raise HTTPException(status_code=404, detail="Not found or not authorized")
    
    # State machine check
    if tx.status != TransactionStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Transaction must be APPROVED to handover")
        
    # Lock the book globally
    book_result = await db.execute(select(Book).where(Book.id == tx.book_id))
    book = book_result.scalars().first()
    book.status = BookStatus.BORROWED
        
    tx.status = TransactionStatus.HANDED_OVER
    tx.handover_date = datetime.utcnow()
    tx.expected_return_date = tx.handover_date + timedelta(days=settings.DEFAULT_BORROWING_PERIOD_DAYS)
    
    # After Handover, automatically transitions to BORROWED for logic
    tx.status = TransactionStatus.BORROWED
    
    db.add(book)
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx

@router.patch("/{id}/confirm-return", response_model=TransactionResponse)
async def confirm_return(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = select(Transaction).options(
        selectinload(Transaction.book),
        selectinload(Transaction.borrower),
        selectinload(Transaction.lender)
    ).where(Transaction.id == id)
    result = await db.execute(query)
    tx = result.scalars().first()
    
    # Only lender can confirm final return
    if not tx or tx.lender_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found or not authorized")
    if tx.status not in [TransactionStatus.BORROWED, TransactionStatus.RETURN_REQUESTED, TransactionStatus.RETURN_MEETUP]:
        raise HTTPException(status_code=400, detail="Invalid state transition")
        
    tx.status = TransactionStatus.RETURNED
    tx.actual_return_date = datetime.utcnow()
    
    # Check late fee
    expected_naive = tx.expected_return_date.replace(tzinfo=None) if tx.expected_return_date else None
    if expected_naive and tx.actual_return_date > expected_naive:
        delta = tx.actual_return_date - expected_naive
        tx.late_fee = delta.days * settings.LATE_FEE_PER_DAY
    
    book_result = await db.execute(select(Book).where(Book.id == tx.book_id))
    book = book_result.scalars().first()
    book.status = BookStatus.AVAILABLE
    
    db.add(book)
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx
