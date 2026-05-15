export function StatusPill({ label }: { label: string }) {
  const tone = label.includes("高") || label.includes("已有") || label.includes("低") || label.includes("高度")
    ? "good"
    : label.includes("中") || label.includes("部分")
      ? "warn"
      : "muted";
  return <span className={`pill ${tone}`}>{label}</span>;
}
