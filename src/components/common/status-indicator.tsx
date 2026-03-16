interface StatusIndicatorProps {
  status: "pending" | "reviewing" | "approved" | "dispensed" | "rejected";
  className?: string;
}

const STATUS_CONFIG = {
  pending:   { label: "未確認",   dotColor: "bg-neutral-400" },
  reviewing: { label: "確認中",   dotColor: "bg-info-500" },
  approved:  { label: "承認済み", dotColor: "bg-success-500" },
  dispensed: { label: "調剤済み", dotColor: "bg-primary-500" },
  rejected:  { label: "却下",    dotColor: "bg-danger-500" },
};

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span className={`h-2 w-2 rounded-full shrink-0 ${config.dotColor}`} aria-hidden="true" />
      <span className="sr-only">{config.label}</span>
      <span className="text-sm text-neutral-700">{config.label}</span>
    </span>
  );
}
