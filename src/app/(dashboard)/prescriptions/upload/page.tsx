"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileImage, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/tiff", "application/pdf"];
const MAX_SIZE_MB = 20;

export default function UploadPage() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const getUploadUrl = trpc.prescription.getUploadUrl.useMutation();
  const createAndOcr = trpc.prescription.createAndOcr.useMutation();

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
      // 1. presigned URL を取得
      const { uploadUrl, s3Key } = await getUploadUrl.mutateAsync({
        fileName: f.name,
        mimeType: f.type as "image/jpeg" | "image/png" | "image/tiff" | "application/pdf",
        fileSizeBytes: f.size,
      });

      // 2. S3 にアップロード
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: f,
        headers: { "Content-Type": f.type },
      });
      if (!uploadRes.ok) throw new Error("S3アップロードに失敗しました");

      setState("processing");

      // 3. 処方箋作成 + OCR 開始
      const { id } = await createAndOcr.mutateAsync({
        s3Key,
        mimeType: f.type as "image/jpeg" | "image/png" | "image/tiff" | "application/pdf",
        fileSizeBytes: f.size,
      });

      setState("done");
      toast.success("処方箋を登録しました。OCRを実行中です。");
      setTimeout(() => router.push(`/prescriptions/${id}/review`), 1000);
    } catch (err) {
      setState("error");
      toast.error("アップロードに失敗しました");
      console.error(err);
    }
  }, [getUploadUrl, createAndOcr, router]);

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

  return (
    <>
      <Header title="処方箋アップロード" />
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8">
            {state === "idle" && (
              <label
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors ${
                  dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
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

            {(state === "uploading" || state === "processing") && (
              <div className="flex flex-col items-center py-12 gap-4">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                <div className="text-center">
                  <p className="font-medium text-gray-700">
                    {state === "uploading" ? "アップロード中..." : "OCR処理中..."}
                  </p>
                  {file && <p className="text-sm text-gray-400 mt-1">{file.name}</p>}
                  {state === "processing" && (
                    <p className="text-xs text-gray-400 mt-2">
                      Document AI + Gemini で処方箋を解析しています...
                    </p>
                  )}
                </div>
              </div>
            )}

            {state === "done" && (
              <div className="flex flex-col items-center py-12 gap-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="font-medium text-gray-700">登録完了！レビュー画面に移動します...</p>
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
