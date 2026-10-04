from sqlalchemy import null
from sqlalchemy import Column, String, DateTime, ForeignKey, func, Text
from app.core.database import Base

class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String(100), primary_key = True)
    value = Column(Text, nullable=False) #JSON String
    category = Column(String(50), nullable=False, index=True)
    description = Column(String(500))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column("updated_by", __import__("sqlalchemy").BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)