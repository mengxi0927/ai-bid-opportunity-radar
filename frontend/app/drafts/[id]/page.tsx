"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Draft, getDraft, updateDraft } from "@/lib/api";
import { Shell } from "@/components/Shell";

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
      {message && <div className="panel">{message}</div>}
      {draft && (
        <>
          <div className="page-head">
            <div>
              <h1>{draft.type}确认</h1>
              <p className="subtle">系统已自动带入标讯、客户、推荐理由、风险提示和建议协同部门。</p>
            </div>
            <div className="actions">
              <button className="button" onClick={() => save("草稿")}>保存草稿</button>
              <button className="button primary" onClick={() => save("已提交")}>提交正式线索</button>
              <Link className="link-button" href={`/tenders/${draft.id.split("-").slice(1, 3).join("-")}`}>返回标讯</Link>
            </div>
          </div>

          <section className="content-grid">
            <div className="panel">
              <h2>基础字段</h2>
              <Editable label="项目名称" value={draft.project_name} onChange={(value) => setDraft({ ...draft, project_name: value })} />
              <Editable label="客户名称" value={draft.customer_name} onChange={(value) => setDraft({ ...draft, customer_name: value })} />
              <Editable label="客户负责人" value={draft.owner} onChange={(value) => setDraft({ ...draft, owner: value })} />
              <Editable label="项目摘要" value={draft.summary} onChange={(value) => setDraft({ ...draft, summary: value })} multiline />
            </div>

            <aside>
              <section className="panel">
                <h2>推荐理由</h2>
                <ul>{draft.recommendation_reasons.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section className="panel">
                <h2>风险提示</h2>
                <ul>{draft.risk_notes.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section className="panel">
                <h2>建议协同部门</h2>
                <div className="tag-list">{draft.departments.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
              </section>
            </aside>
          </section>
        </>
      )}
    </Shell>
  );
}

function Editable({ label, value, onChange, multiline }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <label className="field" style={{ display: "block", marginBottom: 14 }}>
      <small>{label}</small>
      {multiline ? (
        <textarea className="textarea" value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
