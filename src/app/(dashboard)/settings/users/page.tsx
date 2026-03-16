"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/utils";
import { useController } from "react-hook-form";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "8文字以上"),
  role: z.enum(["pharmacist", "clerk", "admin"]),
});
type CreateForm = z.infer<typeof createSchema>;

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const { data: users, refetch } = trpc.store.listUsers.useQuery();
  const createUser = trpc.store.createUser.useMutation();
  const updateUser = trpc.store.updateUser.useMutation();
  const utils = trpc.useUtils();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "clerk" },
  });
  const { field: roleField } = useController({ control, name: "role" });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createUser.mutateAsync(data);
      await utils.store.listUsers.invalidate();
      toast.success("ユーザーを作成しました");
      reset();
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "作成に失敗しました");
    }
  });

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateUser.mutateAsync({ id, isActive: !isActive });
      await utils.store.listUsers.invalidate();
      toast.success(isActive ? "ユーザーを無効化しました" : "ユーザーを有効化しました");
    } catch {
      toast.error("更新に失敗しました");
    }
  };

  return (
    <>
      <Header title="ユーザー管理" />
      <div className="p-6 space-y-4 max-w-3xl">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />ユーザーを追加</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>新規ユーザー作成</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>氏名</Label>
                  <Input {...register("name")} />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>メールアドレス</Label>
                  <Input type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>初期パスワード</Label>
                  <Input type="password" {...register("password")} />
                  {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>ロール</Label>
                  <Select value={roleField.value} onValueChange={roleField.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clerk">事務員</SelectItem>
                      <SelectItem value="pharmacist">薬剤師</SelectItem>
                      <SelectItem value="admin">管理者</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createUser.isPending}>
                  {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  作成
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">氏名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">メール</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">ロール</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">状態</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users?.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive
                        ? <Badge className="text-xs bg-green-100 text-green-700">有効</Badge>
                        : <Badge className="text-xs bg-gray-100 text-gray-500">無効</Badge>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => toggleActive(u.id, u.isActive)}
                        className={u.isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-700"}
                      >
                        {u.isActive ? <><UserX className="h-3 w-3 mr-1" />無効化</> : <><UserCheck className="h-3 w-3 mr-1" />有効化</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
