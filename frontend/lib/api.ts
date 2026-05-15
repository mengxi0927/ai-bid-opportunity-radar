const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5001/api";

export type Tender = {
  id: string;
  title: string;
  buyer: string;
  published_at: string;
  source: string;
  source_url: string;
  notice_type: string;
  budget: string;
  deadline: string;
  score: number;
  recommendation_level: string;
  recommendation_reasons: string[];
  next_steps: string[];
  parsed: {
    project_name: string;
    project_type: string;
    industry: string;
    keywords: string[];
    summary: string;
    possible_qualifications: string[];
    initial_risks: string[];
  };
  customer_match: {
    status: string;
    owner: string;
    customer_type: string;
    history_opportunities: number;
    cooperated: boolean;
    priority: string;
    reason: string;
  };
  capability_match: {
    status: string;
    entity: string;
    certifications: string[];
    copyrights: string[];
    cases: string[];
    gaps: string[];
    departments: string[];
  };
  risk: {
    level: string;
    payment: string;
    feasibility: string;
    notes: string[];
  };
  qwen_analysis?: QwenAnalysis;
};

export type QwenAnalysis = {
  provider: string;
  model: string;
  summary: string;
  project_type: string;
  industry: string;
  score: number;
  recommendation_level: string;
  customer_status: string;
  capability_status: string;
  risk_level: string;
  reasons: string[];
  risks: string[];
  next_steps: string[];
};

export type Overview = {
  date: string;
  metrics: Record<string, number>;
  metric_details: Record<string, MetricDetail[]>;
  value_metrics: Record<string, number | string>;
  top_recommendations: Tender[];
};

export type MetricDetail = {
  id: string;
  title: string;
  buyer: string;
  published_at: string;
  notice_type: string;
  score: number;
  recommendation_level: string;
  customer_status: string;
  capability_status: string;
  risk_level: string;
  status: string;
  note: string;
};

export type Draft = {
  id: string;
  type: string;
  status: string;
  project_name: string;
  customer_name: string;
  source: string;
  source_url: string;
  summary: string;
  recommendation_level: string;
  score: number;
  recommendation_reasons: string[];
  risk_notes: string[];
  departments: string[];
  owner: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`API ${path} failed with ${response.status}`);
  }
  return response.json();
}

export function getOverview() {
  return request<Overview>("/overview");
}

export function getTenders(search = "") {
  return request<{ items: Tender[] }>(`/tenders${search}`);
}

export function importTenderFromUrl(url: string) {
  return request<{ item: Tender; imported_total: number }>("/tenders/import", {
    method: "POST",
    body: JSON.stringify({ url })
  });
}

export function crawlWeeklyTenders() {
  return request<{ crawled: number; imported_total: number; items: Tender[]; week_start: string; week_end: string }>("/tenders/crawl-week", {
    method: "POST",
    body: JSON.stringify({ max_pages_per_source: 3, max_items: 120 })
  });
}

export function getTender(id: string) {
  return request<Tender>(`/tenders/${id}`);
}

export function getAiStatus() {
  return request<{ provider: string; configured: boolean }>("/ai/status");
}

export function analyzeTenderWithQwen(id: string) {
  return request<{ item: Tender; analysis: QwenAnalysis }>(`/tenders/${id}/qwen-analysis`, {
    method: "POST"
  });
}

export function createDraft(id: string, type: "lead" | "opportunity") {
  return request<Draft>(`/tenders/${id}/drafts`, {
    method: "POST",
    body: JSON.stringify({ type })
  });
}

export function getDraft(id: string) {
  return request<Draft>(`/drafts/${id}`);
}

export function updateDraft(id: string, data: Partial<Draft>) {
  return request<Draft>(`/drafts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

export function submitFeedback(data: { tender_id: string; option: string; comment?: string }) {
  return request<{ status: string; total: number }>("/feedback", {
    method: "POST",
    body: JSON.stringify(data)
  });
}
