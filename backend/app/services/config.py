import json
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.system_config import SystemConfig


# Every config key the app knows about. Adding a key here is how you make it
# editable in the admin UI without touching the frontend.
DEFAULTS: dict[str, dict] = {
    "auth.password_min_length": {
        "value": 8,
        "category": "auth",
        "description": "Minimum password length",
    },
    "auth.password_require_digit": {
        "value": True,
        "category": "auth",
        "description": "Require at least one digit",
    },
    "auth.password_require_letter": {
        "value": True,
        "category": "auth",
        "description": "Require at least one letter",
    },
    "auth.access_token_minutes": {
        "value": 15,
        "category": "auth",
        "description": "Access token lifetime (minutes)",
    },
    "auth.refresh_token_days": {
        "value": 7,
        "category": "auth",
        "description": "Refresh token lifetime (days)",
    },
    "upload.max_file_size_mb": {
        "value": 25,
        "category": "upload",
        "description": "Max image upload size (MB)",
    },
    "upload.allowed_extensions": {
        "value": [".jpg", ".jpeg", ".png", ".bmp", ".webp"],
        "category": "upload",
        "description": "Allowed image extensions",
    },
    "features.auto_annotation": {
        "value": False,
        "category": "features",
        "description": "Enable auto-annotation with ML models",
    },
    "features.video_annotation": {
        "value": True,
        "category": "features",
        "description": "Enable video annotation",
    },
    "features.review_workflow": {
        "value": True,
        "category": "features",
        "description": "Enable review/QC workflow",
    },
    "features.registration_open": {
        "value": True,
        "category": "features",
        "description": "Allow new user self-registration",
    },
}


async def get_all_config(db: AsyncSession) -> dict[str, Any]:
    """Merge DEFAULTS with DB overrides."""
    rows = (await db.execute(select(SystemConfig))).scalars().all()
    overrides = {r.key: json.loads(r.value) for r in rows}
    result = {}
    for key, spec in DEFAULTS.items():
        result[key] = {
            **spec,
            "value": overrides.get(key, spec["value"]),
            "is_overridden": key in overrides,
        }
    return result


async def get_value(db: AsyncSession, key: str, default: Any = None) -> Any:
    row = (await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )).scalar_one_or_none()
    if row:
        return json.loads(row.value)
    spec = DEFAULTS.get(key)
    return spec["value"] if spec else default


async def set_value(
    db: AsyncSession, key: str, value: Any, user_id: int
) -> None:
    if key not in DEFAULTS:
        raise ValueError(f"Unknown config key: {key}")
    row = (await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )).scalar_one_or_none()
    if row:
        row.value = json.dumps(value)
        row.updated_by = user_id
    else:
        db.add(SystemConfig(
            key=key,
            value=json.dumps(value),
            category=DEFAULTS[key]["category"],
            description=DEFAULTS[key]["description"],
            updated_by=user_id,
        ))