"""
M2 知识整合器 — 对应模板 P9（证据梳理）
三级证据来源（方案 §4.2）：
  1 在线检索：OpenAlex / Semantic Scholar（公开学术 API，无需密钥）
  2 本地来源：本地知识图谱（astronomy_kg_seed.json）/ 本地数据集
  3 模型知识：LLM 背景知识（标注 model_generated，confidence 上限 0.55）

证据卡片三分类：fact / literature_interpretation / model_inference
引用核验：OpenAlex DOI 存在性检查（失败不阻断，标注 unverified）
冲突对：claim_type=fact 且方向对立 → conflict_with 标记
"""

import asyncio
import json
import os
from typing import Optional

import httpx
from loguru import logger

from .llm import chat_json
from .db import get_conn
from .skills_library import skill_prompt

_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_KG_PATH = os.path.join(_PROJECT_ROOT, "datasets", "astronomy_kg_seed.json")

OPENALEX_SEARCH = "https://api.openalex.org/works"
S2_SEARCH = "https://api.semanticscholar.org/graph/v1/paper/search"
CROSSREF_SEARCH = "https://api.crossref.org/works"

# 全局检索限流闸（迭代4修复：批量并发下 OpenAlex/S2 免费 API 被打 429，
# 在线文献归零 → D2 证据质量崩塌。按来源限并发 + 请求间隔，宁慢勿限流）
# 迭代4.5：OpenAlex/S2 出现 IP 级临时封禁（curl 直测也 429）→ 限流闸防不住已生效封禁，
# 接入 Crossref 作为第三检索源（polite pool 限流宽松 ~50 req/s）+ DOI 核验回退源
_SEARCH_SEM: dict[str, asyncio.Semaphore] = {}
_SEARCH_GAP = {"openalex": 0.8, "semantic_scholar": 1.5, "crossref": 0.5}
_SEARCH_CONC = {"openalex": 2, "semantic_scholar": 1, "crossref": 2}
_LAST_REQ: dict[str, float] = {}


async def _rate_limited(source: str) -> None:
    """按来源串行化检索请求：并发上限 + 最小请求间隔。"""
    import time as _t
    sem = _SEARCH_SEM.setdefault(source, asyncio.Semaphore(_SEARCH_CONC.get(source, 2)))
    async with sem:
        gap = _SEARCH_GAP.get(source, 0.5)
        now = _t.monotonic()
        wait = _LAST_REQ.get(source, 0) + gap - now
        if wait > 0:
            await asyncio.sleep(wait)
        _LAST_REQ[source] = _t.monotonic()


# 来源熔断器（迭代4.5.1：OpenAlex/S2 遭 IP 级封禁后，每题仍3次退避重试纯浪费时间，
# 连续失败达阈值后熔断跳过，冷却期满半开放行探测，源恢复自动重启用）
_BREAKER_FAILS: dict[str, int] = {}
_BREAKER_COOL_UNTIL: dict[str, float] = {}
_BREAKER_THRESHOLD = 6        # 连续失败次数阈值
_BREAKER_COOLDOWN = 300.0     # 冷却秒数


def _breaker_record(source: str, ok: bool) -> None:
    """记录一次检索成败：成功清零，连续失败达阈值触发熔断。"""
    import time as _t
    if ok:
        if _BREAKER_FAILS.get(source):
            logger.info(f"✅ {source} 熔断恢复（探测成功）")
        _BREAKER_FAILS[source] = 0
        _BREAKER_COOL_UNTIL.pop(source, None)
    else:
        _BREAKER_FAILS[source] = _BREAKER_FAILS.get(source, 0) + 1
        if _BREAKER_FAILS[source] >= _BREAKER_THRESHOLD:
            _BREAKER_COOL_UNTIL[source] = _t.monotonic() + _BREAKER_COOLDOWN
            logger.warning(
                f"⛔ {source} 熔断：连续失败 {_BREAKER_FAILS[source]} 次，"
                f"{_BREAKER_COOLDOWN:.0f}s 内跳过该源（冷却后半开探测）")


def _breaker_open(source: str) -> bool:
    """熔断是否生效：True=跳过该源。冷却期满转半开（放行一次探测）。"""
    import time as _t
    until = _BREAKER_COOL_UNTIL.get(source)
    if until is None:
        return False
    if _t.monotonic() < until:
        return True
    # 冷却期满 → 半开：撤销熔断窗口并回退计数，放行本次探测
    _BREAKER_COOL_UNTIL.pop(source, None)
    _BREAKER_FAILS[source] = max(1, _BREAKER_FAILS.get(source, 0) - _BREAKER_THRESHOLD)
    return False

M2_SYSTEM_PROMPT = """你是科学证据整合专家。基于检索到的文献与本地知识，产出结构化证据卡片，输出纯JSON。

规则：
1. claim_type 三分类必须准确：
   - fact：可重复观测/实验确立的客观事实（如测定值、已确证现象）
   - literature_interpretation：文献作者的解释/观点/模型（可能存争议）
   - model_inference：无外部来源、由你基于背景知识推断的内容（须标注低置信度）
2. 每条证据须明确 supports_gaps：它支撑哪些知识缺口（G-xx 列表）。
3. 若两条证据结论对立，在 conflict_with 中互标对方编号，并说明对立点。
4. quote 尽量摘自所给文献摘要原文；model_inference 无 quote 时留空。
5. 严禁编造文献：只能使用提供的文献列表；背景推断一律标 model_inference。
6. confidence：fact 0.75-0.95；literature_interpretation 0.5-0.8；model_inference ≤0.55。

输出JSON格式：
{
  "cards": [
    {
      "e_code": "E-0001",
      "claim_type": "fact|literature_interpretation|model_inference",
      "claim": "证据主张（一句话，含对象与变量）",
      "quote": "关键句摘录",
      "source_ref": "所引文献编号（如 L1；model_inference 留空）",
      "supports_gaps": ["G-01"],
      "confidence": 0.8,
      "relevance": 0.8,
      "conflict_with": "",
      "conflict_reason": ""
    }
  ]
}"""


# ────────────────────────────────────────────────────────────────
# 在线检索
# ────────────────────────────────────────────────────────────────

async def _get_json_with_retry(url: str, params: dict, timeout: float = 12.0,
                               max_attempts: int = 3, source: str = "API") -> Optional[dict]:
    """带退避重试的 GET+JSON；429/503/5xx 自动重试，指数退避。"""
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                r = await client.get(url, params=params)
                if r.status_code in (429, 500, 502, 503, 504):
                    last_err = f"HTTP {r.status_code}"
                    if attempt < max_attempts:
                        await asyncio.sleep(min(2.0 * attempt, 6.0))
                        continue
                    logger.warning(f"⚠️ {source} 重试{max_attempts}次仍限流/异常({last_err})")
                    return None
                r.raise_for_status()
                return r.json()
        except httpx.HTTPStatusError as e:
            last_err = str(e)
            logger.warning(f"⚠️ {source} HTTP错误: {e}")
            return None
        except Exception as e:
            last_err = str(e)
            if attempt < max_attempts:
                await asyncio.sleep(min(1.5 * attempt, 4.0))
                continue
            logger.warning(f"⚠️ {source} 请求失败({last_err})")
            return None
    return None


async def search_openalex(query: str, per: int = 5, timeout: float = 12.0) -> list[dict]:
    """OpenAlex 检索，返回标准化文献条目（带退避重试 + 全局限流闸 + 熔断器）。"""
    if _breaker_open("openalex"):
        return []
    await _rate_limited("openalex")
    params = {
        "search": query,
        "per-page": per,
        "select": "id,doi,title,publication_year,authorships,abstract_inverted_index,primary_location",
        "mailto": "academic-joan-of-arc@example.org",
    }
    data = await _get_json_with_retry(OPENALEX_SEARCH, params, timeout, source="OpenAlex")
    _breaker_record("openalex", data is not None)
    if data is None:
        return []

    out = []
    for w in data.get("results", []):
        title = w.get("title") or ""
        year = w.get("publication_year")
        doi = (w.get("doi") or "").replace("https://doi.org/", "")
        authors = [a.get("author", {}).get("display_name", "") for a in (w.get("authorships") or [])[:3]]
        # 还原 inverted abstract
        abstract = ""
        inv = w.get("abstract_inverted_index")
        if inv:
            pos: dict[int, str] = {}
            for word, idxs in inv.items():
                for i in idxs:
                    pos[i] = word
            abstract = " ".join(pos[i] for i in sorted(pos))[:800]
        loc = (w.get("primary_location") or {}).get("landing_page_url") or ""
        out.append({
            "ref_id": "",
            "source_type": "openalex",
            "title": title,
            "year": year,
            "doi": doi,
            "authors": ", ".join(a for a in authors if a),
            "abstract": abstract,
            "url": loc or (w.get("id") or ""),
        })
    return out


async def search_semantic_scholar(query: str, per: int = 5, timeout: float = 12.0) -> list[dict]:
    """Semantic Scholar 检索（备用源，交叉核验用；带退避重试 + 全局限流闸 + 熔断器）。"""
    if _breaker_open("semantic_scholar"):
        return []
    await _rate_limited("semantic_scholar")
    params = {
        "query": query,
        "limit": per,
        "fields": "title,year,authors,abstract,externalIds,url,venue",
    }
    data = await _get_json_with_retry(S2_SEARCH, params, timeout, source="SemanticScholar")
    _breaker_record("semantic_scholar", data is not None)
    if data is None:
        return []

    out = []
    for p in data.get("data", []):
        ext = p.get("externalIds") or {}
        out.append({
            "ref_id": "",
            "source_type": "semantic_scholar",
            "title": p.get("title") or "",
            "year": p.get("year"),
            "doi": ext.get("DOI", ""),
            "arxiv_id": ext.get("ArXiv", ""),
            "authors": ", ".join(a.get("name", "") for a in (p.get("authors") or [])[:3]),
            "abstract": (p.get("abstract") or "")[:800],
            "url": p.get("url") or "",
            "venue": p.get("venue") or "",
        })
    return out


async def search_crossref(query: str, per: int = 5, timeout: float = 12.0) -> list[dict]:
    """Crossref 检索（迭代4.5新增：OpenAlex/S2 遭 IP 级封禁时的第三检索源）。

    polite pool（mailto + UA）限流宽松（约50 req/s），返回带 DOI 的元数据。
    摘要覆盖率较低，故证据卡侧重引用标题/作者/年份/DOI 等可核验字段。
    """
    if _breaker_open("crossref"):
        return []
    await _rate_limited("crossref")
    params = {"query": query, "rows": per, "mailto": "academic-joan-of-arc@example.org"}
    data = await _get_json_with_retry(CROSSREF_SEARCH, params, timeout, source="Crossref")
    _breaker_record("crossref", data is not None)
    if data is None:
        return []

    out = []
    for it in (data.get("message") or {}).get("items") or []:
        title = (it.get("title") or [""])[0]
        doi = it.get("DOI") or ""
        if not doi:
            continue
        year = None
        for k in ("published-print", "published-online", "issued", "created"):
            dp = (it.get(k) or {}).get("date-parts") or []
            if dp and dp[0]:
                year = dp[0][0]
                break
        authors = [
            f"{a.get('given', '')} {a.get('family', '')}".strip()
            for a in (it.get("author") or [])[:3]
        ]
        out.append({
            "ref_id": "",
            "source_type": "crossref",
            "title": title,
            "year": year,
            "doi": doi,
            "authors": ", ".join(a for a in authors if a),
            "abstract": (it.get("abstract") or "")[:800],
            "url": it.get("URL") or f"https://doi.org/{doi}",
            "venue": (it.get("container-title") or [""])[0] if it.get("container-title") else "",
        })
    return out


# ────────────────────────────────────────────────────────────────
# 本地来源
# ────────────────────────────────────────────────────────────────

def load_local_kg(keywords: list[str]) -> list[dict]:
    """从本地天文知识图谱种子中按关键词命中实体/关系。"""
    if not os.path.exists(_KG_PATH):
        return []
    try:
        with open(_KG_PATH, "r", encoding="utf-8") as f:
            kg = json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ 本地KG读取失败: {e}")
        return []

    nodes = kg.get("nodes") or kg.get("entities") or []
    edges = kg.get("edges") or kg.get("relations") or []
    kws = [k.lower() for k in keywords if k]
    if not kws:
        return []

    hits = []
    node_names = {}
    for n in nodes:
        name = str(n.get("name") or n.get("label") or n.get("id") or "")
        node_names[n.get("id")] = name
        if any(k in name.lower() or name.lower() in k for k in kws):
            desc = n.get("description") or n.get("desc") or ""
            hits.append({
                "source_type": "local_kg",
                "claim": f"本地知识图谱实体：{name}" + (f"（{desc}）" if desc else ""),
                "quote": desc,
                "citation": f"本地知识图谱 astronomy_kg_seed.json :: {name}",
                "url": "",
            })
    for e in edges:
        src = node_names.get(e.get("source"), str(e.get("source", "")))
        tgt = node_names.get(e.get("target"), str(e.get("target", "")))
        rel = e.get("relation") or e.get("label") or e.get("type") or "related"
        line = f"{src} —[{rel}]→ {tgt}"
        if any(k in src.lower() or k in tgt.lower() for k in kws):
            hits.append({
                "source_type": "local_kg",
                "claim": f"本地知识图谱关系：{line}",
                "quote": "",
                "citation": f"本地知识图谱 astronomy_kg_seed.json :: {line}",
                "url": "",
            })
    return hits[:6]


def load_local_datasets(keywords: list[str]) -> list[dict]:
    """扫描 datasets/ 目录，将数据文件登记为 local_dataset 证据线索。"""
    ds_dir = os.path.join(_PROJECT_ROOT, "datasets")
    if not os.path.isdir(ds_dir):
        return []
    out = []
    for fname in sorted(os.listdir(ds_dir)):
        if fname.startswith(".") or fname.endswith(".pyc"):
            continue
        path = os.path.join(ds_dir, fname)
        if os.path.isfile(path):
            size_kb = os.path.getsize(path) / 1024
            out.append({
                "source_type": "local_dataset",
                "claim": f"本地数据集文件 {fname}（{size_kb:.0f}KB）可用于数据驱动检验",
                "quote": "",
                "citation": f"本地数据集 datasets/{fname}",
                "url": path,
            })
    return out[:4]


# ────────────────────────────────────────────────────────────────
# 引用核验
# ────────────────────────────────────────────────────────────────

async def verify_doi(doi: str, timeout: float = 8.0) -> tuple[bool, str]:
    """核验 DOI 是否存在：OpenAlex 主，失败回退 Crossref（迭代4.5）。失败不阻断流程。"""
    if not doi:
        return False, "无DOI，未核验"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            r = await client.get(
                f"https://api.openalex.org/works/https://doi.org/{doi}",
                params={"mailto": "academic-joan-of-arc@example.org"},
            )
            if r.status_code == 200:
                return True, "DOI 已在 OpenAlex 核验存在"
            # OpenAlex 不可用（429等）→ 回退 Crossref works/{doi}
            r2 = await client.get(
                f"https://api.crossref.org/works/{doi}",
                params={"mailto": "academic-joan-of-arc@example.org"},
                headers={"User-Agent": "Academic-Joan-of-Arc/1.0 (mailto:academic-joan-of-arc@example.org)"},
            )
            if r2.status_code == 200:
                return True, "DOI 已在 Crossref 核验存在"
            return False, f"DOI 核验未命中（OpenAlex HTTP {r.status_code} / Crossref HTTP {r2.status_code}）"
    except Exception as e:
        return False, f"DOI 核验超时/失败：{e}"


# ────────────────────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────────────────────

def _fallback_cards(m1: dict) -> dict:
    """LLM/检索全部不可用时的确定性兜底。"""
    gaps = m1.get("gaps") or [{"g_code": "G-01"}]
    g0 = gaps[0].get("g_code", "G-01") if gaps else "G-01"
    return {
        "cards": [
            {
                "e_code": "E-0001",
                "claim_type": "model_inference",
                "claim": f"[Mock] 围绕缺口 {g0} 的背景推断：该领域存在可检索的既有研究脉络，具体事实待在线检索恢复后补充",
                "quote": "",
                "source_ref": "",
                "supports_gaps": [g0],
                "confidence": 0.3,
                "relevance": 0.5,
                "conflict_with": "",
                "conflict_reason": "",
            }
        ],
        "_mock": True,
    }


def _build_literature_block(literature: list[dict]) -> str:
    lines = []
    for lit in literature:
        lines.append(
            f"[{lit['ref_id']}] ({lit['source_type']}) {lit.get('authors','')} ({lit.get('year','?')}). "
            f"{lit['title']}. DOI: {lit.get('doi','无')}\n摘要: {lit.get('abstract','（摘要不可得）')[:600]}"
        )
    return "\n\n".join(lines) if lines else "（本次在线检索未取得文献，背景推断须标注 model_inference）"


def _build_local_block(local: list[dict]) -> str:
    if not local:
        return ""
    lines = [f"[{i+1}] ({h['source_type']}) {h['claim']}" for i, h in enumerate(local)]
    return "\n".join(lines)


async def integrate_knowledge(
    question: str,
    m1_result: dict,
    run_id: int,
    round_no: int = 1,
    search_queries: Optional[list[str]] = None,
    max_online: int = 6,
) -> dict:
    """M2：多源检索 → 证据卡片生成 → 冲突标记 → 引用核验 → 落库。

    返回：{"cards": [...], "literature_meta": [...], "local_hits": n, "model_used": str}
    """
    gaps = m1_result.get("gaps") or []
    objects = m1_result.get("objects") or []
    subqs = m1_result.get("subquestions") or []

    # 检索式：优先外部指定（补料轮），否则由问题+对象自动构造
    if not search_queries:
        search_queries = [question]
        search_queries += [f"{question} {o}" for o in objects[:2]]
        search_queries += subqs[:1]
    search_queries = [q for q in search_queries if q][:4]

    # ── 1 在线检索（OpenAlex 主、S2 备、Crossref 补，合并去重）──
    # 迭代4.5：OpenAlex/S2 遭 IP 级封禁时 Crossref 兜底（当前实测可用）
    tasks = []
    for q in search_queries[:2]:
        tasks.append(search_openalex(q, per=max_online))
        tasks.append(search_semantic_scholar(q, per=max(3, max_online - 2)))
        tasks.append(search_crossref(q, per=max_online))
    results = await asyncio.gather(*tasks, return_exceptions=True)

    literature: list[dict] = []
    seen_titles = set()
    seen_dois = set()
    for res in results:
        if isinstance(res, Exception):
            continue
        for lit in res:
            key = (lit.get("title") or "").strip().lower()[:60]
            doi_key = (lit.get("doi") or "").strip().lower()
            if doi_key and doi_key in seen_dois:
                continue
            if key and key not in seen_titles:
                seen_titles.add(key)
                if doi_key:
                    seen_dois.add(doi_key)
                literature.append(lit)
    literature = literature[: max_online * 2]
    for i, lit in enumerate(literature, 1):
        lit["ref_id"] = f"L{i}"

    # ── 2 本地来源 ──
    keywords = objects + [question[:20]]
    local_kg = load_local_kg(keywords)
    local_ds = load_local_datasets(keywords)
    local_all = local_kg + local_ds

    # ── 3 LLM 生成证据卡片 ──
    gap_block = "\n".join(
        f"{g.get('g_code','G-??')}: {g.get('statement','')}" for g in gaps
    ) or "G-01: 核心机制未明"
    user_prompt = (
        f"科学问题：{question}\n\n知识缺口：\n{gap_block}\n\n"
        f"=== 检索到的文献（引用时用 ref_id）===\n{_build_literature_block(literature)}\n\n"
        f"=== 本地知识来源 ===\n{_build_local_block(local_all)}\n\n"
        f"请产出 8-12 张证据卡片，硬性要求：\n"
        f"1) 三种 claim_type 均须出现：至少 2 张 fact（优先从文献摘要中提取测定值/已确证现象）、"
        f"至少 3 张 literature_interpretation、model_inference 不超过总数的 40%；\n"
        f"2) 每张卡尽量引用检索到的文献（source_ref 用 L 编号），以获得可核验的 DOI 来源；\n"
        f"3) 至少尝试找出 1-2 组冲突对（不同文献/方法与结论的对立），在 conflict_with 中互标；\n"
        f"4) 覆盖全部知识缺口（每张卡注明 supports_gaps）；\n"
        f"5) 若文献确无对立则不强行制造冲突，但须说明'已检视未发现实质对立'。"
    )

    # 技能注入：SK-02 证据三角互证 + SK-03 冲突对挖掘（在线文献充足时启用）
    if len(literature) >= 3:
        user_prompt += "\n\n" + skill_prompt("m2_evidence")

    result, model_used = await chat_json(
        system_prompt=M2_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        model="general",
        temperature=0.3,
        fallback=_fallback_cards(m1_result),
    )

    # 形状防御（迭代5加固，与 M4 同类风险）：LLM 偶发直接返回卡片数组
    if isinstance(result, list):
        result = {"cards": result}
    elif not isinstance(result, dict):
        result = {}
    cards = result.get("cards") or []
    if not isinstance(cards, list):
        cards = []
    lit_by_ref = {lit["ref_id"]: lit for lit in literature}

    # ── 4 规范化 + 引用核验 ──
    # 跨轮防冲突：e_code 基于该 run「其他轮」已有卡片数续编号
    #（排除本轮旧卡 → 同轮重跑编号不变，幂等覆盖；补料轮则接续新号段）
    conn = get_conn()
    try:
        existing = conn.execute(
            "SELECT COUNT(*) FROM evidence_cards WHERE run_id=? AND retrieval_round<>?",
            (run_id, round_no)).fetchone()[0]
    finally:
        conn.close()
    remap: dict[str, str] = {}
    for i, c in enumerate(cards, 1):
        old = c.get("e_code") or f"E-{i:04d}"
        new = f"E-{existing + i:04d}"
        remap[old] = new
        c["e_code"] = new
    for c in cards:
        cw = c.get("conflict_with") or ""
        if cw in remap:
            c["conflict_with"] = remap[cw]

    doi_verify_tasks = []
    verify_targets: list[int] = []  # cards 下标
    for i, c in enumerate(cards, 1):
        ct = c.get("claim_type", "literature_interpretation")
        if ct not in ("fact", "literature_interpretation", "model_inference"):
            ct = "literature_interpretation"
            c["claim_type"] = ct
        ref = c.get("source_ref", "")
        lit = lit_by_ref.get(ref)
        if lit:
            c["source_type"] = lit["source_type"]
            c["citation"] = (
                f"{lit.get('authors','')}, {lit['title']}, {lit.get('year','?')}, "
                f"DOI:{lit.get('doi','无')}"
            )
            c["source_url"] = lit.get("url", "")
            c["_doi"] = lit.get("doi", "")
        elif ct == "model_inference" or not ref:
            c["source_type"] = "model_generated"
            c["citation"] = "模型背景知识推断（无外部文献来源）"
            c["source_url"] = ""
            c["_doi"] = ""
            c["confidence"] = min(float(c.get("confidence", 0.4) or 0.4), 0.55)
        else:
            # 引用了本地来源
            idx = None
            try:
                idx = int(str(ref).strip("Ll[]")) - 1
            except Exception:
                pass
            if idx is not None and 0 <= idx < len(local_all):
                loc = local_all[idx]
                c["source_type"] = loc["source_type"]
                c["citation"] = loc["citation"]
                c["source_url"] = loc.get("url", "")
            else:
                c["source_type"] = "model_generated"
                c["citation"] = "来源不明，按模型推断处理"
                c["_doi"] = ""
            c.setdefault("verified", 0)
        if c.get("_doi"):
            doi_verify_tasks.append(verify_doi(c["_doi"]))
            verify_targets.append(i - 1)

    # 批量核验（并发上限3，避免限流）
    if doi_verify_tasks:
        sem = asyncio.Semaphore(3)

        async def _limited(coro):
            async with sem:
                return await coro

        verify_results = await asyncio.gather(*[_limited(t) for t in doi_verify_tasks])
        for idx, (ok, note) in zip(verify_targets, verify_results):
            cards[idx]["verified"] = 1 if ok else 0
            cards[idx]["verify_note"] = note

    # ── 5 落库 ──
    conn = get_conn()
    try:
        # 清理本轮旧卡（同一 run 同轮重跑幂等）
        conn.execute(
            "DELETE FROM evidence_cards WHERE run_id=? AND retrieval_round=?",
            (run_id, round_no),
        )
        for c in cards:
            conn.execute(
                """
                INSERT OR REPLACE INTO evidence_cards
                (run_id, e_code, source_type, citation, source_url, claim_type, claim, quote,
                 relevance, confidence, supports_gaps, conflict_with, retrieval_round, verified, verify_note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    c["e_code"],
                    c.get("source_type", "model_generated"),
                    c.get("citation", ""),
                    c.get("source_url", ""),
                    c.get("claim_type", "literature_interpretation"),
                    c.get("claim", ""),
                    c.get("quote", ""),
                    float(c.get("relevance", 0.5) or 0.5),
                    float(c.get("confidence", 0.5) or 0.5),
                    json.dumps(c.get("supports_gaps", []), ensure_ascii=False),
                    c.get("conflict_with", "") or "",
                    round_no,
                    int(c.get("verified", 0) or 0),
                    c.get("verify_note", "") or "",
                ),
            )
        conn.commit()
    finally:
        conn.close()

    n_fact = sum(1 for c in cards if c.get("claim_type") == "fact")
    n_lit = sum(1 for c in cards if c.get("claim_type") == "literature_interpretation")
    n_inf = sum(1 for c in cards if c.get("claim_type") == "model_inference")
    n_conflict = sum(1 for c in cards if c.get("conflict_with"))
    logger.info(
        f"✅ M2 完成 | 证据卡 {len(cards)} 张 (fact={n_fact}, lit={n_lit}, infer={n_inf}) | "
        f"在线文献 {len(literature)} 篇 | 本地命中 {len(local_all)} | 冲突对标记 {n_conflict} | model: {model_used}"
    )

    # 清掉临时字段
    for c in cards:
        c.pop("_doi", None)

    return {
        "cards": cards,
        "literature_meta": [
            {k: lit.get(k) for k in ("ref_id", "source_type", "title", "year", "doi", "authors", "url")}
            for lit in literature
        ],
        "local_hits": len(local_all),
        "search_queries": search_queries,
        "model_used": model_used,
    }
