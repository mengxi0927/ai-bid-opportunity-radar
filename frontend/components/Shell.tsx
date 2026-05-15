import Link from "next/link";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AI</span>
          <div>
            <strong>商机智能雷达</strong>
            <small>招投标 POC</small>
          </div>
        </div>
        <nav>
          <Link href="/">概览</Link>
          <Link href="/tenders">标讯推荐</Link>
          <Link href="/value">价值看板</Link>
        </nav>
      </aside>
      <section className="workspace">{children}</section>
    </main>
  );
}
