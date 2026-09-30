from sqlalchemy import Column, BigInteger, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    prefix = Column(String(20), nullable=False, index=True) #first 8 chars for display
    key_hash = Column(String(128), unique=True, nullable=False, index=True)
    last_used_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    revoked_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())