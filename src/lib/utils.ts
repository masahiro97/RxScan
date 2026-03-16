import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRxNumber(): string {
  const now = new Date();
  const dateStr = format(now, "yyyyMMdd");
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `RX-${dateStr}-${rand}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "yyyy年MM月dd日");
  } catch {
    return dateStr;
  }
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 90) return "text-green-600";
  if (confidence >= 70) return "text-yellow-600";
  return "text-red-600";
}

export function confidenceBgColor(confidence: number): string {
  if (confidence >= 90) return "bg-green-50 border-green-200";
  if (confidence >= 70) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "待機中",
  reviewing: "確認中",
  approved: "承認済",
  dispensed: "調剤済",
  rejected: "却下",
};

export const ROLE_LABELS: Record<string, string> = {
  pharmacist: "薬剤師",
  clerk: "事務員",
  admin: "管理者",
};
