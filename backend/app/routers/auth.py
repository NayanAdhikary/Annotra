from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit
from app.core.security import (
    hash_password, verify_password, create_access_token,
    generate_refresh_token, hash_refresh_token,
)
from passlib.handlers.bcrypt import bcrypt as passlib_bcrypt
from app.config import settings
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    RegisterRequest, LoginRequest, RefreshRequest, ChangePasswordRequest,
    TokenPair, UserResponse,
)
from app.services.config import get_value

router = APIRouter()

async def _validate_password(db: AsyncSession, password: str) -> None:
    min_length = await get_value(db, "auth.password_min_length", 8)
    require_digit = await get_value(db, "auth.password_require_digit", True)
    require_letter = await get_value(db, "auth.password_require_letter", True)

    errors = []
    if len(password) < min_length:
        errors.append(f"Password must be at least {min_length} characters")
    if require_digit and not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one digit")
    if require_letter and not any(c.isalpha() for c in password):
        errors.append("Password must contain at least one letter")
    if errors:
        raise HTTPException(422, "; ".join(errors))


def _to_response(u: User) -> UserResponse:
    return UserResponse(
        id=u.id, email=u.email, username=u.username, full_name=u.full_name,
        role=u.role, is_active=u.is_active,
        created_at=u.created_at.isoformat() if u.created_at else "",
    )


async def _issue_token_pair(db: AsyncSession, user: User, request: Request) -> TokenPair:
    access = create_access_token(user.id, user.role)
    raw_refresh, refresh_hash, expires_at = generate_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=expires_at,
        user_agent=(request.headers.get("user-agent") or "")[:500],
        ip_address=request.client.host if request.client else None,
    ))
    await db.commit()
    return TokenPair(
        access_token=access,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request,
                   db: AsyncSession = Depends(get_db)):
    registration_open = await get_value(db, "features.registration_open", True)
    if not registration_open:
        raise HTTPException(403, "Self-registration is disabled")

    await rate_limit(request, key=f"register:{request.client.host}", limit=10, window=3600)
    await _validate_password(db, payload.password)

    existing = (await db.execute(
        select(User).where((User.email == payload.email) | (User.username == payload.username))
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already taken")

    any_user = (await db.execute(select(User.id).limit(1))).first()
    role = UserRole.ADMIN.value if any_user is None else UserRole.ANNOTATOR.value

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _issue_token_pair(db, user, request)


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, request: Request,
                db: AsyncSession = Depends(get_db)):
    await rate_limit(request, key=f"login:email:{payload.email}", limit=5, window=300)
    await rate_limit(request, key=f"login:ip:{request.client.host}", limit=20, window=300)

    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()

    if user is None:
        verify_password(payload.password, "$2b$12$" + "x" * 53)  # timing-safe
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    # Silently repair incorrectly-padded bcrypt hashes in the DB
    try:
        normalized = passlib_bcrypt.normhash(user.hashed_password)
        if normalized != user.hashed_password:
            user.hashed_password = hash_password(payload.password)
    except Exception:
        pass

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return await _issue_token_pair(db, user, request)


@router.post("/refresh", response_model=TokenPair)
async def refresh_tokens(payload: RefreshRequest, request: Request,
                         db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(payload.refresh_token)
    rt = (await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )).scalar_one_or_none()

    if rt is None or rt.revoked_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
        
    expires = rt.expires_at.replace(tzinfo=timezone.utc) if rt.expires_at.tzinfo is None else rt.expires_at
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    user = await db.get(User, rt.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User disabled")

    rt.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return await _issue_token_pair(db, user, request)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(payload.refresh_token)
    rt = (await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )).scalar_one_or_none()
    if rt and rt.revoked_at is None:
        rt.revoked_at = datetime.now(timezone.utc)
        await db.commit()


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return _to_response(user)


from datetime import timedelta
from app.models.annotation import Annotation
from sqlalchemy import func

@router.get("/me/stats")
async def my_stats(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    total = (await db.execute(
        select(func.count()).select_from(Annotation).where(Annotation.created_by == user.id)
    )).scalar_one()
    accepted = (await db.execute(
        select(func.count()).select_from(Annotation)
        .where(Annotation.created_by == user.id, Annotation.review_status == "accepted")
    )).scalar_one()
    rejected = (await db.execute(
        select(func.count()).select_from(Annotation)
        .where(Annotation.created_by == user.id, Annotation.review_status == "rejected")
    )).scalar_one()
    denom = accepted + rejected
    rate = (accepted / denom) if denom else 0.0

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_count = (await db.execute(
        select(func.count()).select_from(Annotation)
        .where(Annotation.created_by == user.id, Annotation.created_at >= week_ago)
    )).scalar_one()

    return {
        "total_annotated": total,
        "total_accepted": accepted,
        "total_rejected": rejected,
        "acceptance_rate": round(rate, 4),
        "tasks_completed": 0,
        "avg_per_day_7d": round(week_count / 7.0, 1),
    }


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.old_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Old password is incorrect")

    await _validate_password(db, payload.new_password)

    user.hashed_password = hash_password(payload.new_password)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


# ---------- Admin ----------

@router.get("/users", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db),
                     user: User = Depends(get_current_user)):
    if user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    rows = (await db.execute(select(User).order_by(User.id))).scalars().all()
    return [_to_response(u) for u in rows]


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def set_role(user_id: int, role: UserRole,
                   db: AsyncSession = Depends(get_db),
                   admin: User = Depends(get_current_user)):
    if admin.role != UserRole.ADMIN.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot change your own role")
    target.role = role.value
    await db.commit()
    await db.refresh(target)
    return _to_response(target)
