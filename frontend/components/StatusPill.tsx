import { Badge } from "@/components/ui/badge";

export function StatusPill({ label }: { label: string }) {
  return <Badge variant={mapVariant(label)}>{label}</Badge>;
}

function mapVariant(label: string) {
  if (label === "高优先级" || label === "已有客户" || label === "高度匹配" || label === "低风险" || label === "低") {
    return "success" as const;
  }
  if (label === "中优先级" || label === "部分匹配" || label === "中风险" || label === "中" || label === "潜在客户") {
    return "warning" as const;
  }
  if (label === "高风险" || label === "高" || label === "低匹配") {
    return "danger" as const;
  }
  if (label === "未匹配") {
    return "neutral" as const;
  }
  return "info" as const;
}
