"""
流水线数据访问层：复用主应用的 SQLite 路径与连接逻辑，
并负责 schema_v2.sql 的幂等迁移（对既有库可重复执行）。
"""

import os
import sqlite3
from loguru import logger

# 使用集中配置模块（消除重复的路径解析逻辑）
import sys
_sys_path_parent = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _sys_path_parent not in sys.path:
    sys.path.insert(0, _sys_path_parent)
from config import DB_PATH, PROJECT_ROOT

_SCHEMA_V2 = os.path.join(PROJECT_ROOT, "database", "schema_v2.sql")
_SCHEMA_V3 = os.path.join(PROJECT_ROOT, "database", "schema_v3_eval.sql")


def get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


_migrated = False


def migrate() -> None:
    """幂等执行 schema_v2，确保六环节所需表存在。"""
    global _migrated
    if _migrated:
        return
    if not os.path.exists(_SCHEMA_V2):
        logger.warning(f"⚠️ schema_v2.sql 未找到: {_SCHEMA_V2}")
        return
    conn = get_conn()
    try:
        with open(_SCHEMA_V2, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        if os.path.exists(_SCHEMA_V3):
            with open(_SCHEMA_V3, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
        # 增量列迁移（幂等：列已存在则跳过）
        _add_column(conn, "hypotheses_v2", "revision_note", "TEXT DEFAULT ''")
        conn.commit()
        _migrated = True
        logger.info("✅ 六环节流水线数据表已就绪 (schema_v2 + schema_v3_eval)")
    except Exception as e:
        logger.error(f"❌ schema_v2 迁移失败: {e}")
    finally:
        conn.close()


def _add_column(conn: sqlite3.Connection, table: str, column: str, col_type: str) -> None:
    """幂等加列：已存在则静默跳过（SQLite 不支持 IF NOT EXISTS 于 ALTER TABLE）。"""
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        logger.info(f"✅ 增量迁移: {table}.{column}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e).lower():
            raise


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None
