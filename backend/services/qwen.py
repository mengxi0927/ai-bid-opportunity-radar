import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_MODEL = "qwen-plus"


class QwenAnalysisError(RuntimeError):
    pass


def qwen_configured():
    return bool(os.getenv("DASHSCOPE_API_KEY"))


def analyze_tender_with_qwen(tender, customer_hint=None, capability_hint=None, capability_knowledge=None, opportunity_history=None):
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise QwenAnalysisError("未配置 DASHSCOPE_API_KEY，无法调用千问。")

    payload = {
        "model": os.getenv("QWEN_MODEL", DEFAULT_MODEL),
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是招投标商机分析助手。请只输出 JSON，不要输出 Markdown。"
                    "你需要判断标讯与软件/数据/AI/运维/系统集成类公司的匹配度，"
                    "并给出销售可执行的理由、风险和下一步动作。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "标讯": {
                            "标题": tender.get("title"),
                            "招标方": tender.get("buyer"),
                            "发布日期": tender.get("published_at"),
                            "公告类型": tender.get("notice_type"),
                            "预算": tender.get("budget"),
                            "截止时间": tender.get("deadline"),
                            "关键词": tender.get("keywords", []),
                            "资格要求": tender.get("requirements", []),
                            "正文摘要": tender.get("raw_summary"),
                            "来源链接": tender.get("source_url"),
                        },
                        "客户匹配参考": customer_hint or {},
                        "公司能力参考": capability_hint or {},
                        "真实资质知识库匹配": capability_knowledge or {},
                        "历史商机库匹配": opportunity_history or {},
                        "输出 JSON 字段": {
                            "summary": "100字以内摘要",
                            "project_type": "项目类型",
                            "industry": "行业",
                            "score": "0-100整数",
                            "recommendation_level": "高优先级/中优先级/观察池",
                            "customer_status": "已有客户/潜在客户/未匹配",
                            "capability_status": "高度匹配/部分匹配/低匹配",
                            "risk_level": "低/中/高",
                            "reasons": ["推荐或不推荐理由，3-5条"],
                            "risks": ["风险提示，1-4条"],
                            "next_steps": ["下一步建议，2-5条"],
                        },
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    data = _post_chat_completions(payload, api_key)
    content = data["choices"][0]["message"]["content"]
    analysis = _parse_json(content)
    return _normalize_analysis(analysis, payload["model"])


def _post_chat_completions(payload, api_key):
    base_url = os.getenv("DASHSCOPE_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise QwenAnalysisError(f"千问接口返回 {exc.code}: {body[:300]}") from exc
    except URLError as exc:
        raise QwenAnalysisError(f"无法连接千问接口：{exc}") from exc
    except Exception as exc:
        raise QwenAnalysisError(f"千问分析失败：{exc}") from exc


def _parse_json(content):
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start : end + 1])
        raise QwenAnalysisError("千问返回内容不是合法 JSON。")


def _normalize_analysis(analysis, model):
    score = int(float(analysis.get("score", 0)))
    score = max(0, min(100, score))
    level = analysis.get("recommendation_level") or _level_from_score(score)
    if level not in ["高优先级", "中优先级", "观察池"]:
        level = _level_from_score(score)

    return {
        "provider": "qwen",
        "model": model,
        "summary": str(analysis.get("summary") or ""),
        "project_type": str(analysis.get("project_type") or "待确认"),
        "industry": str(analysis.get("industry") or "通用行业"),
        "score": score,
        "recommendation_level": level,
        "customer_status": _choice(analysis.get("customer_status"), ["已有客户", "潜在客户", "未匹配"], "未匹配"),
        "capability_status": _choice(analysis.get("capability_status"), ["高度匹配", "部分匹配", "低匹配"], "低匹配"),
        "risk_level": _choice(analysis.get("risk_level"), ["低", "中", "高"], "中"),
        "reasons": _string_list(analysis.get("reasons")),
        "risks": _string_list(analysis.get("risks")),
        "next_steps": _string_list(analysis.get("next_steps")),
    }


def _choice(value, allowed, fallback):
    return value if value in allowed else fallback


def _string_list(value):
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()][:6]


def _level_from_score(score):
    if score >= 80:
        return "高优先级"
    if score >= 60:
        return "中优先级"
    return "观察池"
