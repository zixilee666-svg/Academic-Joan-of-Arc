# 基于国产开源大模型的AI Scientist科研智能平台 — 龙虾复现提示词

> 项目代号：Academic-Web  
> 比赛：挑战杯"揭榜挂帅"XH-202619  
> 基座模型：千问(Qwen)系列 via 阿里云百炼平台  
> 技术栈：React 18 + TS + Vite + Tailwind + EdgeOne Pages + EdgeOne Functions + KV Storage  
> 文档生成日期：2026-07-12  
> 版本：v1.0

---

## Phase 1：基础架构与基础设施（第1-3周）

**阶段目标**：搭建AI Scientist科研智能平台的基础框架，完成百炼API集成、基础UI组件库、认证系统和EdgeOne部署配置，实现可运行的前端骨架和API代理层。

**应用技术清单**：
- React 18.3 + TypeScript 5.3 + Vite 5.0
- Tailwind CSS 3.4 + shadcn/ui
- 阿里云百炼平台API（OpenAI兼容格式，SSE流式）
- EdgeOne Pages + Edge Functions（JavaScript运行时）
- EdgeOne KV Storage（键值存储）
- Zustand 4.5（状态管理）+ persist中间件
- React Router v6（客户端路由）
- Lucide React（图标系统）
- Axios（HTTP客户端）
- react-markdown + remark-gfm（Markdown渲染）

---

### 子任务分解表

| 子任务ID | 子任务名称 | 龙虾类型 | 预计工时 | 前置依赖 | 验收标准 |
|---------|-----------|---------|---------|---------|---------|
| P1-T1 | 项目初始化与框架搭建 | coder | 4h | 无 | `npm run dev`正常启动，目录结构符合规范 |
| P1-T2 | 百炼API封装与类型定义 | coder | 6h | P1-T1 | 可成功调用qwen-max并返回结构化响应，SSE流式可用 |
| P1-T3 | 基础UI组件库与主题系统 | coder | 8h | P1-T1 | 12+基础组件可用，深色/浅色主题切换正常 |
| P1-T4 | 用户认证与状态管理 | coder | 6h | P1-T1, P1-T2 | 注册/登录/登出流程完整，JWT持久化到localStorage |
| P1-T5 | EdgeOne Functions基础中间件 | coder | 6h | P1-T2 | `/api/health`返回200，CORS正确，百炼代理可用 |
| P1-T6 | 基础路由与页面骨架 | coder | 4h | P1-T3, P1-T4 | 所有页面路由可访问，导航高亮正确，响应式布局正常 |

---

### 详细龙虾提示词：P1-T1 项目初始化与框架搭建

```
【龙虾角色】：coder
【龙虾ID】：P1-T1
【任务名称】：项目初始化与Vite+React+TS框架搭建
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（空目录或需初始化）
- 前置已完成：无
- 技术约束：必须使用Vite 5+、React 18+、TypeScript 5+、Tailwind 3.4+；所有代码严格TypeScript，禁止any
【具体指令】：
1. 执行`npm create vite@latest . -- --template react-ts`，确保项目创建在当前目录。
2. 安装依赖：`npm install react-router-dom zustand axios lucide-react clsx tailwind-merge class-variance-authority`
3. 安装开发依赖：`npm install -D @types/node tailwindcss postcss autoprefixer @tailwindcss/typography`
4. 初始化Tailwind：`npx tailwindcss init -p`，配置`tailwind.config.js`：
   - content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"]
   - darkMode: "class"
   - 扩展颜色：primary(#2563eb), secondary(#64748b), background(#ffffff/#0f172a)
5. 创建`src/styles/globals.css`，导入Tailwind基础层，定义CSS变量支持dark mode。
6. 创建目录结构：
   - src/components/ui/（基础UI组件）
   - src/components/layout/（布局组件）
   - src/pages/（页面组件）
   - src/hooks/（自定义Hooks）
   - src/lib/（工具函数）
   - src/types/（全局类型）
   - src/store/（Zustand状态）
   - src/api/（API封装）
   - src/config/（配置文件）
7. 配置`tsconfig.json`：确保`baseUrl: "."`，`paths: {"@/*": ["src/*"]}`。
8. 配置`vite.config.ts`：添加`resolve.alias: {"@": path.resolve(__dirname, "src")}`。
9. 修改`src/App.tsx`：只保留最基础的骨架，引入路由占位。
10. 运行`npm run build`，确保无TS错误和构建错误。
【代码规范】：
- 所有组件使用函数式组件+TypeScript类型
- 文件名使用PascalCase（组件）或camelCase（工具）
- 目录名使用kebab-case
- 禁止在代码中硬编码API KEY
- 所有配置项放入src/config/
【验收标准】：
1. `npm run dev`启动后访问localhost:5173无报错
2. `npm run build`零错误零警告
3. 目录结构与规范一致，目录树可通过`tree src -L 2`验证
4. tailwind.config.js包含darkMode: "class"
【预期产出文件清单】：
- tailwind.config.js
- postcss.config.js
- src/styles/globals.css
- src/App.tsx
- src/main.tsx
- src/vite-env.d.ts
- vite.config.ts
- tsconfig.json（更新后）
【风险提醒】：
- Vite模板可能生成较旧的React版本，需手动检查package.json并升级
- Tailwind 3.4与Vite 5的兼容性需要确认；如遇问题，降级到tailwindcss@3.3.5
- TypeScript路径别名配置失败会导致后续import报错，需确保tsconfig和vite.config同步
```

---

### 详细龙虾提示词：P1-T2 百炼API封装与类型定义

```
【龙虾角色】：coder
【龙虾ID】：P1-T2
【任务名称】：百炼API TypeScript封装与SSE流式处理
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P1-T1已完成）
- 前置已完成：P1-T1框架搭建
- 技术约束：百炼API使用OpenAI兼容格式；endpoint为`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`；模型列表支持qwen-max、qwen-plus、qwq-32b；SSE流式响应必须支持
【具体指令】：
1. 在`src/types/`创建`bailian.ts`，定义核心接口：
   - ChatMessage: {role: "system"|"user"|"assistant"; content: string; name?: string}
   - ChatRequest: {model: string; messages: ChatMessage[]; temperature?: number; max_tokens?: number; stream?: boolean; top_p?: number}
   - ChatResponse: {id: string; choices: Array<{message: ChatMessage; finish_reason: string}>; usage: {prompt_tokens: number; completion_tokens: number; total_tokens: number}}
   - StreamChunk: {id: string; choices: Array<{delta: {role?: string; content?: string}; finish_reason: string|null}>}
2. 在`src/config/`创建`ai.ts`，导出：
   - BAILIAN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
   - DEFAULT_MODEL = "qwen-max"
   - AVAILABLE_MODELS = ["qwen-max", "qwen-plus", "qwq-32b", "qwen-turbo"]
   - 温度、max_tokens等默认值
3. 在`src/api/`创建`bailianClient.ts`，实现：
   - 非流式调用`chatCompletion(request: ChatRequest): Promise<ChatResponse>`
   - 流式调用`chatCompletionStream(request: ChatRequest, onChunk: (chunk: StreamChunk) => void, onDone: () => void, onError: (err: Error) => void): void`
   - 使用原生EventSource或fetch+ReadableStream处理SSE
   - 流式解析逻辑：按行读取`data:`前缀，JSON解析后提取delta.content
   - 错误处理：区分网络错误、API错误（非200）、解析错误
4. 在`src/api/`创建`bailianClient.test.ts`（或简单测试页面），写一个测试组件：
   - 输入框+发送按钮
   - 调用非流式API并显示结果
   - 调用流式API并实时显示 accumulating content
   - 使用从环境变量读取的API Key（Vite: `import.meta.env.VITE_BAILIAN_API_KEY`）
5. 在根目录创建`.env.example`：VITE_BAILIAN_API_KEY=your-api-key-here
6. 在`vite.config.ts`中确保`envPrefix: "VITE_"`。
7. 创建`src/hooks/useBailianChat.ts`：封装React Hook，管理消息状态、加载状态、流式accumulation。
8. 验证：用测试组件发送"你好，请用一句话介绍自己"，确认收到qwen-max的回复。
【代码规范】：
- API Key必须从import.meta.env读取，禁止硬编码
- 所有fetch调用必须携带header：Authorization: Bearer ${apiKey}, Content-Type: application/json
- SSE解析必须处理`[DONE]`标记和空行
- 流式回调中必须处理finish_reason === "stop"时结束
【验收标准】：
1. 非流式调用成功，返回的choices[0].message.content是有效字符串
2. 流式调用能在2秒内开始收到首chunk，10秒内完成完整回复
3. 错误场景处理：无API Key时友好提示，网络超时（30s）时提示重试
4. TypeScript类型在src/types/bailian.ts中完整定义，无any
【预期产出文件清单】：
- src/types/bailian.ts
- src/config/ai.ts
- src/api/bailianClient.ts
- src/hooks/useBailianChat.ts
- src/api/test/BailianTestPage.tsx（临时测试页）
- .env.example
【风险提醒】：
- 百炼API偶尔返回非标准SSE格式（如空data行），解析器需健壮处理
- 跨域问题：生产环境通过EdgeOne Functions代理，开发环境需在vite.config配置proxy或允许CORS
- qwq-32b是推理模型，输出可能包含`<think>`标签，前端需做过滤处理
- API Key泄露风险：确保.env在.gitignore中
```

---

### 详细龙虾提示词：P1-T3 基础UI组件库与主题系统

```
【龙虾角色】：coder
【龙虾ID】：P1-T3
【任务名称】：shadcn/ui风格基础组件库与明暗主题系统
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P1-T1已完成）
- 前置已完成：P1-T1
- 技术约束：不使用shadcn CLI（避免额外依赖），手动实现核心组件；必须支持dark mode切换；所有组件使用TypeScript+Tailwind
【具体指令】：
1. 在`src/components/ui/`创建以下组件（每个组件独立文件，使用forwardRef）：
   - Button：variants（default, outline, ghost, destructive, link），sizes（sm, md, lg, icon），支持loading状态
   - Card：Card, CardHeader, CardTitle, CardContent, CardFooter
   - Input：支持label、error、disabled、type
   - Textarea：自适应高度，支持maxLength计数
   - Select：原生select的封装样式，或简单的div-based下拉
   - Badge：variants（default, secondary, outline, destructive）
   - Avatar：支持fallback文字
   - Skeleton：脉冲加载动画
   - Tooltip：基于CSS的简单实现或使用title属性降级
   - Dialog/Modal：使用createPortal，支持ESC关闭和点击backdrop关闭
   - Toast：简易通知系统，使用zustand管理toast队列
   - Tabs：TabList + TabPanel，支持受控和非受控
2. 创建`src/components/ui/index.ts`统一导出所有组件。
3. 创建`src/components/layout/`：
   - Navbar：顶部导航，包含Logo、导航链接、主题切换按钮、用户头像
   - Sidebar：左侧边栏（可折叠），导航菜单项高亮
   - Footer：底部版权信息
   - MainLayout：组合Navbar+Sidebar+Footer，支持移动端响应式（sidebar变drawer）
4. 创建`src/hooks/useTheme.ts`：管理dark/light/system主题，写入localStorage，监听系统偏好。
5. 创建`src/store/themeStore.ts`（Zustand）：管理全局主题状态。
6. 在`src/styles/globals.css`中定义完整的设计系统CSS变量：
   - colors: background, foreground, primary, secondary, muted, accent, destructive, border, input, ring
   - 每种颜色分light和dark值（使用:root和.dark）
7. 在`src/App.tsx`中引入ThemeProvider，确保dark mode切换生效。
8. 在`src/pages/`创建临时展示页`DesignSystemPage.tsx`，展示所有组件的各种variant和主题切换效果。
9. 验证：切换主题时，所有组件颜色正确变化，无闪烁。
【代码规范】：
- 组件使用`cn()`工具函数（基于clsx+tailwind-merge）合并className
- 组件props使用接口定义，扩展HTML原生属性时使用`React.ComponentPropsWithoutRef<"div">`
- 颜色必须使用CSS变量（如`bg-background text-foreground`），禁止硬编码颜色值
- 组件文件必须导出默认和命名导出两种形式
【验收标准】：
1. 12+组件在DesignSystemPage上可见且功能正常
2. 主题切换按钮切换时，页面无闪烁，所有组件颜色正确反色
3. Button组件支持loading状态，显示旋转spinner且disabled
4. Dialog组件支持ESC关闭、点击backdrop关闭、焦点陷阱（如可实现）
5. 移动端宽度<768px时，sidebar自动折叠为hamburger菜单
6. 所有组件通过axe-core基础可访问性检查（如无空按钮、有label关联）
【预期产出文件清单】：
- src/components/ui/Button.tsx
- src/components/ui/Card.tsx
- src/components/ui/Input.tsx
- src/components/ui/Textarea.tsx
- src/components/ui/Select.tsx
- src/components/ui/Badge.tsx
- src/components/ui/Avatar.tsx
- src/components/ui/Skeleton.tsx
- src/components/ui/Dialog.tsx
- src/components/ui/Toast.tsx
- src/components/ui/Tabs.tsx
- src/components/ui/index.ts
- src/components/layout/Navbar.tsx
- src/components/layout/Sidebar.tsx
- src/components/layout/Footer.tsx
- src/components/layout/MainLayout.tsx
- src/hooks/useTheme.ts
- src/store/themeStore.ts
- src/lib/utils.ts（cn函数）
- src/pages/DesignSystemPage.tsx
【风险提醒】：
- Dialog的焦点管理和portal创建在Vite+React中可能有hydration问题，确保只在客户端mount后渲染
- Tailwind CSS变量在dark mode下的继承顺序可能出错，测试时检查body的class是否正确切换
- 移动端响应式测试需在真机或DevTools模拟，避免仅依赖桌面测试
```

---

### 详细龙虾提示词：P1-T4 用户认证与状态管理

```
【龙虾角色】：coder
【龙虾ID】：P1-T4
【任务名称】：用户认证系统（JWT）与全局状态管理
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P1-T1、P1-T3已完成）
- 前置已完成：P1-T1, P1-T3
- 技术约束：认证后端使用EdgeOne Functions（P1-T5实现），当前前端需模拟或预留接口；JWT存储在localStorage；使用Zustand管理全局状态
【具体指令】：
1. 在`src/types/`创建`auth.ts`：
   - User: {id: string; email: string; name: string; avatar?: string; createdAt: string}
   - AuthState: {user: User|null; token: string|null; isLoading: boolean; error: string|null}
   - LoginRequest: {email: string; password: string}
   - RegisterRequest: {email: string; password: string; name: string}
2. 在`src/store/`创建`authStore.ts`（Zustand）：
   - state: AuthState
   - actions: login, register, logout, setUser, setToken, clearError
   - 使用persist中间件将token和user持久化到localStorage
   - 初始化时从localStorage恢复token，并设置isLoading=true进行自动验证
3. 在`src/api/`创建`authClient.ts`：
   - 模拟login/register API（返回Promise，延迟500ms），数据格式与真实API一致
   - 真实API调用待P1-T5完成后替换
   - 封装`apiFetch`函数：自动携带Authorization: Bearer ${token} header
   - 拦截401响应：自动清除token并跳转登录页
4. 在`src/hooks/`创建`useAuth.ts`：
   - 导出authStore的selector和辅助函数
   - 提供`isAuthenticated`、`isAdmin`等computed状态
5. 在`src/pages/`创建：
   - LoginPage.tsx：邮箱+密码表单，登录按钮，跳转注册链接
   - RegisterPage.tsx：邮箱+密码+确认密码+姓名表单，注册按钮，表单验证
   - ProfilePage.tsx：展示用户信息，支持修改姓名和头像，登出按钮
6. 在`src/components/layout/Navbar.tsx`中集成认证状态：
   - 未登录：显示"登录"和"注册"按钮
   - 已登录：显示用户头像下拉菜单（含"个人中心"、"登出"）
7. 在`src/App.tsx`中配置路由：/login, /register, /profile。
8. 创建`src/components/auth/ProtectedRoute.tsx`：未登录用户访问受保护路由时重定向到/login。
9. 验证：
   - 注册新用户 -> 自动登录 -> 导航栏显示头像
   - 刷新页面 -> 仍保持登录状态
   - 点击登出 -> 清除状态，跳转首页
【代码规范】：
- 密码输入框必须type="password"
- 表单验证：邮箱格式验证（正则），密码最小8位，注册时两次密码一致
- Zustand store的action必须使用immer或set函数式更新
- token必须存储在localStorage键名"academic-web-token"
【验收标准】：
1. 注册表单验证失败时，具体字段显示错误信息（红色边框+文字）
2. 登录成功后，localStorage中可看到"academic-web-token"和"academic-web-auth-storage"
3. 刷新页面后，用户状态自动恢复，无需重新登录
4. 登出后，localStorage相关键被清除，页面跳转/login
5. 未登录用户直接访问/profile被重定向到/login，登录成功后返回/profile
【预期产出文件清单】：
- src/types/auth.ts
- src/store/authStore.ts
- src/api/authClient.ts
- src/hooks/useAuth.ts
- src/pages/LoginPage.tsx
- src/pages/RegisterPage.tsx
- src/pages/ProfilePage.tsx
- src/components/auth/ProtectedRoute.tsx
【风险提醒】：
- localStorage在SSR/SSG场景下不存在，所有localStorage访问必须在useEffect或条件判断`typeof window !== "undefined"`中进行
- 模拟API的延迟需用setTimeout，避免阻塞UI
- Zustand persist中间件在存储嵌套对象时可能丢失类型，需确保User接口完整
- 密码明文传输风险：后续P1-T5需补充HTTPS和EdgeOne Functions的加密处理
```

---

### 详细龙虾提示词：P1-T5 EdgeOne Functions基础中间件

```
【龙虾角色】：coder
【龙虾ID】：P1-T5
【任务名称】：EdgeOne Functions API层与百炼代理
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P1-T2已完成）
- 前置已完成：P1-T2（百炼客户端封装）
- 技术约束：EdgeOne Functions使用JavaScript（非TS），运行时兼容Cloudflare Workers；KV Storage使用EdgeOne原生API；Functions目录默认`functions/`或`edge-functions/`
【具体指令】：
1. 确认EdgeOne Functions目录结构（通常为项目根目录`functions/`），创建：
   - functions/api/health.js：返回{status: "ok", timestamp: Date.now()}
   - functions/api/chat.js：百炼API代理（最重要）
   - functions/api/auth/login.js：用户登录（模拟或对接真实认证）
   - functions/api/auth/register.js：用户注册
   - functions/_middleware.js：全局CORS和错误处理中间件
2. 实现`functions/api/chat.js`：
   - 读取请求体{model, messages, temperature, stream, max_tokens}
   - 转发到`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
   - 携带header：Authorization: Bearer ${BAILIAN_API_KEY}（从环境变量读取）
   - 如果stream=true，直接透传SSE响应（设置Content-Type: text/event-stream）
   - 如果stream=false，透传JSON响应
   - 错误处理：百炼API错误时返回{error: string, code: number}
   - 添加简单速率限制：同一IP 10秒内最多5次请求（使用KV计数）
3. 实现`functions/_middleware.js`：
   - CORS头：Access-Control-Allow-Origin: *（或限制为部署域名）
   - 允许Methods：GET, POST, OPTIONS
   - 允许Headers：Content-Type, Authorization
   - 全局错误捕获：try/catch返回JSON错误
4. 在根目录创建`wrangler.toml`或`edgeone.json`（根据EdgeOne实际配置格式）：
   - 定义路由映射：/api/* -> functions/api/路径
   - 环境变量占位：BAILIAN_API_KEY
5. 实现`functions/api/auth/login.js`和`register.js`：
   - 使用KV Storage存储用户信息（键格式：user:${email}）
   - 密码使用bcryptjs（需npm install bcryptjs@2.4.3并打包）或简单SHA256（演示用）
   - JWT生成：使用jose库（轻量，适合Workers环境）
   - 返回{token, user: {id, email, name}}
6. 创建本地模拟脚本（可选）：`scripts/dev-proxy.js`，使用express模拟EdgeOne Functions行为用于本地开发。
7. 修改前端`src/api/bailianClient.ts`：将API地址改为`/api/chat`（生产环境通过EdgeOne Functions代理）。
8. 修改前端`src/api/authClient.ts`：将API地址改为`/api/auth/*`。
9. 验证：
   - 本地部署`npx edgeone dev`（或等效命令），访问/api/health返回ok
   - 前端发送聊天请求，通过EdgeOne Functions成功转发到百炼并返回结果
【代码规范】：
- EdgeOne Functions文件使用.js扩展名（运行时无TS支持）
- 环境变量通过`env.VAR_NAME`或`context.env.VAR_NAME`读取（根据EdgeOne文档）
- KV操作使用async/await，所有路由handler必须返回Response对象
- 错误响应必须包含JSON格式和正确的HTTP状态码
【验收标准】：
1. GET /api/health返回200和JSON {status: "ok"}
2. POST /api/chat（非流式）返回与百炼原始API一致的结构
3. POST /api/chat（stream=true）返回SSE流，前端可逐字显示
4. 未携带Authorization请求百炼时，EdgeOne Functions返回401错误（如配置了认证）
5. 跨域请求OPTIONS预检返回204
6. 同一IP快速连续请求6次，第6次返回429 Too Many Requests
【预期产出文件清单】：
- functions/_middleware.js
- functions/api/health.js
- functions/api/chat.js
- functions/api/auth/login.js
- functions/api/auth/register.js
- functions/utils/jwt.js（JWT工具）
- functions/utils/kv.js（KV封装）
- wrangler.toml / edgeone.json
- scripts/dev-proxy.js（可选）
【风险提醒】：
- EdgeOne Functions的JavaScript运行时不支持Node.js内置模块（如fs, path），使用Web标准API（fetch, Request, Response）
- bcrypt在Workers环境可能不兼容，建议使用jose库进行JWT和简单密码哈希
- 环境变量在EdgeOne控制台配置，本地开发使用.env或wrangler.toml的[vars]
- 流式响应的SSE格式必须严格遵守：每行`data: {...}\n\n`，最后`data: [DONE]\n\n`
- KV Storage在EdgeOne有读写延迟和限制，不适合高频计数，速率限制可降级为内存Map（单节点）
```

---

### 详细龙虾提示词：P1-T6 基础路由与页面骨架

```
【龙虾角色】：coder
【龙虾ID】：P1-T6
【任务名称】：React Router路由体系与页面骨架搭建
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P1-T3, P1-T4已完成）
- 前置已完成：P1-T3, P1-T4
- 技术约束：React Router v6；使用lazy loading分割代码；所有页面必须适配MainLayout
【具体指令】：
1. 在`src/App.tsx`中配置BrowserRouter路由体系：
   - 使用`createBrowserRouter`或`<Routes>`方式
   - 路由列表：
     - / -> HomePage（首页）
     - /login -> LoginPage
     - /register -> RegisterPage
     - /dashboard -> DashboardPage（受保护）
     - /research -> ResearchPage（受保护）
     - /research/:id -> ResearchDetailPage（受保护）
     - /library -> LibraryPage（文献库）
     - /profile -> ProfilePage（受保护）
     - /settings -> SettingsPage（受保护）
     - /design-system -> DesignSystemPage（开发用，仅dev环境）
     - * -> NotFoundPage
2. 使用`React.lazy()` + `Suspense` + `Skeleton`实现代码分割，每个页面独立chunk。
3. 在`src/pages/`创建所有页面骨架（仅需基础结构，具体内容后续Phase填充）：
   - HomePage：Hero区域 + 功能介绍卡片 + CTA按钮
   - DashboardPage：欢迎语 + 快速操作卡片 + 最近研究列表（模拟数据）
   - ResearchPage：研究项目列表 + 新建按钮
   - ResearchDetailPage：研究详情占位（名称、状态、标签页）
   - LibraryPage：文献列表占位 + 搜索框
   - SettingsPage：主题设置、模型选择、API Key配置（前端安全存储警告）
   - NotFoundPage：404动画 + 返回首页按钮
4. 在`src/components/layout/Sidebar.tsx`中配置导航链接：
   - 首页（Home）
   - 仪表盘（Dashboard）
   - 研究（Research）
   - 文献库（Library）
   - 设置（Settings）
   - 使用NavLink实现激活状态高亮
5. 在`src/components/layout/Navbar.tsx`中添加面包屑或当前页面标题。
6. 在`MainLayout`中集成路由切换动画（可选：使用framer-motion或简单CSS transition）。
7. 配置滚动到顶部：每次路由切换时`window.scrollTo(0, 0)`。
8. 验证：
   - 访问所有路由，页面渲染正确
   - 未登录访问/dashboard重定向到/login
   - 登录后访问/login重定向到/dashboard
   - 404页面正确显示
【代码规范】：
- 路由配置集中管理在`src/App.tsx`或`src/routes.tsx`
- 页面组件使用`export default function PageName()`
- 受保护路由统一使用`<ProtectedRoute>`包裹
- 路由路径使用kebab-case
【验收标准】：
1. 访问/显示HomePage，/login显示LoginPage，/dashboard显示DashboardPage
2. 未登录状态下直接访问/research被拦截并重定向到/login，URL参数保留redirect=/research
3. 登录后访问/login自动跳转到/dashboard
4. 侧边栏导航项与当前路由匹配时高亮显示
5. 页面切换时浏览器标签页标题变化（使用react-helmet-async或document.title）
6. 代码分割生效：每个页面有独立的JS chunk（通过Network面板验证）
【预期产出文件清单】：
- src/App.tsx（更新）
- src/routes.tsx（如需要）
- src/pages/HomePage.tsx
- src/pages/DashboardPage.tsx
- src/pages/ResearchPage.tsx
- src/pages/ResearchDetailPage.tsx
- src/pages/LibraryPage.tsx
- src/pages/SettingsPage.tsx
- src/pages/NotFoundPage.tsx
- src/components/layout/Sidebar.tsx（更新）
- src/components/layout/Navbar.tsx（更新）
【风险提醒】：
- React.lazy与TypeScript配合时，确保组件文件有默认导出
- 路由守卫和重定向逻辑在React Router v6中使用`<Navigate>`或`useNavigate`hook
- 开发环境下的/design-system路由需在生产构建时排除，可通过条件编译或环境变量控制
- 移动端路由切换时侧边栏应自动收起，避免遮挡内容
```

---

### Phase 1 阶段预期效果

完成Phase 1后，你应该看到：
1. 运行`npm run dev`启动完整的前端项目，首页有Hero区域、导航栏和侧边栏
2. 主题切换按钮可以切换明暗模式，所有组件颜色正确变化
3. 可以注册/登录/登出，认证状态持久化，受保护路由有权限控制
4. 在Settings页面或测试页面可以输入问题，通过EdgeOne Functions代理调用百炼qwen-max，流式响应逐字显示
5. 所有页面有基础骨架，路由切换流畅，移动端响应式正常
6. `npm run build`零错误，构建产物包含代码分割的chunk

---

### Phase 1 阶段联调验证

验证步骤：
1. **环境检查**：`node -v >= 18`，`npm -v >= 9`
2. **安装验证**：`npm install`无错误，无 peer dependency 警告
3. **构建验证**：`npm run build`成功，dist/目录包含JS、CSS、HTML
4. **功能验证清单**：
   - [ ] 首页可访问，导航正常
   - [ ] 注册新用户，表单验证生效
   - [ ] 登录后导航栏显示用户头像
   - [ ] 刷新页面后仍保持登录
   - [ ] 在聊天测试页面发送消息，10秒内收到qwen-max回复
   - [ ] 切换dark mode，页面颜色反色正确
   - [ ] 访问不存在的路由显示404页面
   - [ ] 移动端（375px宽度）侧边栏折叠为菜单按钮
5. **EdgeOne验证**：部署到EdgeOne Pages预览环境，确认/api/health可访问
6. **文档更新**：在README.md中记录Phase 1完成状态和启动命令

---

## Phase 2：核心智能体系统（第4-6周）

**阶段目标**：实现AI Scientist核心引擎（文献综述、假设生成、实验设计）、多智能体协作框架、研究流程管理和论文生成模块，使平台具备端到端的科研辅助能力。

**应用技术清单**：
- 百炼平台 Function Calling（工具调用）
- SSE流式响应（用于长文本生成）
- Markdown渲染（react-markdown + remark-gfm + rehype-highlight）
- KaTeX（数学公式渲染）
- Mermaid（图表渲染，可选）
- Zustand复杂状态切片（研究状态机）
- EdgeOne KV Storage（研究数据持久化）
- React DnD（研究流程拖拽，可选）
- date-fns（日期处理）

---

### 子任务分解表

| 子任务ID | 子任务名称 | 龙虾类型 | 预计工时 | 前置依赖 | 验收标准 |
|---------|-----------|---------|---------|---------|---------|
| P2-T1 | AI Scientist核心引擎 | coder | 10h | P1-T2 | 单轮研究任务可执行：输入主题→输出文献综述+假设+方案 |
| P2-T2 | 多智能体协作框架 | coder | 8h | P2-T1 | 3+智能体（文献员、实验员、分析师）可协作完成研究任务 |
| P2-T3 | 研究流程管理器 | coder | 6h | P2-T1, P2-T2 | 研究项目可创建、暂停、查看状态、历史记录 |
| P2-T4 | 论文生成与编辑模块 | coder | 8h | P2-T1 | 可生成结构化论文（摘要/引言/方法/结果/讨论）并编辑 |
| P2-T5 | 实验设计与代码生成 | coder | 6h | P2-T2 | 实验方案可生成并附带Python代码，支持复制和下载 |
| P2-T6 | 知识库与文献管理 | coder | 6h | P1-T5 | 文献可上传/链接添加、元数据提取、引用管理 |

---

### 详细龙虾提示词：P2-T1 AI Scientist核心引擎

```
【龙虾角色】：coder
【龙虾ID】：P2-T1
【任务名称】：AI Scientist核心研究引擎（单智能体）
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（Phase 1已完成）
- 前置已完成：P1-T2（百炼API封装）, P1-T6（页面路由）
- 技术约束：使用qwen-max（通用）或qwq-32b（推理）模型；单次请求上下文最大32K tokens；必须流式输出以提升用户体验；输出格式为结构化Markdown
【具体指令】：
1. 在`src/types/`创建`research.ts`：
   - ResearchTopic: {id: string; title: string; description: string; domain: string; createdAt: string; status: "idle"|"running"|"completed"|"failed"}
   - ResearchPhase: {id: string; name: string; status: "pending"|"running"|"completed"|"failed"; output: string; startedAt?: string; completedAt?: string}
   - ResearchResult: {topic: ResearchTopic; phases: ResearchPhase[]; finalReport?: string}
   - ScientistAgentRequest: {topic: string; domain: string; depth: "quick"|"standard"|"deep"; language: "zh"|"en"}
2. 在`src/config/`创建`research.ts`：
   - 定义系统提示词模板：
     ```
     你是一位资深AI科学家助手，擅长帮助研究者进行学术研究。你的任务是根据用户提供的主题，生成高质量的研究内容。请按以下结构输出：
     1. 研究背景与文献综述（引用相关领域重要工作）
     2. 研究问题与核心假设（提出3-5个可验证假设）
     3. 研究方法建议（推荐合适的方法论和技术路线）
     4. 预期贡献与创新点
     5. 参考文献建议（5-10篇相关文献的标题和简要说明）
     要求：使用学术中文，逻辑严谨，每个部分明确标注标题。
     ```
   - 各阶段提示词：PHASE_LITERATURE, PHASE_HYPOTHESIS, PHASE_METHOD, PHASE_CONTRIBUTION
3. 在`src/api/`创建`scientistEngine.ts`：
   - 核心函数`executeResearch(request: ScientistAgentRequest, onPhaseUpdate: (phase: ResearchPhase) => void, onComplete: (result: ResearchResult) => void)`
   - 将研究拆解为4个顺序阶段：文献综述 → 假设生成 → 方法设计 → 贡献总结
   - 每个阶段调用百炼API，使用独立的系统提示词+用户topic
   - 阶段间数据传递：前一阶段的输出summary作为后一阶段的context
   - 流式处理：每个阶段内部使用SSE，实时输出到UI
   - 错误处理：单阶段失败时记录错误，尝试使用简化提示词重试1次，仍失败则标记整体失败
4. 在`src/hooks/`创建`useResearchEngine.ts`：
   - 管理研究执行状态（idle/running/completed/failed）
   - 提供`startResearch`、`cancelResearch`函数
   - 使用useRef管理abortController以支持取消
5. 在`src/pages/`创建`ResearchPage.tsx`（完整版）：
   - 顶部：研究主题输入框 + 领域选择（下拉：计算机科学/生物医学/物理学/经济学/社会科学/其他）
   - 深度选择：快速(1轮) / 标准(4轮) / 深度(4轮+扩展)
   - 开始按钮，点击后进入研究执行视图
   - 研究执行视图：显示4个阶段的进度卡片（pending/running/completed/failed），每个卡片内实时显示流式输出内容
   - 完成后：展示最终报告，支持复制Markdown、导出为文件
6. 创建`src/components/research/`：
   - ResearchInput.tsx：主题输入+配置表单
   - PhaseCard.tsx：阶段进度卡片（含状态图标、进度条、内容区）
   - ResearchReport.tsx：最终报告渲染（Markdown+代码高亮）
   - PhaseTimeline.tsx：垂直时间线展示各阶段
7. 验证：
   - 输入"深度学习在药物发现中的应用"，选择"生物医学"，标准深度
   - 观察4个阶段依次执行，每阶段内容实时显示
   - 总耗时应在2-5分钟（取决于API响应速度）
   - 最终报告包含5个要求的部分，格式正确
【代码规范】：
- 研究阶段状态使用枚举，禁止字符串硬编码
- 系统提示词使用模板字符串，预留变量替换位置
- 流式输出accumulation使用useRef避免重复渲染
- 研究ID使用crypto.randomUUID()生成
- 阶段输出使用Markdown格式，前端用react-markdown渲染
【验收标准】：
1. 输入研究主题后，点击开始，4个阶段按顺序执行，每个阶段状态从pending→running→completed
2. 阶段执行时，内容区域实时显示生成的文本，无明显卡顿
3. 任一阶段失败后，显示错误信息，并提供"重试该阶段"按钮
4. 最终报告包含：研究背景、核心假设、方法建议、预期贡献、参考文献建议
5. 研究过程中可以取消，取消后API请求终止，状态回退到idle
6. 深度为"quick"时只执行1个综合阶段，输出简化版报告
【预期产出文件清单】：
- src/types/research.ts
- src/config/research.ts
- src/api/scientistEngine.ts
- src/hooks/useResearchEngine.ts
- src/pages/ResearchPage.tsx（更新）
- src/components/research/ResearchInput.tsx
- src/components/research/PhaseCard.tsx
- src/components/research/ResearchReport.tsx
- src/components/research/PhaseTimeline.tsx
【风险提醒】：
- qwen-max输出可能 truncation，设置max_tokens=4096或更大，并监控finish_reason
- 多阶段顺序调用累积上下文可能超限（32K），每阶段结束后只传递summary（<500字）而非完整输出
- 流式SSE连接可能中断，需实现自动重连机制（最多重试2次）
- 研究执行过程中页面刷新会丢失状态，后续P2-T3需添加持久化
- 并发研究请求可能导致API速率限制，需限制同时只能运行1个研究任务
```

---

### 详细龙虾提示词：P2-T2 多智能体协作框架

```
【龙虾角色】：coder
【龙虾ID】：P2-T2
【任务名称】：多智能体协作框架（Multi-Agent Collaboration）
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P2-T1已完成）
- 前置已完成：P2-T1（AI Scientist核心引擎）
- 技术约束：每个智能体使用独立的系统提示词和角色定义；智能体间通过结构化消息传递协作；协调器（Orchestrator）负责任务分配和结果整合
【具体指令】：
1. 在`src/types/`创建`agent.ts`：
   - AgentRole: "literature" | "hypothesis" | "methodologist" | "analyst" | "critic" | "writer"
   - AgentConfig: {role: AgentRole; name: string; systemPrompt: string; model: string; temperature: number}
   - AgentMessage: {from: AgentRole; to: AgentRole; type: "task"|"result"|"review"|"question"; content: string; timestamp: number}
   - AgentTask: {id: string; role: AgentRole; input: string; context: AgentMessage[]; status: "pending"|"running"|"completed"|"failed"}
2. 在`src/config/`创建`agents.ts`，定义5个智能体配置：
   - 文献智能体(literature)：擅长文献综述和知识检索，系统提示词强调"搜索和分析相关文献，总结研究现状"
   - 假设智能体(hypothesis)：擅长提出创新假设，系统提示词强调"基于文献综述提出3-5个可验证假设，评估可行性"
   - 方法智能体(methodologist)：擅长实验设计，系统提示词强调"设计严谨的实验方案，选择合适的方法论"
   - 分析智能体(analyst)：擅长数据分析和结果解释，系统提示词强调"分析实验结果，解释统计显著性"
   - 评审智能体(critic)：擅长同行评审，系统提示词强调"批判性评估研究设计的弱点，提出改进建议"
3. 在`src/api/`创建`agentOrchestrator.ts`：
   - 实现`AgentOrchestrator`类：
     - 方法`createCollaboration(topic: string, domain: string): AgentTask[]`：生成任务DAG
     - 方法`executeCollaboration(tasks: AgentTask[], onUpdate: (msg: AgentMessage) => void): Promise<AgentMessage[]>`
   - 协作流程：
     1. 文献智能体先执行，输出文献综述
     2. 假设智能体基于文献综述执行，输出假设
     3. 方法智能体基于假设执行，输出实验方案
     4. 分析智能体基于方案执行（模拟），输出预期结果分析
     5. 评审智能体基于所有前序输出执行，输出评审意见
     6. 协调器整合所有输出为最终报告
   - 并行优化：文献和假设可部分并行（如果独立），但方法依赖假设，分析依赖方法，评审依赖所有
4. 在`src/components/research/`创建：
   - AgentCollaborationView.tsx：多智能体协作可视化界面
   - AgentNode.tsx：单个智能体节点（显示角色名、状态、输出摘要）
   - AgentConnection.tsx：智能体间的数据流连线（SVG或CSS实现）
   - CollaborationTimeline.tsx：展示协作时序
5. 在`ResearchPage.tsx`中添加"多智能体模式"切换开关：
   - 关闭：使用P2-T1的单引擎模式
   - 开启：使用多智能体协作模式，显示协作流程图
6. 在`src/hooks/`创建`useAgentCollaboration.ts`：管理多智能体状态。
7. 验证：
   - 启用多智能体模式，输入研究主题
   - 观察5个智能体节点依次激活，节点间显示数据流
   - 每个智能体完成后，其输出显示在对应节点中
   - 评审智能体完成后，显示最终整合报告
【代码规范】：
- 智能体配置集中管理，禁止在业务逻辑中硬编码prompt
- 智能体间消息传递使用不可变数据结构，避免引用污染
- 协调器使用队列管理任务执行顺序，支持优先级
- 每个智能体调用使用独立的API请求，便于监控和重试
【验收标准】：
1. 多智能体模式下，5个智能体按正确顺序执行（文献→假设→方法→分析→评审）
2. 每个智能体节点显示：角色名、状态徽章、输出内容区（可展开/折叠）
3. 智能体间有视觉连线表示数据依赖关系
4. 任一智能体失败时，显示错误信息，下游智能体暂停等待
5. 评审智能体的输出包含对前序各阶段的批判性评价
6. 最终整合报告包含所有智能体的输出摘要，结构清晰
【预期产出文件清单】：
- src/types/agent.ts
- src/config/agents.ts
- src/api/agentOrchestrator.ts
- src/hooks/useAgentCollaboration.ts
- src/components/research/AgentCollaborationView.tsx
- src/components/research/AgentNode.tsx
- src/components/research/AgentConnection.tsx
- src/components/research/CollaborationTimeline.tsx
- src/pages/ResearchPage.tsx（更新，添加模式切换）
【风险提醒】：
- 多智能体模式调用API次数多（5次+整合），成本高且慢，需提供成本提示
- 智能体间上下文传递可能超限，需对每阶段输出做智能截断（保留核心结论）
- 5个API并发/顺序调用可能触发百炼速率限制，需添加请求间隔（如每轮间隔1秒）
- 可视化连线在响应式布局下可能错位，使用相对定位或SVG计算路径
- 评审智能体可能过于批判导致用户体验差，需在prompt中要求"建设性批评"
```

---

### 详细龙虾提示词：P2-T3 研究流程管理器

```
【龙虾角色】：coder
【龙虾ID】：P2-T3
【任务名称】：研究项目流程管理与持久化
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P2-T1, P2-T2已完成）
- 前置已完成：P2-T1, P2-T2
- 技术约束：使用Zustand管理研究列表状态；持久化优先使用localStorage（演示），后续对接EdgeOne KV；研究状态机需支持创建/运行/暂停/完成/归档
【具体指令】：
1. 在`src/types/`创建`project.ts`：
   - ResearchProject: {id: string; title: string; domain: string; status: "draft"|"running"|"paused"|"completed"|"archived"; mode: "single"|"multi-agent"; createdAt: string; updatedAt: string; phases: ResearchPhase[]; finalReport?: string; tags: string[]}
2. 在`src/store/`创建`projectStore.ts`（Zustand）：
   - state: {projects: ResearchProject[]; currentProjectId: string|null; isLoading: boolean}
   - actions:
     - createProject(title, domain, mode): 创建新项目，状态draft
     - startProject(id): 将项目状态改为running，启动研究引擎
     - pauseProject(id): 暂停运行中的项目（保存当前状态）
     - resumeProject(id): 从暂停状态恢复
     - completeProject(id, report): 标记完成，保存最终报告
     - archiveProject(id): 归档项目
     - deleteProject(id): 删除项目
     - updateProjectTags(id, tags): 更新标签
   - 使用persist中间件将项目列表持久化到localStorage键"academic-web-projects"
3. 在`src/pages/`创建`DashboardPage.tsx`（完整版）：
   - 顶部统计卡片：进行中项目数、已完成项目数、本月新建数
   - 快速开始区域：输入标题+选择领域+点击"开始研究"（直接创建并启动）
   - 项目列表：表格/卡片视图切换，显示标题、状态、领域、更新时间、操作按钮
   - 操作按钮：查看、继续、暂停、归档、删除（需确认）
   - 筛选：按状态/领域/标签筛选，搜索标题
   - 排序：按更新时间/创建时间/标题排序
4. 在`src/pages/`创建`ResearchDetailPage.tsx`（完整版）：
   - 头部：项目标题（可编辑）、状态徽章、标签、操作按钮（暂停/继续/归档）
   - 标签页切换：概览/研究过程/最终报告/设置
   - 概览：项目信息卡片、进度条、预计时间
   - 研究过程：显示各阶段详情（复用PhaseCard和AgentNode）
   - 最终报告：Markdown渲染，支持导出PDF（简单实现：打印样式或marked+html2canvas）
   - 设置：修改标题、领域、标签，删除项目
5. 在`src/components/project/`创建：
   - ProjectCard.tsx：项目卡片（用于网格视图）
   - ProjectTable.tsx：项目表格（用于列表视图）
   - ProjectStatusBadge.tsx：状态徽章（颜色：draft灰/running蓝/paused黄/completed绿/archived灰）
   - ProjectFilterBar.tsx：筛选栏组件
   - CreateProjectDialog.tsx：创建项目弹窗
6. 在`src/api/`创建`projectStorage.ts`：
   - 本地存储接口，后续替换为EdgeOne KV
   - saveProject, loadProjects, deleteProject等
7. 在`src/hooks/`创建`useProjects.ts`：封装projectStore的操作。
8. 验证：
   - 在Dashboard点击"新建项目"，创建项目后出现在列表中
   - 点击"开始研究"，项目状态变为running，跳转到ResearchDetailPage
   - 研究过程中点击"暂停"，状态变为paused，刷新后仍可恢复
   - 研究完成后状态变为completed，最终报告可查看
   - 归档后项目在Dashboard默认筛选中隐藏，可在归档视图中查看
【代码规范】：
- 项目ID使用crypto.randomUUID()
- 时间戳使用ISO 8601格式，显示时使用date-fns格式化
- 状态转换必须符合状态机：draft→running→paused|running→completed，禁止跳变
- 删除操作必须二次确认，防止误删
- 项目列表使用虚拟滚动（如项目数>50，使用react-window）
【验收标准】：
1. Dashboard可创建项目，创建后立即出现在列表顶部
2. 项目状态变更实时反映在UI上（badge颜色变化）
3. 研究过程中刷新页面，项目状态和研究进度从localStorage恢复
4. 暂停后可恢复，恢复时继续上次未完成的阶段
5. 归档项目不在默认视图显示，切换"显示归档"后可查看
6. 删除项目需弹出确认对话框，确认后项目从列表和localStorage移除
7. 项目标签支持增删改，标签在卡片上以色块展示
【预期产出文件清单】：
- src/types/project.ts
- src/store/projectStore.ts
- src/pages/DashboardPage.tsx（完整版）
- src/pages/ResearchDetailPage.tsx（完整版）
- src/components/project/ProjectCard.tsx
- src/components/project/ProjectTable.tsx
- src/components/project/ProjectStatusBadge.tsx
- src/components/project/ProjectFilterBar.tsx
- src/components/project/CreateProjectDialog.tsx
- src/api/projectStorage.ts
- src/hooks/useProjects.ts
【风险提醒】：
- localStorage有5MB限制，大量研究项目或大报告可能超限，需做大小检查并提示用户归档旧项目
- 状态恢复时，如果研究引擎正在运行SSE，无法真正恢复流式连接，只能从已完成阶段恢复
- 并发操作（快速点击暂停/继续）可能导致状态混乱，使用乐观更新+实际确认模式
- 日期格式化注意时区，使用date-fns的UTC或本地时间明确处理
- 项目数据结构设计要考虑后续EdgeOne KV迁移，键名和结构保持兼容
```

---

### 详细龙虾提示词：P2-T4 论文生成与编辑模块

```
【龙虾角色】：coder
【龙虾ID】：P2-T4
【任务名称】：学术论文生成与交互式编辑器
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P2-T1, P2-T3已完成）
- 前置已完成：P2-T1（核心引擎）, P2-T3（流程管理）
- 技术约束：论文格式遵循学术规范（IMRaD结构：Introduction, Methods, Results, and Discussion）；支持Markdown编辑和实时预览；数学公式使用KaTeX渲染；代码块使用语法高亮
【具体指令】：
1. 在`src/types/`创建`paper.ts`：
   - PaperSection: {id: string; type: "abstract"|"introduction"|"methods"|"results"|"discussion"|"conclusion"|"references"; title: string; content: string; status: "empty"|"draft"|"reviewed"|"final"; wordCount: number}
   - Paper: {id: string; projectId: string; title: string; sections: PaperSection[]; authors: string[]; keywords: string[]; createdAt: string; updatedAt: string; status: "draft"|"submitted"|"published"}
2. 在`src/config/`创建`paper.ts`：
   - 论文章节模板定义：
     - abstract: "摘要：用200-300字概括研究背景、方法、结果和结论"
     - introduction: "引言：介绍研究背景、问题陈述、研究目标和论文结构"
     - methods: "方法：详细描述实验设计、数据收集、分析方法"
     - results: "结果：客观呈现实验结果，使用图表和统计数据"
     - discussion: "讨论：解释结果意义、与已有研究对比、局限性分析"
     - conclusion: "结论：总结主要发现、理论贡献、未来研究方向"
   - 每个章节的生成提示词模板（基于项目研究结果）
3. 在`src/api/`创建`paperGenerator.ts`：
   - `generatePaper(project: ResearchProject): Promise<Paper>`：根据项目研究结果生成完整论文结构
   - `generateSection(project: ResearchProject, sectionType: PaperSection["type"]): Promise<string>`：生成单个章节
   - 生成策略：
     - 使用研究结果(finalReport)作为上下文
     - 每个章节独立调用API（避免超长上下文）
     - abstract最后生成（基于全文）
   - 支持流式生成，实时显示到编辑器
4. 在`src/components/paper/`创建：
   - PaperEditor.tsx：主编辑器，左右分栏（左侧章节列表，右侧编辑区）
   - SectionEditor.tsx：单个章节编辑器，支持Markdown文本编辑
   - PaperPreview.tsx：实时预览面板，使用react-markdown+KaTeX渲染
   - SectionNavigator.tsx：章节导航，显示各章节状态和字数统计
   - PaperToolbar.tsx：工具栏（保存、导出、AI续写、格式化）
   - PaperExportDialog.tsx：导出选项（Markdown/PDF/Word），使用print CSS或简单库生成
5. 在`src/pages/`创建`PaperEditorPage.tsx`：
   - 从项目研究结果生成论文按钮
   - 论文编辑器主界面
   - 顶部显示论文标题（可编辑）、作者、关键词
6. 安装依赖：`npm install react-markdown remark-gfm rehype-highlight rehype-katex remark-math katex`
7. 在`src/styles/`创建`katex.css`：导入KaTeX基础样式。
8. 验证：
   - 从已完成项目点击"生成论文"，生成6个章节
   - 在编辑器中修改某章节内容，预览面板实时更新
   - 输入数学公式如`$E=mc^2$`，预览正确渲染
   - 点击导出，生成包含样式的HTML文件可下载
【代码规范】：
- 论文章节使用UUID标识，顺序由数组索引控制
- Markdown编辑器使用textarea（基础版）或后续接入Monaco/codemirror
- KaTeX公式使用`$...$`（行内）和`$$...$$`（块级）语法
- 代码块使用```language标注，支持主流编程语言高亮
- 论文字数统计使用中文/英文混合算法（中文每个字符算1字，英文每词算1字）
【验收标准】：
1. 从已完成项目生成论文，自动生成6个章节（abstract, introduction, methods, results, discussion, conclusion）
2. 每个章节生成后显示字数统计，总字数显示在顶部
3. 编辑器中修改内容后，预览面板在500ms防抖后更新
4. 数学公式正确渲染，如`$\sigma = \sqrt{\frac{1}{N}\sum_{i=1}^N (x_i - \mu)^2}$`
5. 代码块显示语法高亮和复制按钮
6. 导出功能生成包含完整样式的HTML文件，打开后格式与预览一致
7. 论文章节可拖拽排序（如实现DnD）或至少支持上下移动
【预期产出文件清单】：
- src/types/paper.ts
- src/config/paper.ts
- src/api/paperGenerator.ts
- src/pages/PaperEditorPage.tsx
- src/components/paper/PaperEditor.tsx
- src/components/paper/SectionEditor.tsx
- src/components/paper/PaperPreview.tsx
- src/components/paper/SectionNavigator.tsx
- src/components/paper/PaperToolbar.tsx
- src/components/paper/PaperExportDialog.tsx
- src/styles/katex.css
【风险提醒】：
- 论文生成调用API 6次以上，成本高，需添加确认对话框和成本估算
- 长文本编辑可能导致React渲染性能问题，使用useMemo和虚拟化
- KaTeX不支持所有LaTeX语法，复杂公式可能渲染失败，需有降级显示
- 导出PDF功能在纯前端实现较复杂，可先用"打印到PDF"或借助html2canvas+jsPDF
- 中文Markdown渲染可能有排版问题，测试时检查标题层级、列表缩进、代码块
```

---

### 详细龙虾提示词：P2-T5 实验设计与代码生成

```
【龙虾角色】：coder
【龙虾ID】：P2-T5
【任务名称】：实验设计方案生成与Python代码自动生成
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P2-T2已完成）
- 前置已完成：P2-T2（多智能体协作）
- 技术约束：代码生成使用qwen-coder或qwen-max（代码能力较强）；代码必须可执行、有注释；使用Python 3.10+语法；常见库：numpy, pandas, matplotlib, scikit-learn, pytorch（可选）
【具体指令】：
1. 在`src/types/`创建`experiment.ts`：
   - ExperimentDesign: {id: string; projectId: string; title: string; objective: string; variables: {independent: string[]; dependent: string[]; controlled: string[]}; methodology: string; sampleSize: number; duration: string; expectedOutcomes: string[]; codeSnippets: CodeSnippet[]}
   - CodeSnippet: {id: string; language: string; filename: string; code: string; description: string; dependencies: string[]}
2. 在`src/config/`创建`experiment.ts`：
   - 实验设计生成提示词模板：
     ```
     你是一位实验设计专家。基于以下研究假设，设计一个完整的实验方案：
     假设：{hypothesis}
     领域：{domain}
     要求：
     1. 明确实验目的和研究问题
     2. 定义自变量、因变量和控制变量
     3. 描述实验设计类型（如RCT、准实验、观察性研究）
     4. 说明样本量和抽样方法
     5. 描述数据收集和分析计划
     6. 生成完整的Python代码实现数据分析和可视化
     代码要求：使用Python 3.10，包含必要import，函数化组织，有详细注释，可直接运行。
     ```
3. 在`src/api/`创建`experimentDesigner.ts`：
   - `designExperiment(projectId: string, hypothesis: string, domain: string): Promise<ExperimentDesign>`
   - 调用百炼API生成实验设计方案（非流式，JSON格式输出）
   - 解析API返回的Markdown中的代码块（```python ... ```），提取为CodeSnippet
   - 生成依赖列表：从import语句提取第三方库名称
4. 在`src/components/experiment/`创建：
   - ExperimentDesigner.tsx：实验设计输入界面（选择假设→生成方案）
   - ExperimentCard.tsx：实验方案卡片（显示变量、方法、样本量等）
   - CodeBlock.tsx：代码展示组件（语法高亮、复制按钮、运行说明）
   - CodeRunner.tsx：代码运行说明（由于无法在前端运行Python，显示依赖安装命令和运行步骤）
   - ExperimentExport.tsx：导出实验方案（Markdown或Jupyter Notebook格式）
5. 在`src/pages/`创建`ExperimentPage.tsx`（或集成到ResearchDetailPage的新标签页）：
   - 选择项目中的假设
   - 点击"设计实验"，显示生成的实验方案
   - 展示代码片段，支持一键复制和下载为.py文件
   - 显示依赖安装命令：`pip install numpy pandas matplotlib scikit-learn`
6. 在`src/lib/`创建`codeParser.ts`：
   - 从Markdown文本提取代码块
   - 解析Python import语句生成依赖列表
   - 格式化代码（简单缩进修复）
7. 验证：
   - 选择一个研究假设，如"深度学习模型A在数据集B上的准确率显著高于模型C"
   - 生成实验方案，检查是否包含：变量定义、实验设计类型、样本量、Python代码
   - 复制Python代码到本地环境，检查是否可以运行（语法正确）
【代码规范】：
- Python代码提取必须准确，避免截断或多余Markdown标记
- 代码组件使用PrismJS或react-syntax-highlighter，主题与页面主题一致
- 代码复制使用Clipboard API，失败时降级为execCommand
- 导出的.py文件必须UTF-8编码，包含文件头注释
- 代码片段支持多语言标签（Python/R/Matlab），默认Python
【验收标准】：
1. 选择假设后，1-2分钟内生成完整实验方案（含变量定义、方法描述、Python代码）
2. 代码块正确提取，显示语法高亮，无Markdown残留标记
3. 代码复制按钮点击后，剪贴板包含纯代码文本
4. 代码可下载为.py文件，文件名格式：experiment_{projectId}_{timestamp}.py
5. 依赖列表从import语句准确提取，显示安装命令
6. 实验方案支持导出为Jupyter Notebook格式（.ipynb，含Markdown说明和代码cell）
7. 代码运行说明包含：环境要求、安装步骤、运行命令、预期输出
【预期产出文件清单】：
- src/types/experiment.ts
- src/config/experiment.ts
- src/api/experimentDesigner.ts
- src/pages/ExperimentPage.tsx（或ResearchDetailPage标签页）
- src/components/experiment/ExperimentDesigner.tsx
- src/components/experiment/ExperimentCard.tsx
- src/components/experiment/CodeBlock.tsx
- src/components/experiment/CodeRunner.tsx
- src/components/experiment/ExperimentExport.tsx
- src/lib/codeParser.ts
【风险提醒】：
- 模型生成的代码可能有语法错误或不完整，需在prompt中明确要求"确保代码完整可运行"
- 复杂实验（如需GPU）的代码可能依赖PyTorch，安装复杂，需标注环境要求
- 代码块提取正则表达式可能匹配错误，测试多种Markdown格式（带/不带语言标记）
- Jupyter Notebook导出需构造JSON格式，确保可被Jupyter正确打开
- 代码安全：用户运行AI生成的代码有潜在风险，需添加免责声明
```

---

### 详细龙虾提示词：P2-T6 知识库与文献管理

```
【龙虾角色】：coder
【龙虾ID】：P2-T6
【任务名称】：文献知识库管理与引用系统
【上下文】：
- 当前仓库路径：/path/to/Academic-Web（P1-T5已完成）
- 前置已完成：P1-T5（EdgeOne Functions中间件）
- 技术约束：文献数据存储在EdgeOne KV（生产）或localStorage（演示）；支持手动添加和URL导入；引用格式支持GB/T 7714和APA；元数据提取使用百炼API或简单解析
【具体指令】：
1. 在`src/types/`创建`library.ts`：
   - Paper: {id: string; title: string; authors: string[]; year: number; journal?: string; doi?: string; url?: string; abstract?: string; keywords: string[]; tags: string[]; addedAt: string; projectIds: string[]; citationCount?: number}
   - CitationStyle: "gb7714" | "apa" | "mla" | "bibtex"
   - LibraryFilter: {search: string; years: [number, number]; tags: string[]; projects: string[]}
2. 在`src/store/`创建`libraryStore.ts`（Zustand）：
   - state: {papers: Paper[]; filter: LibraryFilter; isLoading: boolean; selectedIds: string[]}
   - actions: addPaper, updatePaper, deletePaper, importFromUrl, exportCitations, setFilter, toggleSelection, batchTag, batchDelete
   - persist到localStorage（演示），后续对接KV
3. 在`src/api/`创建`libraryClient.ts`：
   - `addPaper(paper: Omit<Paper, "id">): Promise<Paper>`
   - `importFromUrl(url: string): Promise<Paper>`：使用百炼API解析URL内容，提取标题、作者、摘要、DOI等元数据
     - 调用百炼：发送prompt"请从以下URL或文本中提取学术论文的元数据：标题、作者、年份、期刊、DOI、摘要、关键词。以JSON格式返回。"
     - 解析返回的JSON填充Paper字段
   - `generateCitation(paper: Paper, style: CitationStyle): string`：根据格式生成引用文本
     - gb7714: "[1] 作者. 标题[J]. 期刊, 年份, 卷(期): 页码."
     - apa: "作者. (年份). 标题. 期刊."
     - bibtex: 标准BibTeX条目格式
4. 在`src/pages/`创建`LibraryPage.tsx`（完整版）：
   - 顶部操作栏：添加文献按钮（手动/从URL导入）、批量操作（导出引用、打标签、删除）
   - 筛选栏：搜索框、年份范围、标签筛选、项目关联筛选
   - 文献列表：卡片/表格视图，每篇文献显示标题、作者、年份、标签、操作
   - 文献详情弹窗：展示完整元数据、摘要、引用格式切换、关联项目
   - 批量导入：支持粘贴多个DOI或URL，批量解析
5. 在`src/components/library/`创建：
   - PaperCard.tsx：文献卡片
   - PaperTable.tsx：文献表格
   - PaperDetailModal.tsx：文献详情弹窗
   - AddPaperDialog.tsx：添加文献表单（手动输入）
   - ImportFromUrlDialog.tsx：URL导入弹窗，显示解析进度
   - CitationPreview.tsx：引用预览（支持切换格式）
   - TagManager.tsx：标签管理（添加/删除/重命名标签）
   - LibraryFilterBar.tsx：筛选栏
6. 在`src/lib/`创建`citationFormatter.ts`：
   - 实现GB/T 7714、APA、BibTeX格式生成函数
   - 中文作者名处理（姓在前，名缩写在后）
   - 年份、期刊名格式化
7. 在EdgeOne Functions创建`functions/api/library/import.js`：
   - 接收URL，使用fetch获取页面内容（可能需处理CORS）
   - 将内容转发给百炼API解析元数据
   - 返回结构化Paper数据
8. 验证：
   - 手动添加一篇文献，填写标题、作者、年份，成功显示在列表中
   - 输入arXiv URL或DOI，点击导入，解析出元数据并显示
   - 选择一篇文献，切换引用格式，显示正确
   - 批量选择2篇文献，导出GB/T 7714格式引用
【代码规范】：
- 文献ID使用crypto.randomUUID()或DOI的hash
- 年份范围筛选使用滑动条或数字输入框
- 标签使用彩色Badge，支持自动补全已有标签
- 引用格式严格遵循学术规范，作者名处理支持中英文混排
- 元数据解析失败时，允许用户手动编辑补充
【验收标准】：
1. 手动添加文献后，列表立即显示，搜索可找到该文献
2. URL导入功能：输入https://arxiv.org/abs/xxxx，10秒内解析出标题、作者、年份、摘要
3. 引用格式切换：同一篇文献在GB/T 7714、APA、BibTeX间切换，格式正确
4. 中文文献GB/T 7714格式："[1] 张三, 李四. 论文标题[J]. 期刊名, 2024, 15(3): 100-110."
5. 英文文献APA格式："Zhang, S., & Li, S. (2024). Paper title. Journal Name."
6. 批量导出：选择多篇文献，生成编号引用列表，可复制或下载.txt
7. 标签管理：添加自定义标签，文献可打多个标签，按标签筛选准确
8. 文献关联项目：可将文献关联到具体研究项目，在项目详情页查看相关文献
【预期产出文件清单】：
- src/types/library.ts
- src/store/libraryStore.ts
- src/api/libraryClient.ts
- src/pages/LibraryPage.tsx（完整版）
- src/components/library/PaperCard.tsx
- src/components/library/PaperTable.tsx
- src/components/library/PaperDetailModal.tsx
- src/components/library/AddPaperDialog.tsx
- src/components/library/ImportFromUrlDialog.tsx
- src/components/library/CitationPreview.tsx
- src/components/library/TagManager.tsx
- src/components/library/LibraryFilterBar.tsx
- src/lib/citationFormatter.ts
- functions/api/library/import.js
- functions/api/library/batch.js
【风险提醒】：
- URL导入受CORS限制，某些站点（如PubMed）可能无法直接fetch，需后端代理或降级为手动输入
- 百炼API解析元数据可能不准确，特别是中文文献，需允许用户手动修正
- 大量文献（>1000）时localStorage超限，需实现分页加载和归档策略
- 引用格式规范复杂，GB/T 7714对不同类型文献（J/M/C/D）格式不同，初期可只支持期刊论文（J）
- 批量导入多个URL时，需串行处理避免API速率限制，显示进度条
```

---

### Phase 2 阶段预期效果

完成Phase 2后，你应该看到：
1. 在Dashboard创建研究项目，输入"强化学习在机器人控制中的应用"，选择多智能体模式，5个智能体（文献员、假设员、方法员、分析员、评审员）依次协作，最终生成整合报告
2. 研究过程中可以暂停、刷新页面后恢复，项目状态正确持久化
3. 研究完成后点击"生成论文"，进入论文编辑器，看到6个章节（摘要、引言、方法、结果、讨论、结论），可编辑和预览
4. 在论文编辑器中输入数学公式，实时渲染为精美排版；代码块带语法高亮和复制按钮
5. 选择研究假设，生成实验设计方案，包含变量定义和Python代码，代码可复制下载
6. 在文献库页面添加文献（手动或URL导入），自动生成引用格式，支持批量导出
7. 整个系统数据（项目、论文、文献）在localStorage中持久化，刷新不丢失

---

### Phase 2 阶段联调验证

验证步骤：
1. **研究流程验证**：
   - [ ] 创建项目 → 启动研究 → 观察单引擎模式4个阶段完成
   - [ ] 切换多智能体模式 → 5个智能体协作完成，可视化流程正确
   - [ ] 研究过程中暂停 → 刷新 → 恢复 → 继续完成
   - [ ] 研究完成后Dashboard状态变为completed
2. **论文生成验证**：
   - [ ] 从completed项目点击"生成论文"，生成6个章节
   - [ ] 编辑章节内容，预览实时同步，数学公式渲染正确
   - [ ] 导出论文为HTML文件，下载后格式与预览一致
3. **实验设计验证**：
   - [ ] 选择假设 → 生成实验方案 → 包含Python代码
   - [ ] 复制代码到本地Python环境，语法正确可运行（至少无语法错误）
4. **文献库验证**：
   - [ ] 手动添加3篇文献，搜索和筛选正常
   - [ ] URL导入1篇arXiv论文，元数据解析正确
   - [ ] 切换引用格式，GB/T 7714和APA格式正确
   - [ ] 批量导出2篇文献引用为.txt文件
5. **端到端验证**：
   - [ ] 从创建项目 → 完成研究 → 生成论文 → 设计实验 → 管理文献，全流程无阻塞
   - [ ] 移动端访问各页面，布局正常可用
6. **性能验证**：
   - [ ] 页面首屏加载<2秒（Lighthouse）
   - [ ] 大量Markdown渲染不卡顿（react-markdown优化）
7. **文档更新**：更新README.md，添加Phase 2功能说明、截图、使用指南

---

## 附录

### A. 百炼API调用参考格式

```typescript
// 非流式调用
const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "qwen-max",
    messages: [
      {role: "system", content: "你是一位AI科学家助手。"},
      {role: "user", content: "请分析深度学习在药物发现中的应用。"}
    ],
    temperature: 0.7,
    max_tokens: 4096
  })
});

// 流式调用（SSE）
const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "qwen-max",
    messages: [...],
    stream: true
  })
});
const reader = response.body?.getReader();
// 解析SSE：按行读取，data: 前缀，JSON.parse，提取choices[0].delta.content
```

### B. EdgeOne Functions目录结构参考

```
functions/
├── _middleware.js          # 全局中间件（CORS、错误处理）
├── api/
│   ├── health.js
│   ├── chat.js             # 百炼代理
│   ├── auth/
│   │   ├── login.js
│   │   └── register.js
│   └── library/
│       ├── import.js
│       └── batch.js
└── utils/
    ├── jwt.js
    └── kv.js
```

### C. 环境变量清单

| 变量名 | 说明 | 位置 |
|-------|------|------|
| VITE_BAILIAN_API_KEY | 百炼API Key（前端开发用） | .env |
| BAILIAN_API_KEY | 百炼API Key（EdgeOne Functions用） | EdgeOne控制台 |
| JWT_SECRET | JWT签名密钥 | EdgeOne控制台 |
| KV_NAMESPACE | KV Storage命名空间ID | EdgeOne控制台 |

### D. 模型选择指南

| 场景 | 推荐模型 | 说明 |
|------|---------|------|
| 通用对话/研究综述 | qwen-max | 综合能力最强，适合复杂推理 |
| 快速响应/成本低 | qwen-turbo | 速度快，适合简单任务 |
| 深度推理/数学证明 | qwq-32b | 推理模型，输出含`<think>`标签 |
| 代码生成 | qwen-coder | 编程专项优化 |

---

> 本文档由AI系统架构师编写，用于"挑战杯揭榜挂帅XH-202619"项目。  
> 每个龙虾提示词可直接复制粘贴给AI Agent执行。  
> 执行过程中如遇技术细节变化，以阿里云百炼和EdgeOne官方最新文档为准。
