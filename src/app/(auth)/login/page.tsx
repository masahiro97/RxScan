"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Loader2, AlertCircle, Shield } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
  totpCode: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showTotp, setShowTotp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        totpCode: data.totpCode ?? "",
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("TOTP") || result.error.includes("totp")) {
          setShowTotp(true);
          setError("認証コードを入力してください");
        } else {
          setError("メールアドレスまたはパスワードが正しくありません");
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm px-4">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-500 rounded-xl mb-4 shadow-sm">
            <span className="text-white font-bold text-xl">Rx</span>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900">RxScan</h1>
          <p className="text-sm text-neutral-500 mt-1">処方箋OCR登録システム</p>
          <p className="text-xs text-neutral-400 mt-0.5">裕生堂</p>
        </div>

        <Card className="bg-white border-neutral-200 shadow-sm rounded-xl">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-neutral-700">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="pharmacy@example.com"
                  className="h-9 text-sm border-neutral-300 focus:border-primary-500 focus:ring-primary-500/20"
                  {...register("email")}
                  autoFocus
                />
                {errors.email && (
                  <p className="text-xs text-danger-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-neutral-700">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  className="h-9 text-sm border-neutral-300 focus:border-primary-500 focus:ring-primary-500/20"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-danger-600">{errors.password.message}</p>
                )}
              </div>

              {showTotp && (
                <div className="space-y-1.5">
                  <Label htmlFor="totpCode" className="text-sm font-medium text-neutral-700 flex items-center gap-1.5">
                    <Shield size={14} className="text-neutral-400" />
                    認証コード（6桁）
                  </Label>
                  <Input
                    id="totpCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="h-9 text-sm font-mono tracking-widest border-neutral-300 focus:border-primary-500 focus:ring-primary-500/20"
                    {...register("totpCode")}
                    autoFocus
                  />
                </div>
              )}

              {error && (
                <Alert className="flex items-center gap-2 py-2 px-3 text-sm bg-danger-50 border-danger-300 text-danger-700">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    ログイン中...
                  </>
                ) : (
                  "ログイン"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
