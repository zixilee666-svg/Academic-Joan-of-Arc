"""
流水线 LLM 封装：
- 复用主应用双引擎（LLM_PROVIDER=bailian|ollama）
- 结构化 JSON 输出抽取（容忍 ```json 围栏与前后缀噪音）
- 引擎不可用时降级为模块级 Mock（保证六环节端到端可演示，输出标注 mock）
- 瞬态故障（限流/网络抖动/超时）指数退避重试，避免一次抖动即整体降级
  （2026-09-05 修复：题69 真实引擎下 M3 因单次瞬态失败被整体替换为 Mock）
"""

import asyncio
import json
import re
from typing import Optional
from loguru import logger

# 瞬态错误关键词（命中即重试）
_TRANSIENT_MARKERS = ("429", "500", "502", "503", "504", "timeout", "timed out",
                      "throttl", "rate", "connection", "temporar", "reset",
                      "disconnected", "broken pipe", "refused", "unreachable",
                      "requests per second", "Too Many Requests", "server overload")


def _is_transient(err: Exception) -> bool:
    """判断异常是否属于可重试的瞬态故障。"""
    text = (str(err) or "").lower()
    return any(m in text for m in _TRANSIENT_MARKERS)


def _repair_truncated(text: str) -> Optional[str]:
    """尝试修复被截断的 JSON：在字符串外扫描括号配平，追加缺失的闭合符。"""
    stack: list[str] = []
    in_str = False
    esc = False
    for ch in text:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]":
            if stack and stack[-1] == ch:
                stack.pop()
            else:
                return None  # 括号错乱，无法修复
    if in_str:
        text += '"'
    # 移除可能残留的悬挂逗号/冒号尾部
    repaired = text.rstrip()
    if repaired.endswith(",") or repaired.endswith(":"):
        repaired = repaired[:-1]
    repaired += "".join(reversed(stack))
    return repaired


def extract_json(text: str) -> Optional[dict | list]:
    """从模型输出中稳健抽取 JSON 对象/数组。"""
    if not text:
        return None
    # 去掉 ```json ... ``` 围栏（兼容未闭合围栏）
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        candidate = fence.group(1)
    elif "```" in text:
        candidate = text.split("```", 2)[1]
        candidate = candidate.replace("json", "", 1) if candidate.startswith("json") else candidate
    else:
        candidate = text
    # 直接解析
    try:
        return json.loads(candidate.strip())
    except Exception:
        pass
    # 抓取第一个 { ... } 或 [ ... ] 块（贪心到最后一个闭合符）
    for opener, closer in (("{", "}"), ("[", "]")):
        start = candidate.find(opener)
        end = candidate.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(candidate[start:end + 1])
            except Exception:
                continue
    # 末位兜底：截断修复（括号配平补齐）
    start = candidate.find("{")
    if start != -1:
        repaired = _repair_truncated(candidate[start:])
        if repaired:
            try:
                return json.loads(repaired)
            except Exception:
                pass
    return None


def _output_truncated(resp) -> bool:
    """启发式判断模型输出是否被 max_tokens 截断。"""
    if getattr(resp, "finish_reason", "") in ("length",):
        return True
    ct = getattr(resp, "completion_tokens", 0) or 0
    return ct >= 3900


async def chat_json(
    system_prompt: str,
    user_prompt: str,
    model: str = "general",
    temperature: float = 0.4,
    fallback: Optional[dict] = None,
    max_tokens: int = 4096,
    max_attempts: int = 3,
) -> tuple[dict, str]:
    """调用引擎并要求 JSON 输出；返回 (parsed, model_used)。

    - 瞬态故障（限流/超时/连接重置）自动退避重试（最多 max_attempts 次）；
    - 输出被 max_tokens 截断导致 JSON 残缺时，自动扩容重试一次；
    - 全部尝试失败才返回 (fallback, "mock")，fallback 为 None 时返回空 dict。
    """
    from llm_engine import get_llm_engine

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    engine = None
    get_err: Optional[Exception] = None
    try:
        engine = get_llm_engine()
    except Exception as e:
        get_err = e

    cur_max_tokens = max_tokens
    trunc_retried = False

    for attempt in range(1, max_attempts + 1):
        if engine is None:
            logger.warning(f"⚠️ LLM 引擎不可用（{get_err}），使用 fallback")
            return (fallback or {}), "mock"
        try:
            resp = await engine.chat(
                model=model, messages=messages, temperature=temperature,
                max_tokens=cur_max_tokens,
            )
            content = resp.content if hasattr(resp, "content") else str(resp)
            parsed = extract_json(content)
            if parsed is None:
                if _output_truncated(resp) and not trunc_retried:
                    trunc_retried = True
                    cur_max_tokens = min(cur_max_tokens * 2, 16384)
                    logger.warning(
                        f"⚠️ LLM 输出疑似被截断（finish={getattr(resp, 'finish_reason', '?')}, "
                        f"tokens={getattr(resp, 'completion_tokens', 0)}），"
                        f"扩容 max_tokens={cur_max_tokens} 重试"
                    )
                    continue
                logger.warning(f"⚠️ LLM 输出无法解析为 JSON，使用 fallback（前200字: {content[:200]}）")
                return (fallback or {}), getattr(resp, "model", "unknown")
            return parsed, getattr(resp, "model", "unknown")
        except Exception as e:
            if attempt < max_attempts and _is_transient(e):
                wait = min(2.0 * attempt, 6.0)
                logger.warning(f"⚠️ LLM 瞬态失败(第{attempt}次)，{wait}s 后重试: {e}")
                await asyncio.sleep(wait)
                continue
            logger.warning(f"⚠️ LLM 调用失败，降级 Mock: {e}")
            return (fallback or {}), "mock"

    return (fallback or {}), "mock"


async def chat_text(
    system_prompt: str,
    user_prompt: str,
    model: str = "general",
    temperature: float = 0.5,
    fallback: str = "",
    max_tokens: int = 4096,
    max_attempts: int = 3,
) -> tuple[str, str]:
    """纯文本生成；瞬态故障自动重试；失败时返回 (fallback, "mock")。"""
    from llm_engine import get_llm_engine

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    for attempt in range(1, max_attempts + 1):
        try:
            engine = get_llm_engine()
            resp = await engine.chat(
                model=model, messages=messages, temperature=temperature,
                max_tokens=max_tokens,
            )
            content = resp.content if hasattr(resp, "content") else str(resp)
            return content, getattr(resp, "model", "unknown")
        except Exception as e:
            if attempt < max_attempts and _is_transient(e):
                wait = min(2.0 * attempt, 6.0)
                logger.warning(f"⚠️ LLM 瞬态失败(第{attempt}次)，{wait}s 后重试: {e}")
                await asyncio.sleep(wait)
                continue
            logger.warning(f"⚠️ LLM 调用失败，降级 Mock: {e}")
            return fallback, "mock"
    return fallback, "mock"
