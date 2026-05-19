"use client";

import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { analyzeTenderWithQwen, createDraft, getAiStatus, getTender, submitFeedback, Tender } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

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
      {message && (
        <Card className="glass-card border-sky-200 bg-sky-50/80">
          <CardContent className="p-4 text-sm text-sky-900">{message}</CardContent>
        </Card>
      )}

      {item && (
        <>
          <section className="hero-panel px-6 py-8 sm:px-8">
            <div className="page-header">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tender Dossier</p>
                <h1 className="page-title">{item.title}</h1>
                <p className="page-description">{item.buyer} · {item.source} · 发布于 {item.published_at} · 截止 {item.deadline}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleDraft("lead")}>生成线索草稿</Button>
                <Button variant="outline" onClick={() => handleDraft("opportunity")}>生成商机草稿</Button>
                <Button variant="secondary" onClick={handleQwenAnalysis} disabled={!qwenConfigured || analyzing}>
                  {analyzing ? "千问分析中..." : "运行 Qwen 分析"}
                </Button>
                <Button asChild variant="ghost">
                  <a href={item.source_url} target="_blank" rel="noreferrer">
                    查看原文
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="fancy-metric accent-card-blue">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Recommendation</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">蓝色表示机会强度与推进可能性</p>
              </div>
              <div className="fancy-metric accent-card-red">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Risk Exposure</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">红色强调需要先被核验的阻塞项</p>
              </div>
              <div className="fancy-metric">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Decision Mode</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">把情报阅读变成有结论的销售决策</p>
              </div>
            </div>
          </section>

          {!qwenConfigured && (
            <Card className="glass-card border-amber-200 bg-amber-50/85">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <div className="font-medium text-amber-900">千问未配置</div>
                  <div className="mt-1 text-sm text-amber-800">请在后端环境变量中设置 `DASHSCOPE_API_KEY`，重启 Flask 后即可调用真实分析。</div>
                </div>
              </CardContent>
            </Card>
          )}

          <section className="metric-grid">
            <MetricCard label="综合评分" value={String(item.score)} />
            <MetricCard label="推荐等级" valueNode={<StatusPill label={item.recommendation_level} />} />
            <MetricCard label="客户匹配" valueNode={<StatusPill label={item.customer_match.status} />} />
            <MetricCard label="企业风险" valueNode={<StatusPill label={item.risk.level} />} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="space-y-4">
              <InsightCard title="项目摘要" description="先判断项目本身是否值得投入">
                <p className="text-sm leading-7 text-slate-700">{item.parsed.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.parsed.keywords.map((tag) => <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary" key={tag}>{tag}</span>)}
                </div>
              </InsightCard>

              <InsightCard title="基础信息" description="招标事实与项目类型">
                <FieldGrid
                  fields={[
                    ["项目名称", item.parsed.project_name],
                    ["招标方", item.buyer],
                    ["项目类型", item.parsed.project_type],
                    ["所属行业", item.parsed.industry],
                    ["预算金额", item.budget],
                    ["投标截止", item.deadline]
                  ]}
                />
              </InsightCard>

              <InsightCard title="客户匹配" description="已有关系决定跟进速度">
                <FieldGrid
                  fields={[
                    ["匹配结果", item.customer_match.status],
                    ["客户负责人", item.customer_match.owner],
                    ["客户类型", item.customer_match.customer_type],
                    ["历史商机", `${item.customer_match.history_opportunities} 条`]
                  ]}
                />
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.customer_match.reason}</p>
              </InsightCard>

              <InsightCard title="能力匹配" description="资质、软著、案例和法人体主体">
                <FieldGrid
                  fields={[
                    ["匹配结果", item.capability_match.status],
                    ["推荐法人体", item.capability_match.entity],
                    ["匹配资质", item.capability_match.certifications.join("、") || "待确认"],
                    ["匹配软著", item.capability_match.copyrights.join("、") || "待确认"],
                    ["匹配案例", item.capability_match.cases.join("、") || "待确认"],
                    ["建议协同", item.capability_match.departments.join("、")]
                  ]}
                />
              </InsightCard>

              {item.qwen_analysis && (
                <InsightCard title={`Qwen 分析 · ${item.qwen_analysis.model}`} description="在规则判断之上补充 AI 分析视角">
                  <FieldGrid
                    fields={[
                      ["千问评分", String(item.qwen_analysis.score)],
                      ["推荐等级", item.qwen_analysis.recommendation_level],
                      ["能力判断", item.qwen_analysis.capability_status],
                      ["风险判断", item.qwen_analysis.risk_level]
                    ]}
                  />
                  <div className="mt-4 space-y-3">
                    {item.qwen_analysis.reasons.map((reason) => (
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-slate-700" key={reason}>{reason}</div>
                    ))}
                  </div>
                </InsightCard>
              )}
            </div>

            <div className="space-y-4">
              <InsightCard title="推荐结论" description="为什么系统建议你看这条项目">
                <div className="space-y-3">
                  {item.recommendation_reasons.map((reason) => (
                    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3" key={reason}>
                      <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                      <p className="text-sm leading-7 text-slate-700">{reason}</p>
                    </div>
                  ))}
                </div>
              </InsightCard>

              <InsightCard title="风险分析" description="看风险，再决定是否投入售前资源">
                <FieldGrid
                  fields={[
                    ["企业风险", item.risk.level],
                    ["回款风险", item.risk.payment],
                    ["可行性风险", item.risk.feasibility]
                  ]}
                />
                <div className="mt-4 space-y-2">
                  {item.risk.notes.map((note) => (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" key={note}>{note}</div>
                  ))}
                </div>
              </InsightCard>

              <InsightCard title="下一步建议" description="把判断推进到行动">
                <div className="space-y-2">
                  {item.next_steps.map((step, index) => (
                    <div className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-3" key={step}>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</div>
                      <p className="text-sm leading-6 text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              </InsightCard>

              <InsightCard title="销售反馈" description="反馈会进入后续推荐优化">
                <div className="space-y-3">
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={feedback} onChange={(event) => setFeedback(event.target.value)}>
                    {feedbackOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                  <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="补充说明，例如预算、客户进度或资质风险" />
                  <Button className="w-full" onClick={handleFeedback}>提交反馈</Button>
                </div>
              </InsightCard>

              <Button asChild variant="ghost" className="w-full justify-start">
                <Link href="/tenders">返回标讯列表</Link>
              </Button>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function MetricCard({ label, value, valueNode }: { label: string; value?: string; valueNode?: React.ReactNode }) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-3xl">{valueNode || value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InsightCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FieldGrid({ fields }: { fields: [string, string][] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map(([label, value]) => (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3" key={label}>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-sm font-medium leading-6 text-slate-900">{value}</div>
        </div>
      ))}
    </div>
  );
}
