from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, books, transactions, chat

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(books.router, prefix="/books", tags=["books"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
