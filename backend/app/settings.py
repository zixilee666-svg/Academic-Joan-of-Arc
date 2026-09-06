"""
Academic Joan of Arc — 系统设置 API
================================
提供推理引擎配置（提供方 / API Key / 模型映射）的读取与热更新、连接测试，
以及用户偏好（主题 / 偏好模型 / 研究兴趣）的读写。

安全与持久化：
  - API Key 读取时脱敏返回（仅显示首尾），不回传明文；
  - 保存时写入 os.environ 并重置推理引擎单例 → 立即热生效；
  - 同时写回项目根 .env（原子写入 + 备份），重启后仍保留。
"""

import os
import re
import time
import shutil
import sqlite3
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from loguru import logger

from auth import require_auth, get_db
from llm_engine import get_llm_engine, reset_llm_engine

router = APIRouter(prefix="/api/settings", tags=["系统设置"])

# ─── .env 路径解析（与 main.py 一致：优先项目根） ───
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_ENV_CANDIDATES = [
    os.path.join(_PROJECT_ROOT, ".env"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
    os.path.join(os.getcwd(), ".env"),
]


def _find_env_file() -> str:
    for c in _ENV_CANDIDATES:
        if os.path.isfile(c):
            return os.path.abspath(c)
    # 都不存在则默认在项目根创建
    return os.path.join(_PROJECT_ROOT, ".env")


# 可通过设置页热更新并写回 .env 的键
_UPDATABLE_KEYS = {
    "LLM_PROVIDER",
    "DASHSCOPE_API_KEY",
    "BAILIAN_API_KEY",
    "BAILIAN_MODEL_REASONING",
    "BAILIAN_MODEL_GENERAL",
    "BAILIAN_MODEL_CODING",
    "BAILIAN_MODEL_MULTIMODAL",
    "OLLAMA_HOST",
}


def _mask_key(key: Optional[str]) -> str:
    """脱敏 API Key：仅显示前 6 位与后 4 位。"""
    if not key:
        return ""
    if len(key) <= 12:
        return key[:3] + "****"
    return f"{key[:6]}{'*' * 8}{key[-4:]}"


# ─── Pydantic 模型 ───

class ConfigUpdate(BaseModel):
    provider: Optional[str] = None            # bailian | ollama
    api_key: Optional[str] = None             # 明文 DashScope Key（仅在用户提供时更新）
    model_reasoning: Optional[str] = None
    model_general: Optional[str] = None
    model_coding: Optional[str] = None
    model_multimodal: Optional[str] = None
    ollama_host: Optional[str] = None


class TestConnectionRequest(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None


class PreferencesUpdate(BaseModel):
    theme: Optional[str] = None               # dark | light | auto
    preferred_model: Optional[str] = None
    research_interests: Optional[str] = None


# ─── .env 写回（原子 + 备份） ───

def _write_env(updates: dict):
    """将 updates 写回 .env：已存在的键替换其值，缺失的键追加；保留注释与其余行。"""
    updates = {k: v for k, v in updates.items() if k in _UPDATABLE_KEYS and v is not None}
    if not updates:
        return None
    env_path = _find_env_file()

    # 备份原文件到工作区（文件保护策略）
    if os.path.isfile(env_path):
        try:
            backup_dir = os.path.join(os.path.expanduser("~"), ".qoderworkcn", "workspace")
            os.makedirs(backup_dir, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            shutil.copy2(env_path, os.path.join(backup_dir, f".env.backup_{ts}"))
        except Exception as e:
            logger.warning(f".env 备份失败（继续写入）: {e}")
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    else:
        lines = ["# Academic Joan of Arc 环境配置（由设置页自动生成）\n"]

    remaining = dict(updates)
    out = []
    key_re = re.compile(r"^\s*([A-Z0-9_]+)\s*=")
    for line in lines:
        m = key_re.match(line)
        if m and m.group(1) in remaining:
            k = m.group(1)
            out.append(f"{k}={remaining.pop(k)}\n")
        else:
            out.append(line)
    # 追加仍剩余的键
    if remaining:
        if out and not out[-1].endswith("\n"):
            out[-1] += "\n"
        out.append("\n# ─── 由设置页更新 ───\n")
        for k, v in remaining.items():
            out.append(f"{k}={v}\n")

    tmp = env_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.writelines(out)
    os.replace(tmp, env_path)   # 原子替换
    logger.info(f"💾 .env 已更新: {list(updates.keys())} → {env_path}")
    return env_path


# ─── 端点 ───

@router.get("/config")
async def get_config(user=Depends(require_auth)):
    """读取当前推理引擎配置（API Key 脱敏）。"""
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    key = os.getenv("DASHSCOPE_API_KEY") or os.getenv("BAILIAN_API_KEY") or ""
    engine = get_llm_engine()
    try:
        health = await engine.health_check()
    except Exception as e:
        health = {"status": "error", "error": str(e)}
    return {
        "success": True,
        "config": {
            "provider": provider,
            "api_key_masked": _mask_key(key),
            "api_key_set": bool(key),
            "model_reasoning": os.getenv("BAILIAN_MODEL_REASONING", "qwen-max"),
            "model_general": os.getenv("BAILIAN_MODEL_GENERAL", "qwen-plus"),
            "model_coding": os.getenv("BAILIAN_MODEL_CODING", "qwen-plus"),
            "model_multimodal": os.getenv("BAILIAN_MODEL_MULTIMODAL", "qwen-vl-max"),
            "ollama_host": os.getenv("OLLAMA_HOST", "http://localhost:11434"),
            "env_file": _find_env_file(),
        },
        "health": health,
        "version": "3.0.0",
    }


@router.put("/config")
async def update_config(payload: ConfigUpdate, user=Depends(require_auth)):
    """更新推理引擎配置：热生效（os.environ + 重置引擎）并写回 .env。"""
    env_updates = {}
    if payload.provider is not None:
        if payload.provider not in ("bailian", "ollama"):
            raise HTTPException(400, "provider 仅支持 bailian 或 ollama")
        os.environ["LLM_PROVIDER"] = payload.provider
        env_updates["LLM_PROVIDER"] = payload.provider
    if payload.api_key:
        os.environ["DASHSCOPE_API_KEY"] = payload.api_key
        os.environ["BAILIAN_API_KEY"] = payload.api_key
        env_updates["DASHSCOPE_API_KEY"] = payload.api_key
        env_updates["BAILIAN_API_KEY"] = payload.api_key
    mapping = {
        "BAILIAN_MODEL_REASONING": payload.model_reasoning,
        "BAILIAN_MODEL_GENERAL": payload.model_general,
        "BAILIAN_MODEL_CODING": payload.model_coding,
        "BAILIAN_MODEL_MULTIMODAL": payload.model_multimodal,
    }
    for k, v in mapping.items():
        if v:
            os.environ[k] = v
            env_updates[k] = v
    if payload.ollama_host:
        os.environ["OLLAMA_HOST"] = payload.ollama_host
        env_updates["OLLAMA_HOST"] = payload.ollama_host

    # 热生效：重置引擎单例，下次调用按新环境变量重建
    reset_llm_engine()
    env_path = _write_env(env_updates)

    return {
        "success": True,
        "message": "配置已保存并热生效",
        "updated_keys": list(env_updates.keys()),
        "env_file": env_path,
        "api_key_masked": _mask_key(os.getenv("DASHSCOPE_API_KEY") or os.getenv("BAILIAN_API_KEY")),
    }


@router.post("/test-connection")
async def test_connection(payload: TestConnectionRequest, user=Depends(require_auth)):
    """测试当前（或指定）配置的连通性：发起一次极简真实调用并计时。"""
    # 若指定了 provider/api_key，临时应用到环境变量并重置引擎
    applied = False
    if payload.provider or payload.api_key:
        if payload.provider:
            os.environ["LLM_PROVIDER"] = payload.provider
        if payload.api_key:
            os.environ["DASHSCOPE_API_KEY"] = payload.api_key
            os.environ["BAILIAN_API_KEY"] = payload.api_key
        reset_llm_engine()
        applied = True

    engine = get_llm_engine()
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    t0 = time.time()
    try:
        resp = await engine.chat(
            model="general",
            messages=[{"role": "user", "content": "请回复两个字：就绪"}],
            temperature=0.1,
            max_tokens=16,
        )
        latency = int((time.time() - t0) * 1000)
        sample = (resp.content or "").strip()[:60]
        return {
            "success": True,
            "status": "healthy",
            "provider": provider,
            "model": getattr(resp, "model", None),
            "latency_ms": latency,
            "sample_reply": sample,
            "applied": applied,
        }
    except Exception as e:
        latency = int((time.time() - t0) * 1000)
        logger.error(f"连接测试失败: {e}")
        return {
            "success": False,
            "status": "error",
            "provider": provider,
            "latency_ms": latency,
            "error": str(e)[:300],
            "applied": applied,
        }


@router.get("/preferences")
async def get_preferences(user=Depends(require_auth)):
    """读取用户偏好（user_settings 表）。"""
    uid = user.get("id") if isinstance(user, dict) else getattr(user, "id", None)
    conn = get_db()
    row = conn.execute(
        "SELECT preferred_model, theme, research_interests FROM user_settings WHERE user_id=?",
        (uid,),
    ).fetchone()
    conn.close()
    if row:
        return {
            "success": True,
            "preferences": {
                "preferred_model": row["preferred_model"],
                "theme": row["theme"],
                "research_interests": row["research_interests"],
            },
        }
    return {
        "success": True,
        "preferences": {"preferred_model": "qwen-plus", "theme": "dark", "research_interests": ""},
    }


@router.put("/preferences")
async def update_preferences(payload: PreferencesUpdate, user=Depends(require_auth)):
    """保存用户偏好（upsert 到 user_settings 表）。"""
    uid = user.get("id") if isinstance(user, dict) else getattr(user, "id", None)
    conn = get_db()
    existing = conn.execute("SELECT user_id FROM user_settings WHERE user_id=?", (uid,)).fetchone()
    if existing:
        conn.execute(
            """UPDATE user_settings SET preferred_model=COALESCE(?,preferred_model),
               theme=COALESCE(?,theme), research_interests=COALESCE(?,research_interests),
               updated_at=CURRENT_TIMESTAMP WHERE user_id=?""",
            (payload.preferred_model, payload.theme, payload.research_interests, uid),
        )
    else:
        conn.execute(
            """INSERT INTO user_settings (user_id, preferred_model, theme, research_interests)
               VALUES (?,?,?,?)""",
            (uid, payload.preferred_model or "qwen-plus", payload.theme or "dark",
             payload.research_interests or ""),
        )
    conn.commit()
    conn.close()
    return {"success": True, "message": "偏好已保存"}
