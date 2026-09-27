from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
import re

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
VALID_INPUT_TYPES = {"select", "radio", "checkbox", "text", "number"}


class AttributeDef(BaseModel):
    name: str = Field(min_length=1, max_length=50, pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$")
    input_type: str
    values: Optional[List[str]] = None          # only for select / radio
    default: Any = None
    required: bool = False

    @field_validator("input_type")
    @classmethod
    def check_type(cls, v):
        if v not in VALID_INPUT_TYPES:
            raise ValueError(f"input_type must be one of {VALID_INPUT_TYPES}")
        return v

    @field_validator("values")
    @classmethod
    def check_values(cls, v, info):
        itype = info.data.get("input_type")
        if itype in ("select", "radio"):
            if not v:
                raise ValueError(f"input_type '{itype}' requires values")
        return v


class LabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = "#FF0000"
    attributes: List[AttributeDef] = Field(default_factory=list)

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        if not HEX_RE.match(v):
            raise ValueError("color must be #RRGGBB")
        return v.upper()


class LabelUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = None
    attributes: Optional[List[AttributeDef]] = None

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
    attributes: List[dict] = []

    class Config:
        from_attributes = True