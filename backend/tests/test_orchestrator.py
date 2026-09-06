# -*- coding: utf-8 -*-
"""
Academic Joan of Arc 后端单元测试
不依赖真实模型/Ollama/百炼，使用 FakeEngine 验证多智能体编排逻辑与
《科学假设与研究计划》结构化提示词完整性。
运行：PYTHONPATH=backend/app pytest backend/tests -v
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from agents import (  # noqa: E402
    get_orchestrator,
    AGENT_CONFIGS,
    STAGE_AGENT_MAP,
    RESEARCH_PLAN_SYSTEM_PROMPT,
)
from llm_engine import LLMResponse  # noqa: E402


class FakeEngine:
    """模拟推理引擎：返回确定性响应，验证编排逻辑而不调用真实模型。"""

    def __init__(self):
        self.calls = []

    async def chat(self, model, messages, stream=False, **kwargs):
        self.calls.append((model, len(messages)))
        return LLMResponse(
            content=f"[MOCK:{model}] 响应",
            model=model,
            prompt_tokens=1,
            completion_tokens=1,
            total_tokens=2,
        )

    async def generate_hypothesis(self, **kwargs):
        return LLMResponse(content="[MOCK] 假设", model="reasoning")

    async def health_check(self):
        return {"status": "healthy", "mock": True}


def test_stage_agent_map_complete():
    for stage in ("question", "literature", "hypothesis", "experiment", "evaluation"):
        assert stage in STAGE_AGENT_MAP
        assert STAGE_AGENT_MAP[stage] in AGENT_CONFIGS


def test_four_agents_present():
    keys = set(AGENT_CONFIGS.keys())
    assert {"literature", "hypothesis", "experiment", "evaluation"} <= keys


def test_research_plan_prompt_has_ten_fields():
    fields = [
        "problem_statement", "rationale", "technical_details", "datasets",
        "paper_title", "paper_abstract", "methods", "experiments",
        "results", "references",
    ]
    for f in fields:
        assert f in RESEARCH_PLAN_SYSTEM_PROMPT


def test_run_agent_uses_correct_agent(monkeypatch):
    eng = FakeEngine()
    import agents

    monkeypatch.setattr(agents, "get_llm_engine", lambda: eng)
    orch = get_orchestrator()
    resp = asyncio.run(orch.run_agent("hypothesis", "测试输入"))
    assert "[MOCK:" in resp.content
    assert len(eng.calls) == 1
    # hypothesis 阶段应使用 reasoning 模型
    assert eng.calls[0][0] == "reasoning"


def test_generate_research_plan_invokes_engine(monkeypatch):
    eng = FakeEngine()
    import agents

    monkeypatch.setattr(agents, "get_llm_engine", lambda: eng)
    orch = get_orchestrator()
    resp = asyncio.run(
        orch.generate_research_plan(question="Q?", literature="L...", hypothesis="H...")
    )
    assert "[MOCK:" in resp.content
    assert len(eng.calls) == 1


def test_format_context_truncates():
    orch = get_orchestrator()
    ctx = {"literature": "x" * 5000, "question": "q"}
    out = orch._format_context(ctx)
    # 单段截断到 2000 字符，整体不应无限增长
    assert len(out) < 5000
