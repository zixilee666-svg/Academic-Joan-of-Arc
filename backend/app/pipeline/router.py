"""
六环节流水线 API 路由（/api/v2）
端点清单（方案 §4.7）：
  GET  /api/v2/questions           125题题库（可按级别筛选）
  POST /api/v2/run                 创建一次运行并执行首轮
  POST /api/v2/iterate             继续自迭代（可附人工反馈）
  GET  /api/v2/runs/{run_id}       运行完整状态（证据/假设树/计划/轮次快照）
  GET  /api/v2/runs/{run_id}/versions  版本对比（各轮快照与diff）
  POST /api/v2/batch               启动125题批量运行
  GET  /api/v2/batch/status        批量进度
  GET  /api/v2/batch/report        导出逐题报告（返回文件路径）
"""

import asyncio
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from . import db as pdb
from . import batch_runner, m6_orchestrator
from .questions_bank import seed_questions
from . import splits as splits_mod
from . import evaluator
from .skills_library import list_skills, get_skill

router = APIRouter(prefix="/api/v2", tags=["pipeline-v2"])

# 后台批量任务句柄
_bg_tasks: dict[str, asyncio.Task] = {}


class RunCreateReq(BaseModel):
    question: Optional[str] = None       # 自定义问题文本（自由新问题）
    q_number: Optional[int] = None       # 或从125题库选题
    max_rounds: int = 3
    level: Optional[str] = None          # 自由问题的分级 A/B/C（C级触发强制降维）；题库选题时以题库为准


class IterateReq(BaseModel):
    run_id: int
    max_rounds: int = 3
    human_feedback: Optional[str] = None


class BatchReq(BaseModel):
    levels: Optional[list[str]] = None
    q_numbers: Optional[list[int]] = None
    concurrency: int = 3
    force: bool = False
    level_rounds: Optional[dict] = None
    split: Optional[str] = None            # train/test/val 分组筛选


class ReshuffleReq(BaseModel):
    seed: int = 42


@router.get("/questions")
async def list_questions(level: Optional[str] = None, domain: Optional[str] = None):
    pdb.migrate()
    seed_questions()
    conn = pdb.get_conn()
    try:
        sql = "SELECT * FROM questions_125 WHERE 1=1"
        args = []
        if level:
            sql += " AND level=?"
            args.append(level)
        if domain:
            sql += " AND domain LIKE ?"
            args.append(f"%{domain}%")
        sql += " ORDER BY q_number"
        rows = [dict(r) for r in conn.execute(sql, args).fetchall()]
        # 附每题三分归属
        split_map = {r["q_number"]: r["split"] for r in conn.execute(
            "SELECT q_number, split FROM question_splits")}
        for row in rows:
            row["split"] = split_map.get(row["q_number"])
        # 附每题最新运行状态
        runs = {r["question_id"]: dict(r) for r in conn.execute(
            "SELECT pr.* FROM pipeline_runs pr INNER JOIN ("
            "  SELECT question_id, MAX(id) AS mid FROM pipeline_runs "
            "  WHERE question_id IS NOT NULL GROUP BY question_id"
            ") t ON pr.id=t.mid")}
        for row in rows:
            run = runs.get(row["id"])
            row["last_run"] = {
                "run_id": run["id"], "status": run["status"],
                "result_class": run["result_class"], "rounds": run["current_round"],
            } if run else None
        return {"total": len(rows), "questions": rows}
    finally:
        conn.close()


@router.post("/run")
async def create_run(req: RunCreateReq):
    pdb.migrate()
    seed_questions()
    conn = pdb.get_conn()
    try:
        question_id = None
        # 自由问题允许指定分级（默认A）；C级触发M1强制降维，与题库C级行为一致
        level = (req.level or "A").strip().upper()
        if level not in ("A", "B", "C"):
            level = "A"
        question = (req.question or "").strip()
        if req.q_number:
            q = conn.execute(
                "SELECT * FROM questions_125 WHERE q_number=?", (req.q_number,)).fetchone()
            if not q:
                raise HTTPException(404, f"题库中无第 {req.q_number} 题")
            question_id = q["id"]
            level = q["level"]   # 题库选题以题库分级为准
            question = question or q["question_zh"]
        if not question:
            raise HTTPException(400, "需提供 question 或 q_number")
        cur = conn.execute(
            "INSERT INTO pipeline_runs (question_id, question_text, level, status) "
            "VALUES (?, ?, ?, 'running')",
            (question_id, question, level))
        run_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()

    result = await m6_orchestrator.iterate(
        run_id, question, level=level, max_rounds=max(1, min(req.max_rounds, 5)))
    state = m6_orchestrator.get_run_state(run_id)
    return {"run_id": run_id, "result": result, "state": state}


@router.post("/iterate")
async def iterate_run(req: IterateReq):
    pdb.migrate()
    conn = pdb.get_conn()
    try:
        run = conn.execute(
            "SELECT * FROM pipeline_runs WHERE id=?", (req.run_id,)).fetchone()
    finally:
        conn.close()
    if not run:
        raise HTTPException(404, f"run {req.run_id} 不存在")

    result = await m6_orchestrator.iterate(
        req.run_id, run["question_text"], level=run["level"] or "A",
        max_rounds=max(req.max_rounds, int(run["current_round"] or 1) + 1),
        human_feedback=req.human_feedback)
    return {"run_id": req.run_id, "result": result}


@router.get("/runs")
async def list_runs(kind: Optional[str] = None, limit: int = 50):
    """历史运行列表（支持自由新问题回溯）。

    kind=custom 仅题库外自由问题（question_id IS NULL）；kind=bank 仅题库题；缺省全部。
    每条附六维自评总分（若有）与轮数/证据卡数，供前端「新问题实验室」历史列表。
    """
    pdb.migrate()
    conn = pdb.get_conn()
    try:
        sql = ("SELECT id, question_id, question_text, level, status, result_class, "
               "current_round, created_at FROM pipeline_runs")
        args: list = []
        if kind == "custom":
            sql += " WHERE question_id IS NULL"
        elif kind == "bank":
            sql += " WHERE question_id IS NOT NULL"
        else:
            sql += " WHERE 1=1"
        sql += " ORDER BY id DESC LIMIT ?"
        args.append(max(1, min(limit, 200)))
        runs = [dict(r) for r in conn.execute(sql, args).fetchall()]
        if runs:
            ids = [r["id"] for r in runs]
            marks = ",".join("?" * len(ids))
            ev = {r["run_id"]: r["c"] for r in conn.execute(
                f"SELECT run_id, COUNT(*) c FROM evidence_cards WHERE run_id IN ({marks}) GROUP BY run_id", ids)}
            sc = {r["run_id"]: r["total"] for r in conn.execute(
                f"SELECT run_id, total FROM run_evaluations WHERE run_id IN ({marks})", ids)}
            for r in runs:
                r["n_cards"] = ev.get(r["id"], 0)
                r["eval_total"] = sc.get(r["id"])
        return {"total": len(runs), "runs": runs}
    finally:
        conn.close()


@router.get("/runs/{run_id}")
async def get_run(run_id: int):
    pdb.migrate()
    state = m6_orchestrator.get_run_state(run_id)
    if not state:
        raise HTTPException(404, f"run {run_id} 不存在")
    return state


@router.get("/runs/{run_id}/versions")
async def get_versions(run_id: int):
    """版本对比：各轮快照 + diff（P17 材料数据源）。"""
    pdb.migrate()
    state = m6_orchestrator.get_run_state(run_id)
    if not state:
        raise HTTPException(404, f"run {run_id} 不存在")
    import json as _json
    versions = []
    for rd in state["rounds"]:
        snap = rd["snapshot"]
        try:
            snap = _json.loads(snap) if isinstance(snap, str) else snap
        except Exception:
            pass
        versions.append({
            "round": rd["round"],
            "decision": rd["decision"],
            "decision_reason": rd["decision_reason"],
            "diff_note": rd["diff_note"],
            "snapshot": snap,
        })
    return {"run_id": run_id, "question": state["run"]["question_text"], "versions": versions}


@router.post("/batch")
async def start_batch(req: BatchReq, background_tasks: BackgroundTasks):
    pdb.migrate()
    seed_questions()
    if batch_runner.batch_status()["running"]:
        raise HTTPException(409, "已有批量任务在运行")

    async def _job():
        await batch_runner.run_batch(
            levels=req.levels, q_numbers=req.q_numbers,
            concurrency=max(1, min(req.concurrency, 6)),
            force=req.force, level_rounds=req.level_rounds,
            split=req.split)

    _bg_tasks["batch"] = asyncio.create_task(_job())
    return {"message": "批量任务已启动（后台执行）", "status": batch_runner.batch_status()}


@router.get("/batch/status")
async def get_batch_status():
    return batch_runner.batch_status()


@router.get("/batch/report")
async def get_batch_report(batch_id: Optional[int] = None):
    pdb.migrate()
    path = batch_runner.export_batch_report(batch_id=batch_id)
    return {"report_path": path}


# ═══════════════ 三分法 / 自评 / 迭代日志 ═══════════════

@router.get("/splits")
async def get_splits():
    """三分汇总（训练/测试/验证各组的规模、级别分布、题号）。"""
    pdb.migrate()
    seed_questions()
    return splits_mod.ensure_splits()


@router.post("/splits/reshuffle")
async def reshuffle_splits(req: ReshuffleReq):
    """按新种子重新三分（覆盖既有划分；会破坏训练/验证隔离，慎用）。"""
    pdb.migrate()
    seed_questions()
    return splits_mod.ensure_splits(seed=req.seed, reshuffle=True)


@router.get("/splits/sample")
async def sample_split(split: str, n: int = 5, seed: int = 42):
    """从某分组分层随机抽样 n 题/级别（用于训练集迭代诊断）。"""
    pdb.migrate()
    if split not in ("train", "test", "val"):
        raise HTTPException(400, "split 必须为 train/test/val")
    import random as _rnd
    from .db import get_conn
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT qs.q_number, qs.level FROM question_splits qs "
            "WHERE qs.split=? ORDER BY qs.q_number", (split,)).fetchall()
        by_level: dict[str, list[int]] = {}
        for r in rows:
            by_level.setdefault(r["level"], []).append(r["q_number"])
        rng = _rnd.Random(seed)
        picked: list[int] = []
        for lv in ("A", "B", "C"):
            nums = by_level.get(lv, [])
            k = min(n, len(nums))
            picked.extend(rng.sample(nums, k) if k else [])
        return {"split": split, "n_per_level": n, "seed": seed,
                "q_numbers": sorted(picked), "count": len(picked)}
    finally:
        conn.close()


@router.post("/eval/run/{run_id}")
async def eval_single_run(run_id: int):
    """对单次运行自评。"""
    pdb.migrate()
    result = evaluator.evaluate_run(run_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.get("/eval/batch")
async def eval_batch(batch_id: Optional[int] = None, split: Optional[str] = None):
    """批量自评汇总：均值/最低分/达标数/各维度平均得分率（训练诊断用）。"""
    pdb.migrate()
    return evaluator.evaluate_batch(batch_run_id=batch_id, split=split)


@router.get("/iteration-log")
async def list_iteration_log():
    """自我辩证迭代日志（发现问题 → 修复 → 前后指标对照）。"""
    pdb.migrate()
    from .db import get_conn
    import json as _json
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM iteration_log ORDER BY iteration_no DESC").fetchall()
        out = []
        for r in rows:
            d = dict(r)
            for k in ("metrics_before", "metrics_after"):
                try:
                    d[k] = _json.loads(d[k]) if d[k] else {}
                except Exception:
                    pass
            out.append(d)
        return {"iterations": out, "count": len(out)}
    finally:
        conn.close()


# ═══════════════ 科研技能库（OpenAI Skills 范式） ═══════════════

@router.get("/skills")
async def get_skills():
    """技能注册表：智能体在各环节可调用的科研技能清单。"""
    return {"skills": list_skills(), "count": len(list_skills())}


@router.get("/skills/{code}")
async def get_skill_detail(code: str):
    """单个技能详情（含提示词增强块）。"""
    s = get_skill(code)
    if not s:
        raise HTTPException(404, f"技能 {code} 不存在")
    return s


class IterationLogReq(BaseModel):
    iteration_no: int
    stage: str = "train"
    findings: str = ""
    changes: str = ""
    metrics_before: Optional[dict] = None
    metrics_after: Optional[dict] = None


@router.post("/iteration-log")
async def add_iteration_log(req: IterationLogReq):
    """记录一轮自我辩证迭代（诊断 → 修复 → 对照）。"""
    pdb.migrate()
    from .db import get_conn
    import json as _json
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO iteration_log (iteration_no, stage, findings, changes, "
            "metrics_before, metrics_after) VALUES (?, ?, ?, ?, ?, ?)",
            (req.iteration_no, req.stage, req.findings, req.changes,
             _json.dumps(req.metrics_before or {}, ensure_ascii=False),
             _json.dumps(req.metrics_after or {}, ensure_ascii=False)),
        )
        conn.commit()
        return {"ok": True, "iteration_no": req.iteration_no}
    finally:
        conn.close()
