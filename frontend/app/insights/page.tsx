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
          <section className="metric-grid">
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

          <section className="dashboard-grid">
            <Card className="glass-card accent-card-blue">
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

            <Card className="glass-card accent-card-red">
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

          <section className="dashboard-grid">
            <InsightTable
              title="行业趋势"
              description="近期哪些方向更值得持续盯住"
              headers={["行业", "公告数", "变化", "关键词", "建议"]}
              rows={data.industry_trends.map((row) => [row.industry, `${row.notice_count}`, row.change, row.keywords, row.suggestion])}
            />
            <InsightTable
              title="区域活跃度"
              description="市场热度和相关机会分布"
              headers={["区域", "公告数", "相关商机", "重点方向", "活跃客户", "建议"]}
              rows={data.regions.map((row) => [row.region, `${row.notice_count}`, `${row.related_count}`, row.directions, `${row.active_customers}`, row.suggestion])}
            />
            <InsightTable
              title="客户动态"
              description="值得销售补充关系背景的客户线索"
              headers={["客户", "类型", "公告数", "方向", "最近公告", "建议动作"]}
              rows={data.customer_dynamics.map((row) => [row.customer_name, row.customer_type, `${row.notice_count}`, row.directions, row.latest_published_at, row.suggested_action])}
            />
            <InsightTable
              title="能力要求"
              description="市场需求与公司资质覆盖情况"
              headers={["要求名称", "出现次数", "状态", "法人体", "建议动作"]}
              rows={data.capabilities.map((row) => [row.name, `${row.count}`, row.status, row.entity, row.action])}
            />
          </section>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>技术关键词与竞争信号</CardTitle>
              <CardDescription>用热词和结果公告观察市场方向与外部竞争动作</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <div className="flex flex-wrap gap-2">
                {data.keywords.map((item) => (
                  <div className="rounded-full border border-border bg-muted/30 px-3 py-2 text-sm" key={item.label}>
                    <span className="font-medium">{item.label}</span>
                    <span className="ml-2 text-muted-foreground">{item.count}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{item.change}</span>
                  </div>
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>竞争企业</TableHead>
                    <TableHead>中标次数</TableHead>
                    <TableHead>主要行业</TableHead>
                    <TableHead>能力方向</TableHead>
                    <TableHead>已有客户</TableHead>
                    <TableHead>建议动作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.competitors.length ? data.competitors.map((row) => (
                    <TableRow key={row.company}>
                      <TableCell className="font-medium">{row.company}</TableCell>
                      <TableCell>{row.wins}</TableCell>
                      <TableCell>{row.industry}</TableCell>
                      <TableCell>{row.capability}</TableCell>
                      <TableCell>{row.existing_customer}</TableCell>
                      <TableCell>{row.action}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">当前筛选条件下暂无竞争信号。</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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

function InsightTable({ title, description, headers, rows }: { title: string; description: string; headers: string[]; rows: string[][] }) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((row) => (
              <TableRow key={row.join("-")}>
                {row.map((cell, index) => <TableCell key={`${cell}-${index}`} className={index === 0 ? "font-medium" : ""}>{cell}</TableCell>)}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center text-muted-foreground">当前筛选条件下暂无数据。</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
