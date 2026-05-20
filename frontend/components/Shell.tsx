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
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/90 text-slate-800 shadow-[0_24px_70px_rgba(37,99,235,0.08)] backdrop-blur-xl lg:flex">
        <div className="border-b border-slate-200/70 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 shadow-lg shadow-blue-500/15 ring-1 ring-white/80">
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
                  active ? "bg-gradient-to-r from-blue-50 via-white to-slate-50 text-blue-700 shadow-md ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/70 bg-slate-50/60 px-6 py-5">
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <section className="space-y-6">{children}</section>
      </div>
    </main>
  );
}
