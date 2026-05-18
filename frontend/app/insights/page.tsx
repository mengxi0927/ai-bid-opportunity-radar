"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getMarketInsights, MarketInsights } from "@/lib/api";
import { Shell } from "@/components/Shell";

const ranges = ["今日", "近7天", "本月", "近30天"];
const industries = ["全部", "政企", "金融", "教育", "医疗", "能源", "制造"];
const regions = ["全部", "华东", "华南", "华北", "华中", "西南", "西北"];

export default function InsightsPage() {
  const [range, setRange] = useState("本月");
  const [industry, setIndustry] = useState("全部");
  const [region, setRegion] = useState("全部");
  const [data, setData] = useState<MarketInsights | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<MarketInsights["keywords"][number] | null>(null);
  const [activeSummary, setActiveSummary] = useState<SummaryCard | null>(null);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams({ range, industry, region });
    return `?${params.toString()}`;
  }, [range, industry, region]);

  useEffect(() => {
    setError("");
    getMarketInsights(search)
      .then((result) => {
        setData(result);
        setActiveKeyword(result.keywords[0] || null);
      })
      .catch(() => {
        setData(null);
        setActiveKeyword(null);
        setError("无法加载市场洞察，请确认 Flask 后端已启动，且已导入真实标讯数据。");
      });
  }, [search]);

  const filterSummary = useMemo(() => `${range} · ${industry}行业 · ${region}区域`, [range, industry, region]);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>市场洞察</h1>
          <p className="subtle">基于公开招投标信息识别客户需求、行业趋势与能力缺口</p>
        </div>
        <div className="insight-filters">
          <Select label="时间范围" value={range} options={ranges} onChange={setRange} />
          <Select label="行业" value={industry} options={industries} onChange={setIndustry} />
          <Select label="区域" value={region} options={regions} onChange={setRegion} />
        </div>
      </div>

      <section className="signal-banner">
        <strong>公开标讯不只是投标线索</strong>
        <span>
          它也是客户需求、市场变化、能力缺口和竞争动作的外部信号。当前筛选：{filterSummary}
          {data && `，真实标讯池 ${data.data_source.total_imported} 条，本次命中 ${data.data_source.filtered_total} 条。`}
        </span>
      </section>

      {error && <div className="empty">{error}</div>}

      {data && (
        <>
          <section className="panel executive-insights">
            <div className="section-title">
              <h2>AI 洞察总结</h2>
              <span>先看结论，点击查看依据</span>
            </div>
            <div className="ai-insight-grid compact">
              {buildSummaryCards(data).map((card) => (
                <button className={`summary-card ${card.tone}`} key={card.title} onClick={() => setActiveSummary(card)} type="button">
                  <small>{card.title}</small>
                  <strong>{card.conclusion}</strong>
                  <span>查看依据</span>
                </button>
              ))}
            </div>
          </section>

          <section className="insight-metrics-grid">
            {data.metrics.map((item) => (
              <div className="metric insight-metric" key={item.label}>
                <small>{item.label}</small>
                <div><strong>{formatNumber(item.value)}</strong><em className={item.change.startsWith("-") ? "down" : "up"}>{item.change}</em></div>
                <span>{item.note}</span>
              </div>
            ))}
          </section>

          <section className="insights-grid">
            <Panel title="客户需求动态" note="已有客户与重点客户近期动作" className="span-2">
              <DataTable
                className="customer-dynamics-table"
                emptyText="当前筛选条件下暂无可识别客户动态。"
                headers={["客户名称", "客户类型", "近期标讯数量", "主要需求方向", "最近发布时间", "建议动作"]}
                rows={data.customer_dynamics.map((row) => [
                  row.customer_name,
                  row.customer_type,
                  `${row.notice_count}条`,
                  row.directions,
                  row.latest_published_at,
                  row.suggested_action
                ])}
              />
            </Panel>

            <Panel title="行业趋势分析" note="行业 TOP5">
              <DataTable
                emptyText="当前筛选条件下暂无行业趋势。"
                headers={["行业", "标讯数量", "环比变化", "高频关键词", "关注建议"]}
                rows={data.industry_trends.map((row) => [
                  row.industry,
                  String(row.notice_count),
                  row.change,
                  row.keywords,
                  row.suggestion
                ])}
              />
            </Panel>

            <Panel title="技术关键词热度" note="点击关键词查看相关标讯数量">
              <div className="keyword-cloud">
                {data.keywords.map((item) => (
                  <button
                    className={activeKeyword?.label === item.label ? "active" : ""}
                    key={item.label}
                    onClick={() => setActiveKeyword(item)}
                    type="button"
                  >
                    <strong>{item.label}</strong>
                    <span>{item.count}次 {item.change}</span>
                  </button>
                ))}
              </div>
              {activeKeyword && (
                <div className="keyword-detail">
                  <strong>{activeKeyword.label}</strong>
                  <span>相关标讯数量：{activeKeyword.count} 条，热度变化 {activeKeyword.change}</span>
                </div>
              )}
            </Panel>

            <Panel title="高频资质与能力要求" note="市场要求与公司覆盖情况">
              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>要求名称</th>
                      <th>出现次数</th>
                      <th>当前匹配状态</th>
                      <th>关联法人体</th>
                      <th>建议动作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.capabilities.map((row) => (
                      <tr key={row.name}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.count}次</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td>{row.entity}</td>
                        <td>{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="区域市场活跃度" note="近期公开采购热度">
              <RegionRadar rows={data.regions} />
            </Panel>

            <Panel title="竞争信号" note="中标、成交和结果公告中的外部动作">
              <DataTable
                emptyText="当前筛选条件下暂无中标或成交类竞争信号。"
                headers={["竞争企业", "近期中标数量", "主要行业", "能力方向", "是否涉及已有客户", "建议动作"]}
                rows={data.competitors.map((row) => [
                  row.company,
                  `${row.wins}次`,
                  row.industry,
                  row.capability,
                  row.existing_customer,
                  row.action
                ])}
              />
            </Panel>
          </section>

          {activeSummary && <SummaryModal card={activeSummary} onClose={() => setActiveSummary(null)} />}
        </>
      )}
    </Shell>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Panel({ title, note, children, className = "" }: { title: string; note: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-title">
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      {children}
    </section>
  );
}

function DataTable({ headers, rows, emptyText, className = "" }: { headers: string[]; rows: string[][]; emptyText: string; className?: string }) {
  if (!rows.length) {
    return <div className="empty">{emptyText}</div>;
  }
  return (
    <div className={`table-wrap compact-table ${className}`}>
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")}>{row.map((cell, index) => <td key={`${cell}-${index}`}>{index === 0 ? <strong>{cell}</strong> : cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "已覆盖" ? "good" : status === "部分覆盖" ? "warn" : "bad";
  return <span className={`coverage-badge ${tone}`}>{status}</span>;
}

function RegionRadar({ rows }: { rows: MarketInsights["regions"] }) {
  if (!rows.length) {
    return <div className="empty">当前筛选条件下暂无区域活跃度。</div>;
  }

  const size = 260;
  const center = size / 2;
  const radius = 88;
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
      labelX: center + Math.cos(angle) * (radius + 28),
      labelY: center + Math.sin(angle) * (radius + 28)
    };
  });
  const polygon = points.map((point) => `${point.valueX},${point.valueY}`).join(" ");

  return (
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
            <span>{row.notice_count} 条标讯</span>
            <span>{row.related_count} 条相关</span>
            <em>{row.directions}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

type SummaryCard = {
  title: string;
  conclusion: string;
  tone: "sales" | "trend" | "capability";
  details: string[];
  evidence: string[];
};

function buildSummaryCards(data: MarketInsights): SummaryCard[] {
  const topCustomer = data.customer_dynamics[0];
  const topIndustry = data.industry_trends[0];
  const topRegion = [...data.regions].sort((a, b) => b.notice_count - a.notice_count)[0];
  const topGap = data.capabilities.find((item) => item.status !== "已覆盖") || data.capabilities[0];
  const topKeyword = data.keywords[0];

  return [
    {
      title: "销售动作",
      conclusion: topCustomer ? `优先跟进 ${topCustomer.customer_name}` : "暂无明确客户跟进对象",
      tone: "sales",
      details: data.summary.sales,
      evidence: topCustomer ? [
        `近期标讯：${topCustomer.notice_count} 条`,
        `需求方向：${topCustomer.directions}`,
        `最近发布：${topCustomer.latest_published_at}`,
        `建议动作：${topCustomer.suggested_action}`
      ] : ["当前筛选条件下未识别到连续客户动态。"]
    },
    {
      title: "市场趋势",
      conclusion: topIndustry ? `${topIndustry.industry}需求最活跃` : "暂无明显行业集中",
      tone: "trend",
      details: data.summary.management,
      evidence: [
        topIndustry ? `${topIndustry.industry}标讯 ${topIndustry.notice_count} 条，环比 ${topIndustry.change}` : "暂无行业数据",
        topKeyword ? `最高频关键词：${topKeyword.label} ${topKeyword.count} 次` : "暂无关键词数据",
        topRegion ? `最活跃区域：${topRegion.region} ${topRegion.notice_count} 条` : "暂无区域数据"
      ]
    },
    {
      title: "能力缺口",
      conclusion: topGap ? `补齐 ${topGap.name}` : "能力覆盖整体稳定",
      tone: "capability",
      details: data.summary.capability,
      evidence: topGap ? [
        `出现次数：${topGap.count} 次`,
        `覆盖状态：${topGap.status}`,
        `关联主体：${topGap.entity}`,
        `建议动作：${topGap.action}`
      ] : ["当前筛选条件下未识别到明显能力缺口。"]
    }
  ];
}

function SummaryModal({ card, onClose }: { card: SummaryCard; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="metric-modal summary-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{card.title}</h2>
            <p className="subtle">{card.conclusion}</p>
          </div>
          <button className="button" onClick={onClose}>关闭</button>
        </div>
        <div className="summary-detail-grid">
          <section>
            <h3>建议理由</h3>
            <ol>
              {card.details.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </section>
          <section>
            <h3>数据支撑</h3>
            <ul>
              {card.evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}
