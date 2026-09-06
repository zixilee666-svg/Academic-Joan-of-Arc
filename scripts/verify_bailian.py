"""
verify_bailian.py — 阿里云百炼(DashScope) 引擎真实调用验证 + 比赛凭证证据生成
====================================================================================
用途：
  1. 加载 .env 中的 DASHSCOPE_API_KEY 与 LLM_PROVIDER=bailian
  2. 复用生产代码 backend/app/bailian_engine.py · BailianEngine 执行真实调用
  3. health_check + 对话 + 假设生成（千问 reasoning 链路）
  4. 将「调用凭证」固化为 交付证据/百炼调用凭证.html 与 .json，供比赛提交截图

运行：
  cd backend/app && python scripts/verify_bailian.py
（脚本会自动将 backend/app 加入 sys.path，因此可从任意目录运行）
"""

import os
import sys
import json
import asyncio
import datetime
from pathlib import Path

# ── 载入项目根目录的 .env ──
ROOT = Path(__file__).resolve().parent.parent  # .../揭榜
sys.path.insert(0, str(ROOT / "backend" / "app"))

_env_path = ROOT / ".env"
if _env_path.exists():
    for line in _env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

import aiohttp
from bailian_engine import BailianEngine

EVIDENCE_DIR = ROOT / "交付证据"
EVIDENCE_DIR.mkdir(exist_ok=True)


def mask_key(key: str) -> str:
    if not key:
        return "(未配置)"
    if len(key) <= 10:
        return "*" * len(key)
    return key[:8] + "*" * (len(key) - 12) + key[-4:]


async def main():
    ts = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    timestamp = ts.strftime("%Y-%m-%d %H:%M:%S (UTC+8)")

    engine = BailianEngine()  # 自动读取 DASHSCOPE_API_KEY
    evidence = {
        "title": "阿里云百炼(DashScope) · 千问(Qwen) 调用凭证",
        "generated_at": timestamp,
        "platform": "aliyun-bailian (DashScope OpenAI-compatible)",
        "endpoint": f"{engine.base_url}/chat/completions",
        "api_key_masked": mask_key(engine.api_key or ""),
        "model_map": engine.model_map,
        "calls": [],
        "health": None,
        "ok": False,
    }

    print("=" * 64)
    print("百炼引擎真实调用验证")
    print(f"  时间      : {timestamp}")
    print(f"  端点      : {evidence['endpoint']}")
    print(f"  Key(掩码) : {evidence['api_key_masked']}")
    print(f"  模型映射  : {evidence['model_map']}")
    print("=" * 64)

    # ── 1) 健康检查 ──
    print("\n[1/3] health_check ...")
    health = await engine.health_check()
    evidence["health"] = health
    print("  ->", json.dumps(health, ensure_ascii=False))

    # ── 2) 真实对话（通用模型 qwen-plus）──
    print("\n[2/3] 真实对话（qwen-plus）...")
    try:
        resp = await engine.chat(
            model="general",
            messages=[{"role": "user", "content": "请用一句话说明你是谁，并证明你运行在阿里云百炼平台的千问模型上。"}],
            max_tokens=120,
            temperature=0.3,
        )
        call = {
            "name": "对话 / chat",
            "capability": "general",
            "model": resp.model,
            "http_status": 200,
            "finish_reason": resp.finish_reason,
            "usage": {
                "prompt_tokens": resp.prompt_tokens,
                "completion_tokens": resp.completion_tokens,
                "total_tokens": resp.total_tokens,
            },
            "content_excerpt": resp.content.strip()[:400],
        }
        evidence["calls"].append(call)
        print(f"  -> [{resp.model}] {resp.content.strip()[:160]!r}")
        print(f"  usage: {call['usage']}")
    except Exception as e:
        evidence["calls"].append({"name": "对话 / chat", "error": str(e)})
        print("  !! 调用失败:", e)

    # ── 3) 假设生成（推理模型 qwen-max，对应应用内假设生成链路）──
    print("\n[3/3] 假设生成（qwen-max / reasoning）...")
    try:
        hyp = await engine.generate_hypothesis(
            question="系外行星大气中的氧-甲烷非平衡共存能否作为生物标志？",
            literature_summary="现有研究多关注单一气体的生物标志意义，缺乏多气体联合非平衡态的统计建模。",
            knowledge_gaps=["缺乏多气体联合的光化学非平衡判据", "缺乏观测噪声下的稳健性分析"],
            model="reasoning",
        )
        call = {
            "name": "假设生成 / generate_hypothesis",
            "capability": "reasoning",
            "model": hyp.model,
            "http_status": 200,
            "finish_reason": hyp.finish_reason,
            "usage": {
                "prompt_tokens": hyp.prompt_tokens,
                "completion_tokens": hyp.completion_tokens,
                "total_tokens": hyp.total_tokens,
            },
            "content_excerpt": hyp.content.strip()[:600],
        }
        evidence["calls"].append(call)
        print(f"  -> [{hyp.model}] 假设生成成功，长度 {len(hyp.content)} 字符")
        print(f"  usage: {call['usage']}")
    except Exception as e:
        evidence["calls"].append({"name": "假设生成 / generate_hypothesis", "error": str(e)})
        print("  !! 调用失败:", e)

    await engine.close()

    # ── 判定成功：health 健康 且 至少一次成功调用 ──
    ok = (evidence["health"].get("status") == "healthy") and any(
        "error" not in c for c in evidence["calls"]
    )
    evidence["ok"] = ok
    evidence["verdict"] = "PASS — 引擎可经百炼平台真实调用千问" if ok else "FAIL — 见上方错误"

    # ── 写出 JSON ──
    json_path = EVIDENCE_DIR / "百炼调用凭证.json"
    json_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")

    # ── 写出 HTML（比赛截图/凭证）──
    html = build_html(evidence)
    html_path = EVIDENCE_DIR / "百炼调用凭证.html"
    html_path.write_text(html, encoding="utf-8")

    print("\n" + "=" * 64)
    print(f"结论: {evidence['verdict']}")
    print(f"证据: {html_path}")
    print(f"      {json_path}")
    print("=" * 64)
    return evidence


def build_html(e: dict) -> str:
    call_rows = []
    for c in e["calls"]:
        if "error" in c:
            call_rows.append(
                f"<tr><td>{c['name']}</td><td colspan='3' style='color:#c0392b'>调用失败: {c['error']}</td></tr>"
            )
            continue
        u = c.get("usage", {})
        call_rows.append(
            f"<tr>"
            f"<td>{c['name']}<br><span class='m'>{c['capability']}→{c['model']}</span></td>"
            f"<td>{c['http_status']} / {c['finish_reason']}</td>"
            f"<td>{u.get('total_tokens', 0)} tokens<br>"
            f"<span class='m'>prompt {u.get('prompt_tokens',0)} / completion {u.get('completion_tokens',0)}</span></td>"
            f"<td style='text-align:left'>{c['content_excerpt'].replace(chr(10), '<br>')}</td>"
            f"</tr>"
        )
    call_html = "\n".join(call_rows)

    health = e["health"] or {}
    h_status = health.get("status", "unknown")
    h_color = "#27ae60" if h_status == "healthy" else "#c0392b"
    verdict_color = "#27ae60" if e["ok"] else "#c0392b"

    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>百炼调用凭证 · Academic Joan of Arc</title>
<style>
  body {{ font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
         margin: 32px; color: #1f2d3d; background: #f7f9fc; }}
  .card {{ background:#fff; border:1px solid #e3e8ef; border-radius:12px;
          padding:24px 28px; max-width:980px; margin:0 auto; box-shadow:0 2px 10px rgba(0,0,0,.05); }}
  h1 {{ font-size:22px; margin:0 0 4px; }}
  .sub {{ color:#7b8794; font-size:13px; margin-bottom:18px; }}
  .kv {{ display:grid; grid-template-columns:140px 1fr; gap:6px 12px;
         font-size:14px; margin:10px 0; }}
  .kv b {{ color:#52606d; font-weight:600; }}
  .badge {{ display:inline-block; padding:4px 12px; border-radius:20px;
            color:#fff; font-weight:700; font-size:14px; background:{h_color}; }}
  .verdict {{ font-size:16px; font-weight:700; color:{verdict_color};
             margin:16px 0; padding:12px 16px; background:#f0f4ff; border-radius:8px; }}
  table {{ width:100%; border-collapse:collapse; margin-top:10px; font-size:13px; }}
  th,td {{ border:1px solid #e3e8ef; padding:8px 10px; text-align:left; vertical-align:top; }}
  th {{ background:#f0f3f8; }}
  .m {{ color:#9aa5b1; font-size:11px; }}
  .foot {{ color:#9aa5b1; font-size:11px; margin-top:18px; }}
  code {{ background:#eef2f7; padding:1px 6px; border-radius:4px; }}
</style></head>
<body><div class="card">
  <h1>阿里云百炼平台 · 千问(Qwen) 模型调用凭证</h1>
  <div class="sub">Academic Joan of Arc — 挑战杯「揭榜挂帅」XH-202619 合规证据 · 基座 = 千问开源大模型 + 百炼平台调用</div>

  <div class="kv">
    <b>生成时间</b><span>{e['generated_at']}</span>
    <b>调用平台</b><span>{e['platform']}</span>
    <b>API 端点</b><span><code>{e['endpoint']}</code></span>
    <b>API Key</b><span>{e['api_key_masked']} <span class="m">(已脱敏，仅本地 .env 保留明文)</span></span>
    <b>模型映射</b><span>reasoning={e['model_map'].get('reasoning')} · general={e['model_map'].get('general')} · coding={e['model_map'].get('coding')} · multimodal={e['model_map'].get('multimodal')}</span>
    <b>健康状态</b><span><span class="badge">{h_status}</span></span>
  </div>

  <div class="verdict">{e['verdict']}</div>

  <table>
    <thead><tr><th>调用项</th><th>状态</th><th>Token 用量</th><th>模型返回（节选）</th></tr></thead>
    <tbody>{call_html}</tbody>
  </table>

  <div class="foot">
    本凭证由 <code>scripts/verify_bailian.py</code> 复用生产代码 <code>backend/app/bailian_engine.py · BailianEngine</code>
    对阿里云百炼平台发起真实 HTTP 调用生成，证明系统「通过百炼平台调用千问模型 API」满足赛题硬性要求。
    API Key 已通过 .gitignore 排除，未随代码提交。
  </div>
</div></body></html>"""


if __name__ == "__main__":
    asyncio.run(main())
