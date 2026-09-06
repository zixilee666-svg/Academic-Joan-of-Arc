"""
Academic Joan of Arc — 集中配置模块
=====================================
统一管理 .env 加载、DB 路径解析、JWT 配置，消除各模块间的重复逻辑。

所有其他模块应通过 ``from config import ...`` 获取共享配置，
而不是各自重复解析路径或加载环境变量。
"""

import os
import warnings
from pathlib import Path

# ─── .env 加载（全局唯一入口）───
try:
    from dotenv import load_dotenv

    _THIS_DIR = os.path.dirname(os.path.abspath(__file__))
    for _cand in [
        os.path.join(_THIS_DIR, "..", ".env"),          # backend/.env
        os.path.join(_THIS_DIR, "..", "..", ".env"),    # 项目根/.env
        ".env",
    ]:
        if os.path.exists(_cand):
            load_dotenv(_cand, override=False)
            break
except ImportError:
    pass  # python-dotenv 未安装时依赖外部环境变量


# ─── 项目根目录 ───
PROJECT_ROOT: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


# ─── 数据库路径（兼容本地开发与 Docker）───
def _resolve_db_path() -> str:
    db_url = os.getenv("DATABASE_URL", "").replace("sqlite:///", "")
    if db_url and os.path.isabs(db_url):
        return db_url
    if db_url:
        data_dir = os.path.dirname(db_url)
        if data_dir and os.path.isdir(os.path.join(PROJECT_ROOT, data_dir)):
            return os.path.join(PROJECT_ROOT, db_url)
        return db_url
    return os.path.join(PROJECT_ROOT, "data", "ai_scientist.db")


DB_PATH: str = _resolve_db_path()


# ─── JWT 配置 ───
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_HOURS: int = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

_jwt_env = os.getenv("JWT_SECRET")
if _jwt_env:
    JWT_SECRET: str = _jwt_env
else:
    JWT_SECRET = "ajoa-secret-key-2026"  # 仅开发环境回退
    warnings.warn(
        "JWT_SECRET 未设置，使用内置默认值。生产环境务必在 .env 中配置随机密钥！",
        stacklevel=2,
    )
