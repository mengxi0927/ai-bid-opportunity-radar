"use client";

import { useEffect, useMemo, useState } from "react";
import { crawlWeeklyTenders, getTenders, Tender } from "@/lib/api";
import { Shell } from "@/components/Shell";
import { TenderTable } from "@/components/TenderTable";

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
      setSyncMessage(`已同步 ${result.week_end} 当天及本周新增标讯，新增/更新 ${result.crawled} 条，当前数据池共 ${result.imported_total} 条。`);
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
      <div className="page-head">
        <div>
          <h1>标讯推荐列表</h1>
          <p className="subtle">集中展示 AI 分析后的标讯，支持按推荐等级、风险和关键词快速筛选。</p>
        </div>
      </div>

      <section className="panel sync-panel">
        <div>
          <h2>标讯同步</h2>
          <p className="subtle sync-note">每天 0 点自动同步前一天新增的标讯。</p>
        </div>
        <div className="sync-actions">
          <button className="button primary" type="button" onClick={handleCrawlWeek} disabled={crawling}>
            {crawling ? "同步中..." : "手动同步当天新增标讯"}
          </button>
        </div>
        {syncMessage && <p className="subtle import-message">{syncMessage}</p>}
      </section>

      <section className="panel">
        <div className="tabs">
          {tabs.map((tab) => (
            <button className={activeTab === tab ? "active" : ""} key={tab} type="button" onClick={() => handleTabChange(tab)}>
              {tab}
              {tab === "我的收藏" ? ` ${favorites.length}` : ""}
            </button>
          ))}
        </div>
        <div className="filters">
          <input className="input" style={{ maxWidth: 260 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或招标方" />
          <select className="select" style={{ maxWidth: 180 }} value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="">全部推荐等级</option>
            <option value="高优先级">高优先级</option>
            <option value="中优先级">中优先级</option>
            <option value="观察池">观察池</option>
          </select>
          <select className="select" style={{ maxWidth: 160 }} value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="">全部风险等级</option>
            <option value="低">低风险</option>
            <option value="中">中风险</option>
            <option value="高">高风险</option>
          </select>
        </div>
      </section>

      {error ? <div className="empty">{error}</div> : <TenderTable items={visibleItems} favorites={favorites} onToggleFavorite={toggleFavorite} />}
    </Shell>
  );
}
