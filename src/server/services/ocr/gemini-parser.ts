/**
 * Gemini 2.5 Flash — Document AI のテキスト出力を処方箋 JSON に構造化パース
 * 画像は送らず、テキストのみ → コスト最小化
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import type { PrescriptionOcrResult } from "./types";

// クライアントシングルトン
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (_genAI) return _genAI;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");
  _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

const SYSTEM_PROMPT = `You are a Japanese pharmacy prescription OCR parser. Extract structured data from Japanese prescription text (処方箋) and return valid JSON.

## Output rules
- Missing or unreadable fields → null
- confidence: 0-100 integer (≥90 = high confidence, <60 = uncertain)
- All dates → "YYYY-MM-DD" format
- Medicine names → copy exactly as written (no normalization)
- Rp number → sequential integer (1, 2, 3...) per prescription group
- Copay ratio (負担割合) → integer: 10, 20, or 30

## Date fields — CRITICAL distinction
| Field | Japanese label | Meaning |
|-------|---------------|---------|
| prescription.date | 交付年月日 | Date the doctor issued the prescription |
| prescription.expiryDate | 処方箋の使用期間 | Last date the patient can have it dispensed |

Rules:
- "交付年月日" or "処方日" → prescription.date only. Never put it in expiryDate.
- "処方箋の使用期間" or "使用期限" → prescription.expiryDate only.
- If expiryDate says "交付の日を含めて4日以内" → calculate: prescription.date + 3 days.
- If expiryDate says "交付の日を含めてN日以内" → calculate: prescription.date + (N-1) days.
- If no usage period is stated → expiryDate = null.

## Total quantity calculation
For each prescription item, totalQuantity must be calculated as:
  totalQuantity = (dose per day) × durationDays

Examples:
- "1回1錠 1日3回 7日分" → dose/day=3錠, durationDays=7, totalQuantity="21錠"
- "1日1錠 30日分" → dose/day=1錠, durationDays=30, totalQuantity="30錠"
- "1回2錠 1日2回 14日分" → dose/day=4錠, durationDays=14, totalQuantity="56錠"
- If totalQuantity is explicitly printed on the prescription, use that value.
- If cannot be calculated → null.

## Self-check before outputting (do not add extra fields)
1. prescription.date < prescription.expiryDate (if both non-null)
2. totalQuantity == dosagePerDay × durationDays (recalculate if wrong)
3. All dates match YYYY-MM-DD format
4. gender is "male", "female", or null only
5. copayRatio is 10, 20, 30, or null only`;

export async function parseWithGemini(
  ocrText: string,
  tableData: string,
  formFieldData = "",
): Promise<PrescriptionOcrResult["patient"] & {
  institution: PrescriptionOcrResult["institution"];
  doctor: PrescriptionOcrResult["doctor"];
  prescription: PrescriptionOcrResult["prescription"];
  items: PrescriptionOcrResult["items"];
  overallConfidence: number;
}> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 }, // thinking オフ → 2〜3秒に短縮
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(),
    } as any,
  });

  const prompt = `${SYSTEM_PROMPT}

【OCRテキスト】
${ocrText}

【テーブルデータ】
${tableData || "（なし）"}

【フォームフィールド（Form Parser抽出）】
${formFieldData || "（なし）"}

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
