"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const storeSchema = z.object({
  name: z.string().min(1, "店舗名は必須です"),
  address: z.string().optional(),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
});
type StoreForm = z.infer<typeof storeSchema>;

export default function StoreSettingsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const utils = trpc.useUtils();

  const { data: currentStore } = trpc.store.getCurrent.useQuery();
  const { data: allStores } = trpc.store.list.useQuery();
  const update = trpc.store.update.useMutation();
  const create = trpc.store.create.useMutation();
  const deleteStore = trpc.store.delete.useMutation();

  // 現在の店舗編集フォーム
  const editForm = useForm<StoreForm>({ resolver: zodResolver(storeSchema) });
  useEffect(() => {
    if (currentStore) editForm.reset({
      name: currentStore.name,
      address: currentStore.address ?? "",
      phone: currentStore.phone ?? "",
      licenseNumber: currentStore.licenseNumber ?? "",
    });
  }, [currentStore, editForm]);

  // 新規店舗追加フォーム
  const addForm = useForm<StoreForm>({ resolver: zodResolver(storeSchema) });

  const onUpdate = editForm.handleSubmit(async (data) => {
    try {
      await update.mutateAsync(data);
      await utils.store.getCurrent.invalidate();
      toast.success("店舗情報を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    }
  });

  const onAdd = addForm.handleSubmit(async (data) => {
    try {
      await create.mutateAsync(data);
      await utils.store.list.invalidate();
      addForm.reset();
      setShowAdd(false);
      toast.success("店舗を追加しました");
    } catch {
      toast.error("追加に失敗しました");
    }
  });

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？この操作は元に戻せません。`)) return;
    try {
      await deleteStore.mutateAsync({ id });
      await utils.store.list.invalidate();
      toast.success("店舗を削除しました");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <>
      <Header title="店舗設定" />
      <div className="p-6 max-w-2xl space-y-6">

        {/* 現在の店舗編集 */}
        <Card>
          <CardHeader><CardTitle>現在の店舗情報</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onUpdate} className="space-y-4">
              <div className="space-y-1">
                <Label>店舗名 <span className="text-red-500">*</span></Label>
                <Input {...editForm.register("name")} />
                {editForm.formState.errors.name && <p className="text-xs text-red-500">{editForm.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>住所</Label>
                <Input {...editForm.register("address")} />
              </div>
              <div className="space-y-1">
                <Label>電話番号</Label>
                <Input {...editForm.register("phone")} />
              </div>
              <div className="space-y-1">
                <Label>薬局開設許可番号</Label>
                <Input {...editForm.register("licenseNumber")} />
              </div>
              <Button type="submit" disabled={update.isPending} className="gap-2">
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 店舗一覧 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>店舗一覧</CardTitle>
              <Button size="sm" className="gap-1" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="h-4 w-4" /> 店舗を追加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 追加フォーム */}
            {showAdd && (
              <form onSubmit={onAdd} className="border rounded-lg p-4 space-y-3 bg-neutral-50">
                <p className="text-sm font-medium">新規店舗</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label>店舗名 <span className="text-red-500">*</span></Label>
                    <Input {...addForm.register("name")} placeholder="例: RxScan 博多店" />
                    {addForm.formState.errors.name && <p className="text-xs text-red-500">{addForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>電話番号</Label>
                    <Input {...addForm.register("phone")} placeholder="092-xxx-xxxx" />
                  </div>
                  <div className="space-y-1">
                    <Label>薬局開設許可番号</Label>
                    <Input {...addForm.register("licenseNumber")} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>住所</Label>
                    <Input {...addForm.register("address")} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={create.isPending} className="gap-1">
                    {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    追加
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>キャンセル</Button>
                </div>
              </form>
            )}

            {/* 店舗リスト */}
            <div className="divide-y divide-neutral-100">
              {allStores?.map((store) => (
                <div key={store.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {store.name}
                      {store.id === currentStore?.id && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">現在</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400">{store.address ?? "住所未設定"}</div>
                  </div>
                  {store.id !== currentStore?.id && (
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(store.id, store.name)}
                      disabled={deleteStore.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
