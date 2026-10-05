import os
import sys
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL:str = "sqlite+aiosqlite:///./annotra.db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_URL: str = "redis://localhost:6379/0"
    DATA_DIR: str = os.environ.get("DATA_DIR", "/data" if sys.platform != "win32" else os.path.join(os.getcwd(), "data"))

    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    STORAGE_BACKEND: str = "local"
    S3_ENDPOINT: str = ""
    S3_BUCKET: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "auto"
    S3_PUBLIC_URL: str = ""
    ENVIRONMENT: str = "production"
    RELEASE: str = "dev"
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"
    
    # Frontend / OAuth (used later)
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = '.env'

settings = Settings()

import time
START_TIME = time.time()

