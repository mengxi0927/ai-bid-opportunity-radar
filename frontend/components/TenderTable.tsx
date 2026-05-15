"use client";

import { useRouter } from "next/navigation";
import { Tender } from "@/lib/api";
import { StatusPill } from "./StatusPill";

export function TenderTable({
  items,
  favorites = [],
  onToggleFavorite
}: {
  items: Tender[];
  favorites?: string[];
  onToggleFavorite?: (id: string) => void;
}) {
  const router = useRouter();

  function openTender(id: string) {
    router.push(`/tenders/${id}`);
  }

  function toggleFavorite(event: React.MouseEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation();
    onToggleFavorite?.(id);
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>项目名称</th>
            <th>招标方</th>
            <th className="nowrap">推荐等级</th>
            <th>评分</th>
            <th>客户</th>
            <th>能力</th>
            <th>风险</th>
            <th>收藏</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="clickable-row" key={item.id} onClick={() => openTender(item.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openTender(item.id)}>
              <td>
                <strong>{item.title}</strong>
                <small>{item.published_at} · {item.notice_type}</small>
              </td>
              <td>{item.buyer}</td>
              <td className="nowrap"><StatusPill label={item.recommendation_level} /></td>
              <td><strong>{item.score}</strong></td>
              <td className="nowrap">{item.customer_match.status}</td>
              <td className="nowrap">{item.capability_match.status}</td>
              <td className="nowrap"><StatusPill label={item.risk.level} /></td>
              <td>
                <button
                  className={`favorite-button ${favorites.includes(item.id) ? "active" : ""}`}
                  type="button"
                  aria-label={favorites.includes(item.id) ? "取消收藏" : "收藏"}
                  title={favorites.includes(item.id) ? "取消收藏" : "收藏"}
                  onClick={(event) => toggleFavorite(event, item.id)}
                >
                  <span aria-hidden="true">{favorites.includes(item.id) ? "★" : "☆"}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
