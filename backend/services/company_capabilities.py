from functools import lru_cache
from pathlib import Path
import json
import re


CAPABILITY_PATH = Path(__file__).resolve().parents[1] / "data" / "capabilities.json"


@lru_cache(maxsize=1)
def load_company_capabilities():
    if not CAPABILITY_PATH.exists():
        return {"stats": {"total_records": 0, "by_kind": {}, "by_company": {}}, "records": []}
    return json.loads(CAPABILITY_PATH.read_text(encoding="utf-8"))


def search_company_capabilities(tender, limit=12):
    knowledge = load_company_capabilities()
    query = build_query_terms(tender)
    scored = []
    for record in knowledge.get("records", []):
        score = score_record(record, query)
        if score > 0:
            scored.append((score, record))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [record for _, record in scored[:limit]]


def capability_context_for_qwen(tender, limit=20):
    knowledge = load_company_capabilities()
    matches = search_company_capabilities(tender, limit=limit)
    return {
        "stats": knowledge.get("stats", {}),
        "matched_records": [
            {
                "kind": item.get("kind"),
                "company": item.get("company"),
                "name": item.get("name"),
                "certificate_no": item.get("certificate_no"),
                "expires_at": item.get("expires_at"),
                "issuer": item.get("issuer"),
                "keywords": item.get("keywords", []),
            }
            for item in matches
        ],
    }


def build_query_terms(tender):
    text = " ".join(
        [
            tender.get("title", ""),
            tender.get("buyer", ""),
            tender.get("notice_type", ""),
            tender.get("raw_summary", ""),
            " ".join(tender.get("keywords", [])),
            " ".join(tender.get("requirements", [])),
        ]
    )
    terms = set(tender.get("keywords", []))
    terms.update(re.findall(r"[\u4e00-\u9fa5A-Za-z0-9]{2,}", text))
    aliases = {
        "信息化": ["软件", "系统", "数据", "平台"],
        "运维": ["ITSS", "ISO20000", "运维"],
        "安全": ["ISO27001", "信息安全", "等保", "网络安全"],
        "AI": ["AI", "人工智能", "知识库", "模型"],
        "云": ["云", "云资源", "云平台"],
        "数据": ["数据", "数据治理", "数据质量", "数据分析"],
        "低代码": ["低代码", "应用构建"],
        "监管": ["监管", "溯源"],
    }
    for term in list(terms):
        for key, values in aliases.items():
            if key.lower() in term.lower():
                terms.update(values)
    return {term for term in terms if len(term) >= 2}


def score_record(record, terms):
    haystack = " ".join(
        [
            record.get("kind", ""),
            record.get("category", ""),
            record.get("company", ""),
            record.get("name", ""),
            record.get("issuer", ""),
            " ".join(record.get("keywords", [])),
        ]
    ).lower()
    score = 0
    for term in terms:
        lowered = term.lower()
        if not lowered:
            continue
        if lowered in haystack:
            score += 5 if len(term) >= 4 else 2
    kind = record.get("kind")
    if kind in ["法人体资质", "软件著作权", "专利"]:
        score += 1
    return score


def stats_summary():
    return load_company_capabilities().get("stats", {})
