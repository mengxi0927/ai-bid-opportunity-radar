from datetime import datetime
from hashlib import md5
from html import unescape
import re
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen


CECBID_HOST = "www.cecbid.org.cn"
LIST_SOURCES = [
    ("招标公告", "https://www.cecbid.org.cn/tenders/list"),
    ("意向预告", "https://www.cecbid.org.cn/previews/list"),
    ("中标公告", "https://www.cecbid.org.cn/results/list"),
    ("重点推荐", "https://www.cecbid.org.cn/vips/list"),
    ("招标专栏", "https://www.cecbid.org.cn/specials/list"),
    ("部属单位", "https://www.cecbid.org.cn/miits/list"),
]


class CecbidParseError(RuntimeError):
    pass


def fetch_cecbid_tender(url):
    _validate_url(url)
    html = _download(url)
    title = _extract_title(html)
    content = _extract_content(html)
    buyer = _extract_buyer(html, content)
    published_at = _extract_date(html)

    return {
        "id": "real-" + md5(url.encode("utf-8")).hexdigest()[:12],
        "title": title,
        "buyer": buyer,
        "published_at": published_at,
        "source": "中国招标投标网",
        "source_url": url,
        "notice_type": _infer_notice_type(title, html),
        "budget": _extract_budget(content),
        "deadline": _extract_deadline(content),
        "raw_summary": _summary(content),
        "keywords": _keywords(title + " " + content),
        "requirements": _requirements(content),
        "real_source": True,
    }


def crawl_cecbid_week(week_start, week_end, max_pages_per_source=3, max_items=120):
    found = {}

    for source_name, list_url in LIST_SOURCES:
        for page in range(1, max_pages_per_source + 1):
            page_url = list_url if page == 1 else f"{list_url}?page={page}"
            html = _download(page_url)
            rows = _extract_list_rows(html, source_name)
            if not rows:
                break

            has_week_item = False
            for row in rows:
                published_at = datetime.strptime(row["published_at"], "%Y-%m-%d").date()
                if published_at < week_start:
                    continue
                if published_at > week_end:
                    continue
                has_week_item = True
                found[row["id"]] = row
                if len(found) >= max_items:
                    return list(found.values())

            if not has_week_item and rows:
                oldest = min(datetime.strptime(row["published_at"], "%Y-%m-%d").date() for row in rows)
                if oldest < week_start:
                    break
            time.sleep(0.2)

    return list(found.values())


def _extract_list_rows(html, source_name):
    rows = []
    blocks = re.findall(r'<div class="border-bottom border-light-subtle py-4 mx-2">(.*?)</div>\s*</div>', html, re.S | re.I)
    if not blocks:
        blocks = re.findall(r'<div class="border-bottom border-light-subtle py-4 mx-2">(.*?)(?=<div class="border-bottom border-light-subtle py-4 mx-2">|<div class="d-flex justify-content-center|</div>\s*</div>\s*</div>)', html, re.S | re.I)

    for block in blocks:
        link_match = re.search(r'href="(https://www\.cecbid\.org\.cn/[^"]+/details/[^"]+)"[^>]*>(.*?)</a>', block, re.S | re.I)
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})", block)
        if not link_match or not date_match:
            continue

        url = link_match.group(1)
        title = _clean_html(link_match.group(2))
        buyer = _extract_list_buyer(block)
        published_at = date_match.group(1)
        notice_type = _notice_type_from_source(source_name, title)
        keywords = _keywords(title)

        rows.append({
            "id": "real-" + md5(url.encode("utf-8")).hexdigest()[:12],
            "title": title,
            "buyer": buyer,
            "published_at": published_at,
            "source": f"中国招标投标网-{source_name}",
            "source_url": url,
            "notice_type": notice_type,
            "budget": "预算未披露",
            "deadline": "待确认",
            "raw_summary": f"来自中国招标投标网{source_name}列表页的真实标讯：{title}。采购单位：{buyer}。发布时间：{published_at}。",
            "keywords": keywords,
            "requirements": _requirements(title),
            "real_source": True,
        })

    return rows


def _extract_list_buyer(block):
    smalls = re.findall(r"<small[^>]*>(.*?)</small>", block, re.S | re.I)
    for small in smalls:
        text = _clean_html(small)
        text = re.sub(r"^[\ue900-\uf8ff]?", "", text).strip()
        if text and not re.match(r"^[A-Za-z0-9\-_/（）()]+$", text) and not re.match(r"\d{4}-\d{2}-\d{2}", text):
            return text[:80]
    return "待人工确认"


def _notice_type_from_source(source_name, title):
    if "澄清" in title or "更正" in title or "变更" in title:
        return "澄清及更正公告"
    if source_name == "意向预告":
        return "采购意向"
    if source_name == "中标公告":
        return "中标公告"
    if "磋商" in title:
        return "竞争性磋商"
    if "单一来源" in title:
        return "单一来源公示"
    return "公开招标"


def _validate_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != CECBID_HOST:
        raise CecbidParseError("仅支持 https://www.cecbid.org.cn 下的公开详情页。")


def _download(url):
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; BidOpportunityRadarPOC/0.1; +https://www.cecbid.org.cn)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
        },
    )
    try:
        with urlopen(request, timeout=12) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except Exception as exc:
        raise CecbidParseError(f"无法抓取页面：{exc}") from exc


def _extract_title(html):
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
    if h1:
        return _clean_html(h1.group(1))
    title = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
    if title:
        return _clean_html(title.group(1)).replace(" - 中国招标投标网", "")
    raise CecbidParseError("页面中未识别到项目标题。")


def _extract_content(html):
    match = re.search(r'<div class="[^"]*\bcontent\b[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.S | re.I)
    if not match:
        match = re.search(r'<div class="[^"]*\bcontent\b[^"]*"[^>]*>(.*?)</div>', html, re.S | re.I)
    if not match:
        return _meta_content(html, "description")
    return _clean_html(match.group(1))


def _extract_buyer(html, content):
    description = _meta_content(html, "description")
    match = re.search(r"采购单位：([^，,]+)", description)
    if match:
        return match.group(1).strip()
    match = re.search(r"招标人[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·]{4,60})", content)
    if match:
        return match.group(1).strip(" 。；;，,")
    match = re.search(r"受招标人([^，,。]+)的委托", content)
    if match:
        return match.group(1).strip()
    return "待人工确认"


def _extract_date(html):
    match = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", html)
    if not match:
        return datetime.today().date().isoformat()
    year, month, day = [int(part) for part in match.groups()]
    return datetime(year, month, day).date().isoformat()


def _infer_notice_type(title, html):
    text = title + " " + _clean_html(html[:4000])
    for label in ["澄清及更正公告", "公开招标", "竞争性磋商", "采购意向", "单一来源公示", "中标公告"]:
        if label in text:
            return label
    return "招标公告"


def _extract_budget(content):
    match = re.search(r"预算(?:金额)?[：:\s]*([0-9,.]+)\s*万?元", content)
    if match:
        value = match.group(1).replace(",", "")
        return f"{value} 万元"
    match = re.search(r"([0-9,.]+)\s*万元", content)
    if match:
        return f"{match.group(1).replace(',', '')} 万元"
    return "预算未披露"


def _extract_deadline(content):
    patterns = [
        r"(?:投标截止时间|提交投标文件截止时间|响应文件提交截止时间|截止时间)[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)",
        r"(\d{4}年\d{1,2}月\d{1,2}日)[^。；;]{0,18}(?:前|截止)",
    ]
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            return _cn_date_to_iso(match.group(1))
    return "待确认"


def _cn_date_to_iso(value):
    match = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", value)
    if not match:
        return value
    year, month, day = [int(part) for part in match.groups()]
    return datetime(year, month, day).date().isoformat()


def _summary(content):
    sentences = re.split(r"[。；;]\s*", content)
    useful = [sentence.strip() for sentence in sentences if len(sentence.strip()) >= 12]
    return "。".join(useful[:3])[:260] or content[:260]


def _keywords(text):
    candidates = [
        "AI",
        "数据治理",
        "平台建设",
        "系统集成",
        "运维",
        "等保",
        "云平台",
        "国产化",
        "低代码",
        "知识库",
        "安全审计",
        "机械喷胶",
        "EtherCAT",
        "PROFINET",
        "HMI",
        "设备监控",
    ]
    hits = [keyword for keyword in candidates if keyword.lower() in text.lower()]
    return hits[:6] or ["招标公告", "项目采购"]


def _requirements(content):
    requirements = []
    for keyword in ["资质", "认证", "同类业绩", "案例", "售后", "施工保障", "技术评分", "供货要求"]:
        if keyword in content:
            requirements.append(keyword)
    return requirements[:5] or ["需人工确认投标资格要求", "需人工确认技术要求"]


def _meta_content(html, name):
    match = re.search(rf'<meta[^>]+name=["\']{name}["\'][^>]+content=["\'](.*?)["\']', html, re.S | re.I)
    return unescape(match.group(1)).strip() if match else ""


def _clean_html(value):
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</p\s*>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()
