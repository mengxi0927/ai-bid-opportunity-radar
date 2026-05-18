"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { Tender } from "@/lib/api";
import { StatusPill } from "@/components/StatusPill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TenderTable({
  items,
  favorites = [],
  onToggleFavorite,
  title = "推荐列表",
  description = "按综合评分、客户关系、能力匹配和风险水平排序"
}: {
  items: Tender[];
  favorites?: string[];
  onToggleFavorite?: (id: string) => void;
  title?: string;
  description?: string;
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
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>项目与时间</TableHead>
              <TableHead>招标方</TableHead>
              <TableHead>推荐</TableHead>
              <TableHead>客户/能力</TableHead>
              <TableHead>风险</TableHead>
              <TableHead className="text-right">评分</TableHead>
              <TableHead className="text-right">收藏</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              items.map((item) => (
                <TableRow
                  className="cursor-pointer"
                  key={item.id}
                  onClick={() => openTender(item.id)}
                  tabIndex={0}
                  onKeyDown={(event) => event.key === "Enter" && openTender(item.id)}
                >
                  <TableCell>
                    <div className="space-y-2">
                      <div className="font-medium text-slate-950">{item.title}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.published_at}</span>
                        <span>•</span>
                        <span>{item.notice_type}</span>
                        <span>•</span>
                        <span>{item.deadline}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{item.buyer}</TableCell>
                  <TableCell><StatusPill label={item.recommendation_level} /></TableCell>
                  <TableCell>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">客户</span>
                        <StatusPill label={item.customer_match.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">能力</span>
                        <StatusPill label={item.capability_match.status} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusPill label={item.risk.level} /></TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-lg font-semibold text-slate-950">{item.score}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                        favorites.includes(item.id)
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      )}
                      type="button"
                      aria-label={favorites.includes(item.id) ? "取消收藏" : "收藏"}
                      onClick={(event) => toggleFavorite(event, item.id)}
                    >
                      <Star className={cn("h-4 w-4", favorites.includes(item.id) && "fill-current")} />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="surface-muted mx-4 my-4 px-6 py-10 text-center text-sm text-muted-foreground">
                    当前筛选条件下暂无标讯，请先同步数据或调整筛选条件。
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
