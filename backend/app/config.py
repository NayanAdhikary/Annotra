from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL:str = "sqlite+aiosqlite:///./annotra.db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_URL: str = "redis://localhost:6379/0"

    class Config:
        env_file = '.env'

settings = Settings()

