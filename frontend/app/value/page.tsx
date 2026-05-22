"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMarketInsights, getOverview, MarketInsightMetric, MarketInsights, Overview } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const currencyFormatter = new Intl.NumberFormat("zh-CN");

export default function ValuePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [insights, setInsights] = useState<MarketInsights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOverview().then(setData).catch(() => setError("无法加载价值指标，请确认 Flask 后端已启动。"));
    getMarketInsights("?range=本月&industry=全部&region=全部").then(setInsights).catch(() => setInsights(null));
  }, []);

  const model = useMemo(() => {
    if (!data) return null;

    const value = data.value_metrics;
    const confirmedFollowups = Number(value.confirmed_followups || 0);
    const convertedOpportunities = Number(value.converted_opportunities || 0);
    const savedHours = Number(value.saved_hours || 0);
    const filteredLowFit = Number(value.filtered_low_fit || 0);

    return {
      outcomes: [
        { label: "销售确认跟进", value: confirmedFollowups, note: "从推荐进入正式销售动作" },
        { label: "已转正式商机", value: convertedOpportunities, note: "进入后续商机管理流程" },
        { label: "累计节省筛选时间", value: savedHours, note: "通过自动抓取、解析和初筛节省的人时" },
        { label: "提前过滤低匹配项目", value: filteredLowFit, note: "减少销售浏览无效公告的时间" }
      ]
    };
  }, [data]);

  const valueSignals = useMemo<MarketInsightMetric[]>(() => {
    if (insights?.metrics?.length) return insights.metrics;
    if (!data) return [];
    return [
      { label: "本月扫描标讯", value: Number(data.value_metrics.monthly_scanned || 0), change: "", note: "来自已导入真实标讯池" },
      { label: "AI识别市场信号", value: Number(data.value_metrics.monthly_relevant || 0), change: "", note: "命中行业、客户、关键词或能力要求" },
      { label: "已有客户动态", value: Number(data.metrics.existing_customers || 0), change: "", note: "存量客户近期公开采购动作" },
      { label: "重点客户动态", value: Number(data.metrics.high_priority || 0), change: "", note: "重点或历史客户连续需求变化" },
      { label: "发现能力缺口", value: 0, change: "", note: "资质、案例、软著或交付资源空白" },
      { label: "竞争信号", value: Number(data.metrics.risk_alerts || 0), change: "", note: "中标、成交或结果公告中的外部动作" }
    ];
  }, [data, insights]);

  return (
    <Shell>
      <section className="hero-panel px-6 py-8 sm:px-8">
        <div className="page-header">
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
        </div>
      </section>

      {error && (
        <Card className="border-rose-200 bg-rose-50/70">
          <CardContent className="p-4 text-sm text-rose-800">{error}</CardContent>
        </Card>
      )}

      {model && (
        <>
          {valueSignals.length > 0 && <ValueSignalGrid metrics={valueSignals} />}

          <section className="value-dashboard-stack">
            <Card className="glass-card accent-card-blue">
              <CardHeader>
                <CardTitle>结果指标</CardTitle>
                <CardDescription>系统从扫描到跟进的链路产出</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="value-outcome-grid">
                {model.outcomes.map((item) => (
                  <div className="value-outcome-card" key={item.label}>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                    </div>
                    <div className="font-mono text-2xl font-semibold">{item.value}</div>
                  </div>
                ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card accent-card-red">
              <CardHeader>
                <CardTitle>管理视角建议</CardTitle>
                <CardDescription>当前数据下更适合关注什么</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="value-advice-grid">
                <div className="value-advice-card">
                  <p className="font-medium text-slate-950">先提高数据覆盖，再谈复杂分析</p>
                  <p className="mt-1 leading-7 text-muted-foreground">当前价值首先取决于真实标讯池规模。导入量不足时，所有价值指标都会偏保守。</p>
                </div>
                <div className="value-advice-card">
                  <p className="font-medium text-slate-950">高优先级项目是最直接的销售价值入口</p>
                  <p className="mt-1 leading-7 text-muted-foreground">建议优先跟踪高优先级、已有客户相关和能力覆盖较高的项目，形成可复盘的转化样本。</p>
                </div>
                <div className="value-advice-card">
                  <p className="font-medium text-slate-950">反馈闭环决定后续质量</p>
                  <p className="mt-1 leading-7 text-muted-foreground">如果销售反馈长期缺失，推荐规则和 AI 分析都无法持续对齐真实业务判断。</p>
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

function ValueSignalGrid({ metrics }: { metrics: MarketInsightMetric[] }) {
  return (
    <section className="market-metric-grid">
      {metrics.map((item) => {
        const narrative = getMetricNarrative(item.label, item.value, item.note);
        return (
          <Card key={item.label} className="glass-card insight-kpi-card">
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="font-mono text-3xl">{currencyFormatter.format(item.value)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <p className="insight-kpi-conclusion">{narrative.conclusion}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={narrative.variant}>{narrative.tag}</Badge>
                <Badge variant="outline">{narrative.scope}</Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function getMetricNarrative(label: string, value: number, note: string) {
  if (label.includes("扫描")) {
    return {
      conclusion: value > 0 ? "本期已有可分析标讯，市场信号池正常更新。" : "本期暂无新增标讯，建议先同步数据。",
      tag: "数据规模",
      scope: "真实导入",
      variant: "info" as const
    };
  }
  if (label.includes("AI识别")) {
    return {
      conclusion: value > 0 ? "已提取行业、客户、关键词和能力要求信号。" : "暂无可识别市场信号。",
      tag: "已形成信号",
      scope: "AI 规则识别",
      variant: "success" as const
    };
  }
  if (label.includes("已有客户")) {
    return {
      conclusion: value > 0 ? "存量客户近期有公开采购动作，建议销售复核关系。" : "暂未匹配到存量客户公开采购动作。",
      tag: value > 0 ? "需跟进" : "暂无动作",
      scope: "客户库匹配",
      variant: value > 0 ? "warning" as const : "neutral" as const
    };
  }
  if (label.includes("重点客户")) {
    return {
      conclusion: value > 0 ? "重点或历史客户出现连续需求变化，建议进入观察池。" : "重点客户暂无明显新增动作。",
      tag: value > 0 ? "重点观察" : "保持监控",
      scope: "重点客户",
      variant: value > 0 ? "warning" as const : "neutral" as const
    };
  }
  if (label.includes("能力缺口")) {
    return {
      conclusion: value > 0 ? "存在资质、案例或软著空白，需提前补材料。" : "当前未发现明显能力缺口。",
      tag: value > 0 ? "需补齐" : "覆盖良好",
      scope: "能力要求",
      variant: value > 0 ? "danger" as const : "success" as const
    };
  }
  if (label.includes("竞争")) {
    return {
      conclusion: value > 0 ? "中标、成交或结果公告中已识别外部竞争动作。" : "暂无明显竞争动作。",
      tag: value > 0 ? "外部动作" : "暂无信号",
      scope: "结果类公告",
      variant: value > 0 ? "warning" as const : "neutral" as const
    };
  }
  return {
    conclusion: note,
    tag: "本期观察",
    scope: "筛选窗口",
    variant: "neutral" as const
  };
}
