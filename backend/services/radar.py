from copy import deepcopy
from datetime import date

from data.seed import CAPABILITIES, CUSTOMERS, RISK_SAMPLES, TENDERS
from services.company_capabilities import search_company_capabilities
from services.opportunity_history import customer_history_for_buyer


LEVELS = [
    (80, "高优先级"),
    (60, "中优先级"),
    (0, "观察池"),
]


def _find_customer(buyer):
    for customer in CUSTOMERS:
        if customer["name"] == buyer or customer["name"] in buyer or buyer in customer["name"]:
            return customer
    return None


def _customer_match(tender):
    history = customer_history_for_buyer(tender["buyer"])
    if history:
        best = history[0]
        signed_count = len([item for item in history if item.get("status") == "已签约"])
        score = min(40, 20 + len(history) * 3 + signed_count * 5)
        return {
            "status": "已有客户" if signed_count else "潜在客户",
            "owner": best.get("sales") or best.get("customer_manager") or "待分配",
            "customer_type": best.get("customer_category") or "历史商机客户",
            "history_opportunities": len(history),
            "cooperated": signed_count > 0,
            "priority": "A" if best.get("customer_level") == "核心客户" else "B",
            "reason": f"历史商机库匹配到{len(history)}条相关记录，最近项目为“{best.get('name')}”，状态为{best.get('status')}。",
            "score": score,
            "matched_opportunities": history,
        }

    customer = _find_customer(tender["buyer"])
    if not customer:
        return {
            "status": "未匹配",
            "owner": "待分配",
            "customer_type": "新客户",
            "history_opportunities": 0,
            "cooperated": False,
            "priority": "C",
            "reason": "客户管理模块暂无明确匹配记录，建议销售补充客户背景。",
            "score": 8,
        }

    score = 18
    if customer["priority"] == "A":
        score += 8
    if customer["cooperated"]:
        score += 8
    score += min(customer["history_opportunities"] * 2, 6)
    return {
        "status": "已有客户" if customer["cooperated"] else "潜在客户",
        "owner": customer["owner"],
        "customer_type": customer["type"],
        "history_opportunities": customer["history_opportunities"],
        "cooperated": customer["cooperated"],
        "priority": customer["priority"],
        "reason": f"{customer['name']}为{customer['type']}，负责人为{customer['owner']}，具备转化基础。",
        "score": min(score, 40),
    }


def _capability_match(tender):
    real_matches = search_company_capabilities(tender, limit=10)
    if real_matches:
        return _real_capability_match(tender, real_matches)

    keyword_set = set(tender["keywords"] + tender["requirements"])
    best = None

    for entity in CAPABILITIES["entities"]:
        tags = set(entity["tags"])
        hit_tags = sorted(tags.intersection(keyword_set))
        hit_copyrights = [item for item in entity["copyrights"] if any(tag in item for tag in tender["keywords"])]
        hit_cases = [item for item in entity["cases"] if any(tag in item for tag in tender["keywords"])]
        cert_hits = [item for item in entity["certifications"] if any(token in item for token in ["ITSS", "ISO", "等保", "安全", "CS"])]
        score = min(len(hit_tags) * 5 + len(hit_copyrights) * 4 + len(hit_cases) * 4 + len(cert_hits), 32)
        candidate = {
            "status": "高度匹配" if score >= 22 else "部分匹配" if score >= 12 else "低匹配",
            "score": score,
            "entity": entity["name"],
            "certifications": cert_hits[:3],
            "copyrights": hit_copyrights[:3],
            "cases": hit_cases[:3],
            "gaps": _capability_gaps(tender, hit_tags, hit_copyrights, hit_cases),
            "departments": ["售前团队", "资质管理团队"] if score >= 12 else ["销售负责人", "解决方案团队"],
        }
        if not best or candidate["score"] > best["score"]:
            best = candidate

    return best


def _real_capability_match(tender, matches):
    strong_kinds = {"法人体资质", "软件著作权", "专利"}
    strong_count = len([item for item in matches if item["kind"] in strong_kinds])
    score = min(32, 8 + strong_count * 5 + min(len(matches), 8))
    if score >= 22:
        status = "高度匹配"
    elif score >= 12:
        status = "部分匹配"
    else:
        status = "低匹配"

    companies = [item["company"] for item in matches if item.get("company")]
    entity = companies[0] if companies else "待确认法人体"
    certifications = [format_capability(item) for item in matches if item["kind"] == "法人体资质"][:4]
    copyrights = [format_capability(item) for item in matches if item["kind"] == "软件著作权"][:4]
    cases = [format_capability(item) for item in matches if item["kind"] in ["专利", "人员资质"]][:4]
    gaps = []
    if not certifications:
        gaps.append("需确认可使用的法人体资质")
    if not copyrights and any(key in " ".join(tender.get("keywords", [])) for key in ["软件", "平台", "系统", "AI", "数据"]):
        gaps.append("需确认可复用软著")
    if tender["budget"] == "预算未披露":
        gaps.append("预算未披露，需评估投入产出")

    return {
        "status": status,
        "score": score,
        "entity": entity,
        "certifications": certifications,
        "copyrights": copyrights,
        "cases": cases,
        "gaps": gaps or ["暂无明显能力缺口"],
        "departments": ["售前团队", "资质管理团队"] if score >= 12 else ["销售负责人", "解决方案团队"],
        "matched_capabilities": matches,
    }


def format_capability(item):
    cert_no = f"（{item['certificate_no']}）" if item.get("certificate_no") else ""
    expires_at = f"，有效期至{item['expires_at']}" if item.get("expires_at") else ""
    return f"{item['company']}：{item['name']}{cert_no}{expires_at}"


def _capability_gaps(tender, hit_tags, hit_copyrights, hit_cases):
    gaps = []
    if "等保" in tender["keywords"] and "等保" not in hit_tags:
        gaps.append("需确认等保资质使用主体")
    if not hit_copyrights:
        gaps.append("需确认可复用软著")
    if not hit_cases:
        gaps.append("需补充同类案例")
    if tender["budget"] == "预算未披露":
        gaps.append("预算未披露，需评估投入产出")
    return gaps or ["暂无明显能力缺口"]


def _risk(tender):
    sample = RISK_SAMPLES.get(tender["buyer"])
    if sample:
        return sample
    return {
        "level": "中",
        "payment": "中",
        "feasibility": "中",
        "notes": ["暂无内部历史合作记录", "外部公开信息未发现明显经营异常，需进一步核验"],
    }


def _risk_score(risk):
    return {"低": 20, "中": 12, "高": 4}.get(risk["level"], 10)


def _parse_notice(tender):
    project_type = "软件平台建设"
    if "运维" in tender["keywords"]:
        project_type = "运维平台建设"
    if "硬件采购" in tender["keywords"]:
        project_type = "硬件集成采购"
    if "云平台" in tender["keywords"]:
        project_type = "云资源管理"
    return {
        "project_name": tender["title"].replace("公开招标公告", "").replace("采购项目", "项目"),
        "project_type": project_type,
        "industry": _infer_industry(tender),
        "keywords": tender["keywords"],
        "summary": tender["raw_summary"],
        "possible_qualifications": tender["requirements"],
        "initial_risks": ["预算金额未知"] if tender["budget"] == "预算未披露" else [],
    }


def _infer_industry(tender):
    text = tender["buyer"] + " ".join(tender["keywords"])
    if "政务" in text or "教育局" in text:
        return "政企/公共事业"
    if "能源" in text:
        return "能源"
    if "制造" in text:
        return "制造"
    if "金融" in text:
        return "金融"
    return "通用行业"


def enrich_tender(tender):
    item = deepcopy(tender)
    item["parsed"] = _parse_notice(item)
    item["customer_match"] = _customer_match(item)
    item["capability_match"] = _capability_match(item)
    item["risk"] = _risk(item)
    score = item["customer_match"]["score"] + item["capability_match"]["score"] + _risk_score(item["risk"])
    if item["notice_type"] == "单一来源公示":
        score -= 8
    item["score"] = max(min(score, 100), 0)
    item["recommendation_level"] = next(label for threshold, label in LEVELS if item["score"] >= threshold)
    item["recommendation_reasons"] = _reasons(item)
    item["next_steps"] = _next_steps(item)
    if item.get("qwen_analysis"):
        _apply_qwen_analysis(item, item["qwen_analysis"])
    item["draft_created"] = False
    return item


def _apply_qwen_analysis(item, analysis):
    item["parsed"]["summary"] = analysis.get("summary") or item["parsed"]["summary"]
    item["parsed"]["project_type"] = analysis.get("project_type") or item["parsed"]["project_type"]
    item["parsed"]["industry"] = analysis.get("industry") or item["parsed"]["industry"]
    item["score"] = analysis.get("score", item["score"])
    item["recommendation_level"] = analysis.get("recommendation_level", item["recommendation_level"])
    item["customer_match"]["status"] = analysis.get("customer_status", item["customer_match"]["status"])
    item["capability_match"]["status"] = analysis.get("capability_status", item["capability_match"]["status"])
    item["risk"]["level"] = analysis.get("risk_level", item["risk"]["level"])
    if analysis.get("risks"):
        item["risk"]["notes"] = analysis["risks"]
    if analysis.get("reasons"):
        item["recommendation_reasons"] = analysis["reasons"]
    if analysis.get("next_steps"):
        item["next_steps"] = analysis["next_steps"]


def _reasons(item):
    reasons = [item["customer_match"]["reason"]]
    reasons.append(f"能力匹配结果为{item['capability_match']['status']}，推荐法人体为{item['capability_match']['entity']}。")
    reasons.append(f"企业风险等级为{item['risk']['level']}，回款风险为{item['risk']['payment']}。")
    if item["score"] >= 80:
        reasons.append("建议优先关注并组织售前进行初步判断。")
    elif item["score"] >= 60:
        reasons.append("建议进入观察池，补齐资质和预算信息后再判断。")
    else:
        reasons.append("当前匹配度偏低，建议谨慎投入售前资源。")
    return reasons


def _next_steps(item):
    steps = ["查看原始公告并确认截止时间", "由销售确认客户背景和预算信息"]
    if item["score"] >= 70:
        steps.append("生成线索草稿并邀请售前团队评估")
    if item["capability_match"]["gaps"]:
        steps.append("确认能力缺口：" + "；".join(item["capability_match"]["gaps"]))
    return steps


def list_tenders(filters=None, extra_tenders=None, include_seed=False):
    filters = filters or {}
    source_tenders = [*(TENDERS if include_seed else []), *(extra_tenders or [])]
    items = [enrich_tender(tender) for tender in source_tenders]
    level = filters.get("level")
    risk = filters.get("risk")
    customer = filters.get("customer")
    capability = filters.get("capability")
    query = filters.get("q", "").strip()

    if level:
        items = [item for item in items if item["recommendation_level"] == level]
    if risk:
        items = [item for item in items if item["risk"]["level"] == risk]
    if customer:
        items = [item for item in items if item["customer_match"]["status"] == customer]
    if capability:
        items = [item for item in items if item["capability_match"]["status"] == capability]
    if query:
        items = [item for item in items if query in item["title"] or query in item["buyer"]]

    return sorted(items, key=lambda item: item["score"], reverse=True)


def get_tender(tender_id, extra_tenders=None):
    for tender in list_tenders({}, extra_tenders):
        if tender["id"] == tender_id:
            return tender
    return None


def overview(extra_tenders=None):
    items = list_tenders({}, extra_tenders)
    relevant_items = [item for item in items if item["score"] >= 20]
    high_priority = [item for item in items if item["recommendation_level"] == "高优先级"]
    existing_customers = [item for item in items if item["customer_match"]["status"] == "已有客户"]
    capability_matched = [item for item in items if item["capability_match"]["status"] in ["高度匹配", "部分匹配"]]
    risk_alerts = [item for item in items if item["risk"]["level"] != "低"]
    draftable = [item for item in items if item["score"] >= 70]
    saved_hours = round(len(items) * 0.25, 1)

    metrics = {
        "scanned": len(items),
        "ai_relevant": len(relevant_items),
        "high_priority": len(high_priority),
        "existing_customers": len(existing_customers),
        "capability_matched": len(capability_matched),
        "risk_alerts": len(risk_alerts),
        "saved_hours": saved_hours,
        "draftable": len(draftable),
    }
    return {
        "date": date.today().isoformat(),
        "metrics": metrics,
        "metric_details": _metric_details(items, metrics, relevant_items),
        "value_metrics": {
            "monthly_scanned": len(items),
            "monthly_relevant": len(relevant_items),
            "monthly_high_priority": len(high_priority),
            "confirmed_followups": 0,
            "converted_opportunities": 0,
            "estimated_amount": _estimated_amount(items),
            "saved_hours": saved_hours,
            "filtered_low_fit": len(items) - len(relevant_items),
        },
        "top_recommendations": items[:4],
    }


def _metric_details(items, metrics, relevant_items):
    high_priority = [item for item in items if item["recommendation_level"] == "高优先级"]
    existing_customers = [item for item in items if item["customer_match"]["status"] == "已有客户"]
    capability_matched = [item for item in items if item["capability_match"]["status"] in ["高度匹配", "部分匹配"]]
    risk_alerts = [item for item in items if item["risk"]["level"] != "低"]
    draftable = [item for item in items if item["score"] >= 70]

    return {
        "scanned": [_metric_row(item, "已扫描", "真实抓取页面已进入本周扫描池。") for item in items],
        "ai_relevant": [_metric_row(item, "AI 初筛相关", "命中行业、客户或能力关键词，建议进入人工复核。") for item in relevant_items],
        "high_priority": [_metric_row(item, "高优先级推荐", "综合评分达到高优先级阈值。") for item in high_priority],
        "existing_customers": [_metric_row(item, "已有客户相关", f"客户负责人：{item['customer_match']['owner']}。") for item in existing_customers],
        "capability_matched": [_metric_row(item, "资质/软著匹配", f"推荐法人体：{item['capability_match']['entity']}。") for item in capability_matched],
        "risk_alerts": [_metric_row(item, "风险提示", "；".join(item["risk"]["notes"])) for item in risk_alerts],
        "saved_hours": _saved_hour_rows(items),
        "draftable": [_metric_row(item, "可生成草稿", "信息完整度满足线索或商机草稿生成条件。") for item in draftable],
    }


def _metric_row(item, status, note):
    return {
        "id": item["id"],
        "title": item["title"],
        "buyer": item["buyer"],
        "published_at": item["published_at"],
        "notice_type": item["notice_type"],
        "score": item["score"],
        "recommendation_level": item["recommendation_level"],
        "customer_status": item["customer_match"]["status"],
        "capability_status": item["capability_match"]["status"],
        "risk_level": item["risk"]["level"],
        "status": status,
        "note": note,
    }


def _saved_hour_rows(items):
    return [
        {
            **_metric_row(item, "节省 0.25h", "自动抓取页面、提取标题/采购单位/日期/正文摘要，替代人工打开页面和复制关键信息。"),
            "score": 0.25,
        }
        for item in items
    ]


def _estimated_amount(items):
    amount = 0
    for item in items:
        budget = str(item.get("budget", ""))
        if "万元" in budget:
            number = budget.replace("万元", "").replace(" ", "").replace(",", "")
            try:
                amount += float(number)
            except ValueError:
                pass
    if amount <= 0:
        return "待确认"
    return f"{amount:g} 万元"


def create_draft(tender_id, draft_type, extra_tenders=None):
    tender = get_tender(tender_id, extra_tenders)
    if not tender:
        return None
    return {
        "id": f"draft-{tender_id}-{draft_type}",
        "type": "商机草稿" if draft_type == "opportunity" else "线索草稿",
        "status": "草稿",
        "tender_id": tender_id,
        "project_name": tender["parsed"]["project_name"],
        "customer_name": tender["buyer"],
        "source": tender["source"],
        "source_url": tender["source_url"],
        "summary": tender["parsed"]["summary"],
        "recommendation_level": tender["recommendation_level"],
        "score": tender["score"],
        "recommendation_reasons": tender["recommendation_reasons"],
        "risk_notes": tender["risk"]["notes"],
        "departments": tender["capability_match"]["departments"],
        "owner": tender["customer_match"]["owner"],
    }
