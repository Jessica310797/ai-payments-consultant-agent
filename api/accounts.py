"""Merchant accounts for PayNavigate: invite-only sign-up, email + password login, revocable sessions.

How it fits together:
  - You (the admin) create a merchant and an invite code with the /v1/admin routes (X-Admin-Key header).
  - The merchant enters the code in the app with their email and a password -> an account linked to that merchant.
  - Logging in returns a random session token; the app sends it as "Authorization: Bearer <token>".
    Only a SHA-256 of each token is stored, so a database leak doesn't expose usable sessions.
  - Passwords are hashed with scrypt (Python standard library), with a random salt per password.

Environment:
  DATABASE_URL   Postgres connection string (Railway's Postgres plugin sets it). Without it a local SQLite file is used,
                 which is fine for development but is wiped on every Railway deploy.
  ADMIN_KEY      long random string; required to use the /v1/admin routes. Unset = admin routes disabled.
"""
import base64
import hashlib
import hmac
import os
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import (Column, DateTime, ForeignKey, Integer, MetaData, String, Table, create_engine, delete, func,
                        insert, select, update)

SESSION_DAYS = 30
INVITE_DAYS = 14
MIN_PASSWORD = 10

# ---------- database ----------

metadata = MetaData()
merchants = Table(
    "merchants", metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(200), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
users = Table(
    "users", metadata,
    Column("id", Integer, primary_key=True),
    Column("email", String(320), nullable=False, unique=True),
    Column("password_hash", String(300), nullable=False),
    Column("merchant_id", Integer, ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("last_login_at", DateTime(timezone=True)),
)
invites = Table(
    "invites", metadata,
    Column("id", Integer, primary_key=True),
    Column("code_hash", String(64), nullable=False, unique=True),
    Column("merchant_id", Integer, ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False),
    Column("email", String(320)),  # when set, only this email can use the code
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("used_at", DateTime(timezone=True)),
)
sessions = Table(
    "sessions", metadata,
    Column("id", Integer, primary_key=True),
    Column("token_hash", String(64), nullable=False, unique=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
)

_engine = None


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "sqlite:///./paynavigate.db")
    # Railway and Heroku style URLs -> the psycopg 3 driver
    return re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", url)


def engine():
    global _engine
    if _engine is None:
        url = _database_url()
        _engine = create_engine(url, pool_pre_ping=True, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
        metadata.create_all(_engine)
    return _engine


def reset_engine():
    """Tests: forget the engine so the next call reads DATABASE_URL again."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = None


def now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(d: datetime | None) -> datetime | None:
    # SQLite returns naive datetimes; everything is stored in UTC
    return d.replace(tzinfo=timezone.utc) if d is not None and d.tzinfo is None else d

# ---------- passwords, tokens, codes ----------

_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return "scrypt${n}${r}${p}${salt}${digest}".format(
        **_SCRYPT, salt=base64.b64encode(salt).decode(), digest=base64.b64encode(digest).decode())


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, digest = stored.split("$")
        got = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(got, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


# Checked against a fixed hash when the email doesn't exist, so login takes the same time either way
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I


def new_invite_code() -> str:
    raw = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(10))
    return f"{raw[:5]}-{raw[5:]}"


def normalise_code(code: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", code.upper())


def normalise_email(email: str) -> str:
    return email.strip().lower()


_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def check_new_credentials(email: str, password: str):
    if not _EMAIL.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if len(password) < MIN_PASSWORD:
        raise HTTPException(422, f"Use a password of at least {MIN_PASSWORD} characters.")
    if len(password) > 200:
        raise HTTPException(422, "That password is too long.")

# ---------- throttling ----------

_failures: dict[str, deque] = defaultdict(deque)
MAX_FAILURES, WINDOW = 8, 15 * 60


def _throttle(key: str):
    q, t = _failures[key], time.time()
    while q and t - q[0] > WINDOW:
        q.popleft()
    if len(q) >= MAX_FAILURES:
        raise HTTPException(429, "Too many attempts. Wait 15 minutes and try again.")


def _fail(key: str):
    _failures[key].append(time.time())


def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"

# ---------- sessions ----------


def _start_session(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(insert(sessions).values(token_hash=sha256(token), user_id=user_id, created_at=now(),
                                         expires_at=now() + timedelta(days=SESSION_DAYS)))
    return token


def _profile(conn, user_id: int) -> dict:
    row = conn.execute(
        select(users.c.id, users.c.email, merchants.c.id.label("merchant_id"), merchants.c.name)
        .join(merchants, merchants.c.id == users.c.merchant_id).where(users.c.id == user_id)).one()
    return {"email": row.email, "merchant": {"id": row.merchant_id, "name": row.name}}


class CurrentUser(BaseModel):
    id: int
    email: str
    merchant_id: int
    token_hash: str


def current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    """Dependency: the signed-in user, from 'Authorization: Bearer <token>'."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in.")
    token_hash = sha256(authorization[7:].strip())
    with engine().begin() as conn:
        row = conn.execute(
            select(users.c.id, users.c.email, users.c.merchant_id, sessions.c.expires_at)
            .join(sessions, sessions.c.user_id == users.c.id).where(sessions.c.token_hash == token_hash)).first()
        if row is None or _aware(row.expires_at) < now():
            if row is not None:
                conn.execute(delete(sessions).where(sessions.c.token_hash == token_hash))
            raise HTTPException(401, "Your session has ended. Please log in again.")
    return CurrentUser(id=row.id, email=row.email, merchant_id=row.merchant_id, token_hash=token_hash)

# ---------- routes ----------

router = APIRouter()


class LoginBody(BaseModel):
    email: str
    password: str


class InviteBody(BaseModel):
    code: str
    email: str
    password: str


class PasswordBody(BaseModel):
    password: str


@router.post("/v1/auth/login")
def login(body: LoginBody, request: Request):
    email = normalise_email(body.email)
    for key in (f"email:{email}", f"ip:{_client(request)}"):
        _throttle(key)
    with engine().begin() as conn:
        row = conn.execute(select(users.c.id, users.c.password_hash).where(users.c.email == email)).first()
        ok = verify_password(body.password, row.password_hash if row else _DUMMY_HASH) and row is not None
        if not ok:
            _fail(f"email:{email}")
            _fail(f"ip:{_client(request)}")
            raise HTTPException(401, "That email and password don't match an account.")
        conn.execute(update(users).where(users.c.id == row.id).values(last_login_at=now()))
        return {"token": _start_session(conn, row.id), **_profile(conn, row.id)}


@router.post("/v1/auth/invite")
def accept_invite(body: InviteBody, request: Request):
    """Create an account from an invite code."""
    key = f"ip:{_client(request)}"
    _throttle(key)
    email = normalise_email(body.email)
    check_new_credentials(email, body.password)
    with engine().begin() as conn:
        inv = conn.execute(select(invites).where(invites.c.code_hash == sha256(normalise_code(body.code)))).first()
        if inv is None or inv.used_at is not None or _aware(inv.expires_at) < now():
            _fail(key)
            raise HTTPException(400, "That invite code isn't valid. It may have been used already or expired - ask for a new one.")
        if inv.email and inv.email != email:
            _fail(key)
            raise HTTPException(400, "This invite is for a different email address.")
        if conn.execute(select(users.c.id).where(users.c.email == email)).first():
            raise HTTPException(409, "There's already an account with that email. Log in instead.")
        user_id = conn.execute(insert(users).values(email=email, password_hash=hash_password(body.password),
                                                    merchant_id=inv.merchant_id, created_at=now(), last_login_at=now())).inserted_primary_key[0]
        conn.execute(update(invites).where(invites.c.id == inv.id).values(used_at=now()))
        return {"token": _start_session(conn, user_id), **_profile(conn, user_id)}


@router.get("/v1/auth/me")
def me(user: CurrentUser = Depends(current_user)):
    with engine().begin() as conn:
        return _profile(conn, user.id)


@router.post("/v1/auth/logout")
def logout(user: CurrentUser = Depends(current_user)):
    with engine().begin() as conn:
        conn.execute(delete(sessions).where(sessions.c.token_hash == user.token_hash))
    return {"ok": True}


@router.post("/v1/auth/delete-account")
def delete_account(body: PasswordBody, user: CurrentUser = Depends(current_user)):
    """Permanently deletes the signed-in user's account and sessions (the merchant record stays for other users)."""
    with engine().begin() as conn:
        stored = conn.execute(select(users.c.password_hash).where(users.c.id == user.id)).scalar_one()
        if not verify_password(body.password, stored):
            raise HTTPException(401, "That password isn't right.")
        conn.execute(delete(sessions).where(sessions.c.user_id == user.id))
        conn.execute(delete(users).where(users.c.id == user.id))
    return {"ok": True}

# ---------- admin: merchants and invites ----------


def require_admin(x_admin_key: str | None = Header(default=None)):
    expected = os.environ.get("ADMIN_KEY")
    if not expected:
        raise HTTPException(403, "Admin routes are switched off. Set ADMIN_KEY on the server to use them.")
    if not hmac.compare_digest(x_admin_key or "", expected):
        raise HTTPException(401, "Wrong admin key.")


class MerchantBody(BaseModel):
    name: str


class NewInviteBody(BaseModel):
    merchant_id: int
    email: str | None = None


@router.post("/v1/admin/merchants", dependencies=[Depends(require_admin)])
def create_merchant(body: MerchantBody):
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Give the merchant a name.")
    with engine().begin() as conn:
        mid = conn.execute(insert(merchants).values(name=name, created_at=now())).inserted_primary_key[0]
    return {"id": mid, "name": name}


@router.get("/v1/admin/merchants", dependencies=[Depends(require_admin)])
def list_merchants():
    with engine().begin() as conn:
        rows = conn.execute(
            select(merchants.c.id, merchants.c.name, func.count(users.c.id).label("users"))
            .outerjoin(users, users.c.merchant_id == merchants.c.id).group_by(merchants.c.id, merchants.c.name)
            .order_by(merchants.c.id)).all()
    return [{"id": r.id, "name": r.name, "users": r.users} for r in rows]


@router.post("/v1/admin/invites", dependencies=[Depends(require_admin)])
def create_invite(body: NewInviteBody):
    """Returns the invite code once; only its hash is stored."""
    email = normalise_email(body.email) if body.email else None
    if email and not _EMAIL.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    code = new_invite_code()
    expires = now() + timedelta(days=INVITE_DAYS)
    with engine().begin() as conn:
        if not conn.execute(select(merchants.c.id).where(merchants.c.id == body.merchant_id)).first():
            raise HTTPException(404, "No merchant with that id.")
        conn.execute(insert(invites).values(code_hash=sha256(normalise_code(code)), merchant_id=body.merchant_id,
                                            email=email, created_at=now(), expires_at=expires))
    return {"code": code, "merchant_id": body.merchant_id, "email": email, "expires_at": expires.isoformat()}


class RemoveUserBody(BaseModel):
    email: str


@router.post("/v1/admin/remove-user", dependencies=[Depends(require_admin)])
def remove_user(body: RemoveUserBody):
    """Removes a login (e.g. a forgotten password): send that person a new invite afterwards."""
    email = normalise_email(body.email)
    with engine().begin() as conn:
        uid = conn.execute(select(users.c.id).where(users.c.email == email)).scalar()
        if uid is None:
            raise HTTPException(404, "No account with that email.")
        conn.execute(delete(sessions).where(sessions.c.user_id == uid))
        conn.execute(delete(users).where(users.c.id == uid))
    return {"ok": True, "removed": email}
