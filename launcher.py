# -*- coding: utf-8 -*-
"""
Academic Joan of Arc — 一键本地启动器
====================================
将「真实前后端」一体化内嵌启动：后端 FastAPI 同源托管 React 构建产物，
单端口 (:8000) 即可可视化操作全流程，无需分别手动启动前后端。

功能（v3.1 · 六环节流水线版）：
  1. 自动定位项目根目录与 Python 解释器（优先项目 .venv，其次系统 Python）
  2. 后端依赖预检（缺失时给出精确安装命令，不盲目启动）
  3. 检查前端构建产物 frontend/dist（缺失则自动 npm run build）
  4. 检测 :8000 是否已有健康服务（有则直接复用并打开浏览器）
  5. 启动后端 uvicorn（内嵌前端），轮询 /health 直至就绪
  6. 打印六环节流水线就绪状态（125题题库 / schema_v2）
  7. 自动打开浏览器 http://localhost:8000
  8. 控制台保留日志；关闭窗口即停止服务

双击 start.bat 或桌面快捷方式「AI科研平台」即可运行。
"""
import os
import sys
import time
import json
import socket
import subprocess
import webbrowser
import urllib.request
import urllib.error

# ─── 基本配置 ───
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_APP = os.path.join(PROJECT_ROOT, "backend", "app")
FRONTEND = os.path.join(PROJECT_ROOT, "frontend")
DIST = os.path.join(FRONTEND, "dist")
INDEX_HTML = os.path.join(DIST, "index.html")
HOST = "127.0.0.1"
PORT = 8000
URL = f"http://localhost:{PORT}"
HEALTH_URL = f"http://{HOST}:{PORT}/health"

# 后端最小依赖（预检用）
REQUIRED_MODULES = ["fastapi", "uvicorn", "jose", "loguru", "aiohttp", "dotenv", "httpx", "jinja2"]


def log(msg):
    print(msg, flush=True)


def port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((HOST, port)) == 0


def health_ok():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def fetch_health():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=5) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def find_python():
    """按优先级探测可用解释器：项目 .venv > 当前解释器。返回 (python路径, 依赖是否齐全)。"""
    candidates = []
    if os.name == "nt":
        venv_py = os.path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe")
    else:
        venv_py = os.path.join(PROJECT_ROOT, ".venv", "bin", "python")
    if os.path.isfile(venv_py):
        candidates.append(venv_py)
    if sys.executable:
        candidates.append(sys.executable)
    if not candidates:
        candidates.append("python")

    check_code = "import " + ", ".join(REQUIRED_MODULES)
    for py in candidates:
        try:
            r = subprocess.run([py, "-c", check_code],
                               capture_output=True, timeout=60)
            if r.returncode == 0:
                return py, True
        except Exception:
            continue
    return candidates[0], False


def ensure_dist():
    """确保前端已构建；缺失则自动构建。"""
    if os.path.isfile(INDEX_HTML):
        log("[√] 前端构建产物已就绪: frontend/dist")
        return True
    log("[!] 未检测到 frontend/dist，开始自动构建前端 ...")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    try:
        if not os.path.isdir(os.path.join(FRONTEND, "node_modules")):
            log("    → npm install（首次可能较慢）")
            subprocess.run([npm, "install"], cwd=FRONTEND, check=True)
        log("    → npm run build")
        subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True)
        return os.path.isfile(INDEX_HTML)
    except Exception as e:
        log(f"[×] 前端构建失败: {e}")
        log("    请手动执行: cd frontend && npm install && npm run build")
        return False


def start_backend(python_exe):
    """启动后端 uvicorn（内嵌托管前端）。"""
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    cmd = [python_exe, "-m", "uvicorn", "main:app",
           "--host", HOST, "--port", str(PORT), "--log-level", "info"]
    log(f"[→] 启动后端: {' '.join(cmd)}")
    log(f"    工作目录: {BACKEND_APP}")
    return subprocess.Popen(cmd, cwd=BACKEND_APP, env=env)


def wait_ready(timeout=90):
    """轮询健康检查直至就绪。"""
    log("[…] 等待服务就绪（健康探针 /health）...")
    start = time.time()
    while time.time() - start < timeout:
        if health_ok():
            return True
        time.sleep(1.0)
    return False


def main():
    log("=" * 60)
    log("  Academic Joan of Arc · 一键本地启动器  v3.2")
    log("  六环节自迭代流水线 · 赛道一方向1A · 千问 Qwen 双引擎")
    log("=" * 60)
    log(f"项目根目录: {PROJECT_ROOT}")

    # 0. 已在运行则直接复用
    if port_in_use(PORT) and health_ok():
        log(f"[√] 检测到 :{PORT} 已有健康服务，直接复用。")
        webbrowser.open(URL)
        log(f"[√] 已在浏览器打开 {URL}")
        log("    （如需重启，请先关闭原服务窗口或结束占用进程）")
        return 0

    if port_in_use(PORT):
        log(f"[!] 端口 {PORT} 被占用但健康检查未通过，可能有残留进程。")
        log("    请关闭占用该端口的程序后重试。")
        return 1

    # 1. 定位 Python 与依赖预检
    python_exe, deps_ok = find_python()
    log(f"Python:     {python_exe}")
    if not deps_ok:
        log("[×] 后端依赖不完整（缺 fastapi/uvicorn/jose/loguru 等）。")
        log("    请先安装（在项目根目录执行）：")
        log(f"      \"{python_exe}\" -m pip install -r backend/requirements.txt")
        log("    或创建项目虚拟环境后再启动：")
        log(f"      \"{sys.executable or 'python'}\" -m venv .venv")
        log(f"      \".venv\\Scripts\\python.exe\" -m pip install -r backend/requirements.txt")
        return 1

    # 2. 确保前端已构建（内嵌所需）
    if not ensure_dist():
        log("[!] 前端产物缺失，仍尝试启动后端（仅 API 可用）。")

    # 3. 启动后端
    proc = start_backend(python_exe)

    # 4. 等待就绪
    if wait_ready():
        log("[√] 服务已就绪！")
        # 六环节流水线就绪状态
        h = fetch_health()
        if h:
            pl = h.get("pipeline") or {}
            provider = h.get("provider", "?")
            llm_status = (h.get("llm") or {}).get("status", "?")
            log(f"    推理引擎: {provider} ({llm_status})")
            if pl.get("ready"):
                log(f"    六环节流水线: 就绪（125题题库 {pl.get('questions_bank', 0)} 题 · 8张新表已迁移）")
            else:
                log("    六环节流水线: 未就绪（查看后端日志中的迁移警告）")
        webbrowser.open(URL)
        log(f"[√] 已在浏览器打开 {URL}")
        log("-" * 60)
        log("  演示账号：admin / admin123  （或 researcher / researcher123）")
        log("  新功能：侧边栏「六环节流水线」→ 新问题实验室 / 125题总控台 / 迭代工作台 / 评测中心")
        log("  停止服务：关闭本窗口，或按 Ctrl+C")
        log("-" * 60)
    else:
        log("[×] 服务在超时时间内未就绪，请查看上方后端日志排查。")
        log("    常见原因：依赖未安装、.env 未配置百炼凭证、端口冲突。")

    # 5. 保持前台，随窗口关闭而终止后端
    try:
        proc.wait()
    except KeyboardInterrupt:
        log("\n[→] 收到停止信号，正在关闭后端 ...")
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        log("[√] 已停止。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
