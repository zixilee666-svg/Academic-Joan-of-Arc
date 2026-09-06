"""
Academic Joan of Arc — 多智能体编排引擎
实现四大Agent的协作调度：文献整合者、假设生成器、实验规划师、评估验证官
"""

import json
import asyncio
import time
from typing import Optional, AsyncGenerator
from dataclasses import dataclass, field

from loguru import logger

from llm_engine import get_llm_engine, LLMResponse


# ─── Agent 定义 ───

@dataclass
class AgentConfig:
    """Agent配置"""
    name: str
    name_cn: str
    model: str
    system_prompt: str
    description: str


AGENT_CONFIGS = {
    "literature": AgentConfig(
        name="Literature Integrator",
        name_cn="文献整合者",
        model="general",
        description="检索、解析、整合多源文献，构建证据链，识别知识缺口",
        system_prompt="""你是一位资深学术文献分析专家。你的任务是：
1. 分析用户提供的研究问题，确定关键检索词和学科方向
2. 基于已有文献信息，提取核心论点和证据
3. 识别文献中的知识缺口（Knowledge Gaps）
4. 构建证据链：将分散的文献发现串联为逻辑连贯的证据体系
5. 生成结构化的文献综述摘要

输出格式要求：
## 文献综述摘要
[200字以内的综合摘要]

## 核心证据
- 证据1: [论点] (来源: [文献])
- 证据2: ...

## 知识缺口
1. [缺口描述] — 严重程度: 高/中/低
2. ...

## 研究方向建议
基于以上分析，建议从以下角度切入：...""",
    ),
    "hypothesis": AgentConfig(
        name="Hypothesis Generator",
        name_cn="假设生成器",
        model="reasoning",
        description="基于知识缺口生成候选假设，评估创新性与可验证性",
        system_prompt="""你是一位资深天体物理学家和科学方法论专家。你的任务是基于文献综述和知识缺口，生成可验证的科学假设。

生成要求：
1. 每个假设必须是可证伪的（Falsifiable）
2. 必须明确指出验证方法和预期结果
3. 必须评估创新性（与现有研究的差异）
4. 生成3个不同角度的候选假设

每个假设的输出格式：
### 假设 [N]: [标题]
- **陈述**: [一句清晰的可证伪陈述]
- **创新点**: [与现有研究的区别]
- **验证方案**: [具体的实验/观测设计]
- **预期结果**: [如果假设成立应观察到什么]
- **证伪标准**: [什么结果会否定假设]
- **置信度**: [0-1]
- **风险**: [主要不确定性]""",
    ),
    "experiment": AgentConfig(
        name="Experiment Planner",
        name_cn="实验规划师",
        model="coding",
        description="设计实验方案、生成验证代码、规划任务流程",
        system_prompt="""你是一位实验设计专家和Python科学计算工程师。你的任务是：
1. 为给定的科学假设设计完整的验证实验方案
2. 明确实验变量（自变量、因变量、控制变量）
3. 设计实验步骤和时间线
4. 生成Python验证代码框架
5. 评估所需资源和潜在风险

输出格式：
## 实验目标
[明确的验证目标]

## 实验变量
| 类型 | 变量名 | 定义 | 范围 |
|------|--------|------|------|

## 实验步骤
1. [步骤名] — 预计时间: X天
   - 具体操作...
   - 交付物: ...

## 代码框架
```python
# 验证代码
```

## 资源需求
- 计算: ...
- 数据: ...
- 时间: ...

## 风险评估
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|""",
    ),
    "evaluation": AgentConfig(
        name="Evaluation Validator",
        name_cn="评估验证官",
        model="reasoning",
        description="评估假设质量、检测偏差、提出修正建议",
        system_prompt="""你是一位严格的科学评审专家和认知偏差检测器。你的任务是：
1. 对假设进行多维度评分（创新性、可验证性、理论基础、数据支持、实用性）
2. 识别认知偏差（确认偏差、可得性偏差、锚定效应）
3. 主动寻找反例和证伪证据
4. 提出具体的改进建议
5. 与前一版本对比，评估改进幅度

输出格式：
## 多维度评分
| 维度 | 得分(1-5) | 理由 |
|------|-----------|------|

## 优势
- ...

## 弱点
- ...

## 认知偏差检测
- 确认偏差: [低/中/高] — [说明]
- 可得性偏差: [低/中/高] — [说明]
- 锚定效应: [低/中/高] — [说明]

## 反例与证伪
- [可能的反例1]
- ...

## 改进建议
1. ...

## 综合评分: X.X / 5.0""",
    ),
}

# ─── 研究计划（对齐比赛《科学假设与研究计划》十大标准字段）───
RESEARCH_PLAN_SYSTEM_PROMPT = """你是一位严谨的科研方法论专家与学术写作助手。请将前面各阶段（问题理解、文献综述、假设、实验方案）的成果，整合成一份符合学术出版规范的《科学假设与研究计划》。

必须严格输出以下 JSON 结构（不要输出 JSON 以外的任何文字）：
{
  "problem_statement": "待研究问题：明确指出当前领域存在的具体局限性",
  "rationale": "解决思路：基于逻辑推理的创新点阐述，展示推导链条",
  "technical_details": "必要的技术手段：验证假设所需的具体技术栈（统计/机器学习/深度学习方法等）",
  "datasets": {
    "source": "假设推演依据的历史数据（来源须真实、可追溯，注明数据集/文献名称）",
    "target": "验证实验所需的拟采集数据特征"
  },
  "paper_title": "符合学术出版规范的标题",
  "paper_abstract": "摘要：含背景、方法、预期结果的完整摘要",
  "methods": "方法论：具体实施步骤，含模型架构或实验流程",
  "experiments": "实验设计：含基线对比(Baselines)及评估指标(Metrics)",
  "results": "实验结果：通过公式推导或实际执行，在一定范围内验证该实验可行性",
  "references": ["真实存在的参考文献（DOI/arXiv/标题），严禁虚构；无确切来源时填空数组"]
}

严格要求：
- references 中的每一条必须是真实、可核验的文献，禁止编造作者、标题或年份；
- 若前面阶段缺少某部分信息，请在对应字段中写"信息待补充"，不要编造内容；
- 仅输出纯 JSON。"""

# 阶段→Agent映射
STAGE_AGENT_MAP = {
    "question": "literature",  # 问题理解由文献Agent辅助
    "literature": "literature",
    "hypothesis": "hypothesis",
    "experiment": "experiment",
    "evaluation": "evaluation",
}


# ─── Agent 执行引擎 ───

class AgentOrchestrator:
    """多智能体编排器"""

    def __init__(self):
        self.execution_log: list[dict] = []

    async def run_agent(
        self,
        stage: str,
        input_text: str,
        context: Optional[dict] = None,
    ) -> LLMResponse:
        """运行单个Agent"""
        agent_key = STAGE_AGENT_MAP.get(stage, "literature")
        config = AGENT_CONFIGS[agent_key]
        engine = get_llm_engine()

        # 构建消息
        messages = [{"role": "system", "content": config.system_prompt}]

        # 如果有上下文（前序阶段的输出），加入对话
        if context:
            context_text = self._format_context(context)
            if context_text:
                messages.append({
                    "role": "user",
                    "content": f"以下是前序阶段的分析结果，请在此基础上继续：\n\n{context_text}",
                })

        messages.append({"role": "user", "content": input_text})

        start_time = time.time()
        logger.info(f"🤖 Agent [{config.name_cn}] 开始执行 | 模型: {config.model} | 阶段: {stage}")

        try:
            response = await engine.chat(
                model=config.model,
                messages=messages,
                temperature=0.7 if stage != "evaluation" else 0.3,
            )

            latency_ms = int((time.time() - start_time) * 1000)
            self._log_execution(agent_key, stage, input_text, response, latency_ms)

            logger.info(f"✅ Agent [{config.name_cn}] 完成 | 耗时: {latency_ms}ms | Token: {response.total_tokens}")
            return response

        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"❌ Agent [{config.name_cn}] 失败: {e}")
            self._log_execution(agent_key, stage, input_text, None, latency_ms, error=str(e))
            raise

    async def run_agent_stream(
        self,
        stage: str,
        input_text: str,
        context: Optional[dict] = None,
    ) -> AsyncGenerator[str, None]:
        """流式运行Agent，返回SSE格式数据"""
        agent_key = STAGE_AGENT_MAP.get(stage, "literature")
        config = AGENT_CONFIGS[agent_key]
        engine = get_llm_engine()

        messages = [{"role": "system", "content": config.system_prompt}]

        if context:
            context_text = self._format_context(context)
            if context_text:
                messages.append({
                    "role": "user",
                    "content": f"以下是前序阶段的分析结果，请在此基础上继续：\n\n{context_text}",
                })

        messages.append({"role": "user", "content": input_text})

        logger.info(f"🤖 Agent [{config.name_cn}] 流式执行开始 | 阶段: {stage}")

        try:
            stream = await engine.chat(
                model=config.model,
                messages=messages,
                stream=True,
                temperature=0.7 if stage != "evaluation" else 0.3,
            )

            async for chunk in stream:
                yield json.dumps({"type": "content", "content": chunk}, ensure_ascii=False)

            yield json.dumps({"type": "stage_complete", "stage": stage}, ensure_ascii=False)

        except Exception as e:
            logger.error(f"❌ Agent [{config.name_cn}] 流式执行失败: {e}")
            yield json.dumps({"type": "error", "error": str(e)}, ensure_ascii=False)

    async def run_full_pipeline(
        self,
        question: str,
        on_progress=None,
    ) -> dict:
        """运行完整研究流水线：问题→文献→假设→实验→评估"""
        results = {}
        stages = ["question", "literature", "hypothesis", "experiment", "evaluation"]

        for stage in stages:
            if on_progress:
                await on_progress(stage, "running")

            try:
                # 构建输入
                if stage == "question":
                    input_text = f"请分析以下科学问题，提取关键实体、学科分类和研究可行性：\n\n{question}"
                elif stage == "literature":
                    input_text = f"请对以下研究问题进行文献综述分析：\n\n研究问题：{question}\n\n{results.get('question', '')}"
                elif stage == "hypothesis":
                    input_text = f"基于以下文献综述，生成可验证的科学假设：\n\n研究问题：{question}\n\n文献综述：{results.get('literature', '')}"
                elif stage == "experiment":
                    input_text = f"为以下假设设计验证实验：\n\n{results.get('hypothesis', '')}"
                elif stage == "evaluation":
                    input_text = f"请评估以下假设和实验方案的质量：\n\n假设：{results.get('hypothesis', '')}\n\n实验方案：{results.get('experiment', '')}"

                response = await self.run_agent(stage, input_text, context=results)
                results[stage] = response.content

                if on_progress:
                    await on_progress(stage, "completed")

            except Exception as e:
                results[stage] = f"[错误] {str(e)}"
                if on_progress:
                    await on_progress(stage, "failed")

        return results

    async def generate_research_plan(
        self,
        question: str,
        literature: str = "",
        hypothesis: str = "",
        experiment: str = "",
        model: str = "reasoning",
    ) -> LLMResponse:
        """将流水线各阶段成果整合为比赛要求的《科学假设与研究计划》（十大标准字段）。

        对齐比赛"生成结果规范"：待研究问题 / 解决思路 / 技术手段 / 数据集(Source+Target)
        / 标题 / 摘要 / 方法论 / 实验设计 / 实验结果 / 参考论文。
        """
        engine = get_llm_engine()
        user_prompt = (
            f"# 研究问题\n{question}\n\n"
            f"# 文献综述\n{literature or '（无）'}\n\n"
            f"# 科学假设\n{hypothesis or '（无）'}\n\n"
            f"# 实验方案\n{experiment or '（无）'}\n\n"
            "请整合以上内容，按系统指令输出《科学假设与研究计划》JSON。"
        )
        messages = [
            {"role": "system", "content": RESEARCH_PLAN_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        return await engine.chat(model=model, messages=messages, temperature=0.4)

    def _format_context(self, context: dict) -> str:
        """格式化前序阶段结果为上下文字符串"""
        parts = []
        stage_labels = {
            "question": "问题理解",
            "literature": "文献综述",
            "hypothesis": "假设生成",
            "experiment": "实验设计",
        }
        for key, label in stage_labels.items():
            if key in context and context[key]:
                # 截取前2000字符避免上下文过长
                content = context[key][:2000]
                parts.append(f"### {label}结果\n{content}")
        return "\n\n".join(parts)

    def _log_execution(
        self,
        agent_key: str,
        stage: str,
        input_text: str,
        response: Optional[LLMResponse],
        latency_ms: int,
        error: Optional[str] = None,
    ):
        """记录Agent执行日志"""
        log_entry = {
            "agent_name": AGENT_CONFIGS[agent_key].name_cn,
            "stage": stage,
            "input_summary": input_text[:200],
            "output_summary": response.content[:200] if response else None,
            "latency_ms": latency_ms,
            "model_used": AGENT_CONFIGS[agent_key].model,
            "prompt_tokens": response.prompt_tokens if response else 0,
            "completion_tokens": response.completion_tokens if response else 0,
            "error": error,
        }
        self.execution_log.append(log_entry)

    def get_logs(self) -> list[dict]:
        """获取执行日志"""
        return self.execution_log


# 全局编排器实例
_orchestrator: Optional[AgentOrchestrator] = None


def get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
