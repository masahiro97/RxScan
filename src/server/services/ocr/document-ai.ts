/**
 * Google Cloud Document AI — テキスト抽出
 * 処方箋画像からテキスト＋テーブル＋フォームフィールドを抽出する
 *
 * プロセッサ種別:
 *   - 汎用OCR (OCR_PROCESSOR): text / tables
 *   - Form Parser (FORM_PARSER_PROCESSOR): text / tables / formFields (キーバリュー)
 *   どちらも同じ関数で処理可能。Form Parser の場合は formFields も返す。
 */
import { v1 } from "@google-cloud/documentai";
import sharp from "sharp";

interface DocumentAiResult {
  text: string;
  tables: TableResult[];
  formFields: FormField[];
  confidence: number;
}

interface TableResult {
  headers: string[];
  rows: string[][];
}

interface FormField {
  name: string;
  value: string;
}

// クライアントシングルトン（Lambda warm 時に再初期化しない）
let _client: v1.DocumentProcessorServiceClient | null = null;

function getClient(): v1.DocumentProcessorServiceClient {
  if (_client) return _client;

  let clientOptions = {};
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const creds = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, "base64").toString("utf-8")
    );
    clientOptions = { credentials: creds };
  }

  _client = new v1.DocumentProcessorServiceClient(clientOptions);
  return _client;
}

/**
 * 画像を Document AI 送信前にリサイズする（最大1500px）
 * PDF はそのまま通す（sharp は PDF 非対応）
 */
async function optimizeImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === "application/pdf") return buffer;

  const image = sharp(buffer);
  const meta = await image.metadata();
  const maxDim = 1500;

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  if (w <= maxDim && h <= maxDim) return buffer;

  const ratio = Math.min(maxDim / w, maxDim / h);
  return image
    .resize(Math.round(w * ratio), Math.round(h * ratio))
    .toBuffer();
}

export async function extractTextWithDocumentAi(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<DocumentAiResult> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us";
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID / DOCUMENT_AI_PROCESSOR_ID が未設定です");
  }

  // 画像リサイズ（転送量・処理時間を削減）
  const optimizedBuffer = await optimizeImage(imageBuffer, mimeType);

  const client = getClient();
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: optimizedBuffer.toString("base64"),
      mimeType,
    },
  });

  const document = result.document;
  if (!document) throw new Error("Document AI からの応答が空です");

  const text = document.text ?? "";

  // テーブル抽出
  const tables: TableResult[] = [];
  for (const page of document.pages ?? []) {
    for (const table of page.tables ?? []) {
      type CellArg = Parameters<typeof extractCellText>[0];
      const headers = (table.headerRows?.[0]?.cells ?? []).map((cell) =>
        extractCellText(cell as unknown as CellArg, text)
      );
      const rows = (table.bodyRows ?? []).map((row) =>
        (row.cells ?? []).map((cell) => extractCellText(cell as unknown as CellArg, text))
      );
      if (headers.length > 0 || rows.length > 0) {
        tables.push({ headers, rows });
      }
    }
  }

  // フォームフィールド抽出（Form Parser プロセッサ使用時に有効）
  const formFields: FormField[] = [];
  for (const page of document.pages ?? []) {
    for (const field of page.formFields ?? []) {
      type AnchorArg = Parameters<typeof extractAnchorText>[0];
      const name = extractAnchorText(field.fieldName as unknown as AnchorArg, text).trim();
      const value = extractAnchorText(field.fieldValue as unknown as AnchorArg, text).trim();
      if (name) formFields.push({ name, value });
    }
  }

  // 平均信頼度
  const pageConfidences = (document.pages ?? []).map((p) => p.layout?.confidence ?? 0);
  const confidence =
    pageConfidences.length > 0
      ? (pageConfidences.reduce((a, b) => a + b, 0) / pageConfidences.length) * 100
      : 0;

  return { text, tables, formFields, confidence };
}

function extractCellText(
  cell: { layout?: { textAnchor?: { textSegments?: Array<{ startIndex?: string | number | null; endIndex?: string | number | null }> | null } | null } | null },
  fullText: string
): string {
  return extractAnchorText(cell.layout as Parameters<typeof extractAnchorText>[0], fullText).trim();
}

function extractAnchorText(
  layout: { textAnchor?: { textSegments?: Array<{ startIndex?: string | number | null; endIndex?: string | number | null }> | null } | null } | null | undefined,
  fullText: string
): string {
  const segments = layout?.textAnchor?.textSegments ?? [];
  return segments
    .map((seg) => {
      const start = Number(seg.startIndex ?? 0);
      const end = Number(seg.endIndex ?? 0);
      return fullText.slice(start, end);
    })
    .join("");
}
