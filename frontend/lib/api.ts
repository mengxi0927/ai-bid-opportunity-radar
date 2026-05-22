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

export type MarketInsightMetric = {
  label: string;
  value: number;
  change: string;
  note: string;
};

export type MarketInsights = {
  filters: {
    range: string;
    industry: string;
    region: string;
  };
  data_source: {
    total_imported: number;
    filtered_total: number;
    latest_date: string;
  };
  metrics: MarketInsightMetric[];
  customer_dynamics: Array<{
    customer_name: string;
    customer_type: string;
    notice_count: number;
    directions: string;
    latest_published_at: string;
    suggested_action: string;
  }>;
  industry_trends: Array<{
    industry: string;
    notice_count: number;
    change: string;
    keywords: string;
    suggestion: string;
  }>;
  keywords: Array<{
    label: string;
    count: number;
    change: string;
  }>;
  capabilities: Array<{
    name: string;
    count: number;
    status: string;
    entity: string;
    action: string;
  }>;
  regions: Array<{
    region: string;
    notice_count: number;
    related_count: number;
    directions: string;
    active_customers: number;
    suggestion: string;
  }>;
  competitors: Array<{
    company: string;
    wins: number;
    industry: string;
    capability: string;
    existing_customer: string;
    action: string;
  }>;
  summary: {
    sales: string[];
    management: string[];
    capability: string[];
  };
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

export type RiskBasicInfo = {
  companyName: string;
  creditCode: string;
  legalRepresentative: string;
  establishedDate: string;
  registeredCapital: string;
  registrationStatus: string;
  industry: string;
  businessScopeSummary: string;
};

export type RiskItem = {
  name: string;
  level: string;
  hit: boolean;
  summary: string;
};

export type RiskDetail = {
  basicInfo: RiskBasicInfo;
  riskScore: number;
  riskLevel: string;
  riskTags: string[];
  riskReasons: string[];
  riskItems: RiskItem[];
  suggestion: string;
};

export type RiskCustomer = {
  id: string;
  companyName: string;
  tenderTitle: string;
  tenderPriority: string;
  isExistingCustomer: boolean;
  scanStatus: "pending" | "scanning" | "scanned" | "failed";
  riskLevel: string;
  riskScore: number;
  riskTags: string[];
  lastScanTime: string;
  detail: RiskDetail | null;
};

export type RiskCustomersResponse = {
  items: RiskCustomer[];
  summary: {
    identifiedCustomers: number;
    completedScans: number;
    highRiskCustomers: number;
    remainingFreeCalls: number;
    qccConfigured: boolean;
  };
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

export function getMarketInsights(search = "") {
  return request<MarketInsights>(`/insights${search}`);
}

export function getRiskCustomers() {
  return request<RiskCustomersResponse>("/risk/customers");
}

export function scanCustomerRisk(companyName: string) {
  return request<{ item: RiskCustomer; remainingFreeCalls: number; cached: boolean }>("/risk/scan", {
    method: "POST",
    body: JSON.stringify({ companyName })
  });
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
