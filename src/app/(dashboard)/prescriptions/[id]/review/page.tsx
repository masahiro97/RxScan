"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageViewer } from "@/components/prescription/image-viewer";
import { MedicineSuggest } from "@/components/prescription/medicine-suggest";
import { ConfidenceBadge } from "@/components/prescription/confidence-badge";
import {
  Loader2, ChevronLeft, Save, CheckCircle, XCircle,
  AlertTriangle, Plus, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, STATUS_LABELS } from "@/lib/utils";

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  rpNumber: z.number(),
  rawMedicineName: z.string().min(1, "薬剤名は必須です"),
  medicineId: z.string().uuid().optional(),
  isGenericName: z.boolean(),
  dosage: z.string(),
  administration: z.string(),
  durationDays: z.number().optional(),
  totalQuantity: z.string().optional(),
  isPrn: z.boolean(),
  notes: z.string().optional(),
  confidenceScore: z.number().optional(),
  sortOrder: z.number(),
});

const reviewSchema = z.object({
  patientId: z.string().uuid().optional(),
  institutionName: z.string().optional(),
  institutionCode: z.string().optional(),
  doctorName: z.string().optional(),
  doctorDepartment: z.string().optional(),
  prescribedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isGenericSubstitutable: z.boolean().optional(),
  dispensingNotes: z.string().optional(),
  items: z.array(itemSchema),
});

type ReviewForm = z.infer<typeof reviewSchema>;

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const { data: rx, isLoading } = trpc.prescription.getById.useQuery({ id });
  const saveReview = trpc.prescription.saveReview.useMutation();
  const approve = trpc.prescription.approve.useMutation();
  const reject = trpc.prescription.reject.useMutation();
  const utils = trpc.useUtils();

  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // データ取得後にフォームに反映
  useEffect(() => {
    if (!rx) return;
    reset({
      patientId: rx.patientId ?? undefined,
      institutionName: rx.institutionName ?? "",
      institutionCode: rx.institutionCode ?? "",
      doctorName: rx.doctorName ?? "",
      doctorDepartment: rx.doctorDepartment ?? "",
      prescribedDate: rx.prescribedDate ?? "",
      expiryDate: rx.expiryDate ?? "",
      isGenericSubstitutable: rx.isGenericSubstitutable ?? true,
      dispensingNotes: rx.dispensingNotes ?? "",
      items: rx.items.map((item, idx) => ({
        id: item.id,
        rpNumber: item.rpNumber,
        rawMedicineName: item.rawMedicineName,
        medicineId: item.medicineId ?? undefined,
        isGenericName: item.isGenericName,
        dosage: item.dosage ?? "",
        administration: item.administration ?? "",
        durationDays: item.durationDays ?? undefined,
        totalQuantity: item.totalQuantity ?? undefined,
        isPrn: item.isPrn,
        notes: item.notes ?? undefined,
        confidenceScore: item.confidenceScore ? Number(item.confidenceScore) : undefined,
        sortOrder: idx,
      })),
    });
  }, [rx, reset]);

  const onSave = handleSubmit(async (data) => {
    try {
      await saveReview.mutateAsync({ id, ...data });
      await utils.prescription.getById.invalidate({ id });
      toast.success("保存しました");
    } catch {
      toast.error("保存に失敗しました");
    }
  });

  const onApprove = async () => {
    // 先に保存してから承認
    await onSave();
    try {
      await approve.mutateAsync({ id });
      toast.success("処方箋を承認しました");
      router.push("/prescriptions");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "承認に失敗しました");
    }
  };

  const onReject = async () => {
    if (!rejectReason.trim()) { toast.error("却下理由を入力してください"); return; }
    try {
      await reject.mutateAsync({ id, reason: rejectReason });
      toast.success("処方箋を却下しました");
      router.push("/prescriptions");
    } catch {
      toast.error("却下に失敗しました");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!rx) return <div className="p-6 text-red-500">処方箋が見つかりません</div>;

  const ocrResult = rx.ocrResults[0];
  const overallConfidence = ocrResult
    ? (ocrResult.confidenceScores as { overall?: number } | null)?.overall ?? 0
    : 0;
  const textBlocks = (ocrResult?.rawResponse as { textBlocks?: { page: number; x: number; y: number; w: number; h: number }[] } | null)?.textBlocks ?? [];
  const isReadOnly = rx.status === "approved" || rx.status === "dispensed";

  return (
    <>
      <Header />
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* 上部ツールバー */}
        <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-1" /> 一覧
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="font-mono text-sm font-medium">{rx.rxNumber}</span>
          <StatusBadge status={rx.status} />
          {overallConfidence > 0 && (
            <ConfidenceBadge confidence={overallConfidence} />
          )}
          {ocrResult?.pipeline === "claude-vision-fallback" && (
            <Badge variant="outline" className="text-xs">Claude Visionフォールバック</Badge>
          )}
          <div className="ml-auto flex gap-2">
            {!isReadOnly && (
              <>
                <Button
                  size="sm" variant="outline"
                  onClick={onSave}
                  disabled={saveReview.isPending}
                >
                  {saveReview.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  修正を保存
                </Button>
                <Button
                  size="sm" variant="destructive"
                  onClick={() => setShowReject(!showReject)}
                >
                  <XCircle className="h-3 w-3 mr-1" /> 却下
                </Button>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={approve.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approve.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                  承認する
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 却下フォーム */}
        {showReject && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <Input
              placeholder="却下理由を入力..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="flex-1 max-w-md border-red-300"
            />
            <Button size="sm" variant="destructive" onClick={onReject} disabled={reject.isPending}>
              却下を確定
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>キャンセル</Button>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左ペイン: 画像ビューア */}
          <div className="w-1/2 border-r bg-gray-900 flex flex-col">
            {rx.images.length > 0 ? (
              <ImageViewer
                images={rx.images as { url: string; pageNumber: number; mimeType?: string }[]}
                textBlocks={textBlocks}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                画像なし
              </div>
            )}
          </div>

          {/* 右ペイン: OCR結果フォーム */}
          <div className="w-1/2 overflow-y-auto bg-white">
            <form onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) void onApprove(); }}>
              <Tabs defaultValue="rx" className="h-full">
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="rx" className="flex-1">処方内容</TabsTrigger>
                  <TabsTrigger value="patient" className="flex-1">患者情報</TabsTrigger>
                  <TabsTrigger value="institution" className="flex-1">医療機関</TabsTrigger>
                </TabsList>

                {/* 処方内容タブ */}
                <TabsContent value="rx" className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">処方日</Label>
                      <Input type="date" {...register("prescribedDate")} disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">有効期限</Label>
                      <Input type="date" {...register("expiryDate")} disabled={isReadOnly} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">調剤メモ</Label>
                    <Input {...register("dispensingNotes")} disabled={isReadOnly} placeholder="調剤上の注意事項..." />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">処方明細</h3>
                      {!isReadOnly && (
                        <Button
                          type="button" size="sm" variant="outline"
                          onClick={() => append({
                            rpNumber: fields.length + 1,
                            rawMedicineName: "",
                            isGenericName: false,
                            dosage: "",
                            administration: "",
                            isPrn: false,
                            sortOrder: fields.length,
                          })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> 薬剤追加
                        </Button>
                      )}
                    </div>

                    {fields.map((field, idx) => (
                      <PrescriptionItemRow
                        key={field.id}
                        index={idx}
                        register={register}
                        control={control}
                        onRemove={() => remove(idx)}
                        isReadOnly={isReadOnly}
                        confidence={field.confidenceScore}
                      />
                    ))}

                    {fields.length === 0 && (
                      <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-lg">
                        {rx.status === "pending" ? "OCR処理中..." : "処方明細がありません"}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* 患者情報タブ */}
                <TabsContent value="patient" className="p-4 space-y-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    患者情報は個人情報です。必要な場合のみ参照してください。
                  </div>
                  {rx.patient ? (
                    <div className="space-y-2 text-sm">
                      <Row label="氏名" value={rx.patient.name} />
                      <Row label="カナ" value={rx.patient.nameKana} />
                      <Row label="生年月日" value={formatDate(rx.patient.birthDate)} />
                      <Row label="性別" value={rx.patient.gender === "male" ? "男性" : rx.patient.gender === "female" ? "女性" : null} />
                      <Row label="保険者番号" value={rx.patient.insurerNumber} />
                      <Row label="被保険者番号" value={rx.patient.insuredNumber} />
                      <Row label="記号" value={rx.patient.insuranceSymbol} />
                      <Row label="負担割合" value={rx.patient.copayRatio ? `${rx.patient.copayRatio}割` : null} />
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">患者情報が登録されていません</div>
                  )}
                </TabsContent>

                {/* 医療機関タブ */}
                <TabsContent value="institution" className="p-4 space-y-3">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">医療機関名</Label>
                      <Input {...register("institutionName")} disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">医療機関コード</Label>
                      <Input {...register("institutionCode")} disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">処方医</Label>
                      <Input {...register("doctorName")} disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">診療科</Label>
                      <Input {...register("doctorDepartment")} disabled={isReadOnly} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

function PrescriptionItemRow({
  index, register, control, onRemove, isReadOnly, confidence,
}: {
  index: number;
  register: ReturnType<typeof useForm<ReviewForm>>["register"];
  control: ReturnType<typeof useForm<ReviewForm>>["control"];
  onRemove: () => void;
  isReadOnly: boolean;
  confidence?: number;
}) {
  const needsAttention = confidence !== undefined && confidence < 90;

  return (
    <div className={`border rounded-lg p-3 space-y-2 text-sm ${needsAttention ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Rp {index + 1}</span>
        <div className="flex items-center gap-2">
          {confidence !== undefined && <ConfidenceBadge confidence={confidence} />}
          {!isReadOnly && (
            <Button type="button" size="sm" variant="ghost" onClick={onRemove} className="h-6 w-6 p-0 text-red-400 hover:text-red-600">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <MedicineSuggest
        control={control}
        nameField={`items.${index}.rawMedicineName`}
        medicineIdField={`items.${index}.medicineId`}
        disabled={isReadOnly}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">用量</Label>
          <Input size={1} {...register(`items.${index}.dosage`)} disabled={isReadOnly} placeholder="1錠" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">用法</Label>
          <Input size={1} {...register(`items.${index}.administration`)} disabled={isReadOnly} placeholder="1日3回毎食後" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">日数</Label>
          <Input
            type="number"
            {...register(`items.${index}.durationDays`, { valueAsNumber: true })}
            disabled={isReadOnly}
            placeholder="7"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">総量</Label>
          <Input {...register(`items.${index}.totalQuantity`)} disabled={isReadOnly} placeholder="21錠" />
        </div>
      </div>
    </div>
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    reviewing: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    dispensed: "bg-blue-100 text-blue-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? ""}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
