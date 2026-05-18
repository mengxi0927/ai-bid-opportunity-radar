from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from services.company_capabilities import search_company_capabilities
from services.opportunity_history import customer_history_for_buyer
from services.radar import list_tenders


INDUSTRIES = ["政企", "金融", "教育", "医疗", "能源", "制造"]
REGIONS = ["华东", "华南", "华北", "华中", "西南", "西北"]
TECH_KEYWORDS = ["数据治理", "AI平台", "信创改造", "网络安全", "云资源", "运维服务", "知识库", "智能客服", "数据资产", "等保"]

REGION_HINTS = {
    "华东": ["上海", "江苏", "南京", "苏州", "无锡", "浙江", "杭州", "宁波", "安徽", "合肥", "福建", "福州", "厦门", "山东", "济南", "青岛"],
    "华南": ["广东", "广州", "深圳", "珠海", "佛山", "广西", "南宁", "海南", "海口"],
    "华北": ["北京", "天津", "河北", "石家庄", "山西", "太原", "内蒙古"],
    "华中": ["河南", "郑州", "湖北", "武汉", "湖南", "长沙", "江西", "南昌"],
    "西南": ["重庆", "四川", "成都", "贵州", "贵阳", "云南", "昆明", "西藏"],
    "西北": ["陕西", "西安", "甘肃", "兰州", "青海", "宁夏", "新疆", "乌鲁木齐"],
}

INDUSTRY_HINTS = {
    "政企": ["政务", "政府", "大数据局", "财政", "税务", "公安", "法院", "检察", "监督", "管理局", "事业单位", "公共"],
    "金融": ["银行", "保险", "证券", "金融", "农信", "支付"],
    "教育": ["大学", "学院", "学校", "教育", "教委", "教育厅"],
    "医疗": ["医院", "医疗", "卫生", "药品", "医保", "疾控"],
    "能源": ["能源", "电力", "电网", "燃气", "煤", "石油", "烟草"],
    "制造": ["制造", "机械", "设备", "工厂", "工业", "生产"],
}

KEYWORD_ALIASES = {
    "数据治理": ["数据治理", "数据平台", "数据质量", "数据资产", "大数据"],
    "AI平台": ["AI", "人工智能", "模型", "算法", "智能", "训练"],
    "信创改造": ["信创", "国产化", "适配", "改造"],
    "网络安全": ["网络安全", "安全", "防火墙", "漏洞", "认证"],
    "云资源": ["云资源", "云平台", "云服务", "政务云"],
    "运维服务": ["运维", "维保", "运营", "维护"],
    "知识库": ["知识库", "知识"],
    "智能客服": ["客服", "热线", "坐席"],
    "数据资产": ["数据资产", "资产目录", "数据目录"],
    "等保": ["等保", "等级保护"],
}


def build_market_insights(raw_tenders, filters=None):
    filters = filters or {}
    items = list_tenders({}, raw_tenders)
    scoped = _apply_filters(items, filters)
    previous = _previous_window(items, filters)

    return {
        "filters": {
            "range": filters.get("range") or "本月",
            "industry": filters.get("industry") or "全部",
            "region": filters.get("region") or "全部",
        },
        "data_source": {
            "total_imported": len(raw_tenders or []),
            "filtered_total": len(scoped),
            "latest_date": max([item.get("published_at", "") for item in scoped], default=""),
        },
        "metrics": _metrics(scoped, previous),
        "customer_dynamics": _customer_dynamics(scoped),
        "industry_trends": _industry_trends(scoped, previous),
        "keywords": _keyword_heat(scoped, previous),
        "capabilities": _capability_requirements(scoped),
        "regions": _region_activity(scoped),
        "competitors": _competitor_signals(scoped),
        "summary": _summary(scoped),
    }


def _apply_filters(items, filters):
    range_name = filters.get("range") or "本月"
    industry = filters.get("industry") or "全部"
    region = filters.get("region") or "全部"
    start, end = _date_window(range_name)
    scoped = []
    for item in items:
        published = _parse_date(item.get("published_at"))
        if not published or published < start or published > end:
            continue
        if industry != "全部" and _infer_industry(item) != industry:
            continue
        if region != "全部" and _infer_region(item) != region:
            continue
        scoped.append(item)
    return scoped


def _previous_window(items, filters):
    range_name = filters.get("range") or "本月"
    industry = filters.get("industry") or "全部"
    region = filters.get("region") or "全部"
    start, end = _date_window(range_name)
    days = max(1, (end - start).days + 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    scoped = []
    for item in items:
        published = _parse_date(item.get("published_at"))
        if not published or published < prev_start or published > prev_end:
            continue
        if industry != "全部" and _infer_industry(item) != industry:
            continue
        if region != "全部" and _infer_region(item) != region:
            continue
        scoped.append(item)
    return scoped


def _date_window(range_name):
    today = date.today()
    if range_name == "今日":
        return today, today
    if range_name == "近7天":
        return today - timedelta(days=6), today
    if range_name == "近30天":
        return today - timedelta(days=29), today
    return today.replace(day=1), today


def _parse_date(value):
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None


def _metrics(items, previous):
    existing = [item for item in items if item["customer_match"]["status"] == "已有客户"]
    key_customers = [item for item in items if item["customer_match"].get("priority") in ["A", "B"] and item["customer_match"]["status"] != "未匹配"]
    capability_gaps = [item for item in items if item["capability_match"]["status"] in ["部分匹配", "低匹配"]]
    competitors = _competitor_signal_items(items)
    return [
        _metric("本月扫描标讯", len(items), _delta(len(items), len(previous)), "来自已导入真实标讯池，随筛选条件动态变化。"),
        _metric("AI识别市场信号", len([item for item in items if item["score"] >= 20]), _delta(len(items), len(previous)), "命中行业、客户、关键词或能力要求的标讯。"),
        _metric("已有客户动态", len(existing), _delta(len(existing), len([item for item in previous if item["customer_match"]["status"] == "已有客户"])), "存量客户近期公开采购动作。"),
        _metric("重点客户动态", len(key_customers), _delta(len(key_customers), len(previous)), "重点或历史客户出现连续需求变化。"),
        _metric("发现能力缺口", len(capability_gaps), _delta(len(capability_gaps), len(previous)), "资质、案例、软著或交付资源存在补齐空间。"),
        _metric("竞争信号", len(competitors), _delta(len(competitors), len(_competitor_signal_items(previous))), "从中标、成交、结果类公告中识别外部竞争动作。"),
    ]


def _metric(label, value, change, note):
    return {"label": label, "value": value, "change": change, "note": note}


def _delta(current, previous):
    if previous <= 0:
        return "+100%" if current > 0 else "0%"
    value = round((current - previous) / previous * 100)
    return f"{value:+d}%"


def _customer_dynamics(items):
    grouped = defaultdict(list)
    for item in items:
        buyer = item.get("buyer") or "待人工确认"
        if buyer == "待人工确认":
            continue
        grouped[buyer].append(item)

    rows = []
    for buyer, buyer_items in grouped.items():
        latest = max(buyer_items, key=lambda item: item.get("published_at", ""))
        customer_match = latest["customer_match"]
        status = customer_match["status"]
        if customer_match.get("priority") == "A" and status != "未匹配":
            customer_type = "重点客户"
        elif status == "已有客户":
            customer_type = "已有客户"
        else:
            customer_type = "新客户"
        rows.append({
            "customer_name": buyer,
            "customer_type": customer_type,
            "notice_count": len(buyer_items),
            "directions": _top_terms(buyer_items, 2),
            "latest_published_at": latest.get("published_at", ""),
            "suggested_action": _customer_action(customer_type, len(buyer_items)),
        })
    rows.sort(key=lambda row: (row["notice_count"], row["latest_published_at"]), reverse=True)
    return rows[:8]


def _customer_action(customer_type, count):
    if customer_type == "已有客户" and count >= 2:
        return "建议24小时内跟进"
    if customer_type == "重点客户":
        return "进入重点观察"
    return "建议分配销售关注"


def _industry_trends(items, previous):
    current_counts = Counter(_infer_industry(item) for item in items)
    previous_counts = Counter(_infer_industry(item) for item in previous)
    rows = []
    for industry, count in current_counts.most_common():
        rows.append({
            "industry": industry,
            "notice_count": count,
            "change": _delta(count, previous_counts[industry]),
            "keywords": _top_terms([item for item in items if _infer_industry(item) == industry], 3),
            "suggestion": _attention_label(count),
        })
    return rows[:5]


def _keyword_heat(items, previous):
    previous_counts = _keyword_counts(previous)
    rows = []
    for keyword, count in _keyword_counts(items).most_common():
        rows.append({"label": keyword, "count": count, "change": _delta(count, previous_counts[keyword])})
    return rows[:10]


def _keyword_counts(items):
    counts = Counter()
    for item in items:
        text = _item_text(item)
        for keyword, aliases in KEYWORD_ALIASES.items():
            if any(alias.lower() in text.lower() for alias in aliases):
                counts[keyword] += 1
    for keyword in TECH_KEYWORDS:
        counts.setdefault(keyword, 0)
    return counts


def _capability_requirements(items):
    definitions = [
        ("等保相关能力", ["等保", "等级保护", "安全"], "确认证书使用主体"),
        ("同类项目案例", ["案例", "业绩", "同类项目"], "补充案例标签"),
        ("AI平台类软著", ["AI", "人工智能", "模型", "智能"], "补充软著或替代材料"),
        ("本地化驻场服务", ["驻场", "本地化", "现场", "运维"], "确认交付资源"),
        ("CMMI / ISO", ["CMMI", "ISO", "认证"], "维护有效期"),
    ]
    rows = []
    for name, aliases, action in definitions:
        matched_items = [item for item in items if any(alias.lower() in _item_text(item).lower() for alias in aliases)]
        entities = []
        strong_matches = 0
        for item in matched_items[:12]:
            matches = search_company_capabilities(item, limit=5)
            if matches:
                strong_matches += 1
                entities.extend([match.get("company") for match in matches if match.get("company")])
        status = "未覆盖"
        if matched_items and strong_matches >= max(1, len(matched_items) // 2):
            status = "已覆盖"
        elif matched_items and strong_matches > 0:
            status = "部分覆盖"
        rows.append({
            "name": name,
            "count": len(matched_items),
            "status": status,
            "entity": _entity_label(entities),
            "action": action,
        })
    return rows


def _region_activity(items):
    grouped = defaultdict(list)
    for item in items:
        grouped[_infer_region(item)].append(item)
    rows = []
    for region in REGIONS:
        region_items = grouped.get(region, [])
        customers = {item["buyer"] for item in region_items if item.get("buyer") and item["buyer"] != "待人工确认"}
        rows.append({
            "region": region,
            "notice_count": len(region_items),
            "related_count": len([item for item in region_items if item["score"] >= 20]),
            "directions": _top_terms(region_items, 2),
            "active_customers": len(customers),
            "suggestion": _attention_label(len(region_items)),
        })
    return rows


def _competitor_signals(items):
    signals = _competitor_signal_items(items)
    rows = []
    for item in signals[:8]:
        rows.append({
            "company": _extract_winner(item),
            "wins": 1,
            "industry": _infer_industry(item),
            "capability": _top_terms([item], 1),
            "existing_customer": "是" if item["customer_match"]["status"] == "已有客户" else "否",
            "action": "关注客户二期机会" if item["customer_match"]["status"] == "已有客户" else "持续观察",
        })
    return rows


def _competitor_signal_items(items):
    markers = ["中标", "成交", "结果", "候选人"]
    return [item for item in items if any(marker in _item_text(item) for marker in markers)]


def _extract_winner(item):
    text = item.get("raw_summary") or item.get("title", "")
    for marker in ["中标人：", "成交供应商：", "供应商名称："]:
        if marker in text:
            return text.split(marker, 1)[1].split("。", 1)[0].split("，", 1)[0][:24]
    return "待从公告正文抽取"


def _summary(items):
    customer_rows = _customer_dynamics(items)
    industry_rows = _industry_trends(items, [])
    capability_rows = _capability_requirements(items)
    top_customer = customer_rows[0] if customer_rows else None
    top_industries = "、".join([row["industry"] for row in industry_rows[:2]]) or "暂无明显行业集中"
    gaps = [row["name"] for row in capability_rows if row["status"] != "已覆盖"][:2]
    return {
        "sales": [
            f"{top_customer['customer_name']}近期发布{top_customer['notice_count']}条相关标讯，建议销售结合需求方向（{top_customer['directions']}）快速确认后续规划。" if top_customer else "当前筛选条件下暂无明确客户连续动态，建议扩大时间范围观察。",
            "对已有客户或重点客户的中标、成交、澄清公告建立二次机会提醒。"
        ],
        "management": [
            f"{top_industries}行业需求活跃，建议管理层关注行业解决方案复用。",
            "公开标讯的变化可作为客户预算方向和采购周期变化的外部信号。"
        ],
        "capability": [
            f"{'、'.join(gaps)}存在覆盖不足或需确认主体，建议补齐材料标签。" if gaps else "当前高频能力要求整体覆盖较好，建议维护证书有效期。",
            "建议把资质、软著、案例和区域交付资源继续结构化，便于后续自动匹配。"
        ],
    }


def _top_terms(items, limit):
    counts = Counter()
    for item in items:
        for keyword in item.get("parsed", {}).get("keywords", []) + item.get("keywords", []):
            if keyword not in ["招标公告", "项目采购"]:
                counts[keyword] += 1
        for keyword, aliases in KEYWORD_ALIASES.items():
            text = _item_text(item)
            if any(alias.lower() in text.lower() for alias in aliases):
                counts[keyword] += 1
    return " / ".join([term for term, _ in counts.most_common(limit)]) or "待人工归类"


def _infer_industry(item):
    analysis_industry = item.get("qwen_analysis", {}).get("industry") or item.get("parsed", {}).get("industry", "")
    text = f"{analysis_industry} {_item_text(item)}"
    for industry, hints in INDUSTRY_HINTS.items():
        if any(hint in text for hint in hints):
            return industry
    return "政企"


def _infer_region(item):
    text = _item_text(item)
    for region, hints in REGION_HINTS.items():
        if any(hint in text for hint in hints):
            return region
    return "华东"


def _item_text(item):
    return " ".join([
        item.get("title", ""),
        item.get("buyer", ""),
        item.get("notice_type", ""),
        item.get("source", ""),
        item.get("raw_summary", ""),
        " ".join(item.get("keywords", [])),
        " ".join(item.get("requirements", [])),
        item.get("parsed", {}).get("summary", ""),
    ])


def _attention_label(count):
    if count >= 30:
        return "高度关注"
    if count >= 12:
        return "持续关注"
    if count >= 5:
        return "重点观察"
    if count > 0:
        return "观察"
    return "暂无新增"


def _entity_label(entities):
    unique = [item for item in dict.fromkeys(entities) if item]
    if not unique:
        return "暂无"
    if len(unique) > 1:
        return "多法人体"
    return unique[0]
