"""
Academic Joan of Arc — 阿里云百炼(DashScope) LLM 引擎
=====================================================================
比赛硬性要求（XH-202619）：基座模型必须基于千问(Qwen)开源模型，
且须通过「阿里云百炼平台」调用模型 API 并提供调用凭证/截图。

本模块通过阿里云百炼平台提供的 OpenAI 兼容接口
(https://dashscope.aliyuncs.com/compatible-mode/v1) 调用千问系列模型
(qwen-max / qwen-plus / qwen-turbo / qwen-vl-max 等)，与本地 Ollama 引擎
保持完全一致的接口（chat / generate_hypothesis / evaluate_hypothesis /
health_check / close），由 llm_engine.get_llm_engine() 通过环境变量
LLM_PROVIDER=bailian 切换启用。

依赖：仅使用 aiohttp（项目已有），无需额外 SDK。
"""

import os
import json
import asyncio
from typing import AsyncGenerator, Optional

from loguru import logger
from llm_engine import LLMResponse


# ───────────────────────────────────────────────────────────────
# 与 LocalLLMEngine 共享的标准化提示词（保持多智能体行为一致）
# ───────────────────────────────────────────────────────────────

HYPOTHESIS_SYSTEM_PROMPT = """你是一位资深天体物理学家和AI科研助手。你的任务是基于提供的文献综述和知识缺口，生成可验证的科学假设。

输出格式要求（严格遵循）：
1. 假设陈述：一句清晰的、可证伪的陈述
2. 创新点：该假设的新颖之处（1-2句）
3. 可验证性：如何设计实验或观测来验证（2-3句）
4. 预期结果：如果假设成立，应该观察到什么
5. 证伪标准：什么结果会否定这个假设
6. 置信度：0-1之间，基于现有证据的评估

请生成3个不同的假设，确保它们之间有足够的差异性（从不同角度切入）。"""

EVAL_SYSTEM_PROMPT = """你是一位严格的科学评审专家。请对给定的假设进行多维度评估。

输出JSON格式：
{
    "novelty": {"score": 0.0-1.0, "reasoning": "..."},
    "verifiability": {"score": 0.0-1.0, "reasoning": "..."},
    "evidence_support": {"score": 0.0-1.0, "reasoning": "..."},
    "logical_consistency": {"score": 0.0-1.0, "reasoning": "..."},
    "overall": {"score": 0.0-1.0, "reasoning": "..."},
    "strengths": ["..."],
    "weaknesses": ["..."],
    "counterexamples": ["..."]
}"""


class BailianEngine:
    """
    阿里云百炼(DashScope) 推理引擎。

    通过 OpenAI 兼容接口调用千问系列模型，满足比赛"通过阿里云百炼平台
    调用模型 API"的硬性提交要件。所有推理流量经 dashscope.aliyuncs.com，
    调用凭证由 DASHSCOPE_API_KEY（或 BAILIAN_API_KEY）提供。
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model: str = "qwen-plus",
    ):
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY") or os.getenv("BAILIAN_API_KEY")
        if not self.api_key:
            logger.warning(
                "⚠️ 未检测到 DASHSCOPE_API_KEY / BAILIAN_API_KEY，"
                "百炼引擎将不可用，请在 .env 中配置后重启服务。"
            )
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        # 能力 → 千问模型映射（可在 .env 中覆盖）
        self.model_map = {
            "reasoning": os.getenv("BAILIAN_MODEL_REASONING", "qwen-max"),
            "general": os.getenv("BAILIAN_MODEL_GENERAL", "qwen-plus"),
            "coding": os.getenv("BAILIAN_MODEL_CODING", "qwen-plus"),
            "multimodal": os.getenv("BAILIAN_MODEL_MULTIMODAL", "qwen-vl-max"),
        }
        self._session: Optional["aiohttp.ClientSession"] = None  # noqa: F821

    # ── 会话管理 ──
    async def _get_session(self):
        if self._session is None or self._session.closed:
            import aiohttp

            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=300),
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
        return self._session

    # ── 核心对话 ──
    async def chat(
        self,
        model: str,
        messages: list[dict],
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> "LLMResponse | AsyncGenerator[str, None]":
        """调用阿里云百炼平台进行对话推理（OpenAI 兼容接口）。"""
        import aiohttp

        model_name = self.model_map.get(model, model)
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": stream,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": 0.9,
        }

        session = await self._get_session()

        if stream:
            return self._stream_chat(session, payload)

        try:
            async with session.post(
                f"{self.base_url}/chat/completions",
                json=payload,
            ) as resp:
                if resp.status != 200:
                    err = await resp.text()
                    raise RuntimeError(f"百炼平台返回 {resp.status}: {err[:500]}")
                data = await resp.json()
                choice = data["choices"][0]
                content = choice.get("message", {}).get("content", "")
                usage = data.get("usage", {}) or {}
                return LLMResponse(
                    content=content,
                    model=model_name,
                    prompt_tokens=usage.get("prompt_tokens", 0),
                    completion_tokens=usage.get("completion_tokens", 0),
                    total_tokens=usage.get("total_tokens", 0),
                    finish_reason=choice.get("finish_reason", "stop"),
                )
        except Exception as e:
            logger.error(f"百炼平台推理失败: {e}")
            raise

    async def _stream_chat(self, session, payload: dict) -> AsyncGenerator[str, None]:
        """流式输出生成器（SSE 解析）。"""
        try:
            async with session.post(
                f"{self.base_url}/chat/completions",
                json=payload,
            ) as resp:
                if resp.status != 200:
                    err = await resp.text()
                    yield f"[错误: 百炼平台返回 {resp.status}: {err[:200]}]"
                    return
                async for line in resp.content:
                    if not line:
                        continue
                    text = line.decode("utf-8").strip()
                    if not text or not text.startswith("data:"):
                        continue
                    data_str = text[len("data:"):].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    if "content" in delta and delta["content"]:
                        yield delta["content"]
        except Exception as e:
            logger.error(f"百炼平台流式推理失败: {e}")
            yield f"[错误: {str(e)}]"

    # ── 专用：假设生成 ──
    async def generate_hypothesis(
        self,
        question: str,
        literature_summary: str,
        knowledge_gaps: list[str],
        model: str = "reasoning",
    ) -> LLMResponse:
        system_prompt = HYPOTHESIS_SYSTEM_PROMPT
        user_prompt = f"""研究问题：{question}

文献综述：
{literature_summary}

知识缺口：
{chr(10).join(f"- {gap}" for gap in knowledge_gaps)}

请基于以上信息生成科学假设。"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return await self.chat(model=model, messages=messages, temperature=0.8)

    # ── 专用：假设评估 ──
    async def evaluate_hypothesis(
        self,
        hypothesis: str,
        evidence: str,
        model: str = "reasoning",
    ) -> dict:
        system_prompt = EVAL_SYSTEM_PROMPT
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"假设：{hypothesis}\n\n证据：{evidence}"},
        ]
        response = await self.chat(model=model, messages=messages, temperature=0.3)
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            return {"raw_evaluation": response.content}

    # ── 健康检查 ──
    async def health_check(self) -> dict:
        """通过一次极简调用检查百炼平台可用性。"""
        if not self.api_key:
            return {"status": "error", "error": "缺少 DASHSCOPE_API_KEY / BAILIAN_API_KEY"}
        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model_map.get("general", "qwen-plus"),
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 1,
                    "stream": False,
                },
            ) as resp:
                if resp.status == 200:
                    return {
                        "status": "healthy",
                        "platform": "aliyun-bailian (DashScope)",
                        "models_required": list(self.model_map.values()),
                        "ready": True,
                    }
                return {"status": "unhealthy", "http_status": resp.status}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
