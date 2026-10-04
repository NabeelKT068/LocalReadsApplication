from typing import Optional
from pydantic import BaseModel, ConfigDict
from enum import Enum
from uuid import UUID
from datetime import datetime

class BookStatusEnum(str, Enum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    BORROWED = "BORROWED"

class BookConditionEnum(str, Enum):
    NEW = "NEW"
    LIKE_NEW = "LIKE_NEW"
    GOOD = "GOOD"
    ACCEPTABLE = "ACCEPTABLE"

class BookBase(BaseModel):
    title: str
    author: str
    isbn: Optional[str] = None
    genre: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    condition: BookConditionEnum = BookConditionEnum.GOOD

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[BookStatusEnum] = None
    condition: Optional[BookConditionEnum] = None

class BookResponse(BookBase):
    id: UUID
    owner_id: UUID
    status: BookStatusEnum
    created_at: datetime
    
    # Optional field to show distance when querying nearby books
    distance_meters: Optional[float] = None
    already_read: Optional[bool] = False
    
    model_config = ConfigDict(from_attributes=True)
