"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Draft, getDraft, updateDraft } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function DraftPage({ params }: { params: { id: string } }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getDraft(params.id).then(setDraft).catch(() => setMessage("草稿只保存在当前 Flask 进程内，请先从标讯详情页生成草稿。"));
  }, [params.id]);

  async function save(status: string) {
    if (!draft) return;
    const next = await updateDraft(draft.id, { ...draft, status });
    setDraft(next);
    setMessage(status === "已提交" ? "已提交正式线索/商机，后续可进入端到端商机流程。" : "草稿已保存。");
  }

  return (
    <Shell>
      {message && (
        <Card className="border-sky-200 bg-sky-50/70">
          <CardContent className="p-4 text-sm text-sky-900">{message}</CardContent>
        </Card>
      )}

      {draft && (
        <>
          <section className="page-header">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Action Draft</p>
              <h1 className="page-title">{draft.type}确认</h1>
              <p className="page-description">系统已带入标讯、客户、推荐理由和风险提示。现在将其整理成一条可提交的销售动作。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => save("草稿")}>保存草稿</Button>
              <Button onClick={() => save("已提交")}>提交正式线索</Button>
              <Button asChild variant="ghost">
                <Link href={`/tenders/${draft.id.split("-").slice(1, 3).join("-")}`}>返回标讯</Link>
              </Button>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <Card>
              <CardHeader>
                <CardTitle>基础字段</CardTitle>
                <CardDescription>这里是销售或售前最常调整的执行字段。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Editable label="项目名称" value={draft.project_name} onChange={(value) => setDraft({ ...draft, project_name: value })} />
                <Editable label="客户名称" value={draft.customer_name} onChange={(value) => setDraft({ ...draft, customer_name: value })} />
                <Editable label="客户负责人" value={draft.owner} onChange={(value) => setDraft({ ...draft, owner: value })} />
                <Editable label="项目摘要" value={draft.summary} onChange={(value) => setDraft({ ...draft, summary: value })} multiline />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>推荐理由</CardTitle>
                  <CardDescription>提交前再次确认推动依据。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {draft.recommendation_reasons.map((item) => <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm" key={item}>{item}</div>)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>风险提示</CardTitle>
                  <CardDescription>建议在正式跟进前先核验这些信息。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {draft.risk_notes.map((item) => <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" key={item}>{item}</div>)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>建议协同部门</CardTitle>
                  <CardDescription>这将帮助销售更快找到配合方。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {draft.departments.map((item) => <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary" key={item}>{item}</span>)}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function Editable({ label, value, onChange, multiline }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      {multiline ? <Textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <Input value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}
