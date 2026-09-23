from sqlalchemy import Column, BigInteger, Integer, String, DateTime, Boolean, func
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN     = "admin"
    MANAGER   = "manager"
    ANNOTATOR = "annotator"
    REVIEWER  = "reviewer"
    OBSERVER  = "observer"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    username        = Column(String(100), unique=True, nullable=False, index=True)
    full_name       = Column(String(255))
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(20), default=UserRole.ANNOTATOR.value, nullable=False, index=True)
    is_active       = Column(Boolean, default=True, nullable=False)
    last_login_at   = Column(DateTime(timezone=True))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())