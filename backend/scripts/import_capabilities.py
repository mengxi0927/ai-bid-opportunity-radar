from datetime import datetime, timedelta
from pathlib import Path
from zipfile import ZipFile
import json
import re
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "capabilities.json"
INPUTS = [
    Path("/Users/mengxi_yang/Downloads/P9&PG资质20260414xlsx.xlsx"),
    Path("/Users/mengxi_yang/Downloads/智慧城市P9法人体资质清单20251202.xlsx"),
    Path("/Users/mengxi_yang/Downloads/PG法人体资质清单20260427.xlsx"),
]

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def main():
    records = []
    for path in INPUTS:
        records.extend(import_workbook(path))

    deduped = dedupe(records)
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_files": [str(path) for path in INPUTS],
        "stats": stats(deduped),
        "records": deduped,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))


def import_workbook(path):
    if not path.exists():
        raise FileNotFoundError(path)

    rows_by_sheet = load_xlsx_rows(path)
    records = []
    for sheet_name, rows in rows_by_sheet.items():
        if not rows:
            continue
        header = normalize_headers(rows[0])
        group_value = ""
        for row_number, row in enumerate(rows[1:], start=2):
            values = row_to_dict(header, row)
            if not any(values.values()):
                continue
            if values.get("序号") and not re.match(r"^\d+(\.0)?$", str(values["序号"])):
                continue

            group_value = values.get("分组") or group_value
            record = normalize_record(path, sheet_name, row_number, values, group_value)
            if record["name"]:
                records.append(record)
    return records


def load_xlsx_rows(path):
    with ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for si in root.findall("main:si", NS):
                shared.append("".join(t.text or "" for t in si.findall(".//main:t", NS)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        result = {}
        for sheet in workbook.find("main:sheets", NS):
            name = sheet.attrib["name"]
            sheet_path = "xl/" + relmap[sheet.attrib[RID]].lstrip("/")
            result[name] = read_sheet(archive.read(sheet_path), shared)
        return result


def read_sheet(xml_bytes, shared):
    root = ET.fromstring(xml_bytes)
    rows = []
    for row in root.findall(".//main:sheetData/main:row", NS):
        values = {}
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r", "A1")
            col = col_index(ref)
            value = cell_value(cell, shared)
            if value:
                values[col] = value
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


def normalize_headers(header):
    normalized = []
    for index, value in enumerate(header):
        text = str(value).strip()
        if not text and index == 1:
            text = "分组"
        normalized.append(text or f"列{index + 1}")
    return normalized


def row_to_dict(header, row):
    return {
        key: clean_value(row[index]) if index < len(row) else ""
        for index, key in enumerate(header)
    }


def normalize_record(path, sheet, row_number, values, group_value):
    kind = infer_kind(sheet, values)
    name = first_present(values, ["资质名称", "证书名称", "专利名称", "商标名称", "类别"])
    company = first_present(values, ["申请公司名称", "所在公司", "公司"]) or infer_company_from_sheet(sheet)
    certificate_no = first_present(values, ["证书编号", "专利号"])
    issued_at = excel_date(first_present(values, ["发证时间", "申请日", "授权公告日"]))
    expires_at = excel_date(first_present(values, ["到期时间", "证书到期日"]))
    issuer = first_present(values, ["发证单位", "颁证机构"])
    category = first_present(values, ["类型"]) or group_value or kind

    return {
        "id": stable_id(path.name, sheet, row_number, company, kind, name, certificate_no),
        "source_file": path.name,
        "sheet": sheet,
        "row": row_number,
        "kind": kind,
        "category": category,
        "group": group_value,
        "company": company,
        "company_code": first_present(values, ["公司代码"]),
        "name": name,
        "certificate_no": certificate_no,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "issuer": issuer,
        "validity": first_present(values, ["有效期"]),
        "status": first_present(values, ["申请状态", "备注", "特殊备注"]),
        "person": first_present(values, ["员工姓名", "发明人"]),
        "department": first_present(values, ["部门"]),
        "keywords": keywords_for(name, category, company, issuer),
    }


def infer_kind(sheet, values):
    text = sheet + " " + " ".join(str(value) for value in values.values())
    if "人员" in sheet:
        return "人员资质"
    if "软著" in sheet or "软件著作权" in text:
        return "软件著作权"
    if "专利" in sheet:
        return "专利"
    if "商标" in sheet:
        return "商标"
    return "法人体资质"


def infer_company_from_sheet(sheet):
    if "PG" in sheet:
        return "神旗数码"
    if "P9" in sheet:
        return "智慧神州(北京)科技有限公司"
    return ""


def clean_value(value):
    text = str(value).strip()
    return "" if text in ["nan", "None"] else text


def first_present(values, keys):
    for key in keys:
        value = values.get(key)
        if value:
            return value
    return ""


def excel_date(value):
    if not value:
        return ""
    text = str(value).strip()
    if re.match(r"^\d+(\.0)?$", text):
        serial = int(float(text))
        if 20000 < serial < 80000:
            return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()
    return text


def keywords_for(*parts):
    text = " ".join(part for part in parts if part)
    candidates = [
        "ISO9001", "ISO27001", "ISO20000", "ITSS", "AAA", "高新技术", "软件企业",
        "数据", "数据治理", "数据质量", "运维", "云", "云资源", "AI", "人工智能",
        "知识库", "低代码", "系统集成", "网络安全", "等保", "智慧城市", "政务",
        "交通", "溯源", "监管", "项目管理", "PMP", "信息系统项目管理",
    ]
    hits = [item for item in candidates if item.lower() in text.lower()]
    tokens = re.findall(r"[\u4e00-\u9fa5A-Za-z0-9]{2,}", text)
    for token in tokens[:8]:
        if token not in hits:
            hits.append(token)
    return hits[:12]


def stable_id(*parts):
    import hashlib

    raw = "|".join(str(part) for part in parts)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]


def dedupe(records):
    by_key = {}
    for record in records:
        key = (record["company"], record["kind"], record["name"], record["certificate_no"])
        by_key[key] = record
    return list(by_key.values())


def stats(records):
    by_kind = {}
    by_company = {}
    for record in records:
        by_kind[record["kind"]] = by_kind.get(record["kind"], 0) + 1
        by_company[record["company"]] = by_company.get(record["company"], 0) + 1
    return {
        "total_records": len(records),
        "by_kind": dict(sorted(by_kind.items())),
        "by_company": dict(sorted(by_company.items())),
    }


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"import failed: {exc}", file=sys.stderr)
        raise
