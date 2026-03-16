/**
 * 薬剤マスタ突合 — あいまい検索 (pg_trgm + Levenshtein)
 * 候補上位5件を返す
 */
import { db } from "@/server/db";
import { medicines } from "@/server/db/schema";
import { sql, desc } from "drizzle-orm";

export interface MedicineCandidate {
  id: string;
  name: string;
  genericName: string | null;
  yjCode: string | null;
  manufacturer: string | null;
  isGeneric: boolean;
  similarity: number;
}

export async function findMedicineCandidates(
  rawName: string,
  limit = 5,
): Promise<MedicineCandidate[]> {
  if (!rawName.trim()) return [];

  const results = await db.execute<{
    id: string;
    name: string;
    generic_name: string | null;
    yj_code: string | null;
    manufacturer: string | null;
    is_generic: boolean;
    similarity: number;
  }>(sql`
    SELECT
      id,
      name,
      generic_name,
      yj_code,
      manufacturer,
      is_generic,
      GREATEST(
        similarity(name, ${rawName}),
        similarity(COALESCE(generic_name, ''), ${rawName})
      ) AS similarity
    FROM medicines
    WHERE
      is_active = true
      AND (
        similarity(name, ${rawName}) > 0.1
        OR similarity(COALESCE(generic_name, ''), ${rawName}) > 0.1
        OR name ILIKE ${"%" + rawName + "%"}
        OR generic_name ILIKE ${"%" + rawName + "%"}
      )
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return results.rows.map((r) => ({
    id: r.id,
    name: r.name,
    genericName: r.generic_name,
    yjCode: r.yj_code,
    manufacturer: r.manufacturer,
    isGeneric: r.is_generic,
    similarity: r.similarity,
  }));
}

export async function searchMedicines(
  query: string,
  limit = 20,
): Promise<MedicineCandidate[]> {
  if (!query.trim()) {
    const rows = await db.select({
      id: medicines.id,
      name: medicines.name,
      genericName: medicines.genericName,
      yjCode: medicines.yjCode,
      manufacturer: medicines.manufacturer,
      isGeneric: medicines.isGeneric,
    }).from(medicines).limit(limit);
    return rows.map((r) => ({ ...r, similarity: 1 }));
  }

  return findMedicineCandidates(query, limit);
}
