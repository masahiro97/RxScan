"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanLine, Search, ChevronRight, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { StatusIndicator } from "@/components/common/status-indicator";
import { ConfidenceBadge } from "@/components/prescription/confidence-badge";

type Status = "pending" | "reviewing" | "approved" | "rejected";

export default function PrescriptionsPage() {
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.prescription.list.useQuery({
    status,
    search: search || undefined,
    page,
    limit: 20,
  });

  return (
    <>
      <Header title="処方箋一覧" />
      <div className="p-6 space-y-4">
        {/* ツールバー */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="処方箋番号・患者名で検索..."
              className="pl-9 h-9 text-sm border-neutral-300 focus:border-primary-500"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Link href="/prescriptions/upload">
            <Button className="gap-2 bg-primary-500 hover:bg-primary-600 text-white shadow-sm">
              <ScanLine size={16} />
              新規スキャン
            </Button>
          </Link>
        </div>

        {/* ステータスフィルタ */}
        <Tabs value={status ?? "all"} onValueChange={(v: string) => { setStatus(v === "all" ? undefined : v as Status); setPage(1); }}>
          <TabsList className="bg-neutral-100">
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="pending">未確認</TabsTrigger>
            <TabsTrigger value="reviewing">確認中</TabsTrigger>
            <TabsTrigger value="approved">承認済</TabsTrigger>
            <TabsTrigger value="rejected">却下</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* テーブル */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ステータス</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">受付番号</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">患者名</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">処方日</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">担当者</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">信頼度</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">登録日時</th>
                <th scope="col" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Loader2 size={24} className="animate-spin mx-auto text-neutral-400" />
                  </td>
                </tr>
              )}
              {!isLoading && data?.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <FileText size={36} strokeWidth={1} className="text-neutral-300 mx-auto mb-2" />
                    <p className="text-neutral-500 text-sm">処方箋が見つかりません</p>
                  </td>
                </tr>
              )}
              {data?.rows.map((rx) => (
                <tr
                  key={rx.id}
                  className="hover:bg-neutral-50 transition-colors cursor-pointer"
                  onClick={() => { window.location.href = `/prescriptions/${rx.id}/review`; }}
                >
                  <td className="px-4 py-3">
                    <StatusIndicator status={rx.status as Status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">{rx.rxNumber}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {rx.patient?.name ?? <span className="text-neutral-400">未登録</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{formatDate(rx.prescribedDate)}</td>
                  <td className="px-4 py-3 text-neutral-500">{rx.scannedBy?.name}</td>
                  <td className="px-4 py-3">
                    {rx.ocrConfidenceAvg != null && (
                      <ConfidenceBadge confidence={Number(rx.ocrConfidenceAvg)} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {new Date(rx.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={16} className="text-neutral-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ページネーション */}
          {data && data.total > 20 && (
            <div className="px-4 py-3 border-t border-neutral-100 flex items-center justify-between text-sm text-neutral-500">
              <span>{data.total}件中 {(page - 1) * 20 + 1}〜{Math.min(page * 20, data.total)}件</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>前へ</Button>
                <Button size="sm" variant="outline" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>次へ</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
