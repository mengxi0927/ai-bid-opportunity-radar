"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { analyzeTenderWithQwen, createDraft, getAiStatus, getTender, submitFeedback, Tender } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";

const feedbackOptions = ["有价值，继续跟进", "一般，进入观察池", "不相关，不跟进", "资质不满足", "客户风险较高", "已由其他销售跟进"];

export default function TenderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenderId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const [item, setItem] = useState<Tender | null>(null);
  const [feedback, setFeedback] = useState(feedbackOptions[0]);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [qwenConfigured, setQwenConfigured] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!tenderId) return;
    setMessage("");
    getTender(tenderId).then(setItem).catch(() => setMessage("未找到该标讯或后端服务未启动。"));
    getAiStatus().then((status) => setQwenConfigured(status.configured)).catch(() => setQwenConfigured(false));
  }, [tenderId]);

  async function handleDraft(type: "lead" | "opportunity") {
    if (!item) return;
    const draft = await createDraft(item.id, type);
    router.push(`/drafts/${draft.id}`);
  }

  async function handleFeedback() {
    if (!item) return;
    await submitFeedback({ tender_id: item.id, option: feedback, comment });
    setMessage("反馈已提交，后续可用于优化推荐规则。");
  }

  async function handleQwenAnalysis() {
    if (!item) return;
    setAnalyzing(true);
    setMessage("");
    try {
      const result = await analyzeTenderWithQwen(item.id);
      setItem(result.item);
      setMessage("千问分析已完成，并已写入当前标讯。");
    } catch {
      setMessage("千问分析失败：请确认后端已配置 DASHSCOPE_API_KEY，并且网络可访问 DashScope。");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Shell>
      {message && <div className="panel">{message}</div>}
      {item && (
        <>
          <div className="page-head">
            <div>
              <h1>{item.title}</h1>
              <p className="subtle">{item.buyer} · {item.source} · {item.published_at}</p>
            </div>
            <div className="actions">
              <button className="button primary" onClick={() => handleDraft("lead")}>生成线索草稿</button>
              <button className="button secondary" onClick={() => handleDraft("opportunity")}>生成商机草稿</button>
              <button className="button secondary" onClick={handleQwenAnalysis} disabled={!qwenConfigured || analyzing}>
                {analyzing ? "千问分析中..." : "千问真实分析"}
              </button>
              <a className="link-button" href={item.source_url} target="_blank">查看原文</a>
            </div>
          </div>

          {!qwenConfigured && (
            <section className="panel ai-warning">
              <strong>千问未配置</strong>
              <span>请在后端环境变量中设置 DASHSCOPE_API_KEY，重启 Flask 后即可调用千问真实分析。</span>
            </section>
          )}

          <section className="metrics-grid">
            <div className="metric"><small>综合评分</small><strong>{item.score}</strong></div>
            <div className="metric"><small>推荐等级</small><strong><StatusPill label={item.recommendation_level} /></strong></div>
            <div className="metric"><small>客户匹配</small><strong>{item.customer_match.status}</strong></div>
            <div className="metric"><small>企业风险</small><strong><StatusPill label={item.risk.level} /></strong></div>
          </section>

          <section className="content-grid">
            <div>
              <Panel title="基础信息">
                <div className="field-grid">
                  <Field label="项目名称" value={item.parsed.project_name} />
                  <Field label="招标方" value={item.buyer} />
                  <Field label="项目类型" value={item.parsed.project_type} />
                  <Field label="所属行业" value={item.parsed.industry} />
                  <Field label="预算金额" value={item.budget} />
                  <Field label="投标截止" value={item.deadline} />
                </div>
              </Panel>

              <Panel title="AI 摘要">
                <p>{item.parsed.summary}</p>
                <div className="tag-list">
                  {item.parsed.keywords.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                </div>
              </Panel>

              {item.qwen_analysis && (
                <Panel title={`千问分析结果 · ${item.qwen_analysis.model}`}>
                  <div className="field-grid">
                    <Field label="千问评分" value={item.qwen_analysis.score} />
                    <Field label="推荐等级" value={item.qwen_analysis.recommendation_level} />
                    <Field label="能力判断" value={item.qwen_analysis.capability_status} />
                    <Field label="风险判断" value={item.qwen_analysis.risk_level} />
                  </div>
                  <div className="stack">
                    {item.qwen_analysis.reasons.map((reason) => <p key={reason}>{reason}</p>)}
                  </div>
                </Panel>
              )}

              <Panel title="客户匹配">
                <div className="field-grid">
                  <Field label="匹配结果" value={item.customer_match.status} />
                  <Field label="客户负责人" value={item.customer_match.owner} />
                  <Field label="客户类型" value={item.customer_match.customer_type} />
                  <Field label="历史商机" value={`${item.customer_match.history_opportunities} 条`} />
                </div>
                <p className="subtle">{item.customer_match.reason}</p>
              </Panel>

              <Panel title="能力匹配">
                <div className="field-grid">
                  <Field label="匹配结果" value={item.capability_match.status} />
                  <Field label="推荐法人体" value={item.capability_match.entity} />
                  <Field label="匹配资质" value={item.capability_match.certifications.join("、") || "待确认"} />
                  <Field label="匹配软著" value={item.capability_match.copyrights.join("、") || "待确认"} />
                  <Field label="匹配案例" value={item.capability_match.cases.join("、") || "待确认"} />
                  <Field label="建议协同" value={item.capability_match.departments.join("、")} />
                </div>
              </Panel>
            </div>

            <aside>
              <Panel title="风险分析">
                <div className="field-grid">
                  <Field label="企业风险等级" value={item.risk.level} />
                  <Field label="回款风险" value={item.risk.payment} />
                  <Field label="投标可行性风险" value={item.risk.feasibility} />
                </div>
                <ul>{item.risk.notes.map((note) => <li key={note}>{note}</li>)}</ul>
              </Panel>

              <Panel title="推荐结论">
                <div className="stack">
                  {item.recommendation_reasons.map((reason) => <p key={reason}>{reason}</p>)}
                </div>
              </Panel>

              <Panel title="下一步建议">
                <div className="timeline">
                  {item.next_steps.map((step) => <div key={step}>{step}</div>)}
                </div>
              </Panel>

              <Panel title="销售反馈">
                <div className="stack">
                  <select className="select" value={feedback} onChange={(event) => setFeedback(event.target.value)}>
                    {feedbackOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                  <textarea className="textarea" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="补充说明" />
                  <button className="button primary" onClick={handleFeedback}>提交反馈</button>
                </div>
              </Panel>
            </aside>
          </section>
        </>
      )}
    </Shell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

function Field({ label, value }: { label: string; value: string | number }) {
  return <div className="field"><small>{label}</small><strong>{value}</strong></div>;
}
