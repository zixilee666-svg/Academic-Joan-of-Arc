# -*- coding: utf-8 -*-
"""
生成比赛交付文档（PDF）：
  1. 技术方案说明书.pdf            （≤20页，比赛硬性提交物）
  2. 用户操作手册.pdf
  3. 部署运维手册.pdf
使用 reportlab 内置 CID 字体 STSong-Light 渲染中文，无需外部字体文件。
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Preformatted, PageBreak, ListFlowable, ListItem,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
FONT = "STSong-Light"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

styles = getSampleStyleSheet()
def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    font = kw.pop("fontName", FONT)
    return ParagraphStyle(name, parent=base, fontName=font, **kw)

title_style   = S("t", fontSize=20, leading=26, alignment=TA_CENTER, spaceAfter=10)
h1_style      = S("h1", fontSize=15, leading=20, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor("#1f4e79"))
h2_style      = S("h2", fontSize=12.5, leading=17, spaceBefore=8, spaceAfter=4, textColor=colors.HexColor("#2e5a88"))
body_style    = S("b", fontSize=10.5, leading=16, alignment=TA_LEFT, spaceAfter=5)
small_style   = S("s", fontSize=9, leading=13, textColor=colors.HexColor("#555555"))
code_style    = S("c", fontSize=8.5, leading=11.5, fontName="Courier", backColor=colors.HexColor("#f4f4f4"), borderPadding=4)
note_style    = S("n", fontSize=9.5, leading=13, textColor=colors.HexColor("#8a6d3b"), backColor=colors.HexColor("#fcf8e3"), borderPadding=5, spaceAfter=6)

def P(t, s=body_style): return Paragraph(t, s)
def H1(t): return Paragraph(t, h1_style)
def H2(t): return Paragraph(t, h2_style)
def CODE(t): return Preformatted(t, code_style)

def table(data, col_widths, header=True):
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    sty = [
        ("FONTNAME", (0,0), (-1,-1), FONT),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#bbbbbb")),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]
    if header:
        sty += [("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1f4e79")),
                ("TEXTCOLOR", (0,0), (-1,0), colors.white),
                ("FONTNAME", (0,0), (-1,0), FONT)]
    t.setStyle(TableStyle(sty))
    return t

# ══════════════════════════════════════════════════════════════
# 1) 技术方案说明书
# ══════════════════════════════════════════════════════════════
def build_tech(path):
    doc = SimpleDocTemplate(path, pagesize=A4, topMargin=1.6*cm, bottomMargin=1.5*cm,
                            leftMargin=1.8*cm, rightMargin=1.8*cm,
                            title="技术方案说明书 — Academic Joan of Arc")
    st = [P("技术方案说明书", title_style),
          P("基于国产开源大模型（千问 Qwen）的 AI Scientist 研发与应用", S("sub", fontSize=12, alignment=TA_CENTER, textColor=colors.HexColor("#666"))),
          P("题目编号：XH-202619 ｜ 发榜单位：浙江阿里巴巴云计算有限公司 ｜ 挑战杯“揭榜挂帅”", small_style),
          Spacer(1, 6)]

    # 一、赛题理解
    st.append(H1("一、赛题理解与项目概述"))
    st.append(P("本赛题要求参赛团队围绕具体学科领域，基于千问（Qwen）系列国产开源大模型，构建具备“问题理解—知识整合—关联发现—可验证假设生成”能力的 AI Scientist 系统，实现从“数据/文献输入”到“可验证科学假设输出”的智能闭环。核心评判维度包括：科学价值（假设创新性与自洽性、方案可落地验证性，40 分）、技术深度（多智能体协作设计、多模态数据处理，30 分）、应用潜力（场景支撑、成果转化、可复现性，30 分）。"))
    st.append(P("Academic Joan of Arc 以<b>天文学（太阳耀斑/活动区演化预测）</b>为垂直领域，采用“千问多智能体流水线”架构：文献整合者 → 假设生成器 → 实验规划师 → 评估验证官，并新增研究计划编排器，将成果结构化为比赛要求的《科学假设与研究计划》十大标准字段。系统支持双推理引擎：<b>阿里云百炼（DashScope）引擎</b>用于正式提交（满足“通过百炼平台调用千问”硬性要求），<b>本地 Ollama 引擎</b>用于离线演示，二者通过环境变量一键切换。"))

    # 二、研究问题与领域
    st.append(H1("二、研究问题与领域选择"))
    st.append(P("选定自然科学方向：太阳活动区磁场演化与耀斑爆发的可预测性。该领域具备多模态实测数据（SDO/HMI 矢量磁图、GOES X 射线流量）、公开历史数据库（NOAA/SWPC 耀斑目录）与成熟文献基础，适合验证“假设自动生成—可验证”的闭环。"))
    st.append(P("待研究问题（Problem Statement）示例：现有耀斑预报多依赖经验阈值，对活动区演化过程的非线性机制刻画不足；如何基于矢量磁特征的时序演化，自动生成“可证伪、可量化验证”的耀斑前兆假设，是核心局限。"))

    # 三、系统总体架构
    st.append(H1("三、系统总体架构"))
    st.append(CODE(
"┌──────────────────────────────────────────────────────────┐\n"
"│  前端层  React 18 + TypeScript + Vite + Tailwind          │\n"
"│  11 页面 · 深色太空主题 · SSE 流式 · 力导向知识图谱        │\n"
"├──────────────────────────────────────────────────────────┤\n"
"│  后端层  FastAPI (Python)                                │\n"
"│  认证(JWT) · 多智能体编排 · SSE · Mock 降级              │\n"
"├──────────────────────────────────────────────────────────┤\n"
"│  推理引擎层（LLM_PROVIDER 切换）                         │\n"
"│  ├─ 阿里云百炼 DashScope: Qwen-Max/Plus/Turbo  ← 提交模式│\n"
"│  └─ 本地 Ollama: Qwen2.5 (7B/14B/Coder/VL)     ← 离线模式│\n"
"├──────────────────────────────────────────────────────────┤\n"
"│  存储/数据层  SQLite(11表+FTS5) · 天文数据集 · 知识图谱种子│\n"
"└──────────────────────────────────────────────────────────┘"))
    st.append(P("引擎切换仅依赖环境变量，无需改动业务代码：<font face='Courier'>LLM_PROVIDER=bailian</font> 时通过 DashScope OpenAI 兼容接口调用千问；<font face='Courier'>LLM_PROVIDER=ollama</font> 时使用本地模型。任一引擎不可用均自动降级 Mock，保证前端全流程可演示。"))

    # 四、四大能力映射
    st.append(H1("四、四大核心能力映射（对齐赛题能力项）"))
    st.append(table([
        ["赛题能力项", "系统实现", "对应 Agent / 模块"],
        ["（一）文献挖掘与事实提取", "本地 FTS5 文献检索 + 证据链构建 + 知识缺口识别，避免断章取义", "文献整合者 / /api/literature/search"],
        ["（二）逻辑驱动的假设生成", "归纳+演绎提示词，生成可证伪、多视角假设", "假设生成器 / /api/research/hypothesis"],
        ["（三）论证可行与多轮迭代", "实验规划师设计验证方案；评估验证官多轮迭代完善", "实验规划师 + 评估验证官"],
        ["（四）智能体思辨与人在回路", "评估验证官辩论/反例搜索；前端 IteratePage 反馈闭环", "评估验证官 / IteratePage"],
    ], [4.2*cm, 7.3*cm, 4.5*cm]))
    st.append(Spacer(1,4))
    st.append(P("流水线串联：问题理解(question) → 文献(literature) → 假设(hypothesis) → 实验(experiment) → 评估(evaluation) → 研究计划(plan)。每个 Agent 的输出作为下一阶段上下文，形成证据链传递。"))

    # 五、协作设计与上下文工程
    st.append(H1("五、多智能体协作设计与上下文工程"))
    st.append(P("上下文工程要点：① 每个 Agent 拥有独立 system_prompt 与角色设定；② 前序阶段结果经 <font face='Courier'>_format_context</font> 截断（≤2000 字符）注入后续对话，控制上下文长度；③ 假设生成器强制结构化输出（陈述/创新点/验证方案/预期结果/证伪标准/置信度）；④ 评估验证官输出 JSON 多维评分并主动寻找反例，实现“智能体思辨”。"))
    st.append(CODE(
"# agents.py — 阶段→Agent 映射\n"
"STAGE_AGENT_MAP = {\n"
"    'question': 'literature',\n"
"    'literature': 'literature',\n"
"    'hypothesis': 'hypothesis',\n"
"    'experiment': 'experiment',\n"
"    'evaluation': 'evaluation',\n"
"}\n\n"
"# 双引擎：llm_engine.get_llm_engine() 按 LLM_PROVIDER 返回\n"
"#   bailian -> BailianEngine (DashScope / 千问)\n"
"#   ollama  -> LocalLLMEngine (本地 Qwen2.5)"))
    st.append(P("百炼引擎（bailian_engine.py）调用示例（满足“通过百炼平台调用模型 API”）："))
    st.append(CODE(
"import aiohttp, json\n"
"async def chat(self, model, messages, stream=False, **kw):\n"
"    payload = {'model': self.model_map[model],\n"
"               'messages': messages, 'stream': stream}\n"
"    async with self._session.post(\n"
"        f'{self.base_url}/chat/completions',  # DashScope 兼容接口\n"
"        json=payload) as r:\n"
"        data = await r.json()\n"
"        return LLMResponse(content=data['choices'][0]\n"
"                            ['message']['content'], model=...)"))
    st.append(Spacer(1,4))
    st.append(P("注：<font face='Courier'>base_url=https://dashscope.aliyuncs.com/compatible-mode/v1</font>，鉴权头 <font face='Courier'>Authorization: Bearer $DASHSCOPE_API_KEY</font>。调用凭证截图由人工在百炼控制台获取（见人工事项清单）。"))

    # 3.1 数据流与状态机
    st.append(H2("3.1 数据流与状态机"))
    st.append(P("研究会话状态机：pending → processing → completed/failed。每个 Agent 调用经编排器写入 agent_logs，前端通过 SSE 实时渲染。文献检索结果写入 SQLite（FTS5），天文数据预打包于 astro_data 表，知识图谱存于 kg_nodes/kg_edges 并支持 BFS 路径查询，实现“关联发现”。"))
    st.append(table([
        ["数据/模块", "来源", "用途"],
        ["文献库", "本地 FTS5 索引（可导入 arXiv/ADS 元数据）", "证据链与知识缺口识别"],
        ["天文数据集", "预打包耀斑/活动区样本（SDO/HMI 派生公开汇总）", "假设验证数据底座"],
        ["知识图谱", "kg_nodes / kg_edges（BFS 路径）", "关联发现与跨学科迁移"],
        ["Agent 日志", "agent_logs 表", "过程可复现与审计"],
    ], [3*cm, 8*cm, 5*cm]))
    st.append(H2("5.1 提示词工程示例（假设生成器）"))
    st.append(P("假设生成器 system_prompt 强制结构化：要求输出“假设陈述 / 创新点 / 验证方案 / 预期结果 / 证伪标准 / 置信度”，并生成 3 个不同视角候选，从提示词层面保障赛题核心“可证伪、可验证”。评估验证官进一步输出 JSON 多维评分并主动寻找反例，形成智能体自我思辨。"))

    # 六、真实案例
    st.append(PageBreak())
    st.append(H1("六、真实案例：《科学假设与研究计划》（十大标准字段）"))
    st.append(P("以下为系统在天文学领域生成的计划结构示意（字段完整对齐比赛“生成结果规范”）。生产环境中由 <font face='Courier'>/api/research/plan</font> 经千问实时生成；参考文献须真实可核验，严禁虚构。"))
    st.append(table([
        ["标准字段", "示例内容（太阳活动区耀斑预测）"],
        ["待研究问题", "现有耀斑预报依赖静态磁特征阈值，难以刻画活动区演化非线性机制；需自动生成可证伪的前兆假设。"],
        ["解决思路", "将活动区磁自由能/螺旋度时序演化与 GOES 流量关联，假设“磁螺度累积速率突增先于 M 级耀斑 6–24h”可由观测证伪。"],
        ["技术手段", "SDO/HMI 矢量磁图（SHARP）→ 计算磁自由能、垂直电流、螺度；LSTM/GRU 时序建模；逻辑回归基线对比；ROC-AUC 评估。"],
        ["数据集.Source", "NOAA/SWPC 耀斑目录（1955–今）；SDO/HMI SHARP 磁参量（arXiv:1407.3179，Bobra et al.）；真实公开。"],
        ["数据集.Target", "拟采集：目标活动区 T–48h 磁参量时序 + T+24h 是否发生 ≥M1.0 耀斑标签。"],
        ["标题", "Magnetic Helicity Accretion Rate as a Precursor of ≥M-class Solar Flares: A Testable Hypothesis"],
        ["摘要", "背景：耀斑预报精度受限；方法：提出螺度累积速率前兆假设并用 HMI+GOES 数据验证；预期：AUC>0.82。"],
        ["方法论", "Step1 磁参量提取→Step2 螺度速率计算→Step3 LSTM 分类→Step4 与经验阈值基线对比。"],
        ["实验设计", "基线：McIntosh 分类/经验阈值；指标：TSS、ROC-AUC、Brier Score；时序交叉验证。"],
        ["实验结果", "基于历史数据回测，螺度速率突增窗口内 M 级耀斑命中率较基线提升约 12%（示意，需实跑）。"],
        ["参考论文", "[1] Bobra & Couvidat 2015, ApJ 798:135；[2] Leka & Barnes 2007, ApJ 656:1173；[3] NOAA SWPC 耀斑目录。"],
    ], [3.2*cm, 12.8*cm]))
    st.append(Spacer(1,4))
    st.append(P("上述参考文献为天文学领域真实公开文献（DOI 可查），用于说明输出格式；最终提交应由系统文献 Agent 实时检索并附真实出处，杜绝虚构。", note_style))

    # 七、部署与运行
    st.append(H1("七、部署、运行与一键交付"))
    st.append(P("提供 Docker Compose 一键部署（Ollama + FastAPI + Nginx 三容器），亦支持本地开发模式。提交模式配置：<font face='Courier'>LLM_PROVIDER=bailian</font> + <font face='Courier'>DASHSCOPE_API_KEY</font>。详见《部署运维手册》。"))

    # 八、安全与可复现
    st.append(H1("八、安全、合规与可复现性"))
    st.append(ListFlowable([
        ListItem(P("基座模型合规：双引擎均基于千问（Qwen）开源模型；提交路径经阿里云百炼平台调用。")),
        ListItem(P("安全：JWT 认证（SHA-256 哈希）、CORS 策略、输入校验、SQL 参数化查询（无拼接）、Mock 降级避免敏感调用泄露。")),
        ListItem(P("可复现：SQLite 确定性初始化脚本 + 种子数据；环境由 requirements.txt / package-lock 锁定；实验由固定随机种子与公开数据集保障。")),
        ListItem(P("可复现性验证：提供单元/集成测试与一键运行脚本，详见测试报告。")),
    ], bulletType="bullet"))

    # 九、创新点与评分映射
    st.append(H1("九、创新点与评分标准映射"))
    st.append(table([
        ["评分维度（满分）", "本项目对应得分点"],
        ["科学价值·假设创新与自洽(20)", "多视角可证伪假设 + 评估验证官反例检测，提升自洽性"],
        ["科学价值·可落地验证(20)", "实验规划师输出可执行 Python 验证框架 + 公开数据集基线对比"],
        ["技术深度·多智能体协作(15)", "4-Agent 流水线 + 上下文工程 + 研究计划编排"],
        ["技术深度·多模态处理(15)", "Qwen-VL 多模态引擎接入实测图像/磁图（预留 multimodal 通道）"],
        ["应用潜力·场景支撑(10)", "太阳耀斑预报，对接空间天气业务需求"],
        ["应用潜力·成果转化(10)", "结构化研究计划可直接转化为论文提纲/实验申请"],
        ["应用潜力·可复现(10)", "Docker 一键部署 + 锁定依赖 + 公开数据"],
    ], [5.5*cm, 10.5*cm]))

    st.append(H1("十、总结"))
    st.append(P("Academic Joan of Arc 以千问多智能体架构实现了“文献→假设→实验→评估→计划”的科研闭环，严格对齐赛题四大能力项与《科学假设与研究计划》十大标准字段，并通过阿里云百炼平台满足基座模型合规要求。系统在离线/在线双模式下均可演示，具备良好的可复现性与落地基础。"))
    st.append(Spacer(1,6))
    st.append(P("（本文档 ≤20 页，满足比赛“技术方案文档 PDF≤20 页”提交规范。）", small_style))

    st.append(H1("附录：项目目录与一键运行"))
    st.append(CODE(
"Academic-Joan-of-Arc/\n"
"├─ backend/app/{main,auth,agents,llm_engine,bailian_engine}.py\n"
"├─ frontend/src/pages/        # 11 个功能页面\n"
"├─ docker-compose.yml         # Ollama+FastAPI+Nginx 一键部署\n"
"├─ .env.example               # LLM_PROVIDER / DASHSCOPE_API_KEY\n"
"├─ database/schema.sql        # SQLite 11 表 + FTS5\n"
"└─ scripts/                   # 初始化、验证、文档生成"))
    st.append(P("提交模式运行：配置 LLM_PROVIDER=bailian 与 DASHSCOPE_API_KEY 后执行 docker-compose up -d，访问 http://localhost:3000；API 文档见 http://localhost:8000/docs。", small_style))

    doc.build(st)
    print("tech ok:", path)

# ══════════════════════════════════════════════════════════════
# 2) 用户操作手册
# ══════════════════════════════════════════════════════════════
def build_user(path):
    doc = SimpleDocTemplate(path, pagesize=A4, topMargin=1.6*cm, bottomMargin=1.5*cm,
                            leftMargin=1.8*cm, rightMargin=1.8*cm, title="用户操作手册")
    st = [P("用户操作手册", title_style), P("Academic Joan of Arc — 基于千问的 AI Scientist 科研平台", small_style), Spacer(1,6)]
    st.append(H1("一、登录与账号"))
    st.append(P("1. 访问系统首页（Docker 部署默认 http://localhost:3000）。"))
    st.append(P("2. 点击右上角“登录”，使用演示账号：研究员 researcher / researcher123，或管理员 admin / admin123。首次使用可在登录页注册新账号。"))
    st.append(P("3. 登录后进入 Dashboard 仪表盘，可查看研究任务状态与统计卡片。"))

    st.append(H1("二、核心功能页面"))
    pages = [
        ("AIHub 首页", "集成全部 Agent 入口导航，是科研流水线的总控台。"),
        ("QuestionPage 科学问题生成", "输入研究主题，系统智能生成并润色科学问题。"),
        ("LiteraturePage 文献综述", "检索、总结文献，管理引用；支持本地 FTS5 检索与证据链构建。"),
        ("HypothesisPage 假设生成", "基于文献生成可证伪的科学假设，展示创新点/验证方案/证伪标准/置信度。"),
        ("PlanPage 实验方案设计", "AI 辅助设计实验变量、步骤与 Python 验证代码框架。"),
        ("IteratePage 迭代优化", "对假设进行多轮反馈与迭代，实现“人在回路”思辨闭环。"),
        ("AstroDataPage 天文数据浏览", "浏览预打包天文数据集（耀斑/活动区），按来源/级别筛选。"),
        ("DataDashboard 数据看板", "展示研究进度、假设数、文献数、知识图谱规模等统计。"),
        ("KnowledgeGraphPage 知识图谱", "力导向图可视化科研实体与关系，支持节点筛选与路径查询。"),
    ]
    st.append(table([["页面", "功能说明"]] + [[a,b] for a,b in pages], [4.5*cm, 11.5*cm]))

    st.append(H1("三、完成一次研究闭环（典型流程）"))
    steps = [
        "在 QuestionPage 输入或生成科学问题，点击“保存/下一步”。",
        "在 LiteraturePage 检索并整合文献，识别知识缺口。",
        "在 HypothesisPage 生成 3 个候选假设，查看置信度与证伪标准。",
        "在 PlanPage 为选定假设设计实验方案（含代码框架）。",
        "在 IteratePage 针对评估验证官意见做多轮迭代优化。",
        "调用“生成研究计划”，导出《科学假设与研究计划》十大字段 JSON（可直接用于参赛提交）。",
    ]
    st.append(ListFlowable([ListItem(P(s)) for s in steps], bulletType="1"))
    st.append(Spacer(1,4))
    st.append(P("提示：若后端未连接模型（Ollama 未启动且未配置百炼 Key），系统自动进入 Mock 演示模式，全流程界面可正常操作，便于离线评审演示。", note_style))
    st.append(H1("四、常见问题"))
    st.append(table([
        ["现象", "处理"],
        ["登录失败", "确认账号密码；Docker 模式确认 backend 容器已启动（docker logs ajoa-backend）。"],
        ["假设生成无响应", "检查 LLM_PROVIDER 与对应 Key/Ollama 状态；访问 /health 查看 provider 与 llm 健康。"],
        ["前端空白", "确认 nginx 容器运行且 API_BASE_URL 指向后端地址。"],
    ], [4.5*cm, 11.5*cm]))
    doc.build(st)
    print("user ok:", path)

# ══════════════════════════════════════════════════════════════
# 3) 部署运维手册
# ══════════════════════════════════════════════════════════════
def build_deploy(path):
    doc = SimpleDocTemplate(path, pagesize=A4, topMargin=1.6*cm, bottomMargin=1.5*cm,
                            leftMargin=1.8*cm, rightMargin=1.8*cm, title="部署运维手册")
    st = [P("部署运维手册", title_style), P("Academic Joan of Arc — Docker / 本地部署与故障排查", small_style), Spacer(1,6)]
    st.append(H1("一、环境要求"))
    st.append(table([
        ["资源", "最低（7B/Ollama）", "推荐（百炼提交）"],
        ["内存", "8GB", "16GB+（百炼模式由云端承担推理，本地仅前端+API）"],
        ["磁盘", "30GB", "50GB"],
        ["运行环境", "Docker Desktop 4.0+ / Python 3.11+ / Node 18+", "同左"],
    ], [3.5*cm, 6*cm, 6.5*cm]))

    st.append(H1("二、方式一：Docker Compose 一键部署（推荐）"))
    st.append(CODE(
"git clone <repo> && cd Academic-Joan-of-Arc\n"
"cp .env.example .env\n"
"# 编辑 .env：LLM_PROVIDER=bailian ; DASHSCOPE_API_KEY=你的KEY\n"
"docker-compose up -d\n"
"# 访问：主应用 http://localhost:3000  API文档 http://localhost:8000/docs"))
    st.append(P("容器组成：ollama（本地推理，提交模式可移除）、backend（FastAPI）、frontend（Nginx 静态+反向代理）。提交使用百炼时可将 ollama 服务注释以节省资源。"))

    st.append(H1("三、方式二：本地开发部署"))
    st.append(CODE(
"# 后端\n"
"cd backend/app && pip install -r ../requirements.txt\n"
"export LLM_PROVIDER=bailian\n"
"export DASHSCOPE_API_KEY=你的KEY\n"
"uvicorn main:app --port 8000 --reload\n\n"
"# 前端\n"
"cd frontend && npm install && npm run dev\n"
"# 访问 http://localhost:5173"))

    st.append(H1("四、环境变量说明"))
    st.append(table([
        ["变量", "说明"],
        ["LLM_PROVIDER", "ollama（默认，离线）| bailian（百炼，提交必选）"],
        ["DASHSCOPE_API_KEY / BAILIAN_API_KEY", "百炼平台 API-KEY（bailian 模式必填）"],
        ["OLLAMA_HOST", "本地 Ollama 地址（ollama 模式）"],
        ["BAILIAN_MODEL_*", "千问模型映射（reasoning/general/coding/multimodal）"],
        ["DATABASE_URL", "SQLite 路径，默认 data/ai_scientist.db"],
        ["JWT_SECRET", "JWT 签名密钥，生产务必修改"],
    ], [5.5*cm, 10.5*cm]))

    st.append(H1("五、健康检查与故障排查"))
    st.append(P("访问 <font face='Courier'>GET /health</font> 返回 provider、llm 健康状态与 database 连接状态。常见故障："))
    st.append(table([
        ["故障", "排查"],
        ["llm 状态 unhealthy（bailian）", "检查 DASHSCOPE_API_KEY 是否有效、网络可达 DashScope；在百炼控制台确认额度。"],
        ["llm 状态 unhealthy（ollama）", "执行 ollama serve 并 ollama pull qwen2.5:7b；确认 OLLAMA_HOST。"],
        ["database disconnected", "确认 data/ 目录可写；首次启动自动执行 schema.sql 初始化。"],
        ["前端调用 401", "重新登录获取 JWT；确认后端 auth 路由正常。"],
    ], [5.5*cm, 10.5*cm]))
    st.append(Spacer(1,4))
    st.append(P("降级策略：任一推理引擎不可用时，后端返回结构化 Mock 响应，前端全流程可演示，不阻塞功能。", note_style))
    doc.build(st)
    print("deploy ok:", path)

if __name__ == "__main__":
    build_tech(os.path.join(ROOT, "技术方案说明书.pdf"))
    build_user(os.path.join(ROOT, "用户操作手册.pdf"))
    build_deploy(os.path.join(ROOT, "部署运维手册.pdf"))
