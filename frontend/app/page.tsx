"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOverview, MetricDetail, Overview } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { TenderTable } from "@/components/TenderTable";

const metricLabels: Record<string, string> = {
  scanned: "本周扫描标讯",
  ai_relevant: "本周 AI 初筛相关",
  high_priority: "本周高优先级推荐",
  existing_customers: "已有客户相关",
  capability_matched: "资质/软著匹配",
  risk_alerts: "风险提示项目",
  saved_hours: "预计节省人工时间",
  draftable: "可生成草稿"
};

const metricDetails: Record<string, { title: string; summary: string; basis: string }> = {
  scanned: {
    title: "本周扫描标讯",
    summary: "本周自动采集并进入解析队列的外部招投标公告总量。",
    basis: "统计口径：去重后的公开招标、竞争性磋商、采购意向、单一来源公示等标讯。"
  },
  ai_relevant: {
    title: "本周 AI 初筛相关",
    summary: "AI 判断与公司重点行业、解决方案能力或既有客户可能相关的标讯。",
    basis: "统计口径：关键词、行业、项目类型、客户关系和能力标签初筛后的相关项目。"
  },
  high_priority: {
    title: "本周高优先级推荐",
    summary: "综合评分达到高优先级阈值，建议销售优先查看并推进的项目。",
    basis: "统计口径：客户匹配、能力匹配、风险水平综合评分达到 80 分及以上。"
  },
  existing_customers: {
    title: "已有客户相关",
    summary: "招标方与客户库中的既有客户或历史合作客户匹配的项目数量。",
    basis: "统计口径：招标方名称与客户资料、历史商机或合作记录匹配成功。"
  },
  capability_matched: {
    title: "资质/软著匹配",
    summary: "项目需求与公司法人体、资质、软著、案例能力存在匹配的数量。",
    basis: "统计口径：能力匹配结果为高度匹配或部分匹配的项目。"
  },
  risk_alerts: {
    title: "风险提示项目",
    summary: "存在中高风险或需要销售进一步核验的项目数量。",
    basis: "统计口径：企业风险、回款风险、预算不明、可行性风险等任一维度非低风险。"
  },
  saved_hours: {
    title: "预计节省人工时间",
    summary: "AI 扫描、解析和初筛为销售节省的人工浏览时间估算。",
    basis: "统计口径：按人工查看公告、提取关键信息和初步判断的平均耗时折算。"
  },
  draftable: {
    title: "可生成草稿",
    summary: "满足生成线索或商机草稿条件的推荐项目数量。",
    basis: "统计口径：综合评分达到 70 分及以上，且具备足够摘要、客户和能力信息。"
  }
};

export default function HomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [activeMetric, setActiveMetric] = useState<string | null>(null);

  useEffect(() => {
    getOverview().then(setData).catch(() => setError("后端服务暂不可用，请先启动 Flask。"));
  }, []);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>本周商机雷达概览</h1>
          <p className="subtle">汇总本周外部标讯、客户匹配、公司能力和风险提示，帮助销售快速判断优先级。</p>
        </div>
        <div className="actions">
          <Link className="link-button primary" href="/tenders?level=高优先级">查看高优先级项目</Link>
          <Link className="link-button" href="/tenders">查看全部推荐</Link>
        </div>
      </div>

      {error && <div className="empty">{error}</div>}

      {data && (
        <>
          {data.metrics.scanned === 0 ? (
            <section className="empty real-data-empty">
              <strong>当前还没有真实导入的招投标数据</strong>
              <span>请先到“标讯推荐”页面粘贴中国招标投标网详情页 URL，导入后首页会自动按真实数据计算。</span>
              <Link className="link-button primary" href="/tenders">去导入真实标讯</Link>
            </section>
          ) : (
            <>
              <section className="metrics-grid">
                {Object.entries(data.metrics).map(([key, value]) => (
                  <button className="metric interactive-metric" key={key} type="button" onClick={() => setActiveMetric(key)}>
                    <small>{metricLabels[key] || key}</small>
                    <strong>{value}{key === "saved_hours" ? "h" : ""}</strong>
                    <span>点击查看明细</span>
                  </button>
                ))}
              </section>

              <section className="content-grid">
                <div>
                  <h2>本周重点推荐</h2>
                  <TenderTable items={data.top_recommendations} />
                </div>
              </section>
            </>
          )}
        </>
      )}

      {data && activeMetric && (
        <MetricModal
          metricKey={activeMetric}
          rows={data.metric_details?.[activeMetric] || []}
          value={data.metrics[activeMetric]}
          onClose={() => setActiveMetric(null)}
        />
      )}
    </Shell>
  );
}

function MetricModal({ metricKey, rows, value, onClose }: { metricKey: string; rows: MetricDetail[]; value: number; onClose: () => void }) {
  const detail = metricDetails[metricKey];
  const label = metricLabels[metricKey] || metricKey;

  if (!detail) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="metric-modal" role="dialog" aria-modal="true" aria-labelledby="metric-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <small>{label}</small>
            <h2 id="metric-modal-title">{detail.title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>

        <div className="modal-value">
          <strong>{value}{metricKey === "saved_hours" ? "h" : ""}</strong>
          <span>{metricKey === "saved_hours" ? `${rows.length} 项效率明细` : `${rows.length} 条明细数据`}</span>
        </div>

        <p>{detail.summary}</p>
        <div className="modal-basis">{detail.basis}</div>

        <div className="detail-table-wrap">
          <table className="detail-table">
            <thead>
              <tr>
                <th>项目/事项</th>
                <th>招标方</th>
                <th>类型</th>
                <th>状态</th>
                <th>{metricKey === "saved_hours" ? "节省" : "评分"}</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.published_at}</small>
                  </td>
                  <td>{item.buyer}</td>
                  <td>{item.notice_type}</td>
                  <td>{item.status}</td>
                  <td><strong>{metricKey === "saved_hours" ? `${item.score}h` : item.score}</strong></td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
