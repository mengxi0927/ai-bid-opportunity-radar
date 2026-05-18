"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ShieldAlert, Sparkles, Target } from "lucide-react";
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

const quickPanels = [
  { key: "high_priority", title: "优先推进队列", icon: Target },
  { key: "risk_alerts", title: "风险待核验", icon: ShieldAlert },
  { key: "draftable", title: "可直接转草稿", icon: BriefcaseBusiness }
] as const;

export default function HomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOverview().then(setData).catch(() => setError("后端服务暂不可用，请先启动 Flask。"));
  }, []);

  return (
    <Shell>
      <section className="page-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Overview</p>
          <h1 className="page-title">本周商机雷达概览</h1>
          <p className="page-description">
            将公开标讯转成可执行的销售情报，优先显示高价值项目、客户关联、能力覆盖与风险判断。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/tenders?level=高优先级">查看高优先级项目</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tenders">进入标讯工作台</Link>
          </Button>
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
        <>
          <section className="metric-grid">
            {Object.entries(data.metrics).map(([key, value]) => (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <CardDescription>{metricLabels[key] || key}</CardDescription>
                  <CardTitle className="font-mono text-3xl">{value}{key === "saved_hours" ? "h" : ""}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {data.metric_details?.[key]?.length || 0} 条关联明细
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="panel-grid">
            <Card>
              <CardHeader>
                <CardTitle>本周重点推荐</CardTitle>
                <CardDescription>直接进入销售判断与售前协同的候选项目</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>项目</TableHead>
                      <TableHead>推荐</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead className="text-right">评分</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_recommendations.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{item.title}</div>
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

            <div className="space-y-4">
              {quickPanels.map(({ key, title, icon: Icon }) => (
                <Card key={key}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{metricLabels[key]}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(data.metric_details[key] || []).slice(0, 3).map((row: MetricDetail) => (
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3" key={row.id}>
                        <div className="text-sm font-medium">{row.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{row.note}</div>
                      </div>
                    ))}
                    <Button asChild variant="ghost" className="w-full justify-between">
                      <Link href={`/tenders${key === "high_priority" ? "?level=高优先级" : ""}`}>
                        查看明细
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="dashboard-grid">
            <Card>
              <CardHeader>
                <CardTitle>推荐机制</CardTitle>
                <CardDescription>当前评分由客户匹配、能力覆盖与风险水平共同决定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="font-medium text-foreground">客户关系</p>
                  <p className="mt-1">结合历史商机与客户库判断是否存在真实转化基础。</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="font-medium text-foreground">公司能力</p>
                  <p className="mt-1">用资质、软著、案例、法人体主体和要求关键词进行匹配。</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="font-medium text-foreground">风险判断</p>
                  <p className="mt-1">从预算、回款、可行性和单一来源等维度做风险修正。</p>
                </div>
              </CardContent>
            </Card>

            <Card>
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
          </section>
        </>
      )}
    </Shell>
  );
}

function MessageCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-rose-200 bg-rose-50/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
