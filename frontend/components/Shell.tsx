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
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/85 text-slate-800 shadow-[0_24px_70px_rgba(37,99,235,0.12)] backdrop-blur-xl lg:flex">
        <div className="border-b border-slate-200/70 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-sky-400 to-emerald-400 shadow-lg shadow-blue-500/20 ring-1 ring-white/80">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-slate-950">商机智能雷达</p>
              <p className="mt-1 text-xs text-slate-500">AI Bid Opportunity Radar</p>
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
                  active ? "bg-gradient-to-r from-blue-50 via-white to-emerald-50 text-blue-700 shadow-md ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/70 bg-slate-50/60 px-6 py-5">
          <Badge variant="info" className="mb-3 border-blue-100 bg-blue-50 text-blue-700">
            Flask API + Next.js
          </Badge>
          <p className="text-xs leading-5 text-slate-500">
            面向销售与售前团队的招投标情报工作台，用于扫描、判断、跟进和转化公开商机。
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="hero-panel mb-6 flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bid Radar Workspace</p>
            <p className="mt-1 text-sm font-medium text-slate-800">客户、资质、风险、推荐结论统一进入同一条工作流</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="info" className="bg-blue-50 text-blue-700">实时分析</Badge>
            <Badge variant="danger" className="bg-rose-50 text-rose-700">红蓝主题</Badge>
            <Badge variant="outline">本地开发环境</Badge>
          </div>
        </div>
        <section className="space-y-6">{children}</section>
      </div>
    </main>
  );
}
