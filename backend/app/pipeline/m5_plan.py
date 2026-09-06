"""
M5 研究计划设计器 — 对应模板 P13（研究计划输出）
五环节结构（方案 §4.5）：
  1 predictions      待验证预测清单（逐条挂接假设）
  2 resources        数据/资料/条件（区分 已具备/待获取）
  3 steps            研究步骤与分析方法
  4 outcome_table    结果判定表（不同结果分别支持/反对什么）★模板硬性要求
  5 stop_conditions  停止/回退/补证据条件

可执行性检查：对计划做资源齐备度、时间依赖、判据完备性自检。
"""

import json
from typing import Optional
from loguru import logger

from .llm import chat_json, chat_text
from .db import get_conn
from .skills_library import skill_prompt

M5_SYSTEM_PROMPT = """你是研究计划设计专家。为入围的科学假设设计可执行研究计划，输出纯JSON。

规则：
1. predictions：每条预测必须挂接假设（h_code），写明观测对象、预期方向、判定阈值（可定量则定量）。
2. resources：每项资源标注 status（ready=已具备 / to_acquire=待获取）与获取途径；禁止虚构已有资源。
3. steps：按时间序给出步骤，每步含方法与预期产出；须与 predictions 对应。
4. outcome_table【关键】：对每条核心预测列出 ≥2 种可能结果，逐一写明"该结果支持什么/反对什么/后续动作"。
5. stop_conditions：写明何时停止（证据饱和）、何时回退（假设被否定→触发替代解释检验）、何时补证据。
6. 计划只描述"将要做什么"，不得宣称假设已被证实。

输出JSON格式：
{
  "hypothesis_ids": ["H-01"],
  "predictions": [
    {"p_code": "P1", "h_code": "H-01", "prediction": "...", "measure": "观测/测量方式", "expected": "预期方向与阈值"}
  ],
  "resources": [
    {"name": "...", "kind": "data|literature|instrument|compute", "status": "ready|to_acquire", "how": "获取途径"}
  ],
  "steps": [
    {"order": 1, "action": "...", "method": "...", "output": "...", "linked_predictions": ["P1"]}
  ],
  "outcome_table": [
    {"p_code": "P1", "branches": [
      {"outcome": "结果A", "supports": ["H-01"], "opposes": [], "next_action": "..."},
      {"outcome": "结果B", "supports": [], "opposes": ["H-01"], "next_action": "触发替代解释检验"}
    ]}
  ],
  "stop_conditions": ["..."]
}"""

M5_FEASIBILITY_PROMPT = """你是科研可行性评审专家。对以下研究计划做可执行性检查，输出纯JSON：
{
  "resource_completeness": 0-1,   // 关键资源是否齐备
  "resource_gaps": ["缺失资源1"],
  "dependency_ok": true/false,     // 步骤依赖是否合理
  "criteria_completeness": 0-1,    // 结果判定判据是否完备
  "risks": ["执行风险1"],
  "verdict": "executable|needs_adjustment|not_executable",
  "advice": "一句话结论"
}"""


def _fallback_plan(question: str, shortlisted: list[dict]) -> dict:
    """兜底计划骨架（标注 mock）。"""
    h_codes = [h.get("h_code") for h in shortlisted] or ["H-01"]
    return {
        "hypothesis_ids": h_codes,
        "predictions": [
            {
                "p_code": f"P{i+1}", "h_code": hc,
                "prediction": f"[Mock] 针对 {hc} 的核心预测（待真实引擎接入后细化判据）",
                "measure": "[Mock] 定向观测/数据分析", "expected": "[Mock] 方向性信号",
            } for i, hc in enumerate(h_codes[:2])
        ],
        "resources": [
            {"name": "本地数据集与文献库", "kind": "data", "status": "ready", "how": "datasets/ 目录与在线检索"},
            {"name": "[Mock] 领域专用数据", "kind": "data", "status": "to_acquire", "how": "待M2补料轮检索"},
        ],
        "steps": [
            {"order": 1, "action": "[Mock] 证据补全与数据准备", "method": "M2 补料轮",
             "output": "扩展证据卡片", "linked_predictions": ["P1"]},
            {"order": 2, "action": "[Mock] 定向观测/分析", "method": "按 predictions 判据执行",
             "output": "结果判定表填充", "linked_predictions": ["P1"]},
        ],
        "outcome_table": [
            {"p_code": "P1", "branches": [
                {"outcome": "[Mock] 观测到预期方向信号", "supports": h_codes[:1], "opposes": [],
                 "next_action": "进入下一预测检验"},
                {"outcome": "[Mock] 未观测到信号", "supports": [], "opposes": h_codes[:1],
                 "next_action": "触发替代解释检验并回退M3"},
            ]}
        ],
        "stop_conditions": ["[Mock] 证据饱和且核心预测均有判定", "[Mock] 假设被否定且替代解释均被排除"],
        "_mock": True,
    }


def render_plan_md(plan: dict, question: str, shortlisted: list[dict]) -> str:
    """整合为 Markdown 计划全文（供前端展示与 P14 材料导出）。"""
    lines = [f"# 研究计划 — {question}", ""]
    lines.append("## 入围假设")
    for h in shortlisted:
        lines.append(f"- **{h.get('h_code')}**（v{h.get('_version',1)}，总分 {h.get('overall_score','-')}）：{h.get('statement','')}")
    lines.append("")
    lines.append("## 环节1 待验证预测")
    for p in plan.get("predictions", []):
        lines.append(f"- **{p.get('p_code')}**（{p.get('h_code')}）：{p.get('prediction','')}｜测量：{p.get('measure','')}｜预期：{p.get('expected','')}")
    lines.append("")
    lines.append("## 环节2 数据/资料/条件")
    for r in plan.get("resources", []):
        st = "已具备" if r.get("status") == "ready" else "待获取"
        lines.append(f"- [{st}] {r.get('name','')}（{r.get('kind','')}）— {r.get('how','')}")
    lines.append("")
    lines.append("## 环节3 研究步骤与方法")
    for s in plan.get("steps", []):
        lines.append(f"{s.get('order','?')}. **{s.get('action','')}**｜方法：{s.get('method','')}｜产出：{s.get('output','')}｜关联预测：{s.get('linked_predictions',[])}")
    lines.append("")
    lines.append("## 环节4 结果判定表")
    for ot in plan.get("outcome_table", []):
        lines.append(f"- **{ot.get('p_code')}**：")
        for b in ot.get("branches", []):
            sup = ",".join(b.get("supports", [])) or "—"
            opp = ",".join(b.get("opposes", [])) or "—"
            lines.append(f"  - 若「{b.get('outcome','')}」→ 支持 {sup}；反对 {opp}；后续：{b.get('next_action','')}")
    lines.append("")
    lines.append("## 环节5 停止/回退条件")
    for sc in plan.get("stop_conditions", []):
        lines.append(f"- {sc}")
    return "\n".join(lines)


async def design_plan(
    question: str,
    shortlisted: list[dict],
    cards: list[dict],
    run_id: int,
    round_no: int = 1,
) -> dict:
    """M5：生成五环节计划 + 可执行性检查，落库并返回。"""
    if not shortlisted:
        logger.warning("⚠️ M5：无入围假设，跳过计划生成")
        return {"plan": None, "feasibility": None, "content_md": "", "model_used": "skip"}

    hyp_block = "\n".join(
        f"--- {h.get('h_code')} ---\n陈述: {h.get('statement','')}\n"
        f"可检验预测: {h.get('testable_prediction','')}\n证伪标准: {h.get('falsification_criteria','')}\n"
        f"替代解释: {h.get('alternative_explanations',[])}"
        for h in shortlisted
    )
    card_block = "\n".join(
        f"{c.get('e_code')} [{c.get('claim_type')}, 来源:{c.get('source_type')}] {c.get('claim','')}"
        for c in cards[:20]
    )

    # 技能注入：SK-06 结果判定表 + SK-07 事前验尸
    skill_block = skill_prompt("m5_plan")

    plan, model_used = await chat_json(
        system_prompt=M5_SYSTEM_PROMPT,
        user_prompt=(
            f"科学问题：{question}\n轮次：R{round_no}\n\n"
            f"=== 入围假设 ===\n{hyp_block}\n\n=== 可用证据 ===\n{card_block}\n\n"
            f"=== 适用科研技能（须遵守）===\n{skill_block}\n\n"
            f"请设计五环节研究计划。"
        ),
        model="general",
        temperature=0.35,
        fallback=_fallback_plan(question, shortlisted),
    )

    # 形状防御（迭代5加固，与 M4 同类风险）：LLM 偶发返回 JSON 数组而非对象
    if not isinstance(plan, dict):
        logger.warning("⚠️ M5 返回非对象结构，使用兜底计划")
        plan = _fallback_plan(question, shortlisted)

    # 规范化
    plan.setdefault("hypothesis_ids", [h.get("h_code") for h in shortlisted])
    for key in ("predictions", "resources", "steps", "outcome_table", "stop_conditions"):
        if not isinstance(plan.get(key), list):
            plan[key] = []

    content_md = render_plan_md(plan, question, shortlisted)

    # ── 可执行性检查（叠加事前验尸视角）──
    premortem = skill_prompt("m5_plan", codes=["SK-07"])
    feasibility, fe_model = await chat_json(
        system_prompt=M5_FEASIBILITY_PROMPT,
        user_prompt=(
            f"研究计划：\n{content_md}\n\n"
            f"评审时请额外运用以下视角：\n{premortem}"
        ),
        model="general",
        temperature=0.2,
        fallback={
            "resource_completeness": 0.5, "resource_gaps": [], "dependency_ok": True,
            "criteria_completeness": 0.5, "risks": [], "verdict": "needs_adjustment",
            "advice": "[Mock] 可执行性检查待真实引擎接入", "_mock": True,
        },
    )

    # ── 落库 ──
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO plans_v2
            (run_id, round, hypothesis_ids, predictions, resources, steps,
             outcome_table, stop_conditions, feasibility_report, content_md)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id, round_no,
                json.dumps(plan.get("hypothesis_ids", []), ensure_ascii=False),
                json.dumps(plan.get("predictions", []), ensure_ascii=False),
                json.dumps(plan.get("resources", []), ensure_ascii=False),
                json.dumps(plan.get("steps", []), ensure_ascii=False),
                json.dumps(plan.get("outcome_table", []), ensure_ascii=False),
                json.dumps(plan.get("stop_conditions", []), ensure_ascii=False),
                json.dumps(feasibility, ensure_ascii=False),
                content_md,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    logger.info(
        f"✅ M5 完成 | 预测 {len(plan.get('predictions', []))} 条 | 步骤 {len(plan.get('steps', []))} 步 | "
        f"可执行性: {feasibility.get('verdict', '?')} | model: {model_used}"
    )
    return {
        "plan": plan,
        "feasibility": feasibility,
        "content_md": content_md,
        "model_used": model_used,
    }
