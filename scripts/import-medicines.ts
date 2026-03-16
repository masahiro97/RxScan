/**
 * 厚労省 薬価基準 Excel → medicines テーブル インポートスクリプト
 *
 * 実行: npx tsx scripts/import-medicines.ts /path/to/薬価基準.xlsx
 * 例:   npx tsx scripts/import-medicines.ts ~/Downloads/001247592.xlsx
 */
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { medicines } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const FILE_PATH = process.argv[2];
if (!FILE_PATH) {
  console.error("使い方: npx tsx scripts/import-medicines.ts <Excelファイルパス>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });

  // 1行目はヘッダー → スキップ
  const dataRows = rows.slice(1).filter((r) => r[0] && r[1]);

  console.log(`📦 ${dataRows.length} 件の医薬品データを処理します...`);

  let inserted = 0;
  let skipped = 0;

  // 100件ずつバッチ挿入
  const BATCH = 100;
  for (let i = 0; i < dataRows.length; i += BATCH) {
    const batch = dataRows.slice(i, i + BATCH).map((r) => {
      const yjCode = String(r[0] ?? "").trim();
      const name = String(r[1] ?? "").trim();
      const genericName = String(r[2] ?? "").trim() || null;
      const unit = (String(r[3] ?? "").trim() || null)?.slice(0, 20) ?? null;
      const manufacturer = String(r[4] ?? "").trim() || null;
      const priceRaw = r[5];
      const drugPrice = priceRaw !== "" && priceRaw != null ? String(priceRaw) : null;

      // 後発品判定: 後発医薬品最高価格が設定されていて、薬価と異なる場合は先発品
      // 簡易判定: YJコードの末尾が特定のパターン（後発品は品目コードが異なる）
      // ここでは品名に「後発」「ジェネリック」が含まれるか、または先発に対してメーカーが異なる場合に後発フラグ
      // 実用的な判定: 後発医薬品最高価格列に値があるのは先発品 or 後発品どちらもあり得る
      // 最もシンプル: YJ コードの 7 桁目が後発医薬品を示す（F, G 等で始まる場合など）
      // ここでは保守的に false としておく（手動更新 or 別データソースで更新可能）
      const isGeneric = false;

      return { yjCode, name, genericName, unit, manufacturer, drugPrice, isGeneric };
    });

    try {
      await db.insert(medicines)
        .values(batch)
        .onConflictDoUpdate({
          target: medicines.yjCode,
          set: {
            name: medicines.name,
            genericName: medicines.genericName,
            unit: medicines.unit,
            manufacturer: medicines.manufacturer,
            drugPrice: medicines.drugPrice,
          },
        });
      inserted += batch.length;
    } catch (e) {
      console.error(`バッチ ${i}〜${i + BATCH} でエラー:`, e);
      skipped += batch.length;
    }

    process.stdout.write(`\r  進捗: ${Math.min(i + BATCH, dataRows.length)}/${dataRows.length}`);
  }

  console.log(`\n✅ インポート完了: ${inserted} 件挿入/更新、${skipped} 件スキップ`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
