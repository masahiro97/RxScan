/**
 * Claude Sonnet Vision — フォールバック OCR
 * 全体信頼度 < 60% または Document AI エラー時のみ使用
 * コスト: ≒ ¥3.2/枚（通常フローの8倍）
 */
import Anthropic from "@anthropic-ai/sdk";
import type { PrescriptionOcrResult } from "./types";

const PROMPT = `あなたは日本の調剤薬局向け処方箋解析システムです。
添付の処方箋画像を解析し、以下のJSON形式で処方箋情報を抽出してください。

読み取れない項目は null にしてください。
信頼度 (confidence) は 0-100 で返してください。
日付は YYYY-MM-DD 形式にしてください。

必要なJSON構造:
{
  "institution": { "name": null, "code": null, "address": null, "phone": null, "confidence": 0 },
  "doctor": { "name": null, "department": null, "confidence": 0 },
  "patient": {
    "name": null, "nameKana": null, "birthDate": null, "gender": null,
    "insurerNumber": null, "insuredNumber": null, "insuranceSymbol": null,
    "copayRatio": null, "confidence": 0
  },
  "prescription": {
    "date": null, "expiryDate": null, "isGenericSubstitutable": true,
    "dispensingNotes": null, "refillCount": null
  },
  "items": [
    {
      "rpNumber": 1, "medicineName": "薬剤名", "isGenericName": false,
      "dosage": "1錠", "administration": "1日3回毎食後", "durationDays": 7,
      "totalQuantity": "21錠", "isPrn": false, "notes": null, "confidence": 0
    }
  ],
  "overallConfidence": 0
}

JSONのみを返してください。マークダウンは不要です。`;

export async function parseWithClaudeVision(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<PrescriptionOcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定です");

  const start = Date.now();
  const client = new Anthropic({ apiKey });

  const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBuffer.toString("base64"),
            },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  // JSON部分のみ抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude Vision から有効なJSONが得られませんでした");

  const parsed = JSON.parse(jsonMatch[0]) as {
    institution: PrescriptionOcrResult["institution"];
    doctor: PrescriptionOcrResult["doctor"];
    patient: PrescriptionOcrResult["patient"];
    prescription: PrescriptionOcrResult["prescription"];
    items: PrescriptionOcrResult["items"];
    overallConfidence: number;
  };

  return {
    meta: {
      pipeline: "claude-vision-fallback",
      processingTimeMs: Date.now() - start,
      overallConfidence: parsed.overallConfidence,
    },
    institution: parsed.institution,
    doctor: parsed.doctor,
    patient: parsed.patient,
    prescription: parsed.prescription,
    items: parsed.items,
  };
}
