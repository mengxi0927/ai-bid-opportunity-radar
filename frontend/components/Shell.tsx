"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, Compass, LayoutDashboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { href: "/", label: "概览", icon: LayoutDashboard },
  { href: "/tenders", label: "标讯雷达", icon: Compass },
  { href: "/value", label: "价值看板", icon: BarChart3 },
  { href: "/insights", label: "市场洞察", icon: Building2 }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="page-shell">
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col overflow-hidden rounded-[28px] border border-slate-900/10 bg-slate-950 text-slate-100 shadow-2xl lg:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <Sparkles className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">商机智能雷达</p>
              <p className="mt-1 text-xs text-slate-400">AI Bid Opportunity Radar</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-5">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                  active ? "bg-white text-slate-950 shadow-lg" : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-6 py-5">
          <Badge variant="info" className="mb-3 border-white/10 bg-sky-400/10 text-sky-200">
            Flask API + Next.js
          </Badge>
          <p className="text-xs leading-5 text-slate-400">
            面向销售与售前团队的招投标情报工作台，用于扫描、判断、跟进和转化公开商机。
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-border/70 bg-white/80 px-5 py-4 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bid Radar Workspace</p>
            <p className="mt-1 text-sm text-slate-700">客户、资质、风险、推荐结论统一进入同一条工作流</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="neutral">实时分析</Badge>
            <Badge variant="outline">本地开发环境</Badge>
          </div>
        </div>
        <section className="space-y-6">{children}</section>
      </div>
    </main>
  );
}
