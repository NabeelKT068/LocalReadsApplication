from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.location import LocationUpdate
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def read_user_me(
    current_user: User = Depends(get_current_user)
) -> Any:
    return current_user

@router.patch("/me", response_model=UserResponse)
async def update_user_me(
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if user_in.name is not None:
        current_user.name = user_in.name
    if user_in.email is not None:
        current_user.email = user_in.email
    if user_in.phone is not None:
        current_user.phone = user_in.phone
    if user_in.avatar_url is not None:
        current_user.avatar_url = user_in.avatar_url
        
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.patch("/me/location", response_model=dict)
async def update_user_location(
    location_in: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Convert lat/lng to PostGIS Point (SRID=4326)
    # Note: Shapely Point takes (longitude, latitude)
    point = Point(location_in.longitude, location_in.latitude)
    
    current_user.location = from_shape(point, srid=4326)
    db.add(current_user)
    await db.commit()
    
    return {"status": "success", "message": "Location updated successfully"}
