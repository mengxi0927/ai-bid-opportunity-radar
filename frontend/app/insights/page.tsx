"use client";

import { useEffect, useMemo, useState } from "react";
import { getMarketInsights, MarketInsights } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ranges = ["今日", "近7天", "本月", "近30天"];
const industries = ["全部", "政企", "金融", "教育", "医疗", "能源", "制造"];
const regions = ["全部", "华东", "华南", "华北", "华中", "西南", "西北"];

export default function InsightsPage() {
  const [range, setRange] = useState("本月");
  const [industry, setIndustry] = useState("全部");
  const [region, setRegion] = useState("全部");
  const [data, setData] = useState<MarketInsights | null>(null);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams({ range, industry, region });
    return `?${params.toString()}`;
  }, [range, industry, region]);

  useEffect(() => {
    setError("");
    getMarketInsights(search)
      .then((result) => setData(result))
      .catch(() => {
        setData(null);
        setError("无法加载市场洞察，请确认 Flask 后端已启动，且已导入真实标讯数据。");
      });
  }, [search]);

  return (
    <Shell>
      <section className="hero-panel px-6 py-8 sm:px-8">
        <div className="page-header">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Market Insights</p>
            <h1 className="page-title">市场洞察</h1>
            <p className="page-description">把招投标公告当作外部市场信号源，观察行业、区域、客户和能力要求的变化，而不是只把它当作线索列表。</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={range} onChange={(event) => setRange(event.target.value)}>
              {ranges.map((option) => <option key={option}>{option}</option>)}
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={industry} onChange={(event) => setIndustry(event.target.value)}>
              {industries.map((option) => <option key={option}>{option}</option>)}
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={region} onChange={(event) => setRegion(event.target.value)}>
              {regions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>
      </section>

      {error && (
        <Card className="border-rose-200 bg-rose-50/70">
          <CardContent className="p-4 text-sm text-rose-800">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          <AiSummaryStrip data={data} />

          <section className="insights-module-grid">
            <RegionRadarCard rows={data.regions} />
            <KeywordHeatCard keywords={data.keywords} />
          </section>

          <section className="insights-module-grid">
            <IndustryTrendChart rows={data.industry_trends} />
          </section>

          <section className="insights-module-grid">
            <CustomerDynamicsPanel rows={data.customer_dynamics} />
            <CapabilityCoveragePanel rows={data.capabilities} />
          </section>

          <CompetitionSignalCard competitors={data.competitors} />
        </>
      )}
    </Shell>
  );
}

function AiSummaryStrip({ data }: { data: MarketInsights }) {
  const topRegion = data.regions[0];
  const topIndustry = data.industry_trends[0];
  const capabilityGap = data.capabilities.find((item) => item.status !== "已覆盖");
  const competitor = data.competitors[0];
  const keywords = topIndustry?.keywords?.split(/[、/]/).filter(Boolean).slice(0, 2).join("、") || "重点关键词";
  const summaries = [
    {
      title: "销售重点",
      badge: "先跟进",
      text: topRegion ? `${topRegion.region}机会最集中，优先看高分、已有客户和重点客户项目。` : "优先跟进高分、已有客户和重点客户项目。"
    },
    {
      title: "市场趋势",
      badge: "看行业",
      text: topIndustry ? `${topIndustry.industry}最活跃，需求集中在${keywords}。` : "关注公告数量上升最快的行业和关键词。"
    },
    {
      title: "能力补齐",
      badge: capabilityGap ? "需确认" : "覆盖稳定",
      text: capabilityGap ? `${capabilityGap.name}仍需确认覆盖，先补主体、案例或材料。` : "当前能力覆盖稳定，继续维护资质和案例有效期。"
    },
    {
      title: "竞争提醒",
      badge: competitor ? "有动作" : "暂无异常",
      text: competitor ? `${competitor.company}近期有中标动作，涉及已有客户的项目先提醒负责人。` : "暂未发现明显竞争动作，保持监控。"
    }
  ];

  return (
    <Card className="glass-card accent-card-blue ai-summary-strip">
      <CardHeader>
        <CardTitle>AI 总结</CardTitle>
        <CardDescription>直接给结论，详细依据见下方区域、行业、能力和竞争模块。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="ai-summary-grid">
          {summaries.map((item) => (
            <div className="ai-summary-tile" key={item.title}>
              <div className="flex items-center justify-between gap-3">
                <strong>{item.title}</strong>
                <Badge variant="info">{item.badge}</Badge>
              </div>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function KeywordHeatCard({ keywords }: { keywords: MarketInsights["keywords"] }) {
  const maxKeywordCount = Math.max(1, ...keywords.map((item) => item.count));
  const topKeywords = keywords.slice(0, 8);

  return (
    <Card className="glass-card keyword-card insights-keyword-card">
      <CardHeader>
        <CardTitle>技术关键词热度</CardTitle>
        <CardDescription>识别近期需求里被反复提及的技术方向</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="keyword-leader">
          <span>最高频</span>
          <strong>{topKeywords[0]?.label || "暂无"}</strong>
          <em>{topKeywords[0]?.count || 0} 次</em>
        </div>
        <div className="keyword-bars">
          {topKeywords.map((item, index) => (
            <div className="keyword-bar-row" key={item.label}>
              <span>{index + 1}</span>
              <strong>{item.label}</strong>
              <div><i style={{ width: `${Math.max(6, (item.count / maxKeywordCount) * 100)}%` }} /></div>
              <em>{item.count}次</em>
              <small className={item.change.startsWith("-") ? "down" : "up"}>{item.change}</small>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CompetitionSignalCard({ competitors }: { competitors: MarketInsights["competitors"] }) {
  const topCompetitors = competitors.slice(0, 6);
  const totalWins = competitors.reduce((sum, row) => sum + row.wins, 0);
  const existingCustomerCount = competitors.filter((row) => row.existing_customer === "是").length;
  const topCompetitor = topCompetitors[0];
  const industries = Array.from(new Set(competitors.map((row) => row.industry).filter(Boolean))).slice(0, 3);

  return (
    <Card className="glass-card competition-card">
      <CardHeader>
        <CardTitle>竞争信号</CardTitle>
        <CardDescription>从中标、成交和结果公告中观察外部动作</CardDescription>
      </CardHeader>
      <CardContent>
        {competitors.length ? (
          <div className="competition-dashboard">
            <div className="competition-brief">
              <div>
                <span>主要竞争动作</span>
                <strong>{topCompetitor?.company || "暂无"}</strong>
                <p>{topCompetitor ? `${topCompetitor.industry} · ${topCompetitor.capability}，近期 ${topCompetitor.wins} 次中标/成交信号。` : "当前筛选条件下暂无竞争动作。"}</p>
              </div>
              <div className="competition-stats">
                <div>
                  <strong>{totalWins}</strong>
                  <span>中标/成交信号</span>
                </div>
                <div>
                  <strong>{existingCustomerCount}</strong>
                  <span>涉及已有客户</span>
                </div>
                <div>
                  <strong>{industries.length}</strong>
                  <span>活跃行业</span>
                </div>
              </div>
            </div>

            <div className="competition-list">
              {topCompetitors.map((row, rowIndex) => (
                <div className="competition-item" key={`${rowIndex}-${row.company}`}>
                  <div className="competition-item-head">
                    <div>
                      <strong>{row.company}</strong>
                      <span>{row.industry} · {row.capability}</span>
                    </div>
                    <em>{row.wins} 次</em>
                  </div>
                  <div className="competition-meta">
                    <Badge variant={row.existing_customer === "是" ? "warning" : "outline"}>{row.existing_customer === "是" ? "涉及已有客户" : "非已有客户"}</Badge>
                    <small>{row.action}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
              当前筛选条件下暂无竞争信号。
            </div>
        )}
      </CardContent>
    </Card>
  );
}

function IndustryTrendChart({ rows }: { rows: MarketInsights["industry_trends"] }) {
  const max = Math.max(1, ...rows.map((row) => row.notice_count));
  const total = rows.reduce((sum, row) => sum + row.notice_count, 0);

  return (
    <Card className="glass-card insights-module-full industry-visual-card">
      <CardHeader>
        <CardTitle>行业趋势</CardTitle>
        <CardDescription>用公告量和关键词集中度判断哪些行业更值得盯住</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="industry-visual-layout">
          <div className="industry-rank-list">
            {rows.map((row, index) => {
              const width = Math.max(8, (row.notice_count / max) * 100);
              const share = total ? Math.round((row.notice_count / total) * 100) : 0;
              return (
                <div className="industry-rank-item" key={row.industry}>
                  <div className="industry-rank-head">
                    <span>{index + 1}</span>
                    <strong>{row.industry}</strong>
                    <em>{row.notice_count} 条</em>
                  </div>
                  <div className="industry-rank-track">
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <div className="industry-rank-meta">
                    <small>占比 {share}%</small>
                    <small>{row.suggestion}</small>
                    <small>{row.keywords}</small>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="industry-focus-box">
            <span>当前最活跃</span>
            <strong>{rows[0]?.industry || "暂无"}</strong>
            <p>{rows[0] ? `${rows[0].notice_count} 条公告，关键词集中在 ${rows[0].keywords}。` : "当前筛选条件下暂无行业信号。"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerDynamicsPanel({ rows }: { rows: MarketInsights["customer_dynamics"] }) {
  const topRows = rows.slice(0, 5);
  const max = Math.max(1, ...topRows.map((row) => row.notice_count));

  return (
    <Card className="glass-card insights-module-half customer-visual-card">
      <CardHeader>
        <CardTitle>客户动态</CardTitle>
        <CardDescription>优先识别近期需求更活跃的客户</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="customer-signal-list">
          {topRows.length ? topRows.map((row) => (
            <div className="customer-signal-card" key={`${row.customer_name}-${row.latest_published_at}`}>
              <div className="customer-signal-main">
                <strong>{row.customer_name}</strong>
                <Badge variant={row.customer_type === "已有客户" ? "success" : row.customer_type === "重点客户" ? "warning" : "outline"}>{row.customer_type}</Badge>
              </div>
              <div className="customer-signal-track">
                <i style={{ width: `${Math.max(10, (row.notice_count / max) * 100)}%` }} />
              </div>
              <div className="customer-signal-meta">
                <span>{row.notice_count} 条公告</span>
                <span>{row.directions}</span>
                <span>{row.suggested_action}</span>
              </div>
            </div>
          )) : (
            <div className="empty-visual">当前筛选条件下暂无客户动态。</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CapabilityCoveragePanel({ rows }: { rows: MarketInsights["capabilities"] }) {
  const statusVariant = (status: string) => {
    if (status === "已覆盖") return "success" as const;
    if (status === "部分覆盖") return "warning" as const;
    return "danger" as const;
  };
  const statusClass = (status: string) => {
    if (status === "已覆盖") return "covered";
    if (status === "部分覆盖") return "partial";
    return "missing";
  };

  return (
    <Card className="glass-card insights-module-half capability-visual-card">
      <CardHeader>
        <CardTitle>能力要求</CardTitle>
        <CardDescription>把市场高频要求转成能力覆盖看板</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="capability-chip-grid">
          {rows.length ? rows.map((row) => (
            <div className={`capability-chip ${statusClass(row.status)}`} key={row.name}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.count} 次出现 · {row.entity}</span>
              </div>
              <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
              <p>{row.action}</p>
            </div>
          )) : (
            <div className="empty-visual">当前筛选条件下暂无能力要求。</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RegionRadarCard({ rows }: { rows: MarketInsights["regions"] }) {
  if (!rows.length) {
    return (
      <Card className="glass-card insights-radar-card">
        <CardHeader>
          <CardTitle>区域活跃度</CardTitle>
          <CardDescription>市场热度和相关机会分布</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">当前筛选条件下暂无区域活跃度。</CardContent>
      </Card>
    );
  }

  const size = 280;
  const center = size / 2;
  const radius = 92;
  const max = Math.max(1, ...rows.map((row) => row.notice_count));
  const points = rows.map((row, index) => {
    const angle = (Math.PI * 2 * index) / rows.length - Math.PI / 2;
    const valueRadius = radius * (row.notice_count / max);
    return {
      ...row,
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
      valueX: center + Math.cos(angle) * valueRadius,
      valueY: center + Math.sin(angle) * valueRadius,
      labelX: center + Math.cos(angle) * (radius + 30),
      labelY: center + Math.sin(angle) * (radius + 30)
    };
  });
  const polygon = points.map((point) => `${point.valueX},${point.valueY}`).join(" ");

  return (
    <Card className="glass-card insights-radar-card">
      <CardHeader>
        <CardTitle>区域活跃度</CardTitle>
        <CardDescription>市场热度和相关机会分布</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="region-radar-layout">
          <svg className="region-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="区域市场活跃度雷达图">
            {[0.25, 0.5, 0.75, 1].map((scale) => {
              const grid = rows.map((_, index) => {
                const angle = (Math.PI * 2 * index) / rows.length - Math.PI / 2;
                return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
              }).join(" ");
              return <polygon className="radar-grid" points={grid} key={scale} />;
            })}
            {points.map((point) => (
              <line className="radar-axis" x1={center} y1={center} x2={point.axisX} y2={point.axisY} key={`${point.region}-axis`} />
            ))}
            <polygon className="radar-area" points={polygon} />
            {points.map((point) => (
              <g key={point.region}>
                <circle className="radar-dot" cx={point.valueX} cy={point.valueY} r="4" />
                <text className="radar-label" x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle">{point.region}</text>
              </g>
            ))}
          </svg>
          <div className="region-radar-list">
            {rows.map((row) => (
              <div className="region-radar-row" key={row.region}>
                <strong>{row.region}</strong>
                <span>{row.notice_count} 条公告</span>
                <span>{row.related_count} 条相关</span>
                <em>{row.directions}</em>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
