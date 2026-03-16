"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

export default function MedicinesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: searchResults, isLoading: searching } = trpc.medicine.search.useQuery(
    { query: search, limit: 50 },
    { enabled: search.length >= 1 }
  );
  const { data: listData, isLoading: listing } = trpc.medicine.list.useQuery(
    { page, limit: 50 },
    { enabled: search.length === 0 }
  );

  const rows = search ? searchResults : listData?.rows ?? [];
  const isLoading = search ? searching : listing;

  return (
    <>
      <Header title="薬剤マスタ" />
      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="薬剤名・一般名・YJコードで検索..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">薬剤名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">一般名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">YJコード</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">メーカー</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">種別</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></td></tr>}
              {!isLoading && (!rows || rows.length === 0) && (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">薬剤が見つかりません</td></tr>
              )}
              {rows?.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.genericName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.yjCode ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{m.manufacturer ?? "—"}</td>
                  <td className="px-4 py-3">
                    {m.isGeneric
                      ? <Badge variant="outline" className="text-xs">後発品</Badge>
                      : <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">先発品</Badge>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!search && listData && listData.total > 50 && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600">
              <span>{listData.total}件中 {(page-1)*50+1}〜{Math.min(page*50, listData.total)}件</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p=>p-1)}>前へ</Button>
                <Button size="sm" variant="outline" disabled={page*50>=listData.total} onClick={() => setPage(p=>p+1)}>次へ</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
