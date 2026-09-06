"""
自评分器（evaluator）— 对单次运行输出六维百分制评分
用途：
  1) 训练集：驱动六环节自我辩证完善（诊断各维度弱点）
  2) 测试集：持续完善
  3) 验证集：闭环确认
  4) 全量终验：<95 分则迭代

六维（总分 100，规则化可复现；权重对应模板硬约束与六环节闭环指标）：
  D1 假设溯源（20）：假设是否挂接知识缺口、引用真实证据编号、附推理链（P10「假设从何而来」）
  D2 证据质量（20）：证据卡数量、三分类覆盖、核验状态、冲突对标记（C7 事实/解释/推断区分）
  D3 可证伪性（20）：可检验预测 + 证伪标准 + 替代解释（P11）
  D4 计划完整性（20）：五环节齐备 + 结果判定表 + 可执行性检查（P13-P16）
  D5 自迭代留痕（10）：多轮/修订链/反馈条目/版本快照（P17 版本比较、模板「多轮资料补充」）
  D6 合规性（10）：无 [Mock] 污染、假设措辞非断言、失败留痕（C6、C2）
"""

import json
import re
from loguru import logger

from .db import get_conn

WEIGHTS = {
    "traceability": 20,      # D1 假设溯源
    "evidence_quality": 20,  # D2 证据质量
    "falsifiability": 20,    # D3 可证伪性
    "plan_completeness": 20, # D4 计划完整性
    "iteration": 10,         # D5 自迭代留痕
    "compliance": 10,        # D6 合规性
}

ASSERTION_WORDS = ("证明了", "已经证实", "确定无疑", "充分证明", "确凿证明")


def _loads(x, default):
    if not x:
        return default
    try:
        return json.loads(x)
    except Exception:
        return default


def evaluate_run(run_id: int, conn=None, save: bool = True) -> dict:
    """对 run_id 计算六维得分，返回 {scores, total, details}。save=True 时落库。"""
    own = False
    if conn is None:
        conn = get_conn()
        own = True
    try:
        run = conn.execute("SELECT * FROM pipeline_runs WHERE id=?", (run_id,)).fetchone()
        if not run:
            return {"error": f"run {run_id} 不存在"}
        run = dict(run)
        details: dict = {}
        scores: dict = {}

        # ── 前置：失败运行直接低分（保留失败留痕是合规的一部分）──
        if run["status"] == "failed":
            scores = {k: 0 for k in WEIGHTS}
            scores["compliance"] = 6  # 失败但留痕
            details = {"note": f"运行失败: {run.get('error_detail', '')[:200]}"}
            total = round(sum(scores[k] / WEIGHTS[k] * WEIGHTS[k] for k in WEIGHTS), 1)
            return _finalize(conn, run, scores, total, details, save)

        gaps = conn.execute(
            "SELECT * FROM knowledge_gaps WHERE run_id=?", (run_id,)).fetchall()
        cards = conn.execute(
            "SELECT * FROM evidence_cards WHERE run_id=?", (run_id,)).fetchall()
        hyps = conn.execute(
            "SELECT * FROM hypotheses_v2 WHERE run_id=? ORDER BY round, id", (run_id,)).fetchall()
        plans = conn.execute(
            "SELECT * FROM plans_v2 WHERE run_id=? ORDER BY round DESC", (run_id,)).fetchall()
        rounds = conn.execute(
            "SELECT * FROM iteration_rounds WHERE run_id=? ORDER BY round", (run_id,)).fetchall()
        fbs = conn.execute(
            "SELECT * FROM feedback_entries WHERE run_id=?", (run_id,)).fetchall()
        valid_ecodes = {c["e_code"] for c in cards if c["e_code"]}

        # ── D1 假设溯源（20）──
        d1_items = []
        if hyps:
            for h in hyps:
                basis = _loads(h["basis"], {})
                cited = basis.get("cited_evidence") or []
                real_cited = [c for c in cited if c in valid_ecodes]
                has_gap = bool(h["gap_id"])
                has_chain = len(basis.get("reasoning_chain") or "") > 10
                d1_items.append(
                    (0.45 if has_gap else 0) +
                    (0.35 if real_cited else (0.15 if cited else 0)) +
                    (0.20 if has_chain else 0)
                )
            d1 = sum(d1_items) / len(d1_items)
        else:
            d1 = 0
        scores["traceability"] = d1 * WEIGHTS["traceability"]
        details["traceability"] = {
            "hypotheses": len(hyps),
            "with_gap": sum(1 for h in hyps if h["gap_id"]),
            "with_real_citation": sum(
                1 for h in hyps
                if any(c in valid_ecodes for c in (_loads(h["basis"], {}).get("cited_evidence") or []))),
        }

        # ── D2 证据质量（20）──
        n_cards = len(cards)
        types = {c["claim_type"] for c in cards}
        n_verified = sum(1 for c in cards if c["verified"])
        n_conflict = sum(1 for c in cards if c["conflict_with"])
        n_online = sum(
            1 for c in cards
            if (c["source_type"] or "") in ("openalex", "semantic_scholar", "crossref"))
        d2 = (
            min(n_cards / 6, 1.0) * 0.30 +
            (len(types) / 3) * 0.20 +
            min(n_verified / max(n_cards, 1), 1.0) * 0.20 +
            (0.15 if n_conflict > 0 else 0) +
            min(n_online / 4, 1.0) * 0.15
        )
        scores["evidence_quality"] = d2 * WEIGHTS["evidence_quality"]
        details["evidence_quality"] = {
            "cards": n_cards, "types": len(types), "verified": n_verified,
            "conflicts": n_conflict, "online": n_online,
        }

        # ── D3 可证伪性（20）──
        d3_items = []
        for h in hyps:
            has_pred = len(h["testable_prediction"] or "") > 15
            has_fals = len(h["falsification_criteria"] or "") > 10
            alts = _loads(h["alternative_explanations"], [])
            has_alt = len(alts) >= 1
            # 假设陈述不得为断言式（C6）：断言词出现在陈述中不扣 D3，留给 D6
            d3_items.append(
                (0.5 if has_pred else 0) + (0.3 if has_fals else 0) + (0.2 if has_alt else 0))
        d3 = sum(d3_items) / len(d3_items) if d3_items else 0
        scores["falsifiability"] = d3 * WEIGHTS["falsifiability"]
        details["falsifiability"] = {
            "with_prediction": sum(1 for h in hyps if len(h["testable_prediction"] or "") > 15),
            "with_falsification": sum(1 for h in hyps if len(h["falsification_criteria"] or "") > 10),
            "with_alternatives": sum(
                1 for h in hyps if len(_loads(h["alternative_explanations"], [])) >= 1),
        }

        # ── D4 计划完整性（20）──
        if plans:
            p = dict(plans[0])  # 取最新轮计划
            preds = _loads(p["predictions"], [])
            res = _loads(p["resources"], [])
            steps = _loads(p["steps"], [])
            ot = _loads(p["outcome_table"], [])
            stop = _loads(p["stop_conditions"], [])
            feas = _loads(p["feasibility_report"], {})
            sections = [len(preds) > 0, len(res) > 0, len(steps) >= 3, len(ot) > 0, len(stop) > 0]
            d4 = (sum(sections) / 5) * 0.7 + (0.2 if feas else 0) + (0.1 if p["content_md"] else 0)
            details["plan_completeness"] = {
                "predictions": len(preds), "resources": len(res), "steps": len(steps),
                "outcome_rows": len(ot), "stop_conditions": len(stop),
                "feasibility": feas.get("verdict") if isinstance(feas, dict) else None,
            }
        else:
            d4 = 0
            details["plan_completeness"] = {"note": "无研究计划（可能无假设入围）"}
        scores["plan_completeness"] = d4 * WEIGHTS["plan_completeness"]

        # ── D5 自迭代留痕（10）──
        n_rounds = len(rounds)
        n_revisions = sum(1 for h in hyps if (h["version"] or 1) > 1 or h["parent_id"])
        n_fb = len(fbs)
        has_snapshot = all(r["snapshot"] for r in rounds) if rounds else False
        d5 = (
            (min(n_rounds, 2) / 2) * 0.35 +
            (0.25 if n_revisions > 0 else 0) +
            (0.25 if n_fb >= 1 else 0) +
            (0.15 if has_snapshot else 0)
        )
        scores["iteration"] = d5 * WEIGHTS["iteration"]
        details["iteration"] = {
            "rounds": n_rounds, "revised_hypotheses": n_revisions,
            "feedback_entries": n_fb, "snapshots_ok": bool(has_snapshot),
        }

        # ── D6 合规性（10）──
        mock_h = sum(1 for h in hyps if (h["statement"] or "").startswith("[Mock]"))
        mock_c = sum(1 for c in cards if (c["claim"] or "").startswith("[Mock]"))
        assertion_h = sum(
            1 for h in hyps
            if any(w in (h["statement"] or "") for w in ASSERTION_WORDS))
        d6 = 1.0
        if hyps:
            d6 -= (mock_h / len(hyps)) * 0.5
        if cards:
            d6 -= (mock_c / len(cards)) * 0.3
        d6 -= min(assertion_h * 0.05, 0.2)
        d6 = max(d6, 0)
        scores["compliance"] = d6 * WEIGHTS["compliance"]
        details["compliance"] = {
            "mock_hypotheses": mock_h, "mock_cards": mock_c,
            "assertion_hypotheses": assertion_h,
        }

        total = round(sum(scores.values()), 1)
        return _finalize(conn, run, scores, total, details, save)
    finally:
        if own:
            conn.close()


def _finalize(conn, run: dict, scores: dict, total: float, details: dict, save: bool) -> dict:
    scores = {k: round(v, 2) for k, v in scores.items()}
    result = {
        "run_id": run["id"],
        "q_number": None,
        "split": None,
        "total": total,
        "scores": scores,
        "details": details,
    }
    if run.get("question_id"):
        q = conn.execute(
            "SELECT q.q_number, qs.split FROM questions_125 q "
            "LEFT JOIN question_splits qs ON qs.q_number=q.q_number WHERE q.id=?",
            (run["question_id"],)).fetchone()
        if q:
            result["q_number"] = q["q_number"]
            result["split"] = q["split"]
    if save:
        # 幂等：同一 run 只保留最新一次评分（重评覆盖旧记录，防止批量汇总反复调用导致表膨胀）
        conn.execute("DELETE FROM run_evaluations WHERE run_id=?", (run["id"],))
        conn.execute(
            "INSERT INTO run_evaluations (run_id, q_number, split, batch_run_id, scores, total, details) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (run["id"], result["q_number"], result["split"] or "",
             run.get("batch_run_id"), json.dumps(scores, ensure_ascii=False),
             total, json.dumps(details, ensure_ascii=False)),
        )
        conn.commit()
    return result


def evaluate_batch(batch_run_id: int | None = None, split: str | None = None,
                   only_best: bool = True) -> dict:
    """批量评分：对指定批次（或全部）的每个题目取最新一次运行评分。

    返回 {summary: {mean, per_split, dist}, per_question: [...]}。
    """
    conn = get_conn()
    try:
        sql = (
            "SELECT pr.* FROM pipeline_runs pr INNER JOIN ("
            "  SELECT question_id, MAX(id) AS mid FROM pipeline_runs "
            "  WHERE question_id IS NOT NULL")
        args: list = []
        if batch_run_id:
            sql += " AND batch_run_id=?"
            args.append(batch_run_id)
        sql += " GROUP BY question_id) t ON pr.id=t.mid"
        runs = conn.execute(sql, args).fetchall()
        results = []
        for r in runs:
            if split:
                q = conn.execute(
                    "SELECT qs.split FROM questions_125 q "
                    "JOIN question_splits qs ON qs.q_number=q.q_number WHERE q.id=?",
                    (r["question_id"],)).fetchone()
                if not q or q["split"] != split:
                    continue
            results.append(evaluate_run(r["id"], conn=conn))

        totals = [r["total"] for r in results if "total" in r]
        per_split = {}
        for s in ("train", "test", "val"):
            sub = [r["total"] for r in results if r.get("split") == s]
            per_split[s] = {
                "n": len(sub),
                "mean": round(sum(sub) / len(sub), 1) if sub else None,
                "min": min(sub) if sub else None,
                "ge95": sum(1 for t in sub if t >= 95),
            }
        summary = {
            "n_runs": len(results),
            "mean": round(sum(totals) / len(totals), 1) if totals else None,
            "min": min(totals) if totals else None,
            "ge95": sum(1 for t in totals if t >= 95),
            "ge90": sum(1 for t in totals if t >= 90),
            "per_split": per_split,
            "weakest_dims": _weakest_dims(results),
        }
        return {"summary": summary, "per_question": sorted(results, key=lambda r: r.get("total", 0))}
    finally:
        conn.close()


def _weakest_dims(results: list[dict]) -> dict:
    """聚合各维度平均得分率（得分/满分），供训练集诊断最弱环节。"""
    agg = {k: [] for k in WEIGHTS}
    for r in results:
        for k, v in (r.get("scores") or {}).items():
            if k in agg:
                agg[k].append(v / WEIGHTS[k])
    return {k: round(sum(v) / len(v), 3) for k, v in agg.items() if v}
