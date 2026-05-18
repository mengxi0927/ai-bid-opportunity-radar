"use client";

import { RefreshCcw, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { crawlWeeklyTenders, getTenders, Tender } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { TenderTable } from "@/components/TenderTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FAVORITES_KEY = "bid-radar-favorites";
const tabs = ["全部推荐", "高优先级", "中优先级", "观察池", "我的收藏"];

export default function TendersPage() {
  const [items, setItems] = useState<Tender[]>([]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [risk, setRisk] = useState("");
  const [error, setError] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [activeTab, setActiveTab] = useState("全部推荐");
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextLevel = params.get("level") || "";
    setLevel(nextLevel);
    setActiveTab(nextLevel || "全部推荐");
    const saved = window.localStorage.getItem(FAVORITES_KEY);
    setFavorites(saved ? JSON.parse(saved) : []);
  }, []);

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (risk) params.set("risk", risk);
    if (query) params.set("q", query);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [level, risk, query]);

  useEffect(() => {
    getTenders(search)
      .then((data) => setItems(data.items))
      .catch(() => setError("无法加载标讯推荐，请确认 Flask 后端已启动。"));
  }, [search]);

  async function handleCrawlWeek() {
    setCrawling(true);
    setSyncMessage("");
    try {
      const result = await crawlWeeklyTenders();
      setItems(result.items);
      setSyncMessage(`已同步至 ${result.week_end}，本周新增/更新 ${result.crawled} 条，当前数据池共 ${result.imported_total} 条。`);
    } catch {
      setSyncMessage("手动同步失败，请稍后重试。");
    } finally {
      setCrawling(false);
    }
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "全部推荐" || tab === "我的收藏") {
      setLevel("");
    } else {
      setLevel(tab);
    }
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }

  const visibleItems = activeTab === "我的收藏" ? items.filter((item) => favorites.includes(item.id)) : items;

  return (
    <Shell>
      <section className="page-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tender Workspace</p>
          <h1 className="page-title">标讯推荐工作台</h1>
          <p className="page-description">
            这里是每日使用的核心页面。按推荐等级、风险和客户匹配快速筛选项目，再进入详情页生成线索或商机草稿。
          </p>
        </div>
        <Button onClick={handleCrawlWeek} disabled={crawling}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${crawling ? "animate-spin" : ""}`} />
          {crawling ? "同步中..." : "同步本周标讯"}
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>筛选与视图</CardTitle>
          <CardDescription>将高优先级、风险待核验和收藏项目组织成固定工作流。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-full border border-border bg-background px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {tab}
                  {tab === "我的收藏" ? ` ${favorites.length}` : ""}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目名称或招标方" />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="">全部推荐等级</option>
              <option value="高优先级">高优先级</option>
              <option value="中优先级">中优先级</option>
              <option value="观察池">观察池</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={risk}
              onChange={(event) => setRisk(event.target.value)}
            >
              <option value="">全部风险等级</option>
              <option value="低">低风险</option>
              <option value="中">中风险</option>
              <option value="高">高风险</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>当前结果 {visibleItems.length} 条</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" /> 收藏 {favorites.length} 条</span>
            {syncMessage && <>
              <span>•</span>
              <span>{syncMessage}</span>
            </>}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-rose-200 bg-rose-50/70">
          <CardContent className="p-6 text-sm text-rose-800">{error}</CardContent>
        </Card>
      ) : (
        <TenderTable
          items={visibleItems}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          title="推荐项目列表"
          description="点击任意项目进入情报详情页，查看客户、能力、风险和下一步建议。"
        />
      )}
    </Shell>
  );
}
