from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Any, List
from uuid import UUID
import uuid
import shutil
import os

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.book import Book, BookStatus
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.book import BookCreate, BookResponse, BookUpdate

router = APIRouter()

@router.post("/upload-cover")
async def upload_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    file_ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{file_ext}"
    filepath = os.path.join("static", "covers", filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"image_url": f"/static/covers/{filename}"}


@router.post("/", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(
    book_in: BookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    db_book = Book(
        **book_in.model_dump(),
        owner_id=current_user.id
    )
    db.add(db_book)
    await db.commit()
    await db.refresh(db_book)
    return db_book

@router.get("/me", response_model=List[BookResponse])
async def get_my_books(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(select(Book).where(Book.owner_id == current_user.id))
    books = result.scalars().all()
    return books

@router.get("/nearby", response_model=List[BookResponse])
async def get_nearby_books(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    radius_km: float = None
) -> Any:
    if current_user.location is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must set your location before discovering nearby books."
        )
        
    radius_meters = (radius_km or settings.SHARING_RADIUS_KM) * 1000.0
    
    # Query: Select books where owner != current_user, status = AVAILABLE,
    # and owner's location is within radius_meters of current_user's location.
    
    # ST_DistanceSphere returns distance in meters
    distance_col = func.ST_DistanceSphere(User.location, current_user.location).label("distance_meters")
    
    already_read_subquery = (
        select(1)
        .where(Transaction.book_id == Book.id)
        .where(Transaction.borrower_id == current_user.id)
        .where(Transaction.status == TransactionStatus.RETURNED)
        .exists()
    )
    already_read_col = already_read_subquery.label("already_read")
    
    query = (
        select(Book, distance_col, already_read_col)
        .join(User, Book.owner_id == User.id)
        .where(Book.status == BookStatus.AVAILABLE)
        .where(User.id != current_user.id)
        .where(User.location.is_not(None))
        .where(func.ST_DWithin(User.location, current_user.location, radius_meters, use_spheroid=True))
        .order_by(distance_col)
    )
    
    result = await db.execute(query)
    
    # Format the result to include distance_meters mapped back into the Pydantic model
    nearby_books = []
    for book, distance, already_read in result.all():
        book_dict = {
            "id": book.id,
            "owner_id": book.owner_id,
            "title": book.title,
            "author": book.author,
            "isbn": book.isbn,
            "genre": book.genre,
            "language": book.language,
            "description": book.description,
            "image_url": book.image_url,
            "condition": book.condition,
            "status": book.status,
            "created_at": book.created_at,
            "distance_meters": round(distance, 1) if distance else None,
            "already_read": already_read
        }
        nearby_books.append(book_dict)
        
    return nearby_books

@router.patch("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: UUID,
    book_update: BookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(select(Book).where(Book.id == book_id, Book.owner_id == current_user.id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found or you don't have permission to edit it")
    
    update_data = book_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(book, field, value)
        
    await db.commit()
    await db.refresh(book)
    return book
