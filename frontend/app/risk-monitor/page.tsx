"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Loader2, RefreshCcw, RotateCw, Search, Settings2, Sparkles } from "lucide-react";
import { getRiskCustomers, RiskCustomer, RiskCustomersResponse, scanCustomerRisk } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const riskOptions = [
  { label: "全部风险", value: "全部" },
  { label: "低风险", value: "低风险" },
  { label: "中风险", value: "中风险" },
  { label: "高风险", value: "高风险" },
  { label: "未扫描", value: "待扫描" }
];

const customerOptions = [
  { label: "全部客户", value: "全部" },
  { label: "新客户", value: "新客户" },
  { label: "已有客户", value: "已有客户" }
];

const priorityOptions = [
  { label: "全部优先级", value: "全部" },
  { label: "高优先级", value: "高" },
  { label: "中优先级", value: "中" },
  { label: "低优先级", value: "低" }
];

const scanOptions = [
  { label: "全部状态", value: "全部" },
  { label: "已扫描", value: "scanned" },
  { label: "未扫描", value: "pending" },
  { label: "扫描中", value: "scanning" },
  { label: "扫描失败", value: "failed" }
];

export default function RiskMonitorPage() {
  const [data, setData] = useState<RiskCustomersResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [riskFilter, setRiskFilter] = useState("全部");
  const [priorityFilter, setPriorityFilter] = useState("全部");
  const [customerFilter, setCustomerFilter] = useState("全部");
  const [scanFilter, setScanFilter] = useState("全部");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const autoScanStarted = useRef(false);

  useEffect(() => {
    getRiskCustomers()
      .then((result) => {
        setData(result);
        setSelectedId(result.items[0]?.id || "");
      })
      .catch(() => setMessage("无法加载客户风险数据，请确认后端服务已启动。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data || autoScanStarted.current) return;
    autoScanStarted.current = true;
    data.items
      .filter((item) => item.tenderPriority === "高" && item.scanStatus === "pending")
      .slice(0, 3)
      .forEach((item) => handleScan(item));
  }, [data]);

  const itemsWithState = useMemo(() => {
    return (data?.items || []).map((item) => ({
      ...item,
      scanStatus: scanning[item.id] ? "scanning" as const : item.scanStatus
    }));
  }, [data, scanning]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return itemsWithState.filter((item) => {
      const riskMatched = riskFilter === "全部" || item.riskLevel === riskFilter || (riskFilter === "待扫描" && item.scanStatus !== "scanned");
      const priorityMatched = priorityFilter === "全部" || item.tenderPriority === priorityFilter;
      const customerMatched = customerFilter === "全部" || (customerFilter === "已有客户" ? item.isExistingCustomer : !item.isExistingCustomer);
      const scanMatched = scanFilter === "全部" || item.scanStatus === scanFilter;
      const keywordMatched = !keyword || item.companyName.toLowerCase().includes(keyword) || item.tenderTitle.toLowerCase().includes(keyword);
      return riskMatched && priorityMatched && customerMatched && scanMatched && keywordMatched;
    });
  }, [customerFilter, itemsWithState, priorityFilter, query, riskFilter, scanFilter]);

  const selected = itemsWithState.find((item) => item.id === selectedId) || itemsWithState[0] || null;
  const resultSummary = useMemo(() => {
    const highRisk = filteredItems.filter((item) => item.riskLevel === "高风险").length;
    const followups = filteredItems.filter((item) => item.scanStatus === "scanned" && item.riskLevel !== "高风险").length;
    return { total: filteredItems.length, highRisk, followups };
  }, [filteredItems]);

  async function handleScan(item: RiskCustomer) {
    if (!data || scanning[item.id]) return;
    if (data.summary.remainingFreeCalls <= 0) {
      setMessage("今日企查查免费接口查询次数已用完，可明日继续扫描或切换 Mock 数据。");
      return;
    }
    setScanning((current) => ({ ...current, [item.id]: true }));
    setMessage("");
    try {
      const result = await scanCustomerRisk(item.companyName);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((candidate) => candidate.companyName === result.item.companyName ? result.item : candidate);
        return {
          ...current,
          items,
          summary: {
            ...current.summary,
            completedScans: items.filter((candidate) => candidate.scanStatus === "scanned").length,
            highRiskCustomers: items.filter((candidate) => candidate.riskLevel === "高风险").length,
            remainingFreeCalls: result.remainingFreeCalls
          }
        };
      });
      setSelectedId(result.item.id);
    } catch {
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((candidate) => candidate.id === item.id ? {
            ...candidate,
            scanStatus: "failed",
            riskLevel: "待扫描",
            riskTags: ["扫描失败，请稍后重试"],
            lastScanTime: new Date().toISOString().slice(0, 16).replace("T", " ")
          } : candidate)
        };
      });
      setMessage("扫描失败，请稍后重试。");
    } finally {
      setScanning((current) => ({ ...current, [item.id]: false }));
    }
  }

  function markConfirmed(item: RiskCustomer) {
    setSelectedId(item.id);
    setMessage(`已标记销售确认：${item.companyName}`);
  }

  return (
    <Shell>
      <section className="risk-hero-panel">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Customer Risk Monitor</p>
          <h1 className="page-title">客户风险监测</h1>
          <p className="page-description">
            基于企业工商、司法、经营异常等风险维度，辅助销售判断客户是否可正常跟进、谨慎确认或暂缓推进。
          </p>
        </div>
        <div className="risk-hero-actions">
          <Button variant="outline" onClick={() => console.log("refresh risk scan")}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            刷新风险扫描
          </Button>
          <Button variant="outline" onClick={() => console.log("export customers")}>
            <Download className="mr-2 h-4 w-4" />
            导出客户清单
          </Button>
          <Button onClick={() => console.log("show scan rules")}>
            <Settings2 className="mr-2 h-4 w-4" />
            查看扫描规则
          </Button>
        </div>
      </section>

      {message && (
        <Card className="glass-card border-blue-100 bg-blue-50/70">
          <CardContent className="p-4 text-sm text-blue-900">{message}</CardContent>
        </Card>
      )}

      {loading && <LoadingState />}

      {data && (
        <>
          <RiskSummaryCards summary={data.summary} />

          <section className="risk-monitor-layout">
            <CustomerRiskList
              items={filteredItems}
              selectedId={selectedId}
              resultSummary={resultSummary}
              filters={{ query, riskFilter, customerFilter, priorityFilter, scanFilter }}
              setters={{ setQuery, setRiskFilter, setCustomerFilter, setPriorityFilter, setScanFilter }}
              onSelect={setSelectedId}
              onScan={handleScan}
              onConfirm={markConfirmed}
              quotaLeft={data.summary.remainingFreeCalls}
            />
            <CustomerRiskDetailPanel item={selected} onScan={handleScan} onConfirm={markConfirmed} />
          </section>
        </>
      )}
    </Shell>
  );
}

function RiskSummaryCards({ summary }: { summary: RiskCustomersResponse["summary"] }) {
  const recommendedFollowups = Math.max(0, summary.completedScans - summary.highRiskCustomers);
  const cards = [
    { label: "已识别客户数", value: summary.identifiedCustomers, note: "从标讯标题和采购方中识别", icon: Search, tone: "blue" },
    { label: "已完成风险扫描", value: summary.completedScans, note: summary.qccConfigured ? "企查查接口/缓存结果" : "当前 Mock 风险结果", icon: CheckCircle2, tone: "green" },
    { label: "高风险客户数", value: summary.highRiskCustomers, note: "建议暂缓或谨慎推进", icon: AlertTriangle, tone: "red" },
    { label: "推荐跟进客户数", value: recommendedFollowups, note: "低/中风险客户可进入销售确认", icon: Sparkles, tone: "violet" }
  ];

  return (
    <section className="risk-summary-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
        <Card className="risk-summary-card" key={card.label}>
          <CardContent>
            <div className="risk-summary-copy">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>
                <span className={`risk-summary-icon ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {card.note}
              </p>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </section>
  );
}

function CustomerRiskList({
  items,
  selectedId,
  resultSummary,
  filters,
  setters,
  onSelect,
  onScan,
  onConfirm,
  quotaLeft
}: {
  items: RiskCustomer[];
  selectedId: string;
  resultSummary: { total: number; highRisk: number; followups: number };
  filters: {
    query: string;
    riskFilter: string;
    customerFilter: string;
    priorityFilter: string;
    scanFilter: string;
  };
  setters: {
    setQuery: (value: string) => void;
    setRiskFilter: (value: string) => void;
    setCustomerFilter: (value: string) => void;
    setPriorityFilter: (value: string) => void;
    setScanFilter: (value: string) => void;
  };
  onSelect: (id: string) => void;
  onScan: (item: RiskCustomer) => void;
  onConfirm: (item: RiskCustomer) => void;
  quotaLeft: number;
}) {
  return (
    <Card className="glass-card risk-list-card">
      <CardHeader>
        <CardTitle>客户风险列表</CardTitle>
        <CardDescription>点击客户查看右侧销售决策面板；扫描会优先使用缓存，避免重复消耗免费次数。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotaLeft <= 0 && (
          <div className="risk-quota-alert">今日企查查免费接口查询次数已用完，可明日继续扫描或切换 Mock 数据。</div>
        )}

        <div className="risk-filter-bar">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={filters.query} onChange={(event) => setters.setQuery(event.target.value)} placeholder="搜索客户名称 / 标讯标题" />
          </div>
          <FilterSelect value={filters.riskFilter} onChange={setters.setRiskFilter} options={riskOptions} />
          <FilterSelect value={filters.customerFilter} onChange={setters.setCustomerFilter} options={customerOptions} />
          <FilterSelect value={filters.priorityFilter} onChange={setters.setPriorityFilter} options={priorityOptions} />
          <FilterSelect value={filters.scanFilter} onChange={setters.setScanFilter} options={scanOptions} />
        </div>

        <div className="risk-result-summary">
          当前展示 <strong>{resultSummary.total}</strong> 个客户，其中 <strong>{resultSummary.highRisk}</strong> 个高风险，<strong>{resultSummary.followups}</strong> 个建议跟进。
        </div>

        {items.length ? (
          <div className="risk-customer-list">
            {items.map((item) => (
              <CustomerRiskCard
                item={item}
                selected={selectedId === item.id}
                key={item.id}
                onSelect={onSelect}
                onScan={onScan}
                onConfirm={onConfirm}
                quotaLeft={quotaLeft}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
}

function CustomerRiskCard({
  item,
  selected,
  onSelect,
  onScan,
  onConfirm,
  quotaLeft
}: {
  item: RiskCustomer;
  selected: boolean;
  onSelect: (id: string) => void;
  onScan: (item: RiskCustomer) => void;
  onConfirm: (item: RiskCustomer) => void;
  quotaLeft: number;
}) {
  const scanning = item.scanStatus === "scanning";
  return (
    <article
      className={`risk-customer-row ${riskRowClass(item)} ${selected ? "active" : ""}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(item.id);
      }}
      role="button"
      tabIndex={0}
    >
      <div className="risk-customer-topline">
        <div className="risk-customer-main">
          <i className="risk-customer-avatar">{item.companyName.slice(0, 1)}</i>
          <strong>{item.companyName}</strong>
        </div>
        <div className="risk-customer-tags">
          <PriorityBadge level={item.tenderPriority} />
          <CustomerTypeBadge existing={item.isExistingCustomer} />
          <RiskBadge level={item.riskLevel} status={item.scanStatus} />
        </div>
      </div>
      <p className="risk-tender-title">{item.tenderTitle}</p>
      <div className="risk-card-footer">
        <div className="risk-customer-meta">
          <span>{riskSummaryText(item)}</span>
          <span>{item.lastScanTime || "未扫描"}</span>
        </div>
        <div className="risk-row-actions" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => onSelect(item.id)}>查看详情</Button>
          <Button size="sm" onClick={() => onScan(item)} disabled={scanning || quotaLeft <= 0}>
            {scanning ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCw className="mr-1 h-3.5 w-3.5" />}
            重新扫描
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onConfirm(item)}>标记已确认</Button>
        </div>
      </div>
    </article>
  );
}

function CustomerRiskDetailPanel({
  item,
  onScan,
  onConfirm
}: {
  item: RiskCustomer | null;
  onScan: (item: RiskCustomer) => void;
  onConfirm: (item: RiskCustomer) => void;
}) {
  if (!item) {
    return (
      <Card className="glass-card risk-detail-card">
        <CardContent className="p-6">
          <EmptyState compact />
        </CardContent>
      </Card>
    );
  }

  const detail = item.detail;
  const level = item.scanStatus === "scanned" ? item.riskLevel : "待扫描";
  const suggestion = getSalesSuggestion(item);
  const qccUrl = `https://www.qcc.com/web/search?key=${encodeURIComponent(detail?.basicInfo.companyName || item.companyName)}`;

  return (
    <Card className="glass-card risk-detail-card">
      <CardHeader>
        <div className="risk-detail-heading">
          <div>
            <CardTitle>{item.companyName}</CardTitle>
            <CardDescription>风险扫描结果与销售建议</CardDescription>
          </div>
          <div className="risk-detail-heading-actions">
            <RiskBadge level={level} status={item.scanStatus} />
            <Button asChild size="sm" variant="outline">
              <a href={qccUrl} target="_blank" rel="noreferrer">
                企查查查看
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="risk-top-insight">
          <div className="risk-score-panel">
            <div>
              <span>综合风险分</span>
              <strong>{detail?.riskScore ?? "--"}</strong>
            </div>
            <p>{detail?.riskReasons?.[0] || "请先执行风险扫描，生成工商、司法和经营异常等维度的风险判断。"}</p>
          </div>
          <section className="risk-advice-card">
            <div>
              <Sparkles className="h-4 w-4" />
              <strong>AI 跟进建议</strong>
            </div>
            <p>{suggestion}</p>
          </section>
        </div>

        {item.scanStatus === "failed" && (
          <div className="risk-error-state">
            <AlertTriangle className="h-4 w-4" />
            <span>扫描失败，请稍后重试。</span>
            <Button size="sm" variant="outline" onClick={() => onScan(item)}>重新扫描</Button>
          </div>
        )}

        <section>
          <h3 className="risk-section-title">风险命中项</h3>
          <div className="risk-hit-list">
            {riskDimensionRows(detail, item).map((risk) => (
              <div className={`risk-hit-row ${risk.tone}`} key={risk.name}>
                <span>{risk.name}</span>
                <Badge variant={risk.variant}>{risk.status}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="risk-section-title">企业基础信息</h3>
          <div className="risk-basic-grid compact">
            <InfoItem label="企业名称" value={detail?.basicInfo.companyName || item.companyName} />
            <InfoItem label="统一社会信用代码" value={detail?.basicInfo.creditCode || "待扫描"} />
            <InfoItem label="法定代表人" value={detail?.basicInfo.legalRepresentative || "待扫描"} />
            <InfoItem label="注册资本" value={detail?.basicInfo.registeredCapital || "待扫描"} />
            <InfoItem label="成立日期" value={detail?.basicInfo.establishedDate || "待扫描"} />
            <InfoItem label="登记状态" value={detail?.basicInfo.registrationStatus || "待扫描"} />
          </div>
        </section>

        <section className="risk-action-panel">
          <h3 className="risk-section-title">建议销售动作</h3>
          <p>{getActionText(item)}</p>
          <div>
            <Button size="sm" onClick={() => onConfirm(item)}>加入跟进</Button>
            <Button size="sm" variant="outline" onClick={() => console.log("manual review", item.companyName)}>提交人工复核</Button>
            <Button size="sm" variant="ghost" onClick={() => onScan(item)}>重新扫描</Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card className="glass-card">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载客户风险数据...
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div className="h-24 animate-pulse rounded-2xl bg-slate-100" key={item} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "risk-empty-state compact" : "risk-empty-state"}>
      <Search className="h-5 w-5" />
      <strong>暂无客户数据</strong>
      <p>请返回“标讯雷达”同步或导入标讯后，再识别客户并进行风险扫描。</p>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function InfoItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "wide" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PriorityBadge({ level }: { level: string }) {
  return <Badge variant={level === "高" ? "danger" : level === "中" ? "warning" : "neutral"}>{level}优先级</Badge>;
}

function CustomerTypeBadge({ existing }: { existing: boolean }) {
  return <Badge variant={existing ? "info" : "outline"}>{existing ? "已有客户" : "新客户"}</Badge>;
}

function RiskBadge({ level, status }: { level: string; status: string }) {
  if (status === "scanning") return <Badge variant="info">扫描中</Badge>;
  if (status === "failed") return <Badge variant="danger">扫描失败</Badge>;
  if (status !== "scanned") return <Badge variant="neutral">未扫描</Badge>;
  if (level === "高风险") return <Badge variant="danger">高风险</Badge>;
  if (level === "中风险") return <Badge variant="warning">中风险</Badge>;
  return <Badge variant="success">低风险</Badge>;
}

function riskRowClass(item: RiskCustomer) {
  if (item.scanStatus === "failed") return "failed";
  if (item.scanStatus !== "scanned") return "pending";
  if (item.riskLevel === "高风险") return "high";
  if (item.riskLevel === "中风险") return "medium";
  return "low";
}

function riskSummaryText(item: RiskCustomer) {
  if (item.scanStatus === "scanning") return "正在扫描风险信息...";
  if (item.scanStatus === "failed") return "扫描失败，请稍后重试";
  if (item.scanStatus !== "scanned") return "未扫描，等待风险排查";
  return item.riskTags.slice(0, 3).join("、") || "未命中明显风险";
}

function getSalesSuggestion(item: RiskCustomer) {
  if (item.scanStatus !== "scanned") return "请先执行风险扫描";
  if (item.riskLevel === "高风险") return "建议暂缓推进，需进一步核实";
  if (item.riskLevel === "中风险") return "建议销售确认后推进";
  return "可正常跟进";
}

function getActionText(item: RiskCustomer) {
  if (item.scanStatus !== "scanned") return "请先执行风险扫描，确认客户工商、司法和经营状态后再决定是否推进。";
  if (item.riskLevel === "高风险") return "暂停推进并提交人工复核，重点核实司法、经营异常和付款风险。";
  if (item.riskLevel === "中风险") return "请销售确认客户背景后再推进，必要时同步法务或财务共同复核。";
  return "加入销售跟进，并同步至商机池。";
}

function riskDimensionRows(detail: RiskCustomer["detail"], item: RiskCustomer) {
  if (!detail) {
    return ["工商状态", "司法风险", "经营异常", "行政处罚", "关联风险"].map((name) => ({
      name,
      status: item.scanStatus === "failed" ? "需重试" : "未扫描",
      tone: "neutral",
      variant: "neutral" as const
    }));
  }
  const pick = (keyword: string) => detail.riskItems.find((risk) => risk.name.includes(keyword));
  const rows = [
    { name: "工商状态", item: pick("工商") },
    { name: "司法风险", item: pick("司法") },
    { name: "经营异常", item: pick("经营") },
    { name: "行政处罚", item: pick("行政") },
    { name: "关联风险", item: pick("股权") }
  ];
  return rows.map((row) => {
    const level = row.item?.level || "低风险";
    const hit = row.item?.hit;
    return {
      name: row.name,
      status: hit ? level : "未命中",
      tone: hit ? level === "高风险" ? "high" : "medium" : "low",
      variant: hit ? level === "高风险" ? "danger" as const : "warning" as const : "success" as const
    };
  });
}
