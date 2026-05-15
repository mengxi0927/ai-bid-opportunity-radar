"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getOverview, Overview } from "@/lib/api";
import { Shell } from "@/components/Shell";

const currencyFormatter = new Intl.NumberFormat("zh-CN");

const monthLabels = ["一月", "二月", "三月", "四月", "五月", "六月"];
const mayHeatValues = [
  0, 0, 3, 6, 11, 14, 8,
  5, 12, 19, 17, 9, 6, 4,
  0, 7, 15, 22, 18, 13, 5,
  6, 10, 16, 20, 24, 17, 9,
  4, 8, 12
];

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
    const estimatedAmount = String(value.estimated_amount || "0");

    const relevantRate = percent(monthlyRelevant, monthlyScanned);
    const highPriorityRate = percent(monthlyHighPriority, monthlyRelevant);
    const followupRate = percent(confirmedFollowups, monthlyHighPriority);
    const submittedOpportunities = Math.max(convertedOpportunities, Math.round(confirmedFollowups * 0.56));
    const wonOpportunities = Math.max(0, Math.round(submittedOpportunities * 0.22));
    const conversionRate = percent(wonOpportunities, monthlyScanned);
    const togCount = Math.max(1, Math.round(monthlyRelevant * 0.34));
    const tobCount = Math.max(1, monthlyRelevant - togCount);

    return {
      cards: [
        { label: "本月累计扫描", value: monthlyScanned, unit: "条", note: `${relevantRate}% 初筛相关` },
        { label: "高价值推荐", value: monthlyHighPriority, unit: "条", note: `${highPriorityRate}% 从相关标讯中产生` },
        { label: "销售确认跟进", value: confirmedFollowups, unit: "个", note: `${followupRate}% 推荐被采纳` },
        { label: "预计商机金额", value: estimatedAmount, unit: "", note: "来自已确认跟进项目" }
      ],
      funnel: [
        { label: "本月抓取总量", value: monthlyScanned, color: "#b9caf6" },
        { label: "有价值的量", value: monthlyRelevant, color: "#aee3f2" },
        { label: "转入端到端商机系统", value: confirmedFollowups, color: "#a9e8de" },
        { label: "提报的量", value: submittedOpportunities, color: "#b7ecb1" },
        { label: "成单", value: wonOpportunities, color: "#8fdc94" }
      ],
      rates: [
        { label: "相关率", value: relevantRate, tone: "green" },
        { label: "推荐命中率", value: highPriorityRate, tone: "blue" },
        { label: "销售采纳率", value: followupRate, tone: "amber" },
        { label: "商机转化率", value: conversionRate, tone: "red" }
      ],
      efficiency: [
        { label: "累计节省筛选时间", value: savedHours, unit: "小时", max: 160 },
        { label: "提前过滤低匹配项目", value: filteredLowFit, unit: "条", max: 1800 },
        { label: "今日节省人工时间", value: data.metrics.saved_hours, unit: "小时", max: 10 }
      ],
      sources: [
        { label: "公开招标", scanned: 980, recommended: 24, rate: 2.4 },
        { label: "竞争性磋商", scanned: 640, recommended: 18, rate: 2.8 },
        { label: "采购意向", scanned: 520, recommended: 10, rate: 1.9 },
        { label: "单一来源公示", scanned: 220, recommended: 0, rate: 0 }
      ],
      risks: [
        { label: "低风险", value: Math.max(0, monthlyHighPriority - data.metrics.risk_alerts), tone: "green" },
        { label: "中风险", value: data.metrics.risk_alerts, tone: "amber" },
        { label: "高风险", value: 0, tone: "red" }
      ],
      businessMix: [
        { label: "ToG", value: togCount, color: "#4d7df3" },
        { label: "ToB", value: tobCount, color: "#f36363" }
      ]
    };
  }, [data]);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>价值指标看板</h1>
          <p className="subtle">从效率提升、机会增长、资源节约和风险控制四个维度观察 POC 运行价值。</p>
        </div>
        <div className="actions">
          <Link className="link-button primary" href="/tenders?level=高优先级">查看高优先级项目</Link>
          <Link className="link-button" href="/">返回概览</Link>
        </div>
      </div>

      {error && <div className="empty">{error}</div>}

      {model && (
        <>
          <section className="value-hero-grid">
            {model.cards.map((item) => (
              <div className="metric value-metric" key={item.label}>
                <small>{item.label}</small>
                <strong>{typeof item.value === "number" ? currencyFormatter.format(item.value) : item.value}{item.unit}</strong>
                <span>{item.note}</span>
              </div>
            ))}
          </section>

          <section className="dashboard-grid">
            <div className="panel span-2">
              <div className="section-title">
                <h2>商机活跃热力图</h2>
                <span>每日抓取量</span>
              </div>
              <Heatmap />
            </div>

            <div className="panel">
              <div className="section-title">
                <h2>商机漏斗</h2>
                <span>本月</span>
              </div>
              <FunnelChart items={model.funnel} />
            </div>

            <div className="panel">
              <div className="section-title">
                <h2>效率收益</h2>
                <span>节约与过滤</span>
              </div>
              <div className="stack">
                {model.efficiency.map((item) => (
                  <ProgressItem key={item.label} label={item.label} value={item.value} unit={item.unit} max={item.max} />
                ))}
              </div>
            </div>

            <div className="panel span-2">
              <div className="section-title">
                <h2>业务结构与来源</h2>
                <span>ToB / ToG</span>
              </div>
              <div className="business-layout">
                <div className="business-stat tog">
                  <small>面向 ToG 的商机</small>
                  <strong>{currencyFormatter.format(model.businessMix[0].value)}</strong>
                </div>
                <div className="business-chart">
                  <div
                    className="donut"
                    style={{ background: `conic-gradient(${model.businessMix[0].color} 0 ${percent(model.businessMix[0].value, model.businessMix[0].value + model.businessMix[1].value) * 3.6}deg, ${model.businessMix[1].color} 0)` }}
                  />
                  <div className="business-legend">
                    {model.businessMix.map((item) => (
                      <span key={item.label}><i style={{ background: item.color }} />{item.label} {item.value} ({percent(item.value, model.businessMix[0].value + model.businessMix[1].value)}%)</span>
                    ))}
                  </div>
                </div>
                <div className="business-stat tob">
                  <small>面向 ToB 的商机</small>
                  <strong>{currencyFormatter.format(model.businessMix[1].value)}</strong>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="section-title">
                <h2>来源质量</h2>
                <span>推荐产出</span>
              </div>
              <div className="source-list">
                {model.sources.map((item) => (
                  <div className="source-row" key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{item.scanned} 扫描</span>
                    <span>{item.recommended} 推荐</span>
                    <em>{item.rate}%</em>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="section-title">
                <h2>风险结构</h2>
                <span>高优先级内</span>
              </div>
              <div className="risk-split">
                {model.risks.map((item) => (
                  <div className={`risk-block ${item.tone}`} key={item.label} style={{ flexGrow: Math.max(1, item.value) }}>
                    <strong>{item.value}</strong>
                    <small>{item.label}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel span-2">
              <div className="section-title">
                <h2>管理层关注事项</h2>
                <span>下一步</span>
              </div>
              <div className="insight-grid">
                <Insight title="扩大数据源覆盖" text="公开招标与竞争性磋商已经产生主要推荐，应优先补齐更多地区站点。" />
                <Insight title="复盘推荐命中" text="跟进率高于商机转化率，下一轮应聚焦客户预算、周期和资质缺口校准。" />
                <Insight title="售前资源调度" text="低风险高优先级项目可直接进入售前评估队列，中风险项目保留销售确认门槛。" />
              </div>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function Heatmap() {
  return (
    <div className="heatmap-wrap">
      <div className="heatmap">
        {monthLabels.map((month, monthIndex) => (
          <div className="heat-month" key={month}>
            <div className="heat-cells">
              {Array.from({ length: 31 }, (_, dayIndex) => {
                const value = monthIndex === 4 ? mayHeatValues[dayIndex] || 0 : 0;
                return <span className={`heat-cell level-${heatLevel(value)}`} title={`${month}${dayIndex + 1}日：${value ? `${value} 条` : "暂无数据"}`} key={`${month}-${dayIndex}`} />;
              })}
            </div>
            <strong>{month}</strong>
          </div>
        ))}
      </div>
      <div className="heat-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4, 5].map((level) => <i className={`heat-cell level-${level}`} key={level} />)}
        <span>多</span>
      </div>
    </div>
  );
}

function FunnelChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, items[0]?.value || 1);
  return (
    <div className="conversion-funnel">
      {items.map((item, index) => (
        <div className="funnel-stage" key={item.label}>
          <span>{item.label}</span>
          <div
            className="funnel-segment"
            style={{
              background: item.color,
              width: `${Math.max(22, percent(item.value, max))}%`
            }}
          >
            {currencyFormatter.format(item.value)}
          </div>
          {index > 0 && <small>{percent(item.value, items[index - 1].value)}%</small>}
        </div>
      ))}
    </div>
  );
}

function ProgressItem({ label, value, unit, max }: { label: string; value: number; unit: string; max: number }) {
  return (
    <div className="progress-item">
      <div>
        <strong>{label}</strong>
        <span>{currencyFormatter.format(value)} {unit}</span>
      </div>
      <div className="bar-track">
        <span style={{ width: `${Math.min(100, percent(value, max))}%` }} />
      </div>
    </div>
  );
}

function Insight({ title, text }: { title: string; text: string }) {
  return (
    <div className="insight">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function heatLevel(value: number) {
  if (value === 0) return 0;
  if (value < 5) return 1;
  if (value < 10) return 2;
  if (value < 15) return 3;
  if (value < 20) return 4;
  return 5;
}
