"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDate, STATUS_LABELS } from "@/lib/utils";

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = trpc.patient.getById.useQuery({ id });

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <div className="p-6 text-red-500">患者が見つかりません</div>;

  const { patient, prescriptions } = data;

  return (
    <>
      <Header />
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Link href="/patients"><Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4 mr-1" />患者一覧</Button></Link>
          <h1 className="text-xl font-bold">{patient.name}</h1>
        </div>

        <div className="bg-white rounded-lg border p-4 grid grid-cols-2 gap-4 text-sm">
          <Row label="氏名" value={patient.name} />
          <Row label="フリガナ" value={patient.nameKana} />
          <Row label="生年月日" value={formatDate(patient.birthDate)} />
          <Row label="性別" value={patient.gender === "male" ? "男性" : patient.gender === "female" ? "女性" : null} />
          <Row label="保険者番号" value={patient.insurerNumber} />
          <Row label="被保険者番号" value={patient.insuredNumber} />
          <Row label="記号" value={patient.insuranceSymbol} />
          <Row label="負担割合" value={patient.copayRatio ? `${patient.copayRatio}割` : null} />
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="col-span-2">
              <span className="text-gray-500">アレルギー: </span>
              <span className="font-medium text-red-600">{patient.allergies.join("、")}</span>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">処方履歴</h2>
          <div className="bg-white rounded-lg border divide-y">
            {prescriptions.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">処方履歴がありません</div>}
            {prescriptions.map((rx) => (
              <Link key={rx.id} href={`/prescriptions/${rx.id}/review`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <div className="font-mono text-xs text-gray-500">{rx.rxNumber}</div>
                  <div className="text-sm">{formatDate(rx.prescribedDate)} — {rx.items.map(i => i.rawMedicineName).join("、")}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${rx.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                  {STATUS_LABELS[rx.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
