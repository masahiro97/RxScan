/**
 * Azure Document Intelligence — テキスト抽出
 * 処方箋画像からテキスト＋テーブル＋OCRハイライトブロックを抽出する
 *
 * モデル: prebuilt-layout (Japan East / 低レイテンシ)
 */
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import sharp from "sharp";
import type { TextBlock } from "./types";

interface DocumentAiResult {
  text: string;
  tables: TableResult[];
  formFields: FormField[];
  textBlocks: TextBlock[];
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
let _client: DocumentAnalysisClient | null = null;

function getClient(): DocumentAnalysisClient {
  if (_client) return _client;

  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

  if (!endpoint || !key) {
    throw new Error("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT / AZURE_DOCUMENT_INTELLIGENCE_KEY が未設定です");
  }

  _client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  return _client;
}

/**
 * 画像を送信前にリサイズする（最大1500px）
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
  const optimizedBuffer = await optimizeImage(imageBuffer, mimeType);

  const client = getClient();

  const poller = await client.beginAnalyzeDocument(
    "prebuilt-layout",
    optimizedBuffer,
  );
  const result = await poller.pollUntilDone();

  const text = result.content ?? "";

  // テーブル抽出
  const tables: TableResult[] = [];
  for (const table of result.tables ?? []) {
    const headerCells = table.cells
      .filter((c) => c.kind === "columnHeader")
      .sort((a, b) => a.columnIndex - b.columnIndex);
    const headers = headerCells.map((c) => c.content);

    const rowsMap = new Map<number, string[]>();
    for (const cell of table.cells) {
      if (cell.kind === "columnHeader") continue;
      if (!rowsMap.has(cell.rowIndex)) rowsMap.set(cell.rowIndex, []);
      rowsMap.get(cell.rowIndex)![cell.columnIndex] = cell.content;
    }
    const rows = Array.from(rowsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, cells]) => cells);

    if (headers.length > 0 || rows.length > 0) {
      tables.push({ headers, rows });
    }
  }

  // テキストブロックのバウンディングボックス抽出（ハイライト用）
  const textBlocks: TextBlock[] = [];
  for (const page of result.pages ?? []) {
    const pageNum = page.pageNumber;
    const pageW = page.width && page.width > 0 ? page.width : 1;
    const pageH = page.height && page.height > 0 ? page.height : 1;

    for (const line of page.lines ?? []) {
      const polygon = line.polygon ?? [];
      if (polygon.length < 4) continue;

      const xs = polygon.map((p) => p.x / pageW);
      const ys = polygon.map((p) => p.y / pageH);

      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(...xs) - x;
      const h = Math.max(...ys) - y;

      if (w > 0.01 && h > 0.003) {
        textBlocks.push({ page: pageNum, x, y, w, h });
      }
    }
  }

  return { text, tables, formFields: [], textBlocks, confidence: 90 };
}
