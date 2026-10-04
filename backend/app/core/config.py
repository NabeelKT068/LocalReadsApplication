from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Neighbourhood Book-Sharing Platform"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/book_sharing_db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Business Rules
    SHARING_RADIUS_KM: float = 2.0
    DEFAULT_BORROWING_PERIOD_DAYS: int = 14
    LATE_FEE_PER_DAY: int = 1
    CURRENCY: str = "INR"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
