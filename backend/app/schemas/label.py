from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


class LabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = "#FF0000"
    attributes: list = Field(default_factory=list)  # reserved for Day 11+

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        if not HEX_RE.match(v):
            raise ValueError("color must be #RRGGBB")
        return v.upper()


class LabelUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        if v is None:
            return v
        if not HEX_RE.match(v):
            raise ValueError("color must be #RRGGBB")
        return v.upper()


class LabelResponse(BaseModel):
    id: int
    task_id: int
    name: str
    color: str

    class Config:
        from_attributes = True