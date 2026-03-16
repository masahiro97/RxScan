"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "店舗名は必須です"),
  address: z.string().optional(),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function StoreSettingsPage() {
  const { data: store } = trpc.store.getCurrent.useQuery();
  const update = trpc.store.update.useMutation();
  const utils = trpc.useUtils();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (store) reset({ name: store.name, address: store.address ?? "", phone: store.phone ?? "", licenseNumber: store.licenseNumber ?? "" });
  }, [store, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await update.mutateAsync(data);
      await utils.store.getCurrent.invalidate();
      toast.success("店舗情報を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    }
  });

  return (
    <>
      <Header title="店舗設定" />
      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader><CardTitle>店舗情報</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>店舗名 <span className="text-red-500">*</span></Label>
                <Input {...register("name")} />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>住所</Label>
                <Input {...register("address")} />
              </div>
              <div className="space-y-1">
                <Label>電話番号</Label>
                <Input {...register("phone")} />
              </div>
              <div className="space-y-1">
                <Label>薬局開設許可番号</Label>
                <Input {...register("licenseNumber")} />
              </div>
              <Button type="submit" disabled={update.isPending} className="gap-2">
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
