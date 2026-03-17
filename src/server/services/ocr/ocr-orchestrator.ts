/**
 * OCR パイプライン統合オーケストレーター
 * Azure DI (textBlocks取得) と Gemini Vision (構造化抽出) を並列実行
 */
import { extractTextWithDocumentAi } from "./document-ai";
import { parseWithGeminiVision } from "./gemini-parser";
import { parseWithClaudeVision } from "./claude-vision-fallback";
import type { PrescriptionOcrResult } from "./types";

const FALLBACK_THRESHOLD = 60;

export async function runOcrPipeline(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<PrescriptionOcrResult> {
  const start = Date.now();

  try {
    // Azure DI (textBlocks) と Gemini Vision (構造化抽出) を同時実行
    const [azureResult, geminiResult] = await Promise.all([
      extractTextWithDocumentAi(imageBuffer, mimeType),
      parseWithGeminiVision(imageBuffer, mimeType),
    ]);

    // 信頼度が低すぎる場合はフォールバック
    if (geminiResult.overallConfidence < FALLBACK_THRESHOLD) {
      console.log(`Gemini Vision 信頼度 ${geminiResult.overallConfidence}% < ${FALLBACK_THRESHOLD}% → Claude Vision フォールバック`);
      return await parseWithClaudeVision(imageBuffer, mimeType);
    }

    return {
      meta: {
        pipeline: "azure-read+gemini-vision-parallel",
        processingTimeMs: Date.now() - start,
        overallConfidence: geminiResult.overallConfidence,
        textBlocks: azureResult.textBlocks,
      },
      institution: geminiResult.institution,
      doctor: geminiResult.doctor,
      patient: {
        name: geminiResult.name,
        nameKana: geminiResult.nameKana,
        birthDate: geminiResult.birthDate,
        gender: geminiResult.gender as "male" | "female" | null,
        insurerNumber: geminiResult.insurerNumber,
        insuredNumber: geminiResult.insuredNumber,
        insuranceSymbol: geminiResult.insuranceSymbol,
        copayRatio: geminiResult.copayRatio,
        confidence: geminiResult.confidence,
      },
      prescription: geminiResult.prescription,
      items: geminiResult.items,
    };
  } catch (err) {
    console.error("並列OCRパイプラインエラー:", err);
    return await parseWithClaudeVision(imageBuffer, mimeType);
  }
}
