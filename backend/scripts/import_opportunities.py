from datetime import datetime, timedelta
from pathlib import Path
from zipfile import ZipFile
import json
import re
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
INPUT = Path("/Users/mengxi_yang/Downloads/端到端重塑_售前-商机管理 (2).xlsx")
OUTPUT = ROOT / "data" / "opportunities.json"
NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


FIELD_MAP = {
    "商机号": "opportunity_no",
    "*商机名称": "opportunity_name",
    "销售员": "sales",
    "申请日期": "created_at",
    "*签约客户名称": "contract_customer",
    "客户类别（AI识别）": "customer_category",
    "最终客户名称": "end_customer",
    "*客户属性": "customer_attribute",
    "客户级别": "customer_level",
    "协同营销部门": "co_marketing_department",
    "*交付单元": "delivery_unit",
    "售前人员": "presales",
    "方案负责人": "solution_owner",
    "申请状态": "application_status",
    "审批状态": "approval_status",
    "*项目名称": "project_name",
    "*业务范围": "business_scope",
    "*签约法人体": "legal_entity",
    "*项目类型": "project_type",
    "*客户经理": "customer_manager",
    "项目类型-运维/行业": "project_subtype",
    "*是否有燕云产品机会": "yancloud_opportunity",
    "*预计成单率（%）": "win_rate",
    "*预计签约时间": "expected_sign_date",
    "*预计签约金额（元）": "expected_amount",
    "*预计毛利率（%）": "expected_margin",
    "预计投标时间": "expected_bid_date",
    "实际成单金额（元）": "actual_amount",
    "实际成单时间": "actual_sign_date",
    "商机状态": "status",
    "*所属营销单元": "marketing_unit",
    "政企-方案类型": "solution_type",
    "政企-产品类型": "product_type",
    "预计分包采购金额（元）": "expected_subcontract_amount",
    "预计自有实施金额（元）": "expected_own_delivery_amount",
}


def main():
    rows = load_first_sheet(INPUT)
    header = rows[0]
    records = []
    for index, row in enumerate(rows[1:], start=2):
        values = {header[col]: clean(row[col]) if col < len(row) else "" for col in range(len(header))}
        if not values.get("商机号") and not values.get("*商机名称") and not values.get("*项目名称"):
            continue
        record = normalize_record(values, index)
        records.append(record)

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_file": str(INPUT),
        "stats": stats(records),
        "records": records,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))


def load_first_sheet(path):
    with ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for si in root.findall("main:si", NS):
                shared.append("".join(t.text or "" for t in si.findall(".//main:t", NS)))
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        first_sheet = workbook.find("main:sheets", NS)[0]
        target = relmap[first_sheet.attrib[RID]].lstrip("/")
        sheet_path = target if target.startswith("xl/") else "xl/" + target
        return read_sheet(archive.read(sheet_path), shared)


def read_sheet(xml_bytes, shared):
    root = ET.fromstring(xml_bytes)
    rows = []
    for row in root.findall(".//main:sheetData/main:row", NS):
        values = {}
        for cell in row.findall("main:c", NS):
            index = col_index(cell.attrib.get("r", "A1"))
            value = cell_value(cell, shared)
            if value:
                values[index] = value
        if values:
            rows.append([values.get(index, "") for index in range(max(values) + 1)])
    return rows


def cell_value(cell, shared):
    cell_type = cell.attrib.get("t")
    value = cell.find("main:v", NS)
    inline = cell.find("main:is", NS)
    if cell_type == "s" and value is not None and value.text is not None:
        return shared[int(value.text)].strip()
    if cell_type == "inlineStr" and inline is not None:
        return "".join(t.text or "" for t in inline.findall(".//main:t", NS)).strip()
    if value is not None and value.text is not None:
        return value.text.strip()
    return ""


def col_index(ref):
    match = re.match(r"([A-Z]+)", ref)
    number = 0
    for char in match.group(1):
        number = number * 26 + ord(char) - 64
    return number - 1


def normalize_record(values, row_number):
    record = {
        "id": values.get("商机号") or f"row-{row_number}",
        "row": row_number,
    }
    for source, target in FIELD_MAP.items():
        record[target] = normalize_value(source, values.get(source, ""))
    record["name"] = record.get("project_name") or record.get("opportunity_name")
    record["customer"] = record.get("contract_customer") or record.get("end_customer")
    record["amount"] = number(record.get("actual_amount")) or number(record.get("expected_amount"))
    record["keywords"] = keywords_for(record)
    return record


def normalize_value(field, value):
    value = clean(value)
    if field in ["申请日期", "*预计签约时间", "预计投标时间", "实际成单时间"]:
        return excel_date(value)
    if "金额" in field or "率" in field or "成单率" in field:
        parsed = number(value)
        return parsed if parsed is not None else value
    return value


def clean(value):
    text = str(value).strip()
    return "" if text in ["nan", "None"] else text


def number(value):
    if value in [None, ""]:
        return None
    text = str(value).replace(",", "").replace("%", "").strip()
    try:
        return float(text)
    except ValueError:
        return None


def excel_date(value):
    if not value:
        return ""
    text = str(value).strip()
    if re.match(r"^\d+(\.\d+)?$", text):
        serial = int(float(text))
        if 20000 < serial < 80000:
            return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()
    return text


def keywords_for(record):
    text = " ".join(
        str(record.get(key, ""))
        for key in [
            "opportunity_name", "project_name", "contract_customer", "end_customer",
            "business_scope", "project_type", "project_subtype", "delivery_unit",
            "marketing_unit", "solution_type", "product_type",
        ]
    )
    candidates = [
        "运维", "维保", "供货", "服务器", "算力", "AI", "资产", "软件", "酒店",
        "银行", "金融", "医院", "政务", "教育", "人力资源", "HRO", "云", "数据",
        "安全", "信创", "行业客户", "资产软件",
    ]
    hits = [item for item in candidates if item.lower() in text.lower()]
    tokens = re.findall(r"[\u4e00-\u9fa5A-Za-z0-9]{2,}", text)
    for token in tokens[:8]:
        if token not in hits:
            hits.append(token)
    return hits[:14]


def stats(records):
    by_status = {}
    by_project_type = {}
    by_customer_level = {}
    total_expected = 0
    total_actual = 0
    for record in records:
        by_status[record.get("status") or "未填"] = by_status.get(record.get("status") or "未填", 0) + 1
        by_project_type[record.get("project_subtype") or record.get("project_type") or "未填"] = by_project_type.get(record.get("project_subtype") or record.get("project_type") or "未填", 0) + 1
        by_customer_level[record.get("customer_level") or "未填"] = by_customer_level.get(record.get("customer_level") or "未填", 0) + 1
        total_expected += number(record.get("expected_amount")) or 0
        total_actual += number(record.get("actual_amount")) or 0
    return {
        "total_records": len(records),
        "by_status": dict(sorted(by_status.items())),
        "by_project_type_top": dict(sorted(by_project_type.items(), key=lambda item: item[1], reverse=True)[:12]),
        "by_customer_level": dict(sorted(by_customer_level.items())),
        "total_expected_amount": total_expected,
        "total_actual_amount": total_actual,
    }


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"import failed: {exc}", file=sys.stderr)
        raise
