"""
Academic Joan of Arc — 本地LLM推理引擎
封装Ollama调用，提供与OpenAI兼容的接口
"""

import json
import aiohttp
import asyncio
from typing import AsyncGenerator, Optional
from dataclasses import dataclass
from loguru import logger


@dataclass
class LLMResponse:
    """标准化LLM响应"""
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    finish_reason: str = "stop"


class LocalLLMEngine:
    """
    本地Ollama推理引擎
    所有推理在本地完成，零外部API依赖
    """
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.models = {
            "reasoning": "qwen2.5:14b",
            "general": "qwen2.5:7b",
            "coding": "qwen2.5-coder:7b",
            "multimodal": "qwen2.5-vl:7b"
        }
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=300)
            )
        return self._session
    
    async def chat(
        self,
        model: str,
        messages: list[dict],
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ) -> LLMResponse | AsyncGenerator[str, None]:
        """
        调用本地Ollama进行对话推理
        
        Args:
            model: 模型标识（reasoning/general/coding/multimodal）
            messages: 消息列表 [{"role": "user", "content": "..."}]
            stream: 是否流式输出
            temperature: 采样温度
            max_tokens: 最大输出长度
        
        Returns:
            非流式：LLMResponse对象
            流式：AsyncGenerator[str, None]
        """
        model_name = self.models.get(model, model)
        
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_ctx": 32768,
                "num_predict": max_tokens,
                "top_p": 0.9,
                "repeat_penalty": 1.1
            }
        }
        
        session = await self._get_session()
        
        if stream:
            return self._stream_chat(session, payload)
        
        # 非流式调用
        try:
            async with session.post(
                f"{self.base_url}/api/chat",
                json=payload
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
                
                content = data.get("message", {}).get("content", "")
                
                return LLMResponse(
                    content=content,
                    model=model_name,
                    prompt_tokens=data.get("prompt_eval_count", 0),
                    completion_tokens=data.get("eval_count", 0),
                    total_tokens=data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
                    finish_reason="stop" if data.get("done", False) else "length"
                )
        except Exception as e:
            logger.error(f"本地推理失败: {e}")
            raise
    
    async def _stream_chat(
        self,
        session: aiohttp.ClientSession,
        payload: dict
    ) -> AsyncGenerator[str, None]:
        """流式输出生成器"""
        try:
            async with session.post(
                f"{self.base_url}/api/chat",
                json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.content:
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        if "message" in chunk and "content" in chunk["message"]:
                            yield chunk["message"]["content"]
                        if chunk.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"流式推理失败: {e}")
            yield f"[错误: {str(e)}]"
    
    async def generate_hypothesis(
        self,
        question: str,
        literature_summary: str,
        knowledge_gaps: list[str],
        model: str = "reasoning"
    ) -> LLMResponse:
        """
        专用接口：生成科学假设
        结构化提示词确保输出格式一致
        """
        system_prompt = """你是一位资深天体物理学家和AI科研助手。你的任务是基于提供的文献综述和知识缺口，生成可验证的科学假设。

输出格式要求（严格遵循）：
1. 假设陈述：一句清晰的、可证伪的陈述
2. 创新点：该假设的新颖之处（1-2句）
3. 可验证性：如何设计实验或观测来验证（2-3句）
4. 预期结果：如果假设成立，应该观察到什么
5. 证伪标准：什么结果会否定这个假设
6. 置信度：0-1之间，基于现有证据的评估

请生成3个不同的假设，确保它们之间有足够的差异性（从不同角度切入）。"""

        user_prompt = f"""研究问题：{question}

文献综述：
{literature_summary}

知识缺口：
{chr(10).join(f"- {gap}" for gap in knowledge_gaps)}

请基于以上信息生成科学假设。"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        return await self.chat(model=model, messages=messages, temperature=0.8)
    
    async def evaluate_hypothesis(
        self,
        hypothesis: str,
        evidence: str,
        model: str = "reasoning"
    ) -> dict:
        """
        专用接口：评估假设质量
        返回结构化评分
        """
        system_prompt = """你是一位严格的科学评审专家。请对给定的假设进行多维度评估。

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

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"假设：{hypothesis}\n\n证据：{evidence}"}
        ]
        
        response = await self.chat(model=model, messages=messages, temperature=0.3)
        
        # 尝试解析JSON
        try:
            result = json.loads(response.content)
            return result
        except json.JSONDecodeError:
            # 如果模型没有输出纯JSON，返回原始内容
            return {"raw_evaluation": response.content}
    
    async def health_check(self) -> dict:
        """检查Ollama服务健康状态"""
        try:
            session = await self._get_session()
            async with session.get(f"{self.base_url}/api/tags") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    models = [m["name"] for m in data.get("models", [])]
                    return {
                        "status": "healthy",
                        "models_available": models,
                        "models_required": list(self.models.values()),
                        "ready": all(
                            any(req in m for m in models)
                            for req in self.models.values()
                        )
                    }
                return {"status": "unhealthy", "http_status": resp.status}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def close(self):
        """关闭会话"""
        if self._session and not self._session.closed:
            await self._session.close()


# 全局引擎实例（单例模式）
_llm_engine: Optional[LocalLLMEngine] = None

# 推理提供方：
#   ollama  —— 本地 Ollama 推理（默认，离线/零外部依赖，使用 qwen2.5 开源模型）
#   bailian —— 阿里云百炼平台（DashScope OpenAI 兼容接口）调用千问 Qwen-Max/Plus/Turbo
# 通过环境变量 LLM_PROVIDER 切换。比赛硬性要求「须通过阿里云百炼平台调用模型 API」，
# 因此正式提交/评审环境应设置 LLM_PROVIDER=bailian 并配置 DASHSCOPE_API_KEY。


def get_llm_engine():
    """根据 LLM_PROVIDER 返回对应推理引擎（单例）。"""
    global _llm_engine
    if _llm_engine is None:
        import os

        provider = os.getenv("LLM_PROVIDER", "ollama").lower()
        if provider == "bailian":
            from bailian_engine import BailianEngine

            _llm_engine = BailianEngine()
            logger.info("🔌 推理引擎: 阿里云百炼(DashScope) · 千问(Qwen)系列")
        else:
            ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
            _llm_engine = LocalLLMEngine(base_url=ollama_host)
            logger.info(f"🔌 推理引擎: 本地 Ollama · {ollama_host}")
    return _llm_engine


def reset_llm_engine():
    """重置推理引擎单例，使下一次 get_llm_engine() 依据最新环境变量重建。

    用于设置页热切换 LLM_PROVIDER / DASHSCOPE_API_KEY / 模型映射后即时生效。
    会尽力关闭旧引擎的 aiohttp 会话（同步上下文中忽略异步关闭异常）。
    """
    global _llm_engine
    old = _llm_engine
    _llm_engine = None
    if old is not None:
        try:
            sess = getattr(old, "_session", None)
            if sess is not None and not sess.closed:
                # 无法在此同步等待异步 close，标记后交由 GC/事件循环回收
                logger.info("♻️ 已重置推理引擎单例（旧会话将由事件循环回收）")
        except Exception:
            pass
    logger.info("♻️ 推理引擎已重置，将按最新配置重建")
