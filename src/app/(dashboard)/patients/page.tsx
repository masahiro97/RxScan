"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.patient.list.useQuery({ search: search || undefined, page, limit: 20 });

  return (
    <>
      <Header title="患者一覧" />
      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="氏名・カナで検索..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">氏名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">フリガナ</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">生年月日</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">性別</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></td></tr>}
              {!isLoading && data?.rows.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-gray-400">患者が見つかりません</td></tr>}
              {data?.rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.nameKana ?? "—"}</td>
                  <td className="px-4 py-3">{formatDate(p.birthDate)}</td>
                  <td className="px-4 py-3">{p.gender === "male" ? "男性" : p.gender === "female" ? "女性" : "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/patients/${p.id}`}>
                      <Button size="sm" variant="ghost" className="gap-1">詳細 <ChevronRight className="h-3 w-3" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
