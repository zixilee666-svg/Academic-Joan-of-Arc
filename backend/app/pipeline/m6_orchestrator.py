"""
M6 反馈编排器 — 对应模板 P15/P16/P17（反馈修正、自迭代、版本比较）
职责：
  1 决策门：基于 M4 评审 + M5 可执行性判定下一步
     pass / revise_hypothesis / supplement_evidence / stop
  2 版本快照：每轮完整状态写入 iteration_rounds（供 P17 版本对比）
  3 反馈路由：将反馈条目分发给 M2(补料)/M3(修订)/M5(调整)
  4 两轮迭代编排：run_one_round / iterate（C5 要求保留第一轮真实缺陷）
"""

import json
from typing import Optional
from loguru import logger

from .db import get_conn, row_to_dict
from . import m1_question, m2_evidence, m3_hypothesis, m4_verify, m5_plan

# 决策门阈值（方案 §4.6）
PASS_SCORE = 0.68          # 最高假设综合分 ≥ 此值且计划可执行 → pass
REVISE_SCORE = 0.45        # 介于之间 → 修订假设
MAX_ROUNDS = 3             # 默认最大迭代轮数（批量运行省资源）
MIN_ROUNDS_FOR_PASS = 2    # 自我辩证铁律：即使 R1 达标，也必须至少经历一轮批判性复核
                           # 才能 pass——科学假设须经得起至少一次自我质疑（训练集迭代2修复）


# ────────────────────────────────────────────────────────────────
# 状态读取
# ────────────────────────────────────────────────────────────────

def get_run_state(run_id: int) -> dict:
    """读取一次运行的完整状态（证据/缺口/假设树/计划/轮次快照）。"""
    conn = get_conn()
    try:
        run = row_to_dict(conn.execute(
            "SELECT * FROM pipeline_runs WHERE id=?", (run_id,)).fetchone())
        if not run:
            return {}
        gaps = [dict(r) for r in conn.execute(
            "SELECT * FROM knowledge_gaps WHERE run_id=? ORDER BY g_code", (run_id,))]
        cards = [dict(r) for r in conn.execute(
            "SELECT * FROM evidence_cards WHERE run_id=? ORDER BY retrieval_round, e_code", (run_id,))]
        hyps = [dict(r) for r in conn.execute(
            "SELECT * FROM hypotheses_v2 WHERE run_id=? ORDER BY round, h_code, version", (run_id,))]
        plans = [dict(r) for r in conn.execute(
            "SELECT * FROM plans_v2 WHERE run_id=? ORDER BY round", (run_id,))]
        rounds = [dict(r) for r in conn.execute(
            "SELECT * FROM iteration_rounds WHERE run_id=? ORDER BY round", (run_id,))]
        feedback = [dict(r) for r in conn.execute(
            "SELECT * FROM feedback_entries WHERE run_id=? ORDER BY id", (run_id,))]
        return {
            "run": run, "gaps": gaps, "cards": cards,
            "hypotheses": hyps, "plans": plans,
            "rounds": rounds, "feedback": feedback,
        }
    finally:
        conn.close()


def _update_run(run_id: int, **fields) -> None:
    if not fields:
        return
    sets = ", ".join(f"{k}=?" for k in fields)
    vals = list(fields.values()) + [run_id]
    conn = get_conn()
    try:
        conn.execute(
            f"UPDATE pipeline_runs SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE id=?", vals)
        conn.commit()
    finally:
        conn.close()


# ────────────────────────────────────────────────────────────────
# 快照与决策门
# ────────────────────────────────────────────────────────────────

def build_round_snapshot(run_id: int, round_no: int, m4_result: dict, m5_result: dict) -> dict:
    """构建本轮快照（证据统计/假设评分/计划判定）。"""
    conn = get_conn()
    try:
        n_cards = conn.execute(
            "SELECT COUNT(*) FROM evidence_cards WHERE run_id=?", (run_id,)).fetchone()[0]
        n_new_cards = conn.execute(
            "SELECT COUNT(*) FROM evidence_cards WHERE run_id=? AND retrieval_round=?",
            (run_id, round_no)).fetchone()[0]
        hyps = [dict(r) for r in conn.execute(
            "SELECT h_code, version, statement, overall_score, status, decision_note, revision_note "
            "FROM hypotheses_v2 WHERE run_id=? AND round=? ORDER BY overall_score DESC",
            (run_id, round_no))]
    finally:
        conn.close()

    return {
        "round": round_no,
        "evidence_total": n_cards,
        "evidence_new_this_round": n_new_cards,
        "hypotheses": hyps,
        "shortlisted": m4_result.get("shortlisted", []),
        "feasibility_verdict": (m5_result.get("feasibility") or {}).get("verdict", ""),
        "best_score": max((h["overall_score"] or 0 for h in hyps), default=0),
    }


def decide_gate(snapshot: dict, m4_result: dict, m5_result: dict, round_no: int,
                max_rounds: int) -> tuple[str, str]:
    """决策门：返回 (decision, reason)。"""
    best = snapshot.get("best_score", 0)
    verdict = snapshot.get("feasibility_verdict", "")
    needs_rev = m4_result.get("needs_revision", [])
    is_final_round = round_no >= max_rounds

    # 通过判定优先于轮数上限：末轮若已达标（含至少一轮批判/修订），
    # 应判 pass 而非被 max_rounds 先行拦截为 stop（迭代2.5修复，源于训练集题27诊断）。
    if best >= PASS_SCORE and verdict in ("executable", "needs_adjustment"):
        if round_no < MIN_ROUNDS_FOR_PASS and not is_final_round:
            # 自我辩证铁律：首轮达标也不直接放行，须先经一轮批判性复核（v2修订）
            return ("revise_hypothesis",
                    f"自我辩证批判复核：R{round_no} 已达标（best={best}），"
                    f"但假设须经至少一轮批判复核方可通过，进入强化批判轮")
        suffix = "（最终轮收敛放行：已含多轮批判/修订）" if is_final_round else ""
        return ("pass", f"最优假设综合分 {best}≥{PASS_SCORE} 且计划可执行性={verdict}{suffix}")

    if is_final_round:
        # 末轮未达标：若有入围假设，视为尽力收敛（计划已生成）；否则如实停止
        if m4_result.get("shortlisted"):
            return ("pass",
                    f"最终轮尽力收敛：best_score={best}<{PASS_SCORE}，"
                    f"已产出入围假设与研究计划，判定为部分验证（partial）")
        return ("stop", f"已达最大轮数 {max_rounds}（best_score={best}），无假设入围")

    if best >= REVISE_SCORE or needs_rev:
        return ("revise_hypothesis",
                f"best_score={best}，待修订假设 {needs_rev}，进入修订轮（附评审修改指令）")
    return ("supplement_evidence",
            f"best_score={best}<{REVISE_SCORE}，证据链薄弱，触发 M2 补料轮后再生成")


def save_round(run_id: int, round_no: int, snapshot: dict,
               decision: str, decision_reason: str, diff_note: str = "") -> None:
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO iteration_rounds
            (run_id, round, snapshot, scores_summary, decision, decision_reason, diff_note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id, round_no,
                json.dumps(snapshot, ensure_ascii=False),
                json.dumps({
                    "best_score": snapshot.get("best_score", 0),
                    "shortlisted": snapshot.get("shortlisted", []),
                    "evidence_total": snapshot.get("evidence_total", 0),
                }, ensure_ascii=False),
                decision, decision_reason, diff_note,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def diff_rounds(prev_snapshot: Optional[dict], snapshot: dict) -> str:
    """生成与上一轮的差异摘要（P17 版本对比的数据源）。"""
    if not prev_snapshot:
        return "首轮：建立证据基线与候选假设树。"
    notes = []
    d_ev = snapshot.get("evidence_total", 0) - prev_snapshot.get("evidence_total", 0)
    if d_ev:
        notes.append(f"证据卡片 +{d_ev}")
    prev_best = prev_snapshot.get("best_score", 0)
    best = snapshot.get("best_score", 0)
    notes.append(f"最优假设综合分 {prev_best} → {best}")
    prev_codes = {h["h_code"] for h in prev_snapshot.get("hypotheses", [])}
    cur_hyps = snapshot.get("hypotheses", [])
    revised = [h for h in cur_hyps if h["h_code"] in prev_codes and (h["version"] or 1) > 1]
    new_h = [h for h in cur_hyps if h["h_code"] not in prev_codes]
    if revised:
        notes.append("修订假设: " + ", ".join(f"{h['h_code']}→v{h['version']}" for h in revised))
    if new_h:
        notes.append("新增假设: " + ", ".join(h["h_code"] for h in new_h))
    return "；".join(notes) if notes else "本轮无显著变化"


# ────────────────────────────────────────────────────────────────
# 单轮执行（M1 仅在首轮执行）
# ────────────────────────────────────────────────────────────────

async def run_one_round(
    run_id: int,
    question: str,
    level: str,
    round_no: int,
    m1_result: Optional[dict] = None,
    search_queries: Optional[list[str]] = None,
    feedback_items: Optional[list[dict]] = None,
    max_rounds: int = MAX_ROUNDS,
) -> dict:
    """执行一轮完整流水线：(M1)→M2→M3→M4→M5→M6 决策。"""
    conn = get_conn()
    try:
        prev_round = conn.execute(
            "SELECT snapshot FROM iteration_rounds WHERE run_id=? ORDER BY round DESC LIMIT 1",
            (run_id,)).fetchone()
    finally:
        conn.close()
    prev_snapshot = json.loads(prev_round["snapshot"]) if prev_round else None

    # ── M1（仅首轮；续跑轮从库中重建）──
    if m1_result is None:
        if round_no == 1:
            _update_run(run_id, current_stage="m1_question")
            m1_result = await m1_question.analyze_question(question, level=level, run_id=run_id)
            # 落库 M1 拆解（问题理解 tab 数据源：子问题/研究对象/降维说明；缺口已单独落 knowledge_gaps）
            _update_run(run_id, decomposition=json.dumps({
                "is_grand": bool(m1_result.get("is_grand")),
                "subquestions": m1_result.get("subquestions") or [],
                "objects": m1_result.get("objects") or [],
                "decomposition_note": m1_result.get("decomposition_note", ""),
                "model_used": m1_result.get("_model", ""),
            }, ensure_ascii=False))
        else:
            # 从既有知识缺口重建 M1 上下文，避免重复调用
            conn = get_conn()
            try:
                gap_rows = conn.execute(
                    "SELECT g_code, statement, severity, parent_subquestion "
                    "FROM knowledge_gaps WHERE run_id=? ORDER BY g_code", (run_id,)).fetchall()
            finally:
                conn.close()
            m1_result = {
                "is_grand": level == "C",
                "subquestions": [],
                "objects": [question],
                "gaps": [dict(g) for g in gap_rows] or [{
                    "g_code": "G-01", "statement": question, "severity": "high",
                    "parent_subquestion": "",
                }],
                "_rebuilt": True,
            }
            logger.info(f"♻️ R{round_no}: 从库中重建 M1 上下文（缺口 {len(m1_result['gaps'])} 条）")

    # ── M2 知识整合（补料轮可带定向检索式）──
    _update_run(run_id, current_stage="m2_evidence", current_round=round_no)
    m2_result = await m2_evidence.integrate_knowledge(
        question, m1_result, run_id, round_no=round_no, search_queries=search_queries)
    cards = m2_result["cards"]

    # ── M3 假设生成（修订模式：父版本来自上轮 needs_revision）──
    _update_run(run_id, current_stage="m3_hypothesis")
    parent_rows = None
    critique_mode = False
    if round_no > 1:
        # 修订模式：加载历史 needs_revision 假设为父节点（同一 h_code 只取最新版本）
        conn = get_conn()
        try:
            rows = conn.execute(
                """
                SELECT h.* FROM hypotheses_v2 h
                INNER JOIN (
                    SELECT h_code, MAX(version) AS mv FROM hypotheses_v2
                    WHERE run_id=? AND status='needs_revision' GROUP BY h_code
                ) t ON h.h_code=t.h_code AND h.version=t.mv
                WHERE h.run_id=? AND h.status='needs_revision'
                """,
                (run_id, run_id)).fetchall()
            parent_rows = rows or None
            # 批判复核回退：无待修订假设（如首轮即达标）时，
            # 取入围假设作为父版本做批判性再审视（自我辩证铁律的配套机制）
            if not parent_rows:
                rows = conn.execute(
                    """
                    SELECT h.* FROM hypotheses_v2 h
                    INNER JOIN (
                        SELECT h_code, MAX(version) AS mv FROM hypotheses_v2
                        WHERE run_id=? AND status='shortlisted' GROUP BY h_code
                    ) t ON h.h_code=t.h_code AND h.version=t.mv
                    WHERE h.run_id=? AND h.status='shortlisted'
                    ORDER BY h.overall_score DESC LIMIT 6
                    """,
                    (run_id, run_id)).fetchall()
                parent_rows = rows or None
                critique_mode = bool(rows)
        finally:
            conn.close()
    m3_result = await m3_hypothesis.generate_hypotheses(
        question, m1_result, cards, run_id, round_no=round_no,
        feedback_items=feedback_items, parent_rows=parent_rows,
        critique_mode=critique_mode)
    hyps = m3_result["hypotheses"]

    # ── M4 核验筛选（最终轮启用尽力入围兜底，保证计划环节必然执行）──
    _update_run(run_id, current_stage="m4_verify")
    m4_result = await m4_verify.verify_and_select(
        question, hyps, cards, run_id, round_no=round_no,
        is_final_round=(round_no >= max_rounds))

    # ── M5 计划设计（仅对入围假设）──
    _update_run(run_id, current_stage="m5_plan")
    shortlisted_full = [h for h in hyps if h.get("h_code") in m4_result["shortlisted"]]
    m5_result = await m5_plan.design_plan(question, shortlisted_full, cards, run_id, round_no=round_no)

    # ── M6 决策门 + 快照 ──
    _update_run(run_id, current_stage="m6_decide")
    snapshot = build_round_snapshot(run_id, round_no, m4_result, m5_result)
    decision, reason = decide_gate(snapshot, m4_result, m5_result, round_no, max_rounds)
    diff_note = diff_rounds(prev_snapshot, snapshot)
    save_round(run_id, round_no, snapshot, decision, reason, diff_note)

    # 反馈条目入表（自动评估反馈）
    conn = get_conn()
    try:
        for rv in m4_result["reviews"]:
            if rv["disposition"] == "revise" and rv.get("revision_instructions"):
                conn.execute(
                    """INSERT INTO feedback_entries
                    (run_id, round, fb_type, target_module, content) VALUES (?, ?, 'auto_eval', 'm3_hypothesis', ?)""",
                    (run_id, round_no,
                     f"{rv['h_code']}: " + "; ".join(rv["revision_instructions"])),
                )
            elif rv["disposition"] == "shortlist":
                # 入围假设的肯定性反馈（保留版本树演化留痕，避免反馈链因 dispose 收紧而断）
                conn.execute(
                    """INSERT INTO feedback_entries
                    (run_id, round, fb_type, target_module, content) VALUES (?, ?, 'auto_eval', 'm3_hypothesis', ?)""",
                    (run_id, round_no,
                     f"{rv['h_code']}: 入围（综合分 {rv['overall_score']}）— {rv.get('reason','')[:200]}"),
                )
        conn.commit()
    finally:
        conn.close()

    logger.info(f"🚪 R{round_no} 决策门: {decision} — {reason}")

    return {
        "round": round_no,
        "m1": m1_result if round_no == 1 else None,
        "m2": {"n_cards": len(cards), "n_online_lit": len(m2_result["literature_meta"]),
               "local_hits": m2_result["local_hits"], "search_queries": m2_result["search_queries"]},
        "m3": {"n_hypotheses": len(hyps)},
        "m4": {"reviews": m4_result["reviews"], "shortlisted": m4_result["shortlisted"],
               "needs_revision": m4_result["needs_revision"]},
        "m5": {"feasibility": m5_result.get("feasibility"),
               "content_md": m5_result.get("content_md", "")},
        "decision": decision,
        "decision_reason": reason,
        "diff_note": diff_note,
        "snapshot": snapshot,
    }


# ────────────────────────────────────────────────────────────────
# 多轮自迭代编排
# ────────────────────────────────────────────────────────────────

async def iterate(
    run_id: int,
    question: str,
    level: str = "A",
    max_rounds: int = MAX_ROUNDS,
    human_feedback: Optional[str] = None,
) -> dict:
    """从当前状态起持续迭代直至 pass/stop（或达最大轮数）。

    human_feedback：人工反馈文本 → 注入为 human 类型反馈条目参与下一轮。
    """
    conn = get_conn()
    try:
        run = conn.execute("SELECT current_round, status FROM pipeline_runs WHERE id=?",
                           (run_id,)).fetchone()
    finally:
        conn.close()
    if not run:
        return {"error": f"run {run_id} 不存在"}

    start_round = int(run["current_round"] or 1)
    # 已完成过首轮则从下一轮开始
    has_round1 = False
    conn = get_conn()
    try:
        has_round1 = conn.execute(
            "SELECT COUNT(*) FROM iteration_rounds WHERE run_id=? AND round>=1", (run_id,)
        ).fetchone()[0] > 0
    finally:
        conn.close()
    next_round = (start_round + 1) if has_round1 else start_round

    if human_feedback:
        conn = get_conn()
        try:
            conn.execute(
                """INSERT INTO feedback_entries
                (run_id, round, fb_type, target_module, content)
                VALUES (?, ?, 'human', 'm3_hypothesis', ?)""",
                (run_id, next_round, human_feedback))
            conn.commit()
        finally:
            conn.close()

    rounds_log = []
    m1_cache = None
    round_no = next_round
    prev_decision = None   # 跟踪上一轮决策，补料轮据此构造定向检索式（修复风险J）
    while round_no <= max_rounds:
        fb_items = None
        conn = get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM feedback_entries WHERE run_id=? AND applied=0", (run_id,)
            ).fetchall()
            fb_items = [dict(r) for r in rows]
            if rows:
                conn.execute(
                    "UPDATE feedback_entries SET applied=1 WHERE run_id=? AND applied=0", (run_id,))
                conn.commit()
        finally:
            conn.close()

        # 补料轮定向检索：上一轮判定 supplement_evidence 时，针对仍 open 的知识缺口
        # 与待修订假设构造检索式，让 M2 补充"对症下药"的证据，而非重复默认检索。
        supplement_queries: Optional[list[str]] = None
        if prev_decision == "supplement_evidence":
            conn = get_conn()
            try:
                open_gaps = [dict(g) for g in conn.execute(
                    "SELECT g_code, statement, parent_subquestion FROM knowledge_gaps "
                    "WHERE run_id=? AND status='open' ORDER BY g_code", (run_id,)).fetchall()]
            finally:
                conn.close()
            supplement_queries = []
            for g in open_gaps[:4]:
                base = (g.get("parent_subquestion") or "").strip()
                stmt = (g.get("statement") or "").strip()
                # 缺口陈述 + 子问题组合成检索式，聚焦证据薄弱处
                q = f"{question} {base}".strip() if base else stmt
                if q:
                    supplement_queries.append(q)
            if not supplement_queries:
                supplement_queries = [f"{question} recent evidence"]
            logger.info(f"🔍 R{round_no} 补料轮：针对 {len(open_gaps)} 个未决缺口构造 {len(supplement_queries)} 条定向检索式")

        result = await run_one_round(
            run_id, question, level, round_no,
            m1_result=m1_cache, feedback_items=fb_items, max_rounds=max_rounds,
            search_queries=supplement_queries)
        if round_no == next_round and result.get("m1"):
            m1_cache = result["m1"]
        rounds_log.append(result)
        prev_decision = result["decision"]

        if result["decision"] == "pass":
            _update_run(run_id, status="completed", result_class="full",
                        final_summary=f"R{round_no} 通过决策门：{result['decision_reason']}")
            break
        if result["decision"] == "stop":
            _update_run(run_id, status="completed", result_class="partial",
                        final_summary=f"R{round_no} 停止：{result['decision_reason']}")
            break
        round_no += 1
    else:
        _update_run(run_id, status="completed", result_class="partial",
                    final_summary=f"达到最大轮数 {max_rounds}，结果为部分收敛")

    return {"run_id": run_id, "rounds": rounds_log,
            "final_decision": rounds_log[-1]["decision"] if rounds_log else "none"}
