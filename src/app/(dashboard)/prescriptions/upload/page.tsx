"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/tiff", "application/pdf"];
const MAX_SIZE_MB = 20;

const STEPS = [
  { threshold: 0,  label: "画像をアップロード中..." },
  { threshold: 15, label: "画像を解析中..." },
  { threshold: 35, label: "テキストを認識中..." },
  { threshold: 60, label: "処方情報を抽出中..." },
  { threshold: 85, label: "データを確認中..." },
];

function useProgressBar(active: boolean) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }

    // イージング: 速く始まり 99% 手前でほぼ止まる
    const tick = () => {
      setProgress((prev) => {
        if (prev >= 99) return 99;
        const remaining = 99 - prev;
        const increment = Math.max(0.15, remaining * 0.045);
        return Math.min(99, prev + increment);
      });
      rafRef.current = setTimeout(tick, 120);
    };

    rafRef.current = setTimeout(tick, 120);
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [active]);

  const complete = () => setProgress(100);

  return { progress, complete };
}

export default function UploadPage() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { progress, complete } = useProgressBar(state === "uploading" || state === "processing");

  const getUploadUrl = trpc.prescription.getUploadUrl.useMutation();
  const createAndOcr = trpc.prescription.createAndOcr.useMutation();

  const currentStep = [...STEPS].reverse().find((s) => progress >= s.threshold) ?? STEPS[0];

  const handleFile = useCallback(async (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error("対応形式: JPEG, PNG, TIFF, PDF");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`ファイルサイズは${MAX_SIZE_MB}MB以下にしてください`);
      return;
    }
    setFile(f);
    setState("uploading");

    try {
      const { uploadUrl, s3Key } = await getUploadUrl.mutateAsync({
        fileName: f.name,
        mimeType: f.type as "image/jpeg" | "image/png" | "image/tiff" | "application/pdf",
        fileSizeBytes: f.size,
      });

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: f,
        headers: { "Content-Type": f.type },
      });
      if (!uploadRes.ok) throw new Error("S3アップロードに失敗しました");

      setState("processing");

      const { id } = await createAndOcr.mutateAsync({
        s3Key,
        mimeType: f.type as "image/jpeg" | "image/png" | "image/tiff" | "application/pdf",
        fileSizeBytes: f.size,
      });

      complete();
      setState("done");
      setTimeout(() => router.push(`/prescriptions/${id}/review`), 600);
    } catch (err) {
      setState("error");
      toast.error("アップロードに失敗しました");
      console.error(err);
    }
  }, [getUploadUrl, createAndOcr, router, complete]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  };

  const isProcessing = state === "uploading" || state === "processing";

  return (
    <>
      <Header title="処方箋アップロード" />
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8">
            {state === "idle" && (
              <label
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors ${
                  dragOver ? "border-primary-400 bg-primary-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <Upload className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700">処方箋をドラッグ&ドロップ</p>
                <p className="text-sm text-gray-400 mt-1">または クリックしてファイルを選択</p>
                <p className="text-xs text-gray-400 mt-3">JPEG, PNG, TIFF, PDF（最大{MAX_SIZE_MB}MB）</p>
                <input
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={onFileInput}
                />
              </label>
            )}

            {(isProcessing || state === "done") && (
              <div className="flex flex-col items-center py-10 gap-6 w-full">
                {state === "done" ? (
                  <CheckCircle className="h-12 w-12 text-green-500" />
                ) : (
                  // ファイルサムネイルアイコン
                  <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center">
                    <Upload className="h-7 w-7 text-primary-500" />
                  </div>
                )}

                <div className="w-full max-w-sm text-center">
                  <p className="font-medium text-gray-700 mb-1">
                    {state === "done" ? "完了！レビュー画面へ移動します" : currentStep?.label}
                  </p>
                  {file && (
                    <p className="text-xs text-gray-400 mb-4 truncate">{file.name}</p>
                  )}

                  {/* プログレスバー */}
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #FF5543, #ff7a6d)",
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{Math.round(progress)}%</p>
                </div>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center py-12 gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="font-medium text-gray-700">エラーが発生しました</p>
                <Button onClick={() => setState("idle")}>再試行</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
