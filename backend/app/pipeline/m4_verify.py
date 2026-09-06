"""
M4 核验筛选器 — 对应模板 P11/P12（证据梳理与筛选）
六维核验（方案 §4.4）：
  1 relevance            假设与问题的相关性
  2 evidence_consistency 证据链一致性（支持/反对证据与陈述是否自洽）
  3 citation_check       引用真实性（证据卡片核验状态回溯）
  4 testability          可检验性（预测与证伪标准是否可操作）
  5 duplication          与既有假设去重
  6 entry_score          综合入门分（加权）

输出：每个假设六维得分 + 处置建议（shortlist / revise / reject），
落库 hypotheses_v2.scores / overall_score / status。
"""

import json
from typing import Optional
from loguru import logger

from .llm import chat_json
from .db import get_conn

# 六维权重（方案 §4.4 表4-2，可经环境变量覆写）
DIM_WEIGHTS = {
    "relevance": 0.20,
    "evidence_consistency": 0.25,
    "citation_check": 0.15,
    "testability": 0.25,
    "duplication": 0.05,
    "novelty_plausibility": 0.10,
}

SHORTLIST_THRESHOLD = 0.62
REVISE_THRESHOLD = 0.45

M4_SYSTEM_PROMPT = """你是科学假设评审专家（集成评审制：独立评分后合议）。对候选假设做六维核验，输出纯JSON。

六维评分标准（每维 0-1，保留两位小数）：
1. relevance：假设是否紧扣科学问题与所挂缺口，对象/变量是否对应。
2. evidence_consistency：陈述与所引证据是否自洽；对反对证据是否诚实处理（隐瞒反对证据重扣）。
3. citation_check：所引证据来源是否可靠（fact>已核验文献>未核验文献>模型推断）；引用纯模型推断作关键支柱者重扣。
4. testability：testable_prediction 与 falsification_criteria 是否可操作（有判据、有方向、可观测）。
5. duplication：与其余候选假设是否高度重复（重复=低分；本维评"区分度"）。
6. novelty_plausibility：新颖性与机制合理性的平衡（过于天马行空或过于平庸都扣分）。

处置建议规则：
- 综合分≥0.62 → shortlist
- 0.45≤综合分<0.62 → revise（必须给出具体修改指令）
- 综合分<0.45 → reject（说明主因）

严禁把假设当作已验证结论评价；评价对象是"假设的质量"而非"结论的真假"。

输出JSON格式：
{
  "reviews": [
    {
      "h_code": "H-01",
      "scores": {
        "relevance": 0.8, "evidence_consistency": 0.7, "citation_check": 0.6,
        "testability": 0.75, "duplication": 0.9, "novelty_plausibility": 0.7
      },
      "dim_notes": {"relevance": "...", "evidence_consistency": "...", "citation_check": "...",
                    "testability": "...", "duplication": "...", "novelty_plausibility": "..."},
      "weak_dims": ["citation_check"],
      "revision_instructions": ["具体修改指令1"],
      "disposition": "shortlist|revise|reject",
      "reason": "处置理由（一句话）"
    }
  ],
  "shortlist_ranking": ["H-02", "H-01"]
}"""


def _heuristic_scores(h: dict, cards_by_code: dict) -> dict:
    """规则化基线评分（LLM不可用时的兜底，确定性可复现）。"""
    sup = h.get("supporting_evidence") or []
    ctr = h.get("counter_evidence") or []
    cited = (h.get("basis") or {}).get("cited_evidence", [])
    all_refs = set(sup) | set(ctr) | set(cited)

    # citation_check：按所引证据的类型/核验状态加权
    if all_refs:
        vals = []
        for code in all_refs:
            c = cards_by_code.get(code) or {}
            ct = c.get("claim_type", "model_inference")
            base = {"fact": 0.85, "literature_interpretation": 0.65, "model_inference": 0.4}.get(ct, 0.4)
            if c.get("verified"):
                base = min(base + 0.1, 0.95)
            vals.append(base)
        citation = sum(vals) / len(vals)
    else:
        citation = 0.2

    testability = 0.0
    if h.get("testable_prediction") and not str(h.get("testable_prediction")).startswith("[Mock]"):
        testability += 0.5
    if h.get("falsification_criteria") and not str(h.get("falsification_criteria")).startswith("[Mock]"):
        testability += 0.5

    evidence_consistency = 0.5
    if sup:
        evidence_consistency += 0.2
    if ctr or not cards_by_code:  # 诚实列出反对证据，或无证据可冲突
        evidence_consistency += 0.15

    relevance = 0.6 if h.get("gap_id") else 0.4
    return {
        "relevance": round(relevance, 2),
        "evidence_consistency": round(min(evidence_consistency, 0.95), 2),
        "citation_check": round(citation, 2),
        "testability": round(testability, 2),
        "duplication": 0.8,
        "novelty_plausibility": 0.6,
    }


def _heuristic_instructions(scores: dict) -> list[str]:
    """规则化修订指令：按最弱维度生成确定性改进要求（保证 Mock 模式反馈链不断）。"""
    instr = []
    if scores.get("testability", 0) < 0.6:
        instr.append("补全可检验预测与证伪标准：写明观测对象、预期方向、判定阈值与'若X则否定'判据")
    if scores.get("citation_check", 0) < 0.6:
        instr.append("关键支柱证据不得仅依赖模型推断：在下一轮补料中检索已核验文献替换或佐证")
    if scores.get("evidence_consistency", 0) < 0.6:
        instr.append("证据链不自洽：明确回应冲突证据，说明支持/反对证据与陈述的对应关系")
    if scores.get("relevance", 0) < 0.6:
        instr.append("重新挂接知识缺口：陈述中的对象与变量须与所挂缺口一一对应")
    if not instr:
        instr.append("综合分接近阈值：强化陈述的可证伪性与证据覆盖后重评")
    return instr


async def verify_and_select(
    question: str,
    hyps: list[dict],
    cards: list[dict],
    run_id: int,
    round_no: int = 1,
    is_final_round: bool = False,
) -> dict:
    """M4：六维核验 → 综合分 → 处置。返回 {"reviews":..., "shortlisted":[h_code], ...}

    is_final_round: 最终轮标记。启用「尽力入围」兜底：若全部假设均被
    revise/reject 拦截，强制将得分最高者提为入围（标注 best_effort），
    保证 M5 计划环节必然执行、六环节闭环不断裂（迭代2.5修复，源于训练集题27诊断）。
    """
    cards_by_code = {c.get("e_code"): c for c in cards}

    hyp_block = "\n".join(
        f"--- {h.get('h_code')} (缺口 {h.get('gap_id')}, v{h.get('_version',1)}) ---\n"
        f"陈述: {h.get('statement','')}\n"
        f"依据: {json.dumps(h.get('basis',{}), ensure_ascii=False)[:400]}\n"
        f"支持证据: {h.get('supporting_evidence',[])} | 反对证据: {h.get('counter_evidence',[])}\n"
        f"可检验预测: {h.get('testable_prediction','')}\n"
        f"证伪标准: {h.get('falsification_criteria','')}\n"
        f"替代解释: {h.get('alternative_explanations',[])}\n"
        f"不确定性: {h.get('uncertainty_level','')} {h.get('uncertainty_sources',[])}"
        for h in hyps
    )

    card_block = "\n".join(
        f"{c.get('e_code')} [{c.get('claim_type')}, 核验={'已核验' if c.get('verified') else '未核验'}, "
        f"conf={c.get('confidence')}] {c.get('claim','')}"
        for c in cards
    )

    result, model_used = await chat_json(
        system_prompt=M4_SYSTEM_PROMPT,
        user_prompt=(
            f"科学问题：{question}\n轮次：R{round_no}\n\n"
            f"=== 候选假设 ===\n{hyp_block}\n\n=== 证据卡片（核验状态）===\n{card_block}\n\n"
            f"请对每个假设给出六维评分与处置建议。"
        ),
        model="general",
        temperature=0.2,
        fallback=None,
    )

    # 形状防御（迭代5修复，源于测试集题79诊断）：LLM 偶发返回 JSON 数组
    # （直接给 reviews 列表）而非对象，result.get 会抛 AttributeError 致整 run 失败。
    if isinstance(result, list):
        result = {"reviews": result}
    elif not isinstance(result, dict):
        result = {}
    reviews_raw = result.get("reviews")
    if not isinstance(reviews_raw, list):
        reviews_raw = []
    reviews_by_code = {
        r.get("h_code"): r for r in reviews_raw if isinstance(r, dict)
    }
    is_mock = not reviews_by_code

    final_reviews = []
    for h in hyps:
        code = h.get("h_code")
        rv = reviews_by_code.get(code)
        if rv and isinstance(rv.get("scores"), dict):
            scores = {k: float(v or 0) for k, v in rv["scores"].items() if k in DIM_WEIGHTS}
        else:
            scores = _heuristic_scores(h, cards_by_code)
            rv = rv or {}
        overall = sum(scores.get(k, 0) * w for k, w in DIM_WEIGHTS.items())
        overall = round(overall, 3)

        disp = rv.get("disposition", "")
        if disp not in ("shortlist", "revise", "reject"):
            disp = "shortlist" if overall >= SHORTLIST_THRESHOLD else (
                "revise" if overall >= REVISE_THRESHOLD else "reject"
            )
        # 分数-处置一致性约束（迭代2.5修复，源于训练集题27诊断）：
        # 定性处置不得严于定量阈值——否则出现"高分却困于 revise"的死循环，
        # 假设永远无法入围、M5 永不生成计划、六环节闭环断裂。
        # 评审的修改意见仍保留在 revision_instructions 供下一轮参考。
        if disp == "revise" and overall >= SHORTLIST_THRESHOLD:
            disp = "shortlist"
        elif disp == "shortlist" and overall < REVISE_THRESHOLD:
            disp = "revise"
        status_map = {"shortlist": "shortlisted", "revise": "needs_revision", "reject": "rejected"}

        # 修订指令：模型给出则用模型的；否则规则化生成（保证反馈链不断）
        weak_dims = rv.get("weak_dims") or [k for k, v in scores.items() if v < 0.6]
        revision_instructions = rv.get("revision_instructions") or (
            _heuristic_instructions(scores) if disp == "revise" else []
        )

        final_reviews.append({
            "h_code": code,
            "scores": scores,
            "overall_score": overall,
            "dim_notes": rv.get("dim_notes", {}),
            "weak_dims": weak_dims,
            "revision_instructions": revision_instructions,
            "disposition": disp,
            "reason": rv.get("reason") or (
                f"（规则化阈值判定：{overall}，弱维度 {weak_dims}）" if is_mock else ""
            ),
        })

        # 落库评分与状态
        conn = get_conn()
        try:
            conn.execute(
                """
                UPDATE hypotheses_v2
                SET scores=?, overall_score=?, status=?, decision_note=?
                WHERE id=?
                """,
                (
                    json.dumps({"scores": scores, "dim_notes": rv.get("dim_notes", {}),
                                "weak_dims": weak_dims,
                                "revision_instructions": revision_instructions},
                               ensure_ascii=False),
                    overall,
                    status_map[disp],
                    (rv.get("reason") or "")[:500],
                    h.get("_row_id"),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    final_reviews.sort(key=lambda r: r["overall_score"], reverse=True)
    shortlisted = [r["h_code"] for r in final_reviews if r["disposition"] == "shortlist"]
    needs_revision = [r["h_code"] for r in final_reviews if r["disposition"] == "revise"]

    # 最终轮「尽力入围」兜底：全部假设被拦截时，强制提升得分最高者为入围，
    # 并在库中同步状态，保证 M5 计划环节执行、六环节闭环不断裂。
    best_effort = False
    if is_final_round and not shortlisted and final_reviews:
        top = final_reviews[0]
        top["disposition"] = "shortlist"
        top["reason"] = (
            (top.get("reason") or "") +
            f"｜[尽力入围] 最终轮无假设达常规阈值，按最高综合分 {top['overall_score']} 强制提入"
        ).strip("｜")
        shortlisted = [top["h_code"]]
        needs_revision = [r["h_code"] for r in final_reviews
                          if r["disposition"] == "revise"]
        best_effort = True
        conn = get_conn()
        try:
            conn.execute(
                "UPDATE hypotheses_v2 SET status='shortlisted', decision_note=? "
                "WHERE run_id=? AND h_code=? AND round=?",
                (top["reason"][:500], run_id, top["h_code"], round_no))
            conn.commit()
        finally:
            conn.close()

    logger.info(
        f"✅ M4 完成 | 评审 {len(final_reviews)} 条 | 入围 {shortlisted} | "
        f"待修订 {needs_revision} | 尽力入围兜底: {best_effort} | model: {model_used}"
    )
    return {
        "reviews": final_reviews,
        "shortlisted": shortlisted,
        "needs_revision": needs_revision,
        "best_effort": best_effort,
        "model_used": model_used,
        "_mock_eval": is_mock,
    }
