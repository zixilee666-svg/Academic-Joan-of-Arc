"""
M1 问题理解器 — 对应模板 P8
四步结构化拆解：
  1 识别研究对象与范围
  2 提取已有条件与关键变量
  3 区分已有认识、争议与未知
  4 形成可处理的知识缺口（C级题强制降维拆解）
"""

import json
from typing import Optional
from loguru import logger

from .llm import chat_json
from .db import get_conn
from .skills_library import skill_prompt

M1_SYSTEM_PROMPT = """你是科学问题解析专家。将给定的科学问题拆解为结构化要素，输出纯JSON。

规则：
1. 若问题宏大（无明确研究对象/不可直接检验），必须先降维为2-4个可回答的子问题，每个子问题须有明确研究对象、可检验方向、可检索的文献支撑；并在 decomposition_note 中说明降维理由。
2. gaps 中每条缺口必须包含研究对象、关键变量、可检验边界，避免空泛。
3. consensus=领域共识；controversies=现存争议（注明对立观点）；unknowns=未知。
4. 严禁编造具体数据；不确定时写"待证据核验"。

输出JSON格式：
{
  "is_grand": true/false,
  "decomposition_note": "降维说明（非宏大问题填空字符串）",
  "subquestions": ["子问题1", "子问题2"],
  "objects": ["研究对象1"],
  "scope": "学科范围与时空尺度",
  "conditions": ["已有条件/预设"],
  "variables": ["关键变量"],
  "consensus": ["已有共识"],
  "controversies": ["争议点（对立观点）"],
  "unknowns": ["未知内容"],
  "gaps": [
    {"g_code": "G-01", "statement": "缺口陈述（含对象/变量/边界）", "severity": "high|medium|low", "parent_subquestion": "所属子问题（可空）"}
  ]
}"""


def _fallback_analysis(question: str) -> dict:
    """LLM不可用时的确定性兜底（保证流水线端到端可跑，输出标注mock）。"""
    return {
        "is_grand": len(question) <= 15,
        "decomposition_note": "[Mock] 推理引擎未连接，降维分析待补充",
        "subquestions": [f"{question}的机制是什么", f"{question}可通过何种观测/实验检验"],
        "objects": ["（待M2证据补充）"],
        "scope": "（待分析）",
        "conditions": [],
        "variables": ["（待识别）"],
        "consensus": [],
        "controversies": [],
        "unknowns": [question],
        "gaps": [
            {
                "g_code": "G-01",
                "statement": f"「{question}」的核心机制与可检验边界尚未明确",
                "severity": "high",
                "parent_subquestion": "",
            }
        ],
        "_mock": True,
    }


async def analyze_question(question: str, level: str = "A", run_id: Optional[int] = None) -> dict:
    """M1：解析科学问题，返回结构化结果并落库知识缺口。"""
    prompt_extra = ""
    if level == "C":
        prompt_extra = "\n【重要】本题属于宏大基础型问题，必须先降维拆解为可回答的子问题，再基于子问题产出缺口。"

    # 技能注入：SK-01 结构化降维（C级强制，A/B级可选增强缺口颗粒度）
    skill_block = skill_prompt("m1_question")
    if skill_block:
        prompt_extra += f"\n{skill_block}"

    result, model_used = await chat_json(
        system_prompt=M1_SYSTEM_PROMPT,
        user_prompt=f"科学问题：{question}\n题目分级：{level}（A收敛可检验 / B数据方法驱动 / C宏大基础）{prompt_extra}\n\n请输出结构化解析。",
        model="general",
        temperature=0.3,
        fallback=_fallback_analysis(question),
    )

    # 形状防御（迭代5加固，与 M4 同类风险）：LLM 偶发返回 JSON 数组而非对象
    if not isinstance(result, dict):
        logger.warning("⚠️ M1 返回非对象结构，使用兜底解析")
        result = _fallback_analysis(question)

    # 规范化
    gaps = result.get("gaps") or []
    for i, g in enumerate(gaps, 1):
        g.setdefault("g_code", f"G-{i:02d}")
        g.setdefault("severity", "medium")
        g.setdefault("parent_subquestion", "")

    # 落库知识缺口
    if run_id is not None:
        conn = get_conn()
        try:
            for g in gaps:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO knowledge_gaps
                    (run_id, g_code, statement, severity, parent_subquestion, status)
                    VALUES (?, ?, ?, ?, ?, 'open')
                    """,
                    (run_id, g["g_code"], g["statement"], g["severity"], g["parent_subquestion"]),
                )
            conn.commit()
        finally:
            conn.close()

    result["_model"] = model_used
    logger.info(f"✅ M1 完成 | 缺口数: {len(gaps)} | 降维: {result.get('is_grand')} | model: {model_used}")
    return result
