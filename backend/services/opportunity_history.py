from functools import lru_cache
from pathlib import Path
import json
import re


OPPORTUNITY_PATH = Path(__file__).resolve().parents[1] / "data" / "opportunities.json"


@lru_cache(maxsize=1)
def load_opportunity_history():
    if not OPPORTUNITY_PATH.exists():
        return {"stats": {"total_records": 0}, "records": []}
    return json.loads(OPPORTUNITY_PATH.read_text(encoding="utf-8"))


def search_similar_opportunities(tender, limit=12):
    terms = build_query_terms(tender)
    scored = []
    for record in load_opportunity_history().get("records", []):
        score = score_record(record, tender, terms)
        if score > 0:
            scored.append((score, record))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [record for _, record in scored[:limit]]


def opportunity_context_for_qwen(tender, limit=20):
    matches = search_similar_opportunities(tender, limit=limit)
    return {
        "stats": load_opportunity_history().get("stats", {}),
        "matched_opportunities": [
            {
                "opportunity_no": item.get("opportunity_no"),
                "name": item.get("name"),
                "customer": item.get("customer"),
                "end_customer": item.get("end_customer"),
                "status": item.get("status"),
                "customer_level": item.get("customer_level"),
                "project_type": item.get("project_type"),
                "project_subtype": item.get("project_subtype"),
                "expected_amount": item.get("expected_amount"),
                "actual_amount": item.get("actual_amount"),
                "win_rate": item.get("win_rate"),
                "sales": item.get("sales"),
                "delivery_unit": item.get("delivery_unit"),
                "keywords": item.get("keywords", []),
            }
            for item in matches
        ],
    }


def customer_history_for_buyer(buyer, limit=5):
    if not buyer:
        return []
    buyer = normalize(buyer)
    matches = []
    for record in load_opportunity_history().get("records", []):
        customer = normalize(record.get("customer", ""))
        end_customer = normalize(record.get("end_customer", ""))
        customer_hit = customer and (buyer in customer or customer in buyer)
        end_customer_hit = end_customer and (buyer in end_customer or end_customer in buyer)
        if buyer and (customer_hit or end_customer_hit):
            matches.append(record)
    return sorted(matches, key=lambda item: item.get("created_at") or "", reverse=True)[:limit]


def stats_summary():
    return load_opportunity_history().get("stats", {})


def build_query_terms(tender):
    text = " ".join(
        [
            tender.get("title", ""),
            tender.get("buyer", ""),
            tender.get("raw_summary", ""),
            tender.get("notice_type", ""),
            " ".join(tender.get("keywords", [])),
            " ".join(tender.get("requirements", [])),
        ]
    )
    terms = set(tender.get("keywords", []))
    terms.update(re.findall(r"[\u4e00-\u9fa5A-Za-z0-9]{2,}", text))
    return {term for term in terms if len(term) >= 2}


def score_record(record, tender, terms):
    haystack = " ".join(
        str(record.get(key, ""))
        for key in [
            "opportunity_name", "project_name", "customer", "end_customer", "business_scope",
            "project_type", "project_subtype", "delivery_unit", "marketing_unit", "solution_type",
            "product_type", "status", "customer_level",
        ]
    ).lower()
    score = 0
    buyer = normalize(tender.get("buyer", ""))
    customer = normalize(record.get("customer", ""))
    end_customer = normalize(record.get("end_customer", ""))
    if buyer and (buyer in customer or customer in buyer or buyer in end_customer or end_customer in buyer):
        score += 50
    for term in terms:
        lowered = term.lower()
        if lowered in haystack:
            score += 5 if len(term) >= 4 else 2
    if record.get("status") in ["已签约", "已确认", "已立项"]:
        score += 3
    if record.get("customer_level") in ["核心客户", "潜力客户"]:
        score += 2
    return score


def normalize(value):
    return re.sub(r"\s|（.*?）|\(.*?\)", "", str(value or ""))
