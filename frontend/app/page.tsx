"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  FileCheck2,
  ShieldAlert,
  Sparkles,
  Star,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { getOverview, MetricDetail, Overview } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const metricLabels: Record<string, string> = {
  scanned: "本周扫描标讯",
  ai_relevant: "AI 初筛相关",
  high_priority: "高优先级推荐",
  existing_customers: "已有客户相关",
  capability_matched: "资质/软著匹配",
  risk_alerts: "风险提示项目",
  saved_hours: "节省人工时间",
  draftable: "可生成草稿"
};

const visibleMetricKeys = [
  "ai_relevant",
  "capability_matched",
  "draftable",
  "existing_customers",
  "high_priority",
  "risk_alerts"
];

const metricMeta: Record<string, { note: string; tone: string; icon: typeof Sparkles }> = {
  ai_relevant: { note: "命中行业、客户或能力要求", tone: "blue", icon: Sparkles },
  capability_matched: { note: "公司资质与项目要求相符", tone: "emerald", icon: BadgeCheck },
  draftable: { note: "可进入线索或草稿准备", tone: "violet", icon: FileCheck2 },
  existing_customers: { note: "存量客户近期采购动态", tone: "sky", icon: Users },
  high_priority: { note: "建议优先分配销售跟进", tone: "amber", icon: Star },
  risk_alerts: { note: "推进前需要人工核验", tone: "rose", icon: ShieldAlert }
};

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOverview().then(setData).catch(() => setError("后端服务暂不可用，请先启动 Flask。"));
  }, []);

  return (
    <Shell>
      <div className="home-dashboard">
      <section className="home-hero-panel">
        <div className="home-hero-header">
          <div>
            <p className="home-eyebrow">Overview</p>
            <h1 className="home-title">本周商机雷达概览</h1>
            <p className="home-description">
              将公开标讯转成可执行的销售情报，优先显示高价值项目、客户关联、能力覆盖与风险判断。
            </p>
          </div>
          <div className="home-hero-actions">
            <Button asChild className="home-primary-button">
              <Link href="/tenders?level=高优先级">查看高优先级项目</Link>
            </Button>
            <Button asChild variant="outline" className="home-secondary-button">
              <Link href="/tenders">进入标讯工作台</Link>
            </Button>
          </div>
        </div>
      </section>

      {error && <MessageCard title="无法连接后端" description={error} />}

      {data && data.metrics.scanned === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>当前还没有真实导入的标讯</CardTitle>
            <CardDescription>先同步本周标讯或导入一条真实公告，系统才能计算推荐、客户匹配和能力判断。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/tenders">去导入或同步数据</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.metrics.scanned > 0 && (
        <div className="home-dashboard-stack">
          <section className="overview-metric-grid">
            {visibleMetricKeys.map((key) => {
              const value = data.metrics[key] || 0;
              const meta = metricMeta[key] || metricMeta.ai_relevant;
              const Icon = meta.icon;
              return (
              <Card key={key} className={`overview-metric-card tone-${meta.tone}`}>
                <CardContent>
                  <div className="overview-metric-topline">
                    <span>{metricLabels[key] || key}</span>
                    <div className="overview-metric-icon">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <strong>{value}</strong>
                  <p>{meta.note}</p>
                  <small>{data.metric_details?.[key]?.length || 0} 条关联明细</small>
                </CardContent>
              </Card>
              );
            })}
          </section>

          <section className="overview-primary-grid">
            <Card className="overview-focus-card overview-recommend-card">
              <CardHeader>
                <CardTitle>本周重点推荐</CardTitle>
                <CardDescription>直接进入销售判断与售前协同的候选项目</CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="overview-recommend-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>项目</TableHead>
                      <TableHead>推荐</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead className="text-right">评分</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_recommendations.slice(0, 3).map((item) => (
                      <TableRow
                        className="cursor-pointer"
                        key={item.id}
                        onClick={() => router.push(`/tenders/${item.id}`)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") router.push(`/tenders/${item.id}`);
                        }}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="line-clamp-2 font-semibold text-slate-950">{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.buyer}</div>
                          </div>
                        </TableCell>
                        <TableCell><StatusPill label={item.recommendation_level} /></TableCell>
                        <TableCell><StatusPill label={item.customer_match.status} /></TableCell>
                        <TableCell className="text-right font-mono font-semibold">{item.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="overview-focus-card overview-risk-card">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="overview-risk-icon">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>风险待核验</CardTitle>
                    <CardDescription>先看可能卡住推进的风险点</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.metric_details.risk_alerts || []).slice(0, 4).map((row: MetricDetail) => (
                  <div className="risk-brief" key={row.id}>
                    <strong>{riskSummary(row)}</strong>
                    <span>{row.title}</span>
                  </div>
                ))}
                <Button asChild variant="ghost" className="w-full justify-between">
                  <Link href="/tenders">
                    查看风险项目
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>

          <section className="overview-action-grid">
            <Card className="overview-action-card">
              <CardHeader>
                <CardTitle>下一步建议</CardTitle>
                <CardDescription>把推荐直接推进到销售动作，而不是停留在列表浏览</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">优先处理高分项目</p>
                    <p className="mt-1 text-muted-foreground">先看高优先级和已有客户相关项目，最快形成销售跟进动作。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">补齐预算与资质缺口</p>
                    <p className="mt-1 text-muted-foreground">中优先级项目的价值通常取决于预算信息和可复用资质是否明确。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">用 AI 深化判断</p>
                    <p className="mt-1 text-muted-foreground">对重要项目调用 Qwen 分析，增强推荐理由、风险提示和下一步动作。</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overview-action-card">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                    <BriefcaseBusiness className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>可直接转草稿</CardTitle>
                    <CardDescription>{metricLabels.draftable}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.metric_details.draftable || []).slice(0, 3).map((row: MetricDetail) => (
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3" key={row.id}>
                    <div className="line-clamp-1 text-sm font-medium">{row.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.score} 分 · {row.customer_status}</div>
                  </div>
                ))}
                <Button asChild variant="ghost" className="w-full justify-between">
                  <Link href="/tenders">
                    查看可转草稿项目
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
      </div>
    </Shell>
  );
}

function riskSummary(row: MetricDetail) {
  const text = `${row.note} ${row.title}`;
  if (text.includes("预算")) return "预算未明，需先核实";
  if (text.includes("技术") || text.includes("资格") || text.includes("资质")) return "资格/技术要求需确认";
  if (text.includes("回款")) return "回款风险需核验";
  if (text.includes("单一来源")) return "单一来源，投入需谨慎";
  if (text.includes("异常")) return "公开风险需复核";
  return "推进前需人工复核";
}

function MessageCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="glass-card border-rose-200 bg-rose-50/80">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
