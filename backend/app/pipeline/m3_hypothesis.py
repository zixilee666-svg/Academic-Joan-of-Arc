"""
M3 候选假设生成器 — 对应模板 P10（假设从何而来）
七要素统一表达（方案 §4.3）：
  1 statement            核心陈述（可证伪命题）
  2 basis                形成依据（推理链 + 引用）
  3 supporting_evidence  支持证据（E-code 列表）
  4 counter_evidence     反对/冲突证据（E-code 列表）
  5 testable_prediction  可检验预测
  6 falsification_criteria 证伪标准
  7 alternative_explanations 替代解释

假设树搜索（移植 AI Scientist-v2 BFTS 思想）：
  - 首轮：每个高严重度缺口生成 num_drafts 个候选（树根，depth=0）
  - 迭代轮：对 needs_revision 假设生成子节点（version+1, depth+1），
    父节点保留为历史版本 → 支撑 P17 版本比较
"""

import json
from typing import Optional
from loguru import logger

from .llm import chat_json
from .db import get_conn
from .skills_library import skill_prompt

M3_SYSTEM_PROMPT = """你是科学假设生成专家。基于知识缺口与证据卡片，生成候选科学假设，输出纯JSON。

铁律（违反即作废）：
1. 假设必须是可证伪命题：有明确研究对象、机制方向、可观测推论；禁止"可能有关系"式空泛陈述。
2. 每个假设必须挂接一个知识缺口（gap_id），并给出从证据到假设的推理链（basis.reasoning_chain），推理链中引用的证据必须使用给定的 E-code，不得虚构编号。
3. 必须诚实列出反对证据（counter_evidence）：证据卡片中与该假设结论相悖的 E-code；若确无则写空数组。
4. testable_prediction 必须给出可操作的观测/实验/数据分析判据（含方向与预期）。
5. falsification_criteria 必须写明"若观察到X，则该假设被否定"。
6. alternative_explanations 至少给出1条竞争解释。
7. 严禁把假设表述为已验证结论；措辞使用"假设/推测/若…则…"。
8. 若为修订轮：须针对反馈逐条回应，说明相对父版本改了什么、为何改。

输出JSON格式：
{
  "hypotheses": [
    {
      "h_code": "H-01",
      "gap_id": "G-01",
      "statement": "核心陈述（可证伪命题）",
      "basis": {
        "reasoning_chain": "由E-xxxx与E-xxxx可知…，故推测…",
        "cited_evidence": ["E-0001", "E-0002"],
        "inference_type": "abductive|deductive|analogical"
      },
      "supporting_evidence": ["E-0001"],
      "counter_evidence": ["E-0003"],
      "testable_prediction": "可检验预测（含判据）",
      "falsification_criteria": "证伪标准",
      "alternative_explanations": ["竞争解释1"],
      "uncertainty_level": "high|medium|low",
      "uncertainty_sources": ["不确定性来源1"],
      "revision_note": "修订说明（首轮留空）"
    }
  ]
}"""


def _fallback_hypotheses(gaps: list[dict], cards: list[dict], round_no: int) -> dict:
    """兜底：为每个高严重度缺口生成一个骨架假设（标注 mock）。"""
    e_codes = [c.get("e_code", "") for c in cards if c.get("e_code")][:4]
    hyps = []
    high_gaps = [g for g in gaps if g.get("severity") in ("high", "medium")] or gaps[:1]
    for i, g in enumerate(high_gaps[:3], 1):
        hyps.append({
            "h_code": f"H-{i:02d}",
            "gap_id": g.get("g_code", ""),
            "statement": f"[Mock] 针对缺口「{g.get('statement','')}」的机制性假设：存在可识别的主导机制变量，其效应方向可通过定向观测判定（待真实推理引擎接入后替换）",
            "basis": {
                "reasoning_chain": "[Mock] 推理引擎未连接，推理链待补",
                "cited_evidence": e_codes,
                "inference_type": "abductive",
            },
            "supporting_evidence": e_codes[:2],
            "counter_evidence": e_codes[2:3],
            "testable_prediction": "[Mock] 若机制成立，则定向观测应呈现特定方向性信号",
            "falsification_criteria": "[Mock] 若定向观测无方向性信号，则假设被否定",
            "alternative_explanations": ["[Mock] 观测信号可能由已知混杂因素导致"],
            "uncertainty_level": "high",
            "uncertainty_sources": ["推理引擎未连接，证据链为占位"],
            "revision_note": "" if round_no == 1 else "[Mock] 修订轮占位",
        })
    return {"hypotheses": hyps, "_mock": True}


async def generate_hypotheses(
    question: str,
    m1_result: dict,
    cards: list[dict],
    run_id: int,
    round_no: int = 1,
    num_drafts: int = 3,
    feedback_items: Optional[list[dict]] = None,
    parent_rows: Optional[list] = None,
    critique_mode: bool = False,
) -> dict:
    """M3：生成候选假设并落库（假设树）。

    feedback_items: M6 路由回来的反馈（上一轮评审/人工/补料）
    parent_rows:    需要修订的父版本假设（sqlite Row 列表）→ 本轮生成其子节点
    critique_mode:  批判复核模式（父版本为入围假设）→ 以"魔鬼代言人"立场强化批判
    """
    gaps = m1_result.get("gaps") or []
    # 只把高价值缺口交给模型（控制上下文）
    focus_gaps = [g for g in gaps if g.get("severity") in ("high", "medium")] or gaps

    card_block = "\n".join(
        f"{c.get('e_code','?')} [{c.get('claim_type','?')}, conf={c.get('confidence','?')}] "
        f"{c.get('claim','')}"
        + (f"（与 {c.get('conflict_with')} 冲突）" if c.get("conflict_with") else "")
        for c in cards
    ) or "（暂无证据卡片）"

    gap_block = "\n".join(
        f"{g.get('g_code','?')} [severity={g.get('severity','?')}] {g.get('statement','')}"
        for g in focus_gaps
    ) or "（无）"

    if parent_rows:
        parent_block = "\n".join(
            f"父版本 {p['h_code']} v{p['version']}: {p['statement']}\n  取舍备注: {p['decision_note'] or '无'}"
            for p in parent_rows
        )
        if critique_mode:
            mode_note = (
                f"【批判复核模式】以下假设已入围但尚未经过批判性复核。请你扮演'魔鬼代言人'：\n"
                f"1) 逐条质疑每个父版本：找出其推理链中最薄弱的一环、被忽略的反对证据、隐含的未检验前提；\n"
                f"2) 为每个父版本生成 1 个强化子版本（h_code 与父版本相同，新 version）：修补弱点、收紧可检验预测、"
                f"显式回应你提出的质疑，并在 revision_note 中写明'质疑→修补'的对应关系；\n"
                f"3) 若某个父版本经质疑后发现不可救药，可如实说明并给出替代方向。\n"
                f"{parent_block}\n"
            )
        else:
            mode_note = (
                f"【修订模式】以下父版本假设被判定需要修订，请为每个父版本生成 1 个修订子版本"
                f"（h_code 与父版本相同，将在库中记为新 version），并在 revision_note 中逐条回应反馈：\n{parent_block}\n"
            )
    else:
        mode_note = f"【首轮生成模式】为每个重点缺口生成 {num_drafts} 个相互竞争的候选假设（共不超过 {num_drafts * max(1, len(focus_gaps))} 个）。"

    fb_block = ""
    if feedback_items:
        fb_block = "\n=== 上轮反馈（须逐条回应）===\n" + "\n".join(
            f"- [{f.get('fb_type','?')}→{f.get('target_module','?')}] {f.get('content','')}"
            for f in feedback_items
        )

    # 技能注入：SK-05 可证伪性锻造（每轮）；SK-04 魔鬼代言人批判（仅批判复核轮）
    skill_codes = ["SK-05"] + (["SK-04"] if critique_mode else [])
    skill_block = skill_prompt("m3_hypothesis", codes=skill_codes)

    user_prompt = (
        f"科学问题：{question}\n当前轮次：R{round_no}\n\n"
        f"=== 知识缺口 ===\n{gap_block}\n\n"
        f"=== 证据卡片 ===\n{card_block}\n\n"
        f"{mode_note}{fb_block}\n\n"
        f"=== 适用科研技能（须遵守）===\n{skill_block}\n\n"
        f"请输出候选假设。"
    )

    result, model_used = await chat_json(
        system_prompt=M3_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        model="reasoning" if round_no == 1 else "general",
        temperature=0.7 if round_no == 1 else 0.4,
        fallback=_fallback_hypotheses(focus_gaps, cards, round_no),
        # 首轮多缺口×多假设×七要素的完整 JSON 常超 4096，放宽上限防截断
        max_tokens=8192 if round_no == 1 else 6144,
    )

    # 形状防御（迭代5加固，与 M4 同类风险）：LLM 偶发直接返回假设数组
    if isinstance(result, list):
        result = {"hypotheses": result}
    elif not isinstance(result, dict):
        result = _fallback_hypotheses(focus_gaps, cards, round_no)

    hyps = result.get("hypotheses") or []
    if not isinstance(hyps, list):
        hyps = []

    # ── 规范化 + 树挂接 ──
    valid_e = {c.get("e_code") for c in cards if c.get("e_code")}
    parent_by_code = {p["h_code"]: p for p in (parent_rows or [])}

    conn = get_conn()
    try:
        # 同轮重跑幂等
        conn.execute(
            "DELETE FROM hypotheses_v2 WHERE run_id=? AND round=?", (run_id, round_no)
        )
        saved = []
        for i, h in enumerate(hyps, 1):
            h.setdefault("h_code", f"H-{i:02d}")
            # 证据引用白名单过滤（防幻觉编号）
            def _filter_codes(lst):
                if not isinstance(lst, list):
                    return []
                return [x for x in lst if x in valid_e]
            sup = _filter_codes(h.get("supporting_evidence"))
            ctr = _filter_codes(h.get("counter_evidence"))
            cited = _filter_codes((h.get("basis") or {}).get("cited_evidence", []))
            basis = h.get("basis") or {}
            basis["cited_evidence"] = cited

            parent_id = None
            depth = 0
            version = 1
            parent = parent_by_code.get(h["h_code"])
            if parent:
                parent_id = parent["id"]
                depth = int(parent["tree_depth"] or 0) + 1
                version = int(parent["version"] or 1) + 1

            cur = conn.execute(
                """
                INSERT INTO hypotheses_v2
                (run_id, round, h_code, version, parent_id, tree_depth, gap_id, statement,
                 basis, supporting_evidence, counter_evidence, testable_prediction,
                 falsification_criteria, alternative_explanations, uncertainty_level,
                 uncertainty_sources, revision_note, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate')
                """,
                (
                    run_id, round_no, h["h_code"], version, parent_id, depth,
                    h.get("gap_id", ""), h.get("statement", ""),
                    json.dumps(basis, ensure_ascii=False),
                    json.dumps(sup, ensure_ascii=False),
                    json.dumps(ctr, ensure_ascii=False),
                    h.get("testable_prediction", ""),
                    h.get("falsification_criteria", ""),
                    json.dumps(h.get("alternative_explanations", []), ensure_ascii=False),
                    h.get("uncertainty_level", "medium"),
                    json.dumps(h.get("uncertainty_sources", []), ensure_ascii=False),
                    h.get("revision_note", "") or "",
                ),
            )
            h["_row_id"] = cur.lastrowid
            h["_version"] = version
            h["_tree_depth"] = depth
            saved.append(h)
        conn.commit()
    finally:
        conn.close()

    logger.info(
        f"✅ M3 完成 | 候选假设 {len(saved)} 条 | 轮次 R{round_no} | "
        f"修订自父版本 {len(parent_by_code)} 条 | model: {model_used}"
    )
    return {"hypotheses": saved, "model_used": model_used}
