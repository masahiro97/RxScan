import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const score = Math.round(confidence);
  const isHigh = score >= 90;
  const isLow = score < 60;

  if (isHigh) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700",
          className
        )}
      >
        <CheckCircle2 size={12} />
        {score}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isLow
          ? "bg-danger-50 text-danger-700"
          : "bg-warning-50 text-warning-700",
        className
      )}
    >
      <AlertTriangle size={12} />
      {score}
    </span>
  );
}
