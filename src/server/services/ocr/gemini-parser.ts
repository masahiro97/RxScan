/**
 * Gemini 2.5 Flash — Document AI のテキスト出力を処方箋 JSON に構造化パース
 * 画像は送らず、テキストのみ → コスト最小化
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import type { PrescriptionOcrResult } from "./types";

const SYSTEM_PROMPT = `あなたは日本の調剤薬局向け処方箋解析システムです。
入力された処方箋テキスト（OCR結果）を解析し、指定されたJSON形式に変換してください。

重要なルール:
- 読み取れない項目は null にする
- 信頼度 (confidence) は 0-100 で、確信度が高い場合は90以上、不明瞭な場合は60未満
- 日付は YYYY-MM-DD 形式
- 薬剤名はOCR読み取りのまま（正規化しない）
- Rp番号は処方明細の番号（1, 2, 3...）
- 負担割合は数値で (10, 20, 30のいずれか)`;

export async function parseWithGemini(
  ocrText: string,
  tableData: string,
): Promise<PrescriptionOcrResult["patient"] & {
  institution: PrescriptionOcrResult["institution"];
  doctor: PrescriptionOcrResult["doctor"];
  prescription: PrescriptionOcrResult["prescription"];
  items: PrescriptionOcrResult["items"];
  overallConfidence: number;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(),
    },
  });

  const prompt = `${SYSTEM_PROMPT}

【OCRテキスト】
${ocrText}

【テーブルデータ】
${tableData || "（なし）"}

上記を解析して処方箋情報をJSONで返してください。`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return JSON.parse(text) as ReturnType<typeof parseWithGemini> extends Promise<infer T> ? T : never;
}

function buildResponseSchema(): Schema {
  return {
    type: SchemaType.OBJECT,
    properties: {
      institution: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, nullable: true },
          code: { type: SchemaType.STRING, nullable: true },
          address: { type: SchemaType.STRING, nullable: true },
          phone: { type: SchemaType.STRING, nullable: true },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["name", "code", "address", "phone", "confidence"],
      },
      doctor: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, nullable: true },
          department: { type: SchemaType.STRING, nullable: true },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["name", "department", "confidence"],
      },
      name: { type: SchemaType.STRING, nullable: true },
      nameKana: { type: SchemaType.STRING, nullable: true },
      birthDate: { type: SchemaType.STRING, nullable: true },
      gender: { type: SchemaType.STRING, nullable: true },
      insurerNumber: { type: SchemaType.STRING, nullable: true },
      insuredNumber: { type: SchemaType.STRING, nullable: true },
      insuranceSymbol: { type: SchemaType.STRING, nullable: true },
      copayRatio: { type: SchemaType.NUMBER, nullable: true },
      confidence: { type: SchemaType.NUMBER },
      prescription: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, nullable: true },
          expiryDate: { type: SchemaType.STRING, nullable: true },
          isGenericSubstitutable: { type: SchemaType.BOOLEAN },
          dispensingNotes: { type: SchemaType.STRING, nullable: true },
          refillCount: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ["date", "expiryDate", "isGenericSubstitutable", "dispensingNotes", "refillCount"],
      },
      items: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            rpNumber: { type: SchemaType.NUMBER },
            medicineName: { type: SchemaType.STRING },
            isGenericName: { type: SchemaType.BOOLEAN },
            dosage: { type: SchemaType.STRING },
            administration: { type: SchemaType.STRING },
            durationDays: { type: SchemaType.NUMBER, nullable: true },
            totalQuantity: { type: SchemaType.STRING, nullable: true },
            isPrn: { type: SchemaType.BOOLEAN },
            notes: { type: SchemaType.STRING, nullable: true },
            confidence: { type: SchemaType.NUMBER },
          },
          required: ["rpNumber", "medicineName", "isGenericName", "dosage",
            "administration", "durationDays", "totalQuantity", "isPrn", "notes", "confidence"],
        },
      },
      overallConfidence: { type: SchemaType.NUMBER },
    },
    required: ["institution", "doctor", "name", "nameKana", "birthDate", "gender",
      "insurerNumber", "insuredNumber", "insuranceSymbol", "copayRatio", "confidence",
      "prescription", "items", "overallConfidence"],
  };
}
