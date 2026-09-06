#!/usr/bin/env python3
"""
Academic Joan of Arc — 离线环境验证脚本
在断网环境下运行，验证所有功能是否正常

用法：
    python verify-offline.py

检查项：
1. Ollama服务是否运行
2. 模型是否已下载
3. 数据库是否初始化
4. 后端API是否响应
5. 核心功能是否可用（推理、检索、数据查询）
"""

import sys
import json
import sqlite3
import asyncio
import subprocess
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class CheckResult:
    name: str
    passed: bool
    message: str
    details: Optional[dict] = None


class OfflineVerifier:
    """离线环境验证器"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results: list[CheckResult] = []
        self.checks_passed = 0
        self.checks_failed = 0
    
    def _add_result(self, result: CheckResult):
        self.results.append(result)
        if result.passed:
            self.checks_passed += 1
        else:
            self.checks_failed += 1
    
    def check_1_ollama_running(self) -> CheckResult:
        """检查1: Ollama服务是否运行"""
        try:
            response = httpx.get("http://localhost:11434/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return CheckResult(
                    name="Ollama服务",
                    passed=True,
                    message="Ollama服务运行正常",
                    details={"available_models": models}
                )
            else:
                return CheckResult(
                    name="Ollama服务",
                    passed=False,
                    message=f"Ollama返回非200状态码: {response.status_code}"
                )
        except httpx.ConnectError:
            return CheckResult(
                name="Ollama服务",
                passed=False,
                message="无法连接到Ollama（端口11434），请检查docker-compose是否已启动"
            )
        except Exception as e:
            return CheckResult(
                name="Ollama服务",
                passed=False,
                message=f"检查失败: {str(e)}"
            )
    
    def check_2_models_downloaded(self) -> CheckResult:
        """检查2: 必需模型是否已下载"""
        required_models = ["qwen2.5:7b", "qwen2.5-coder:7b"]
        optional_models = ["qwen2.5:14b", "qwen2.5-coder:14b"]
        
        try:
            response = httpx.get("http://localhost:11434/api/tags", timeout=5)
            data = response.json()
            available = [m["name"] for m in data.get("models", [])]
            
            missing_required = [m for m in required_models if m not in available]
            
            if missing_required:
                return CheckResult(
                    name="模型下载状态",
                    passed=False,
                    message=f"缺少必需模型: {', '.join(missing_required)}",
                    details={"available": available, "missing": missing_required}
                )
            
            has_optional = [m for m in optional_models if m in available]
            
            return CheckResult(
                name="模型下载状态",
                passed=True,
                message=f"必需模型已就绪，可选模型: {', '.join(has_optional) if has_optional else '无'}",
                details={"available": available}
            )
        except Exception as e:
            return CheckResult(
                name="模型下载状态",
                passed=False,
                message=f"检查失败: {str(e)}"
            )
    
    def check_3_database(self) -> CheckResult:
        """检查3: 数据库是否初始化"""
        db_path = Path("data/ai_scientist.db")
        
        if not db_path.exists():
            return CheckResult(
                name="SQLite数据库",
                passed=False,
                message=f"数据库文件不存在: {db_path}"
            )
        
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # 检查关键表是否存在
            required_tables = [
                "users", "research_sessions", "literature",
                "kg_nodes", "kg_edges", "astro_data", "hypotheses"
            ]
            
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            existing = [row[0] for row in cursor.fetchall()]
            
            missing = [t for t in required_tables if t not in existing]
            
            # 检查文献数据量
            cursor.execute("SELECT COUNT(*) FROM literature")
            literature_count = cursor.fetchone()[0]
            
            # 检查天文数据量
            cursor.execute("SELECT COUNT(*) FROM astro_data")
            astro_count = cursor.fetchone()[0]
            
            conn.close()
            
            if missing:
                return CheckResult(
                    name="SQLite数据库",
                    passed=False,
                    message=f"缺少表: {', '.join(missing)}",
                    details={"existing_tables": existing, "literature_count": literature_count}
                )
            
            return CheckResult(
                name="SQLite数据库",
                passed=True,
                message=f"数据库正常，文献: {literature_count}条，天文数据: {astro_count}条",
                details={
                    "tables": len(existing),
                    "literature_count": literature_count,
                    "astro_count": astro_count
                }
            )
        
        except Exception as e:
            return CheckResult(
                name="SQLite数据库",
                passed=False,
                message=f"数据库检查失败: {str(e)}"
            )
    
    def check_4_backend_api(self) -> CheckResult:
        """检查4: 后端API是否响应"""
        try:
            response = httpx.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return CheckResult(
                    name="后端API服务",
                    passed=True,
                    message=f"API正常，版本: {data.get('version', 'unknown')}, 模式: {data.get('mode', 'unknown')}",
                    details=data
                )
            else:
                return CheckResult(
                    name="后端API服务",
                    passed=False,
                    message=f"API返回状态码: {response.status_code}"
                )
        except httpx.ConnectError:
            return CheckResult(
                name="后端API服务",
                passed=False,
                message=f"无法连接到后端API ({self.base_url})"
            )
        except Exception as e:
            return CheckResult(
                name="后端API服务",
                passed=False,
                message=f"检查失败: {str(e)}"
            )
    
    def check_5_network_isolation(self) -> CheckResult:
        """检查5: 确认网络隔离（无外网访问）"""
        test_urls = [
            "https://www.baidu.com",
            "https://dashscope.aliyuncs.com",
            "https://api.openai.com"
        ]
        
        blocked = 0
        for url in test_urls:
            try:
                httpx.get(url, timeout=3)
            except Exception:
                blocked += 1
        
        if blocked == len(test_urls):
            return CheckResult(
                name="网络隔离验证",
                passed=True,
                message="✅ 确认无外网访问，系统处于离线模式",
                details={"blocked_endpoints": len(test_urls)}
            )
        else:
            return CheckResult(
                name="网络隔离验证",
                passed=False,
                message=f"⚠️  部分外网可访问（{len(test_urls) - blocked}/{len(test_urls)}），建议断开网络进行完全离线测试",
                details={"blocked": blocked, "total": len(test_urls)}
            )
    
    async def check_6_local_inference(self) -> CheckResult:
        """检查6: 本地推理功能"""
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": "general",
                    "messages": [{"role": "user", "content": "你好，请回复'Academic Joan of Arc离线测试成功'"}],
                    "stream": False
                },
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return CheckResult(
                    name="本地模型推理",
                    passed=True,
                    message="模型推理正常",
                    details={"response_preview": content[:100]}
                )
            else:
                return CheckResult(
                    name="本地模型推理",
                    passed=False,
                    message=f"推理请求失败: {response.status_code}"
                )
        except Exception as e:
            return CheckResult(
                name="本地模型推理",
                passed=False,
                message=f"推理测试失败: {str(e)}"
            )
    
    def check_7_disk_space(self) -> CheckResult:
        """检查7: 磁盘空间"""
        try:
            import shutil
            stat = shutil.disk_usage(".")
            free_gb = stat.free // (1024**3)
            total_gb = stat.total // (1024**3)
            
            if free_gb < 5:
                return CheckResult(
                    name="磁盘空间",
                    passed=False,
                    message=f"磁盘空间不足: {free_gb}GB可用（建议保留5GB+）"
                )
            
            return CheckResult(
                name="磁盘空间",
                passed=True,
                message=f"磁盘空间充足: {free_gb}GB / {total_gb}GB",
                details={"free_gb": free_gb, "total_gb": total_gb}
            )
        except Exception as e:
            return CheckResult(
                name="磁盘空间",
                passed=False,
                message=f"检查失败: {str(e)}"
            )
    
    def run_all_checks(self):
        """运行所有检查"""
        print("=" * 60)
        print("🧠 Academic Joan of Arc — 离线环境验证")
        print("=" * 60)
        print()
        
        # 同步检查
        self._add_result(self.check_1_ollama_running())
        self._add_result(self.check_2_models_downloaded())
        self._add_result(self.check_3_database())
        self._add_result(self.check_4_backend_api())
        self._add_result(self.check_5_network_isolation())
        self._add_result(self.check_7_disk_space())
        
        # 异步检查（模型推理）
        loop = asyncio.get_event_loop()
        self._add_result(loop.run_until_complete(self.check_6_local_inference()))
        
        self.print_report()
    
    def print_report(self):
        """打印检查报告"""
        print()
        print("-" * 60)
        print("📋 检查结果:")
        print("-" * 60)
        
        for result in self.results:
            status = "✅ 通过" if result.passed else "❌ 失败"
            print(f"\n{status} | {result.name}")
            print(f"   └─ {result.message}")
            if result.details:
                for k, v in result.details.items():
                    if isinstance(v, list):
                        v = ", ".join(str(x) for x in v[:5])
                    print(f"      {k}: {v}")
        
        print()
        print("=" * 60)
        print(f"📊 总计: {self.checks_passed} 通过 / {self.checks_failed} 失败")
        
        if self.checks_failed == 0:
            print()
            print("🎉 所有检查通过！系统已就绪，可离线运行。")
            print("   访问 http://localhost:3000 开始使用")
        else:
            print()
            print("⚠️  存在失败的检查项，请根据提示修复后重试。")
        
        print("=" * 60)
        
        return self.checks_failed == 0


if __name__ == "__main__":
    verifier = OfflineVerifier()
    all_passed = verifier.run_all_checks()
    sys.exit(0 if all_passed else 1)
