"use client";

import { useEffect, useMemo, useState } from "react";
import { getMarketInsights, MarketInsights } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
          <section className="market-metric-grid">
            {data.metrics.map((item) => (
              <Card key={item.label} className="glass-card">
                <CardHeader className="pb-3">
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="font-mono text-3xl">{item.value}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0 text-sm">
                  <span className="text-muted-foreground">{item.note}</span>
                  <Badge variant={item.change.startsWith("-") ? "warning" : "success"}>{item.change}</Badge>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="insights-overview-grid">
            <Card className="glass-card accent-card-blue insights-summary-card">
              <CardHeader>
                <CardTitle>AI 总结</CardTitle>
                <CardDescription>销售、管理和能力团队分别应该关注什么</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SummaryBlock title="销售团队" items={data.summary.sales} />
                <SummaryBlock title="管理层" items={data.summary.management} />
                <SummaryBlock title="能力建设" items={data.summary.capability} />
              </CardContent>
            </Card>

            <Card className="glass-card accent-card-red insights-source-card">
              <CardHeader>
                <CardTitle>数据源概况</CardTitle>
                <CardDescription>当前筛选窗口下的真实数据范围</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <StatRow label="总导入标讯" value={`${data.data_source.total_imported} 条`} />
                <StatRow label="本次命中数量" value={`${data.data_source.filtered_total} 条`} />
                <StatRow label="最新公告日期" value={data.data_source.latest_date} />
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-muted-foreground">
                  当前筛选：{data.filters.range} · {data.filters.industry}行业 · {data.filters.region}区域
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="insights-module-grid">
            <InsightTable
              className="insights-module-wide"
              title="行业趋势"
              description="近期哪些方向更值得持续盯住"
              headers={["行业", "公告数", "变化", "关键词", "建议"]}
              rows={data.industry_trends.map((row) => [row.industry, `${row.notice_count}`, row.change, row.keywords, row.suggestion])}
            />
            <RegionRadarCard rows={data.regions} />
            <InsightTable
              className="insights-module-half"
              title="客户动态"
              description="值得销售补充关系背景的客户线索"
              headers={["客户", "类型", "公告数", "方向", "最近公告", "建议动作"]}
              rows={data.customer_dynamics.map((row) => [row.customer_name, row.customer_type, `${row.notice_count}`, row.directions, row.latest_published_at, row.suggested_action])}
            />
            <InsightTable
              className="insights-module-half"
              title="能力要求"
              description="市场需求与公司资质覆盖情况"
              headers={["要求名称", "出现次数", "状态", "法人体", "建议动作"]}
              rows={data.capabilities.map((row) => [row.name, `${row.count}`, row.status, row.entity, row.action])}
            />
          </section>

          <KeywordCompetitionPanel keywords={data.keywords} competitors={data.competitors} />
        </>
      )}
    </Shell>
  );
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <p className="font-medium text-slate-950">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => <div className="text-sm leading-7 text-muted-foreground" key={item}>{item}</div>)}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-slate-950">{value}</span>
    </div>
  );
}

function KeywordCompetitionPanel({
  keywords,
  competitors
}: {
  keywords: MarketInsights["keywords"];
  competitors: MarketInsights["competitors"];
}) {
  const maxKeywordCount = Math.max(1, ...keywords.map((item) => item.count));
  const topKeywords = keywords.slice(0, 8);

  return (
    <section className="keyword-competition-panel">
      <Card className="glass-card keyword-card">
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

      <Card className="glass-card competition-card">
        <CardHeader>
          <CardTitle>竞争信号</CardTitle>
          <CardDescription>从中标、成交和结果公告中观察外部动作</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="competition-list">
            {competitors.length ? competitors.slice(0, 6).map((row, rowIndex) => (
              <div className="competition-item" key={`${rowIndex}-${row.company}`}>
                <div>
                  <strong>{row.company}</strong>
                  <span>{row.industry} · {row.capability}</span>
                </div>
                <div className="competition-meta">
                  <Badge variant={row.existing_customer === "是" ? "warning" : "outline"}>{row.existing_customer === "是" ? "涉及已有客户" : "非已有客户"}</Badge>
                  <em>{row.wins} 次</em>
                </div>
                <p>{row.action}</p>
              </div>
            )) : (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                当前筛选条件下暂无竞争信号。
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
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

function InsightTable({ title, description, headers, rows, className = "" }: { title: string; description: string; headers: string[]; rows: string[][]; className?: string }) {
  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="insight-table-scroll">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((row, rowIndex) => (
                <TableRow key={`${rowIndex}-${row.join("-")}`}>
                  {row.map((cell, index) => <TableCell key={`${rowIndex}-${cell}-${index}`} className={index === 0 ? "font-medium" : ""}>{cell}</TableCell>)}
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={headers.length} className="text-center text-muted-foreground">当前筛选条件下暂无数据。</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
