# Academic Joan of Arc — 后端 API 接口文档

> 版本：v3.1 · 双推理引擎（阿里云百炼 / 本地 Ollama）
> 基础地址：`http://localhost:8000` · 在线文档：`http://localhost:8000/docs`（Swagger）
> 认证：除 `/health` 与公开接口外，需携带 `Authorization: Bearer <JWT>`

---

## 1. 认证模块（auth.py）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册用户（用户名、密码，SHA-256 哈希存储） |
| POST | `/api/auth/login` | 登录获取 JWT（表单/JSON：username, password） |
| GET  | `/api/auth/me` | 获取当前用户信息（需 JWT） |

**登录示例**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"researcher","password":"researcher123"}'
# → {"access_token":"<JWT>","token_type":"bearer"}
```

---

## 2. 通用对话（兼容 OpenAI 格式）

### POST `/api/chat`
调用千问模型进行通用对话，支持流式（SSE）与非流式。

**请求体**
```json
{
  "model": "reasoning",          // reasoning | general | coding | multimodal
  "messages": [{"role":"user","content":"..."}],
  "stream": false,
  "temperature": 0.7
}
```
**响应（非流式）**
```json
{
  "choices":[{"message":{"role":"assistant","content":"..."},"finish_reason":"stop"}],
  "usage": {"prompt_tokens":0,"completion_tokens":0,"total_tokens":0},
  "model": "qwen-max"
}
```
> 模型可用性由 `LLM_PROVIDER` 决定：百炼模式返回 `qwen-max/plus/turbo`；Ollama 模式返回 `qwen2.5:*`；引擎不可用时降级为 Mock。

---

## 3. 多智能体编排（agents.py）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/research/run-agent` | 运行单个研究 Agent（question/literature/hypothesis/experiment/evaluation） |
| POST | `/api/research/run-agent-stream` | 流式运行 Agent（SSE） |
| POST | `/api/research/hypothesis` | 专用：生成科学假设（结构化提示词） |
| POST | `/api/research/plan` | **生成《科学假设与研究计划》（十大标准字段，对齐比赛规范）** |

### POST `/api/research/run-agent`
```json
{
  "stage": "hypothesis",
  "input": "基于以下文献综述生成假设...",
  "context": {"literature":"...","question":"..."},
  "sessionId": ""
}
```
→ `{"success":true,"stage":"hypothesis","content":"...","model":"qwen-max","tokens":{...}}`

### POST `/api/research/plan`（比赛核心交付）
将问题/文献/假设/实验方案整合为标准化研究计划 JSON。

**请求体**
```json
{
  "question": "太阳耀斑爆发的早期前兆有哪些？",
  "literature": "（文献综述文本）",
  "hypothesis": "（假设生成文本）",
  "experiment": "（实验方案文本）",
  "model": "reasoning"
}
```
**响应**
```json
{
  "success": true,
  "plan": "{\"problem_statement\":\"...\",\"rationale\":\"...\",\"technical_details\":\"...\",\"datasets\":{\"source\":\"...\",\"target\":\"...\"},\"paper_title\":\"...\",\"paper_abstract\":\"...\",\"methods\":\"...\",\"experiments\":\"...\",\"results\":\"...\",\"references\":[...]}",
  "model": "qwen-max"
}
```
> 十大字段：`problem_statement` / `rationale` / `technical_details` / `datasets.source` / `datasets.target` / `paper_title` / `paper_abstract` / `methods` / `experiments` / `results` / `references`（references 严禁虚构）。

---

## 4. 研究会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/research/session` | 创建研究会话（title, question, domain, depth） |
| GET  | `/api/research/sessions` | 列出最近 50 个会话 |
| GET  | `/api/research/session/{id}` | 获取会话详情 |
| DELETE | `/api/research/session/{id}` | 删除会话 |

---

## 5. 数据与知识

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/literature/search?q=&top_k=` | 本地文献检索（SQLite FTS5，降级 LIKE） |
| GET  | `/api/astro/data?source=&flare_class=&limit=` | 天文数据查询（预打包数据集） |
| GET  | `/api/knowledge/graph?node_type=&limit=` | 知识图谱节点与关系 |
| GET  | `/api/knowledge/paths?source_id=&target_id=` | 两节点间路径（BFS） |
| GET  | `/api/stats/dashboard` | 数据大屏统计（会话/假设/文献/图谱计数） |
| GET  | `/api/agent/logs?limit=` | Agent 执行日志 |

---

## 6. 系统

### GET `/health`
```json
{
  "status":"healthy",
  "version":"3.0.0",
  "mode":"offline",
  "provider":"bailian",
  "llm":{"status":"healthy","platform":"aliyun-bailian (DashScope)","models_required":["qwen-max","qwen-plus","qwen-plus","qwen-vl-max"],"ready":true},
  "database":"connected"
}
```

---

## 7. 错误码

| HTTP | 含义 |
|------|------|
| 400 | 请求参数校验失败（zod 风格校验） |
| 401 | 未认证 / Token 失效 |
| 422 | Pydantic 模型解析失败 |
| 500 | 服务端内部错误（含引擎调用失败，自动降级 Mock） |

---

## 8. 推理引擎切换

| 环境变量 | 取值 | 说明 |
|----------|------|------|
| `LLM_PROVIDER` | `ollama`（默认）/ `bailian` | 选择推理引擎 |
| `DASHSCOPE_API_KEY` / `BAILIAN_API_KEY` | 百炼 API-KEY | 百炼模式必填 |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 模式地址 |
| `BAILIAN_MODEL_REASONING/GENERAL/CODING/MULTIMODAL` | 千问模型名 | 可覆盖模型映射 |
