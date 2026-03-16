/**
 * Google Cloud Document AI — テキスト抽出
 * 処方箋画像からテキスト＋テーブル構造を抽出する
 */
import { v1 } from "@google-cloud/documentai";

interface DocumentAiResult {
  text: string;
  tables: TableResult[];
  confidence: number;
}

interface TableResult {
  headers: string[];
  rows: string[][];
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

  const client = getClient();
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: imageBuffer.toString("base64"),
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
      tables.push({ headers, rows });
    }
  }

  // 平均信頼度
  const pageConfidences = (document.pages ?? []).map((p) => p.layout?.confidence ?? 0);
  const confidence =
    pageConfidences.length > 0
      ? (pageConfidences.reduce((a, b) => a + b, 0) / pageConfidences.length) * 100
      : 0;

  return { text, tables, confidence };
}

function extractCellText(
  cell: { layout?: { textAnchor?: { textSegments?: Array<{ startIndex?: string | number | null; endIndex?: string | number | null }> | null } | null } | null },
  fullText: string
): string {
  const segments = cell.layout?.textAnchor?.textSegments ?? [];
  return segments
    .map((seg) => {
      const start = Number(seg.startIndex ?? 0);
      const end = Number(seg.endIndex ?? 0);
      return fullText.slice(start, end);
    })
    .join("")
    .trim();
}
