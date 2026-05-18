"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getOverview, Overview } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const currencyFormatter = new Intl.NumberFormat("zh-CN");

export default function ValuePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOverview().then(setData).catch(() => setError("无法加载价值指标，请确认 Flask 后端已启动。"));
  }, []);

  const model = useMemo(() => {
    if (!data) return null;

    const value = data.value_metrics;
    const monthlyScanned = Number(value.monthly_scanned || 0);
    const monthlyRelevant = Number(value.monthly_relevant || 0);
    const monthlyHighPriority = Number(value.monthly_high_priority || 0);
    const confirmedFollowups = Number(value.confirmed_followups || 0);
    const convertedOpportunities = Number(value.converted_opportunities || 0);
    const savedHours = Number(value.saved_hours || 0);
    const filteredLowFit = Number(value.filtered_low_fit || 0);
    const estimatedAmount = String(value.estimated_amount || "待确认");

    return {
      cards: [
        { label: "本月累计扫描", value: monthlyScanned, unit: "条", note: "公开标讯进入智能雷达的基础样本量" },
        { label: "AI 初筛相关", value: monthlyRelevant, unit: "条", note: percent(monthlyRelevant, monthlyScanned) + "% 进入下一步人工判断" },
        { label: "高价值推荐", value: monthlyHighPriority, unit: "条", note: "评分达到优先跟进阈值的项目" },
        { label: "预计商机金额", value: estimatedAmount, unit: "", note: "仅基于可识别预算的项目估算" }
      ],
      outcomes: [
        { label: "销售确认跟进", value: confirmedFollowups, note: "从推荐进入正式销售动作" },
        { label: "已转正式商机", value: convertedOpportunities, note: "进入后续商机管理流程" },
        { label: "累计节省筛选时间", value: savedHours, note: "通过自动抓取、解析和初筛节省的人时" },
        { label: "提前过滤低匹配项目", value: filteredLowFit, note: "减少销售浏览无效公告的时间" }
      ]
    };
  }, [data]);

  return (
    <Shell>
      <section className="page-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Value Dashboard</p>
          <h1 className="page-title">价值指标看板</h1>
          <p className="page-description">用更克制的管理视图看系统价值，不堆砌花哨图表，而是聚焦效率、质量和转化潜力。</p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/tenders?level=高优先级">查看高优先级项目</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">返回概览</Link>
          </Button>
        </div>
      </section>

      {error && (
        <Card className="border-rose-200 bg-rose-50/70">
          <CardContent className="p-4 text-sm text-rose-800">{error}</CardContent>
        </Card>
      )}

      {model && (
        <>
          <section className="metric-grid">
            {model.cards.map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-3">
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="font-mono text-3xl">
                    {typeof item.value === "number" ? currencyFormatter.format(item.value) : item.value}
                    {item.unit}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">{item.note}</CardContent>
              </Card>
            ))}
          </section>

          <section className="dashboard-grid">
            <Card>
              <CardHeader>
                <CardTitle>结果指标</CardTitle>
                <CardDescription>系统从扫描到跟进的链路产出</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {model.outcomes.map((item) => (
                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4" key={item.label}>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                    </div>
                    <div className="font-mono text-2xl font-semibold">{item.value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>管理视角建议</CardTitle>
                <CardDescription>当前数据下更适合关注什么</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="font-medium text-slate-950">先提高数据覆盖，再谈复杂分析</p>
                  <p className="mt-1 leading-7 text-muted-foreground">当前价值首先取决于真实标讯池规模。导入量不足时，所有价值指标都会偏保守。</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="font-medium text-slate-950">高优先级项目是最直接的销售价值入口</p>
                  <p className="mt-1 leading-7 text-muted-foreground">建议优先跟踪高优先级、已有客户相关和能力覆盖较高的项目，形成可复盘的转化样本。</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="font-medium text-slate-950">反馈闭环决定后续质量</p>
                  <p className="mt-1 leading-7 text-muted-foreground">如果销售反馈长期缺失，推荐规则和 AI 分析都无法持续对齐真实业务判断。</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </Shell>
  );
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
