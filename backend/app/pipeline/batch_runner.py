"""
125 题批量运行器 — 对应模板硬约束 C2（全量逐题输出，含失败题）
特性：
  - 并发控制（默认 3 题并行，避免引擎限流）
  - 断点续跑：已完成/已存在结果的题目默认跳过（force=True 可强制重跑）
  - 每题独立记录成败：失败题落 result_class='failed' 并保留 error_detail
  - 批次统计：成功/部分/证据不足/需人工/失败 分类计数
  - 逐题文档导出：export_batch_report 生成 Markdown 全量报告
"""

import asyncio
import json
import os
import time
from loguru import logger

from .db import get_conn
from . import m6_orchestrator
from .splits import get_q_numbers, ensure_splits
from .evaluator import evaluate_run

_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# 全模块级单例：同一时刻只允许一个批量任务
_batch_state = {
    "running": False,
    "batch_id": 0,
    "total": 0,
    "done": 0,
    "failed": 0,
    "current": "",
    "started_at": 0,
    "log": [],
}


def batch_status() -> dict:
    return dict(_batch_state)


def _log(msg: str) -> None:
    _batch_state["log"].append(msg)
    if len(_batch_state["log"]) > 500:
        _batch_state["log"] = _batch_state["log"][-500:]
    logger.info(msg)


async def _run_one_question(q: dict, batch_id: int, level_rounds: dict) -> dict:
    """单题执行：创建 run → 迭代 → 返回结果分类。"""
    q_number = q["q_number"]
    question = q["question_zh"]
    level = q["level"]
    max_rounds = level_rounds.get(level, 2)

    conn = get_conn()
    try:
        cur = conn.execute(
            """INSERT INTO pipeline_runs
            (question_id, question_text, level, status, batch_run_id)
            VALUES (?, ?, ?, 'running', ?)""",
            (q["id"], question, level, batch_id),
        )
        run_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()

    try:
        result = await m6_orchestrator.iterate(
            run_id, question, level=level, max_rounds=max_rounds)
        # 每题运行完毕即自评（落库），供训练/测试/验证诊断
        try:
            ev = evaluate_run(run_id)
            score = ev.get("total")
        except Exception as e:
            score = None
            logger.warning(f"⚠️ 题 {q_number} 自评失败: {e}")
        return {"q_number": q_number, "run_id": run_id, "ok": True,
                "final": result.get("final_decision", "?"), "score": score}
    except Exception as e:
        logger.exception(f"❌ 题 {q_number} 运行失败: {e}")
        conn = get_conn()
        try:
            conn.execute(
                """UPDATE pipeline_runs
                SET status='failed', result_class='failed', error_detail=?
                WHERE id=?""",
                (f"{type(e).__name__}: {e}"[:800], run_id),
            )
            conn.commit()
        finally:
            conn.close()
        return {"q_number": q_number, "run_id": run_id, "ok": False, "error": str(e)}


async def run_batch(
    levels: list[str] | None = None,
    q_numbers: list[int] | None = None,
    concurrency: int = 3,
    force: bool = False,
    level_rounds: dict | None = None,
    split: str | None = None,
) -> dict:
    """执行批量运行。

    levels：限定级别（如 ["A"]）；q_numbers：限定题号；二者可组合。
    split：限定分组（train/test/val），与 q_numbers 组合时取交集。
    level_rounds：各级别最大迭代轮数，默认 {"A": 2, "B": 2, "C": 1}（C级批量模式只跑1轮降维+首轮）。
    """
    if _batch_state["running"]:
        return {"error": "已有批量任务在运行", "status": batch_status()}

    level_rounds = level_rounds or {"A": 2, "B": 2, "C": 1}
    batch_id = int(time.time())

    # 若指定分组，先确保三分存在，再取该组题号（与 q_numbers 取交集）
    if split:
        ensure_splits()
        split_nums = set(get_q_numbers(split))
        if q_numbers:
            q_numbers = [n for n in q_numbers if n in split_nums]
        else:
            q_numbers = sorted(split_nums)

    conn = get_conn()
    try:
        sql = "SELECT * FROM questions_125 WHERE 1=1"
        args = []
        if levels:
            sql += f" AND level IN ({','.join('?' * len(levels))})"
            args += levels
        if q_numbers:
            sql += f" AND q_number IN ({','.join('?' * len(q_numbers))})"
            args += q_numbers
        sql += " ORDER BY q_number"
        questions = [dict(r) for r in conn.execute(sql, args).fetchall()]

        if not force:
            done_nums = {r["question_text"] for r in conn.execute(
                "SELECT question_text FROM pipeline_runs "
                "WHERE status IN ('completed','partial')").fetchall()}
            before = len(questions)
            questions = [q for q in questions if q["question_zh"] not in done_nums]
            skipped = before - len(questions)
        else:
            skipped = 0
    finally:
        conn.close()

    if not questions:
        return {"error": None, "message": f"无待运行题目（跳过已完成 {skipped} 题）",
                "total": 0, "batch_id": batch_id}

    _batch_state.update({
        "running": True, "batch_id": batch_id, "total": len(questions),
        "done": 0, "failed": 0, "current": "", "started_at": int(time.time()),
        "log": [],
    })
    _log(f"🚀 批量运行启动 batch_id={batch_id} | 共 {len(questions)} 题（跳过已完成 {skipped}）| 并发 {concurrency}")

    sem = asyncio.Semaphore(concurrency)

    async def _limited(q: dict) -> dict:
        async with sem:
            _batch_state["current"] = f"#{q['q_number']} {q['question_zh'][:20]}"
            r = await _run_one_question(q, batch_id, level_rounds)
            _batch_state["done"] += 1
            if not r["ok"]:
                _batch_state["failed"] += 1
            score_txt = f" | 自评 {r['score']} 分" if r.get("score") is not None else ""
            _log(f"{'✅' if r['ok'] else '❌'} 题 {q['q_number']} 完成 "
                 f"({_batch_state['done']}/{_batch_state['total']}) "
                 f"run_id={r['run_id']}{score_txt}")
            return r

    try:
        results = await asyncio.gather(*[_limited(q) for q in questions])
    finally:
        _batch_state["running"] = False
        _batch_state["current"] = ""

    n_ok = sum(1 for r in results if r["ok"])
    scored = [r["score"] for r in results if r.get("score") is not None]
    avg_score = round(sum(scored) / len(scored), 1) if scored else None
    _log(f"🏁 批量运行结束：成功 {n_ok} / 失败 {len(results) - n_ok} | 自评分均值 {avg_score}")

    # 汇总统计
    conn = get_conn()
    try:
        stats = {row["result_class"] or "running": row["n"] for row in conn.execute(
            "SELECT result_class, COUNT(*) AS n FROM pipeline_runs "
            "WHERE batch_run_id=? GROUP BY result_class", (batch_id,))}
    finally:
        conn.close()

    return {"batch_id": batch_id, "total": len(results), "ok": n_ok,
            "failed": len(results) - n_ok, "result_stats": stats,
            "avg_score": avg_score, "results": results}


# ────────────────────────────────────────────────────────────────
# 逐题报告导出（C2：全部125题逐题输出，含失败题）
# ────────────────────────────────────────────────────────────────

def export_batch_report(batch_id: int | None = None, out_dir: str | None = None) -> str:
    """导出逐题 Markdown 报告；batch_id=None 时导出每题最新一次运行。"""
    out_dir = out_dir or os.path.join(_PROJECT_ROOT, "reports")
    os.makedirs(out_dir, exist_ok=True)

    conn = get_conn()
    try:
        questions = [dict(r) for r in conn.execute(
            "SELECT * FROM questions_125 ORDER BY q_number")]
        lines = [
            "# 《125个科学问题》全量运行报告（赛道一·方向1A · C2 逐题输出）",
            "",
            f"- 生成批次: {batch_id if batch_id else '每题最新运行'}",
            "",
        ]
        n_total = len(questions)
        stats: dict[str, int] = {}

        for q in questions:
            if batch_id:
                run = conn.execute(
                    "SELECT * FROM pipeline_runs WHERE question_id=? AND batch_run_id=? "
                    "ORDER BY id DESC LIMIT 1", (q["id"], batch_id)).fetchone()
            else:
                run = conn.execute(
                    "SELECT * FROM pipeline_runs WHERE question_id=? "
                    "ORDER BY id DESC LIMIT 1", (q["id"],)).fetchone()

            lines.append(f"## 题 {q['q_number']}｜{q['domain']}｜级别 {q['level']}")
            lines.append(f"**问题**：{q['question_zh']}")
            lines.append("")
            if not run:
                lines.append("**状态**：⚪ 未运行")
                stats["not_run"] = stats.get("not_run", 0) + 1
                lines.append("")
                continue

            run = dict(run)
            rc = run["result_class"] or run["status"]
            stats[rc] = stats.get(rc, 0) + 1
            lines.append(f"**状态**：{run['status']}｜结果分类：{rc}｜轮次：{run['current_round']}")
            if run["error_detail"]:
                lines.append(f"**失败详情**：{run['error_detail']}")

            # 最优假设与评分
            best = conn.execute(
                "SELECT h_code, version, statement, overall_score, status FROM hypotheses_v2 "
                "WHERE run_id=? ORDER BY overall_score DESC LIMIT 1", (run["id"],)).fetchone()
            if best:
                lines.append(
                    f"**最优假设**：{best['h_code']} v{best['version']}（{best['status']}, "
                    f"综合分 {best['overall_score']}）：{best['statement']}")

            # 迭代轨迹
            rounds = conn.execute(
                "SELECT round, decision, decision_reason, diff_note FROM iteration_rounds "
                "WHERE run_id=? ORDER BY round", (run["id"],)).fetchall()
            if rounds:
                lines.append("**迭代轨迹**：")
                for rd in rounds:
                    lines.append(f"- R{rd['round']} → {rd['decision']}：{rd['decision_reason']}；{rd['diff_note']}")
            lines.append("")

        lines.insert(4, f"- 题目总数: {n_total}｜分类统计: {json.dumps(stats, ensure_ascii=False)}")
        lines.insert(5, "")

        content = "\n".join(lines)
        fname = f"125题全量运行报告_batch{'all' if not batch_id else batch_id}.md"
        path = os.path.join(out_dir, fname)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        _log(f"📄 逐题报告已导出: {path}")
        return path
    finally:
        conn.close()
