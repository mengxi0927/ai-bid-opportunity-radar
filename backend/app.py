from pathlib import Path
from datetime import date, timedelta
import json
import site

LOCAL_PACKAGES = Path(__file__).parent / ".packages"
if LOCAL_PACKAGES.exists():
    site.addsitedir(str(LOCAL_PACKAGES))

from flask import Flask, jsonify, request

from services.cecbid import CecbidParseError, crawl_cecbid_week, fetch_cecbid_tender
from services.company_capabilities import capability_context_for_qwen, stats_summary
from services.opportunity_history import opportunity_context_for_qwen, stats_summary as opportunity_stats_summary
from services.qwen import QwenAnalysisError, analyze_tender_with_qwen, qwen_configured
from services.radar import create_draft, get_tender, list_tenders, overview


app = Flask(__name__)
DRAFTS = {}
FEEDBACK = []
IMPORTED_TENDERS_PATH = Path(__file__).parent / "data" / "imported_tenders.json"
IMPORTED_TENDERS = []


def load_imported_tenders():
    if not IMPORTED_TENDERS_PATH.exists():
        return []
    return json.loads(IMPORTED_TENDERS_PATH.read_text(encoding="utf-8"))


def save_imported_tenders():
    IMPORTED_TENDERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    IMPORTED_TENDERS_PATH.write_text(json.dumps(IMPORTED_TENDERS, ensure_ascii=False, indent=2), encoding="utf-8")


IMPORTED_TENDERS = load_imported_tenders()


def upsert_imported_tenders(tenders):
    by_id = {item["id"]: item for item in IMPORTED_TENDERS}
    for tender in tenders:
        by_id[tender["id"]] = tender
    IMPORTED_TENDERS[:] = list(by_id.values())
    save_imported_tenders()


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,OPTIONS"
    return response


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "bid-opportunity-radar"})


@app.route("/api/overview")
def api_overview():
    return jsonify(overview(IMPORTED_TENDERS))


@app.route("/api/tenders")
def api_tenders():
    filters = {
        "level": request.args.get("level"),
        "risk": request.args.get("risk"),
        "customer": request.args.get("customer"),
        "capability": request.args.get("capability"),
        "q": request.args.get("q", ""),
    }
    return jsonify({"items": list_tenders(filters, IMPORTED_TENDERS)})


@app.route("/api/tenders/<tender_id>")
def api_tender_detail(tender_id):
    tender = get_tender(tender_id, IMPORTED_TENDERS)
    if not tender:
        return jsonify({"message": "Tender not found"}), 404
    return jsonify(tender)


@app.route("/api/ai/status")
def api_ai_status():
    return jsonify({
        "provider": "qwen",
        "configured": qwen_configured(),
        "capability_stats": stats_summary(),
        "opportunity_stats": opportunity_stats_summary(),
    })


@app.route("/api/tenders/import", methods=["POST", "OPTIONS"])
def api_import_tender():
    if request.method == "OPTIONS":
        return "", 204
    payload = request.get_json(silent=True) or {}
    url = payload.get("url", "").strip()
    if not url:
        return jsonify({"message": "请提供要导入的中国招标投标网页面 URL。"}), 400

    try:
        tender = fetch_cecbid_tender(url)
    except CecbidParseError as exc:
        return jsonify({"message": str(exc)}), 422

    existing = next((item for item in IMPORTED_TENDERS if item["id"] == tender["id"]), None)
    if existing:
        existing.update(tender)
    else:
        IMPORTED_TENDERS.append(tender)
    save_imported_tenders()

    enriched = next(item for item in list_tenders({}, IMPORTED_TENDERS) if item["id"] == tender["id"])
    return jsonify({"item": enriched, "imported_total": len(IMPORTED_TENDERS)}), 201


@app.route("/api/tenders/crawl-week", methods=["POST", "OPTIONS"])
def api_crawl_week():
    if request.method == "OPTIONS":
        return "", 204
    payload = request.get_json(silent=True) or {}
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    max_pages = int(payload.get("max_pages_per_source", 3))
    max_items = int(payload.get("max_items", 120))

    try:
        tenders = crawl_cecbid_week(week_start, today, max_pages_per_source=max_pages, max_items=max_items)
    except CecbidParseError as exc:
        return jsonify({"message": str(exc)}), 422

    before = len(IMPORTED_TENDERS)
    upsert_imported_tenders(tenders)
    enriched = list_tenders({}, IMPORTED_TENDERS)
    return jsonify({
        "crawled": len(tenders),
        "imported_total": len(IMPORTED_TENDERS),
        "new_or_updated": len(IMPORTED_TENDERS) - before,
        "week_start": week_start.isoformat(),
        "week_end": today.isoformat(),
        "items": enriched,
    })


@app.route("/api/tenders/<tender_id>/qwen-analysis", methods=["POST", "OPTIONS"])
def api_qwen_analysis(tender_id):
    if request.method == "OPTIONS":
        return "", 204

    raw_tender = next((item for item in IMPORTED_TENDERS if item["id"] == tender_id), None)
    if not raw_tender:
        return jsonify({"message": "Tender not found"}), 404

    enriched = get_tender(tender_id, IMPORTED_TENDERS)
    try:
        analysis = analyze_tender_with_qwen(
            raw_tender,
            customer_hint=enriched.get("customer_match"),
            capability_hint=enriched.get("capability_match"),
            capability_knowledge=capability_context_for_qwen(raw_tender),
            opportunity_history=opportunity_context_for_qwen(raw_tender),
        )
    except QwenAnalysisError as exc:
        return jsonify({"message": str(exc), "configured": qwen_configured()}), 422

    raw_tender["qwen_analysis"] = analysis
    save_imported_tenders()
    updated = get_tender(tender_id, IMPORTED_TENDERS)
    return jsonify({"item": updated, "analysis": analysis})


@app.route("/api/tenders/<tender_id>/drafts", methods=["POST", "OPTIONS"])
def api_create_draft(tender_id):
    if request.method == "OPTIONS":
        return "", 204
    payload = request.get_json(silent=True) or {}
    draft = create_draft(tender_id, payload.get("type", "lead"), IMPORTED_TENDERS)
    if not draft:
        return jsonify({"message": "Tender not found"}), 404
    DRAFTS[draft["id"]] = draft
    return jsonify(draft), 201


@app.route("/api/drafts/<draft_id>", methods=["GET", "PATCH", "OPTIONS"])
def api_draft(draft_id):
    if request.method == "OPTIONS":
        return "", 204
    draft = DRAFTS.get(draft_id)
    if not draft:
        return jsonify({"message": "Draft not found"}), 404
    if request.method == "PATCH":
        draft.update(request.get_json(silent=True) or {})
    return jsonify(draft)


@app.route("/api/feedback", methods=["POST", "OPTIONS"])
def api_feedback():
    if request.method == "OPTIONS":
        return "", 204
    payload = request.get_json(silent=True) or {}
    FEEDBACK.append(payload)
    return jsonify({"status": "received", "total": len(FEEDBACK), "feedback": payload}), 201


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
