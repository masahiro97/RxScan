/**
 * RDS で一度だけ実行するDBセットアップ
 * - pg_trgm 拡張を有効化（薬品名あいまい検索用）
 *
 * 実行: DATABASE_URL=... npx tsx scripts/setup-db-extensions.ts
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    console.log("✅ pg_trgm 拡張を有効化しました");

    // similarity 検索のインデックスを作成（medicine名の高速化）
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medicines_name_trgm
        ON medicines USING gin (name gin_trgm_ops);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medicines_generic_name_trgm
        ON medicines USING gin (COALESCE(generic_name, '') gin_trgm_ops);
    `);
    console.log("✅ pg_trgm インデックスを作成しました");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
