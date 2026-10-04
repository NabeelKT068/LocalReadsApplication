from app.models.base import Base
from app.models.user import User
from app.models.book import Book
from app.models.transaction import Transaction
from app.models.chat import Message, Meetup

# Make Alembic aware of these models
__all__ = ["Base", "User", "Book", "Transaction", "Message", "Meetup"]
