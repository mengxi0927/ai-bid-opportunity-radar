from copy import deepcopy
from datetime import datetime
from hashlib import md5
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "risk_customers.json"
QCC_BASE_URL = "https://api.qichacha.com"
CALL_STATE = {"used": 0}


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _load_customers():
    if not DATA_PATH.exists():
        return []
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def _save_customers(customers):
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(customers, ensure_ascii=False, indent=2), encoding="utf-8")


def free_call_limit():
    try:
        return int(os.getenv("QCC_MAX_FREE_CALLS", "20"))
    except ValueError:
        return 20


def remaining_calls():
    return max(0, free_call_limit() - CALL_STATE["used"])


def qcc_configured():
    return bool(os.getenv("QCC_APP_KEY") and os.getenv("QCC_SECRET_KEY"))


def _risk_level(score):
    if score >= 60:
        return "高风险"
    if score >= 30:
        return "中风险"
    return "低风险"


def _suggestion(level):
    return {
        "低风险": "可正常跟进",
        "中风险": "建议销售进一步确认",
        "高风险": "建议暂缓跟进",
    }.get(level, "建议谨慎推进")


def calculate_risk_score(signal):
    score = 0
    tags = []
    status = signal.get("registrationStatus", "")
    if status and status not in ["存续", "在业", "正常"]:
        score += 30
        tags.append("登记状态异常")
    if signal.get("dishonest"):
        score += 30
        tags.append("失信被执行人")
    if signal.get("executor"):
        score += 20
        tags.append("被执行人")
    if signal.get("abnormal"):
        score += 20
        tags.append("经营异常")
    if signal.get("seriousViolation"):
        score += 35
        tags.append("严重违法")
    if signal.get("penalty"):
        score += 10
        tags.append("行政处罚")
        if signal.get("largePenalty"):
            score += 10
            tags.append("大额处罚")
    for key, label, weight in [
        ("equityFreeze", "股权冻结", 15),
        ("mortgage", "动产抵押", 10),
        ("liquidation", "清算风险", 20),
        ("bankruptcy", "破产重整", 25),
    ]:
        if signal.get(key):
            score += weight
            tags.append(label)
    if signal.get("lowTaxCredit"):
        score += 10
        tags.append("纳税信用偏低")
    score = min(score, 100)
    if not tags:
        tags = ["登记状态正常", "未见重大负面风险"]
    return score, _risk_level(score), tags


def _risk_items(signal):
    return [
        {
            "name": "工商状态风险",
            "level": "中风险" if signal.get("registrationStatus") not in ["存续", "在业", "正常"] else "低风险",
            "hit": signal.get("registrationStatus") not in ["存续", "在业", "正常"],
            "summary": f"登记状态：{signal.get('registrationStatus', '待确认')}。",
        },
        {
            "name": "司法/执行风险",
            "level": "高风险" if signal.get("dishonest") else "中风险" if signal.get("executor") else "低风险",
            "hit": bool(signal.get("dishonest") or signal.get("executor")),
            "summary": "命中失信或被执行记录。" if signal.get("dishonest") or signal.get("executor") else "未发现明显执行风险。",
        },
        {
            "name": "行政处罚风险",
            "level": "中风险" if signal.get("penalty") else "低风险",
            "hit": bool(signal.get("penalty")),
            "summary": "命中行政处罚记录。" if signal.get("penalty") else "未命中重大行政处罚。",
        },
        {
            "name": "经营异常风险",
            "level": "高风险" if signal.get("seriousViolation") else "中风险" if signal.get("abnormal") else "低风险",
            "hit": bool(signal.get("abnormal") or signal.get("seriousViolation")),
            "summary": "命中经营异常或严重违法记录。" if signal.get("abnormal") or signal.get("seriousViolation") else "未命中经营异常。",
        },
        {
            "name": "税务/信用风险",
            "level": "中风险" if signal.get("lowTaxCredit") else "低风险",
            "hit": bool(signal.get("lowTaxCredit")),
            "summary": "纳税信用等级偏低。" if signal.get("lowTaxCredit") else "未发现明显税务信用风险。",
        },
        {
            "name": "股权/抵押/清算风险",
            "level": "高风险" if signal.get("bankruptcy") or signal.get("liquidation") else "中风险" if signal.get("equityFreeze") or signal.get("mortgage") else "低风险",
            "hit": bool(signal.get("equityFreeze") or signal.get("mortgage") or signal.get("liquidation") or signal.get("bankruptcy")),
            "summary": "命中冻结、抵押、清算或破产相关风险。" if signal.get("equityFreeze") or signal.get("mortgage") or signal.get("liquidation") or signal.get("bankruptcy") else "未发现冻结、抵押、清算或破产风险。",
        },
    ]


def _mock_signal(company_name):
    if "某智慧" in company_name:
        return {"registrationStatus": "存续", "executor": True, "abnormal": True, "penalty": True, "equityFreeze": True}
    if "烟机" in company_name:
        return {"registrationStatus": "存续", "executor": True, "penalty": True}
    if "科学院" in company_name:
        return {"registrationStatus": "正常", "mortgage": True}
    if "待人工确认" in company_name:
        raise QccScanError("扫描失败，请稍后重试")
    return {"registrationStatus": "存续"}


def _mock_basic_info(company_name, signal):
    return {
        "companyName": company_name,
        "creditCode": "待接口返回",
        "legalRepresentative": "待接口返回",
        "establishedDate": "待接口返回",
        "registeredCapital": "待接口返回",
        "registrationStatus": signal.get("registrationStatus", "存续"),
        "industry": "待接口返回",
        "businessScopeSummary": "企查查接口未配置时使用 Demo 风险结果，后续可替换为真实工商信息。",
    }


def _build_detail(company_name, basic_info, signal):
    score, level, tags = calculate_risk_score(signal)
    hit_count = sum(1 for item in tags if item not in ["登记状态正常", "未见重大负面风险"])
    reason = "未命中重大负面风险，因此判定为低风险。"
    if hit_count:
        reason = f"命中 {hit_count} 项风险：{'、'.join(tags)}，因此判定为{level}。"
    return {
        "basicInfo": basic_info,
        "riskScore": score,
        "riskLevel": level,
        "riskTags": tags,
        "riskReasons": [reason],
        "riskItems": _risk_items(signal),
        "suggestion": _suggestion(level),
    }


class QccScanError(Exception):
    pass


def _qcc_token(app_key, secret_key, timespan):
    return md5(f"{app_key}{timespan}{secret_key}".encode("utf-8")).hexdigest().upper()


def _call_qcc(api_path, search_key):
    app_key = os.getenv("QCC_APP_KEY", "")
    secret_key = os.getenv("QCC_SECRET_KEY", "")
    timespan = str(int(datetime.now().timestamp()))
    token = _qcc_token(app_key, secret_key, timespan)
    query = urlencode({"key": app_key, "searchKey": search_key})
    request = Request(
        f"{QCC_BASE_URL}{api_path}?{query}",
        headers={"Token": token, "Timespan": timespan},
        method="GET",
    )
    try:
        with urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise QccScanError(f"企查查接口调用失败：{exc}") from exc


def _parse_qcc_result(company_name, risk_payload, basic_payload):
    # Different QCC products return slightly different shapes. Keep parsing defensive for demo.
    result = risk_payload.get("Result") or risk_payload.get("result") or {}
    basic_result = basic_payload.get("Result") or basic_payload.get("result") or {}
    signal = {
        "registrationStatus": basic_result.get("Status") or basic_result.get("RegStatus") or result.get("Status") or "存续",
        "dishonest": bool(result.get("ShiXinCount") or result.get("DishonestCount")),
        "executor": bool(result.get("ZhiXingCount") or result.get("ExecutorCount")),
        "abnormal": bool(result.get("OpExceptionCount") or result.get("AbnormalCount")),
        "seriousViolation": bool(result.get("IllegalCount") or result.get("SeriousViolationCount")),
        "penalty": bool(result.get("PenaltyCount") or result.get("AdministrativePenaltyCount")),
        "equityFreeze": bool(result.get("EquityFreezeCount")),
        "mortgage": bool(result.get("MortgageCount")),
        "liquidation": bool(result.get("LiquidationCount")),
        "bankruptcy": bool(result.get("BankruptcyCount")),
        "lowTaxCredit": bool(result.get("TaxViolationCount")),
    }
    basic_info = {
        "companyName": basic_result.get("Name") or company_name,
        "creditCode": basic_result.get("CreditCode") or basic_result.get("No") or "待接口返回",
        "legalRepresentative": basic_result.get("OperName") or basic_result.get("LegalPerson") or "待接口返回",
        "establishedDate": basic_result.get("StartDate") or "待接口返回",
        "registeredCapital": basic_result.get("RegistCapi") or "待接口返回",
        "registrationStatus": signal["registrationStatus"],
        "industry": basic_result.get("Industry") or "待接口返回",
        "businessScopeSummary": (basic_result.get("Scope") or "待接口返回")[:120],
    }
    return _build_detail(company_name, basic_info, signal)


def list_risk_customers():
    customers = _load_customers()
    scanned = sum(1 for item in customers if item.get("scanStatus") == "scanned")
    high_risk = sum(1 for item in customers if item.get("riskLevel") == "高风险")
    return {
        "items": customers,
        "summary": {
            "identifiedCustomers": len(customers),
            "completedScans": scanned,
            "highRiskCustomers": high_risk,
            "remainingFreeCalls": remaining_calls(),
            "qccConfigured": qcc_configured(),
        },
    }


def scan_company(company_name):
    customers = _load_customers()
    customer = next((item for item in customers if item.get("companyName") == company_name), None)
    cached = next(
        (item for item in customers if item.get("companyName") == company_name and item.get("scanStatus") == "scanned" and item.get("detail")),
        None,
    )
    if cached:
        return {"item": cached, "remainingFreeCalls": remaining_calls(), "cached": True}
    if remaining_calls() <= 0:
        raise QccScanError("免费查询次数已用完")

    CALL_STATE["used"] += 1
    try:
        if qcc_configured():
            risk_payload = _call_qcc("/ECIV4/RiskScan/GetRiskScan", company_name)
            basic_payload = _call_qcc("/ECIV4/GetBasicDetailsByName", company_name)
            detail = _parse_qcc_result(company_name, risk_payload, basic_payload)
        else:
            signal = _mock_signal(company_name)
            detail = _build_detail(company_name, _mock_basic_info(company_name, signal), signal)
    except QccScanError:
        if customer:
            customer["scanStatus"] = "failed"
            customer["riskLevel"] = "待扫描"
            customer["riskScore"] = 0
            customer["riskTags"] = ["扫描失败，请稍后重试"]
            customer["lastScanTime"] = _now()
            customer["detail"] = None
            _save_customers(customers)
        raise

    if not customer:
        customer = {
            "id": f"risk-{len(customers) + 1:03d}",
            "companyName": company_name,
            "tenderTitle": "手动风险扫描",
            "tenderPriority": "中",
            "isExistingCustomer": False,
        }
        customers.append(customer)

    customer.update({
        "scanStatus": "scanned",
        "riskLevel": detail["riskLevel"],
        "riskScore": detail["riskScore"],
        "riskTags": detail["riskTags"],
        "lastScanTime": _now(),
        "detail": deepcopy(detail),
    })
    _save_customers(customers)
    return {"item": customer, "remainingFreeCalls": remaining_calls(), "cached": False}
