"""
125题三分法 — 训练集 / 测试集 / 验证集
对应老板指令：随机三分，用于「训练自辩证 → 测试完善 → 验证闭环」三段式深化。

划分原则：
  - 分层随机（按 A/B/C 级别分层），保持各级别在三组中的比例一致，
    避免训练集与验证集难度分布失衡；
  - 比例：训练 56% / 测试 22% / 验证 22%（70 / 28 / 27）；
  - 固定随机种子（默认 42），划分可复现；
  - 幂等：已划分则直接返回，除非显式 reshuffle。
"""

import random
from loguru import logger

from .db import get_conn

RATIOS = {"train": 0.56, "test": 0.22, "val": 0.22}
DEFAULT_SEED = 42


def _assign_split(n: int, ratios: dict) -> list[str]:
    """按比例分配 n 个样本到三组（保证总和为 n，余数补给验证集）。"""
    n_train = round(n * ratios["train"])
    n_test = round(n * ratios["test"])
    n_val = n - n_train - n_test
    return ["train"] * n_train + ["test"] * n_test + ["val"] * n_val


def ensure_splits(seed: int = DEFAULT_SEED, reshuffle: bool = False) -> dict:
    """确保 125 题已有三分结果；返回汇总。

    reshuffle=True 时按新种子重新划分（训练/测试/验证数据将被覆盖）。
    """
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT q_number, level FROM questions_125 ORDER BY q_number").fetchall()
        if not rows:
            raise RuntimeError("questions_125 题库为空，请先 seed_questions()")

        existing = conn.execute("SELECT COUNT(*) FROM question_splits").fetchone()[0]
        if existing >= len(rows) and not reshuffle:
            summary = get_split_summary(conn=conn)
            return summary

        # 分层随机：每个级别内部独立打乱后按比例切分
        rng = random.Random(seed)
        by_level: dict[str, list[int]] = {}
        for r in rows:
            by_level.setdefault(r["level"], []).append(r["q_number"])

        assignments: dict[int, str] = {}
        for level, nums in by_level.items():
            nums = sorted(nums)
            rng.shuffle(nums)
            labels = _assign_split(len(nums), RATIOS)
            rng.shuffle(labels)  # 避免组内顺序偏置
            for num, lab in zip(nums, labels):
                assignments[num] = lab

        conn.execute("DELETE FROM question_splits")
        conn.executemany(
            "INSERT INTO question_splits (q_number, split, level, seed) VALUES (?, ?, ?, ?)",
            [(num, lab, next(r["level"] for r in rows if r["q_number"] == num), seed)
             for num, lab in assignments.items()],
        )
        conn.commit()
        logger.info(f"✅ 125题三分完成 | seed={seed} | "
                    + " ".join(f"{k}={v}" for k, v in
                               {s: sum(1 for x in assignments.values() if x == s)
                                for s in ("train", "test", "val")}.items()))
        return get_split_summary(conn=conn)
    finally:
        conn.close()


def get_split_summary(conn=None) -> dict:
    """三分汇总：各组规模、级别分布、题号列表。"""
    own = False
    if conn is None:
        conn = get_conn()
        own = True
    try:
        rows = conn.execute(
            "SELECT q_number, split, level, seed FROM question_splits ORDER BY q_number"
        ).fetchall()
        if not rows:
            return {"assigned": 0, "splits": {}, "seed": None}
        splits = {}
        for s in ("train", "test", "val"):
            grp = [dict(r) for r in rows if r["split"] == s]
            splits[s] = {
                "count": len(grp),
                "levels": {lv: sum(1 for g in grp if g["level"] == lv)
                           for lv in ("A", "B", "C")},
                "q_numbers": [g["q_number"] for g in grp],
            }
        return {"assigned": len(rows), "splits": splits, "seed": rows[0]["seed"]}
    finally:
        if own:
            conn.close()


def get_q_numbers(split: str) -> list[int]:
    """取某一分组的题号列表。"""
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT q_number FROM question_splits WHERE split=? ORDER BY q_number",
            (split,)).fetchall()
        return [r["q_number"] for r in rows]
    finally:
        conn.close()
