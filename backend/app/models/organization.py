from sqlalchemy import Column, BigInteger, String, DateTime, func
from app.core.database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(BigInteger, primary_key=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
