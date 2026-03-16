/**
 * OCR パイプライン統合オーケストレーター
 * Step1: Document AI → Step2: Gemini パース → フォールバック: Claude Vision
 */
import { extractTextWithDocumentAi } from "./document-ai";
import { parseWithGemini } from "./gemini-parser";
import { parseWithClaudeVision } from "./claude-vision-fallback";
import type { PrescriptionOcrResult } from "./types";

const FALLBACK_THRESHOLD = 60; // 全体信頼度がこれ未満ならフォールバック

export async function runOcrPipeline(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<PrescriptionOcrResult> {
  const start = Date.now();

  try {
    // Step 1: Document AI でテキスト抽出（画像は自動リサイズ済み）
    const docAiResult = await extractTextWithDocumentAi(imageBuffer, mimeType);

    // Document AI の信頼度が低すぎる場合はフォールバック
    if (docAiResult.confidence < FALLBACK_THRESHOLD) {
      console.log(`Document AI 信頼度 ${docAiResult.confidence.toFixed(1)}% < ${FALLBACK_THRESHOLD}% → Claude Vision フォールバック`);
      return await parseWithClaudeVision(imageBuffer, mimeType);
    }

    // Step 2: テーブルデータ整形
    const tableText = docAiResult.tables
      .map((t, i) =>
        `テーブル${i + 1}:\nヘッダー: ${t.headers.join(" | ")}\n${t.rows.map((r) => r.join(" | ")).join("\n")}`
      )
      .join("\n\n");

    // Form Parser のフォームフィールド整形（Form Parser 使用時のみ値あり）
    const formFieldText = docAiResult.formFields.length > 0
      ? docAiResult.formFields.map((f) => `${f.name}: ${f.value}`).join("\n")
      : "";

    // Step 3: Gemini でパース（thinking オフ・整合性チェック込み）
    const geminiResult = await parseWithGemini(docAiResult.text, tableText, formFieldText);

    // Gemini パース後も信頼度が低ければフォールバック
    if (geminiResult.overallConfidence < FALLBACK_THRESHOLD) {
      console.log(`Gemini 信頼度 ${geminiResult.overallConfidence}% < ${FALLBACK_THRESHOLD}% → Claude Vision フォールバック`);
      return await parseWithClaudeVision(imageBuffer, mimeType);
    }

    return {
      meta: {
        pipeline: "document-ai+gemini",
        processingTimeMs: Date.now() - start,
        overallConfidence: geminiResult.overallConfidence,
        textBlocks: docAiResult.textBlocks,
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
    console.error("通常OCRパイプラインエラー:", err);
    return await parseWithClaudeVision(imageBuffer, mimeType);
  }
}
