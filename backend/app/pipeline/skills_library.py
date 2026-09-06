"""
科研技能库（skills_library）— 可组合的提示词技能，深化六环节各阶段
设计思想（借鉴 OpenAI Skills / Agent Skills 范式）：
  - 每个技能 = 名称 + 适用环节 + 触发条件 + 提示词增强 + 质量守则
  - 技能按需注入对应环节的 prompt，不增加额外 LLM 调用（零成本深化）
  - 技能注册表支持前端展示与文档导出（满足"说明智能体具备哪些技能"）

技能清单（v1）：
  SK-01 结构化降维     → M1（C级宏大问题）
  SK-02 证据三角互证   → M2（多源证据整合）
  SK-03 冲突对挖掘     → M2（对立证据识别）
  SK-04 魔鬼代言人批判 → M3（批判复核轮，自我辩证核心）
  SK-05 可证伪性锻造   → M3（预测与证伪标准）
  SK-06 结果判定表     → M5（outcome_table 双分支强制）
  SK-07 事前验尸       → M5（计划风险预判）
"""

from typing import Optional

SKILLS = [
    {
        "code": "SK-01", "name": "结构化降维", "module": "m1_question",
        "trigger": "level == 'C'（宏大基础型问题）",
        "summary": "将不可直接检验的宏大问题拆解为可回答、可检索、可证伪的子问题链，"
                   "每个子问题锁定对象-变量-判据三要素；不可降维者如实标注'需研究者判断'。",
        "prompt_block": (
            "【技能·结构化降维】降维时须保证：每个子问题含明确研究对象、可观测变量、"
            "判定判据三要素；子问题之间互斥且共同覆盖原问题核心；"
            "无法降维的部分如实标注，不得虚构可检验性。"
        ),
    },
    {
        "code": "SK-02", "name": "证据三角互证", "module": "m2_evidence",
        "trigger": "在线文献 ≥ 3 篇",
        "summary": "关键主张须由 ≥2 个独立来源互证（fact 优先引用可核验 DOI 文献），"
                   "单一来源的主张须标注置信度上限。",
        "prompt_block": (
            "【技能·证据三角互证】对支撑核心缺口的主张，优先采用多来源互证："
            "同一结论被 ≥2 篇独立文献支持时标 fact 或高置信 literature_interpretation；"
            "仅单一来源者置信度不得超过 0.7，并在 claim 中注明'单一来源'。"
        ),
    },
    {
        "code": "SK-03", "name": "冲突对挖掘", "module": "m2_evidence",
        "trigger": "文献间存在方法/结论分歧",
        "summary": "主动检索并标记相互对立的证据对（不同方法、不同学派、不同结论），"
                   "冲突是假设生成的沃土——对立点即假设切入点。",
        "prompt_block": (
            "【技能·冲突对挖掘】检视文献时主动寻找对立：方法对立（实验vs计算）、"
            "结论对立（支持vs反对同一机制）、数据对立（不同测定值）。"
            "发现对立即在 conflict_with 互标并写明对立点，不得抹平真实分歧。"
        ),
    },
    {
        "code": "SK-04", "name": "魔鬼代言人批判", "module": "m3_hypothesis",
        "trigger": "批判复核轮（round>1 且父版本已入围）",
        "summary": "以敌意审视立场逐条质疑入围假设：最薄弱推理环节、被忽略的反对证据、"
                   "隐含未检验前提——质疑后生成强化子版本，形成版本树留痕。",
        "prompt_block": (
            "【技能·魔鬼代言人批判】对每个父版本假设执行三步批判："
            "①定位推理链最薄弱环节；②列出被忽略或低估的反对证据；"
            "③揭示隐含的未检验前提。随后给出修补这些弱点的强化子版本。"
        ),
    },
    {
        "code": "SK-05", "name": "可证伪性锻造", "module": "m3_hypothesis",
        "trigger": "生成假设时（每轮）",
        "summary": "每个假设必须配备：可操作预测（观测对象+预期方向+判定阈值）与"
                   "证伪标准（'若观察到X则否定'），禁止空泛的方向性陈述。",
        "prompt_block": (
            "【技能·可证伪性锻造】testable_prediction 须含观测对象、预期方向、判定阈值三要素；"
            "falsification_criteria 须写成'若观察到X，则本假设被否定'的可执行判据；"
            "禁止使用'可能有关''或许影响'等不可证伪措辞。"
        ),
    },
    {
        "code": "SK-06", "name": "结果判定表", "module": "m5_plan",
        "trigger": "计划设计时（每条核心预测）",
        "summary": "对每条核心预测强制列出 ≥2 种可能结果分支，逐一写明"
                   "支持什么/反对什么/后续动作——这是模板硬性要求，也是科学诚实的体现。",
        "prompt_block": (
            "【技能·结果判定表】每条核心预测的 outcome_table 至少含两个分支："
            "观测到预期信号（支持假设→下一步深化）、未观测到/反向信号（反对假设→"
            "触发替代解释检验）。每个分支必须写明后续动作，禁止留空。"
        ),
    },
    {
        "code": "SK-07", "name": "事前验尸", "module": "m5_plan",
        "trigger": "可执行性检查时",
        "summary": "假设计划一年后失败，倒推最可能的三个失败原因（资源缺口/依赖断裂/"
                   "判据模糊），并将其写入 stop_conditions 与风险清单。",
        "prompt_block": (
            "【技能·事前验尸】以'假设本计划已失败'为起点倒推：最可能的失败原因是"
            "资源获取失败、步骤依赖断裂还是判定判据模糊？将前三大风险写入评审，"
            "并在计划中给出对应的回退/补救条件。"
        ),
    },
]

_BY_MODULE: dict[str, list[dict]] = {}
for _s in SKILLS:
    _BY_MODULE.setdefault(_s["module"], []).append(_s)


def list_skills() -> list[dict]:
    """技能注册表（供 API / 前端展示）。"""
    return [{k: s[k] for k in ("code", "name", "module", "trigger", "summary")}
            for s in SKILLS]


def skill_prompt(module: str, condition: Optional[dict] = None,
                 codes: Optional[list[str]] = None) -> str:
    """取某环节的适用技能提示词块（拼接后注入 system/user prompt 尾部）。

    codes: 指定只注入的技能编号（如 M3 常规轮只要 SK-05，批判复核轮加 SK-04）。
    """
    blocks = []
    for s in _BY_MODULE.get(module, []):
        if codes is not None and s["code"] not in codes:
            continue
        blocks.append(s["prompt_block"])
    return "\n".join(blocks)


def get_skill(code: str) -> Optional[dict]:
    return next((s for s in SKILLS if s["code"] == code), None)
