"use client";

import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, CheckCircle2, ScanLine, ChevronRight, Activity } from "lucide-react";
import Link from "next/link";
import { StatusIndicator } from "@/components/common/status-indicator";
import { ConfidenceBadge } from "@/components/prescription/confidence-badge";

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.prescription.stats.useQuery();
  const { data: recent } = trpc.prescription.list.useQuery({ limit: 5, page: 1 });
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <Header title="ダッシュボード" />
      <div className="p-6 space-y-6 max-w-5xl">

        {/* 本日の処理状況 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-neutral-500">本日の処理状況</h2>
            <span className="text-sm text-neutral-400">{today}</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="待機中"
              value={stats?.pending ?? 0}
              icon={<Clock size={18} className="text-neutral-400" />}
              accentColor="border-l-neutral-300"
              loading={isLoading}
            />
            <StatCard
              label="確認中"
              value={stats?.reviewing ?? 0}
              icon={<Activity size={18} className="text-info-500" />}
              accentColor="border-l-info-500"
              loading={isLoading}
            />
            <StatCard
              label="承認済"
              value={stats?.approved ?? 0}
              icon={<CheckCircle2 size={18} className="text-success-500" />}
              accentColor="border-l-success-500"
              loading={isLoading}
            />
            <StatCard
              label="合計"
              value={stats?.total ?? 0}
              icon={<FileText size={18} className="text-primary-500" />}
              accentColor="border-l-primary-500"
              loading={isLoading}
            />
          </div>
        </div>

        {/* クイックアクション */}
        <div className="flex gap-3">
          <Link href="/prescriptions/upload">
            <Button className="gap-2 bg-primary-500 hover:bg-primary-600 text-white shadow-sm">
              <ScanLine size={16} />
              新規スキャン
            </Button>
          </Link>
          <Link href="/prescriptions">
            <Button variant="outline" className="gap-2">
              <FileText size={16} />
              処方箋一覧
            </Button>
          </Link>
        </div>

        {/* 直近の処方箋 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-neutral-500">直近の処方箋</h2>
            <Link href="/prescriptions" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              全て見る
              <ChevronRight size={12} />
            </Link>
          </div>
          <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {recent?.rows.length === 0 && (
                <div className="p-10 text-center">
                  <FileText size={40} strokeWidth={1} className="text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm">処方箋がありません</p>
                  <p className="text-neutral-400 text-xs mt-1">新しい処方箋をスキャンしてください</p>
                </div>
              )}
              <div className="divide-y divide-neutral-100">
                {recent?.rows.map((rx) => (
                  <Link
                    key={rx.id}
                    href={`/prescriptions/${rx.id}/review`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIndicator status={rx.status as "pending" | "reviewing" | "approved" | "dispensed" | "rejected"} />
                      <div>
                        <div className="text-sm font-medium text-neutral-900">{rx.rxNumber}</div>
                        <div className="text-xs text-neutral-500">
                          {rx.patient?.name ?? "患者未登録"}
                          {rx.scannedBy?.name && <span> · {rx.scannedBy.name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {rx.ocrConfidenceAvg != null && (
                        <ConfidenceBadge confidence={Number(rx.ocrConfidenceAvg)} />
                      )}
                      <ChevronRight size={14} className="text-neutral-300" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label, value, icon, accentColor, loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentColor: string;
  loading?: boolean;
}) {
  return (
    <Card className={`bg-white border-neutral-200 shadow-sm rounded-xl border-l-4 ${accentColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <div className="text-2xl font-semibold text-neutral-900">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
