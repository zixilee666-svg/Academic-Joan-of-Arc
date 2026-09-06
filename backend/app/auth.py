"""
Academic Joan of Arc — 认证模块
JWT认证 + 本地用户管理（SQLite）
"""

import os
import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Optional

from config import DB_PATH, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from loguru import logger

router = APIRouter(prefix="/api/auth", tags=["认证"])
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """带随机盐的 SHA-256 密码哈希，格式: salt$hash"""
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}${h}"


def verify_password(password: str, stored: str) -> bool:
    """验证密码（兼容旧无盐格式与新 salt$hash 格式）"""
    if "$" in stored:
        salt, expected = stored.split("$", 1)
        return hashlib.sha256((salt + password).encode("utf-8")).hexdigest() == expected
    # 旧格式：纯 SHA-256（向后兼容已有用户）
    return hashlib.sha256(password.encode("utf-8")).hexdigest() == stored


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Pydantic Models ───

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str = ""


class TokenResponse(BaseModel):
    token: str
    user: dict


# ─── Helper Functions ───

def create_token(user_id: int, username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    """验证JWT token，返回用户信息或None"""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "id": int(payload["sub"]),
            "username": payload["username"],
            "role": payload.get("role", "user"),
        }
    except JWTError:
        return None


def require_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    """强制要求认证"""
    user = verify_token(credentials)
    if user is None:
        raise HTTPException(status_code=401, detail="未认证或token已过期")
    return user


# ─── Routes ───

@router.post("/login")
async def login(request: LoginRequest):
    """用户登录"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE username = ?", (request.username,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(user["id"], user["username"], "admin" if user["id"] == 1 else "user")

    return {
        "token": token,
        "user": {
            "id": str(user["id"]),
            "username": user["username"],
            "name": user["username"],
            "role": "admin" if user["id"] == 1 else "user",
            "avatar": "",
            "createdAt": user["created_at"],
        },
    }


@router.post("/register")
async def register(request: RegisterRequest):
    """用户注册"""
    conn = get_db()
    cursor = conn.cursor()

    # 检查用户名是否已存在
    cursor.execute("SELECT id FROM users WHERE username = ?", (request.username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="用户名已存在")

    password_hash = hash_password(request.password)
    cursor.execute(
        "INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
        (request.username, password_hash, ""),
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    token = create_token(user_id, request.username, "user")

    return {
        "token": token,
        "user": {
            "id": str(user_id),
            "username": request.username,
            "name": request.name or request.username,
            "role": "user",
            "avatar": "",
            "createdAt": datetime.now().isoformat(),
        },
    }


@router.get("/me")
async def get_me(user: dict = Depends(require_auth)):
    """获取当前用户信息"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    return {
        "id": str(row["id"]),
        "username": row["username"],
        "name": row["username"],
        "role": "admin" if row["id"] == 1 else "user",
        "avatar": row["avatar"] or "",
        "research_field": row["research_field"] or "",
        "createdAt": row["created_at"],
    }


def init_default_users():
    """初始化默认用户（首次启动时调用）"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]

    if count == 0:
        # 创建默认管理员
        admin_hash = hash_password("admin123")
        cursor.execute(
            "INSERT INTO users (username, password_hash, email, research_field) VALUES (?, ?, ?, ?)",
            ("admin", admin_hash, "admin@ajoa.local", "天文物理"),
        )
        # 创建默认研究员
        researcher_hash = hash_password("researcher123")
        cursor.execute(
            "INSERT INTO users (username, password_hash, email, research_field) VALUES (?, ?, ?, ?)",
            ("researcher", researcher_hash, "researcher@ajoa.local", "天文物理"),
        )
        conn.commit()
        logger.info("✅ 默认用户已创建: admin/admin123, researcher/researcher123")

    conn.close()
