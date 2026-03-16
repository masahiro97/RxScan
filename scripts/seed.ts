/**
 * 初期データシード
 * 使い方: npm run db:seed
 */
import { db } from "../src/server/db";
import { stores, users, medicines } from "../src/server/db/schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("🌱 シードデータを投入中...");

  // pg_trgm 拡張を有効化
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`);
  console.log("✅ pg_trgm / fuzzystrmatch 拡張を有効化");

  // Store
  const [store] = await db.insert(stores).values({
    name: "サンプル薬局 渋谷店",
    address: "東京都渋谷区渋谷1-1-1",
    phone: "03-0000-0000",
    licenseNumber: "13-AB-0001",
  }).onConflictDoNothing().returning();

  const storeId = store?.id;
  if (!storeId) {
    const existing = await db.query.stores.findFirst();
    if (!existing) throw new Error("店舗の作成に失敗しました");
    console.log("⚠️ 既存の店舗を使用します");
  }
  const finalStoreId = storeId ?? (await db.query.stores.findFirst())!.id;

  // Admin user
  const passwordHash = await bcrypt.hash("Password123!", 12);
  await db.insert(users).values({
    storeId: finalStoreId,
    email: "admin@rxscan.local",
    passwordHash,
    name: "管理者 山田",
    role: "admin",
  }).onConflictDoNothing();

  await db.insert(users).values({
    storeId: finalStoreId,
    email: "pharmacist@rxscan.local",
    passwordHash,
    name: "薬剤師 佐藤",
    role: "pharmacist",
  }).onConflictDoNothing();

  console.log("✅ ユーザーを作成: admin@rxscan.local / pharmacist@rxscan.local (Password123!)");

  // サンプル薬剤マスタ
  const sampleMedicines = [
    { name: "ロキソニン錠60mg", genericName: "ロキソプロフェンナトリウム水和物錠60mg", yjCode: "1149017F1280", manufacturer: "第一三共", isGeneric: false },
    { name: "ロキソプロフェンNa錠60mg「DSEP」", genericName: "ロキソプロフェンナトリウム水和物錠60mg", yjCode: "1149017F4149", manufacturer: "第一三共エスファ", isGeneric: true },
    { name: "レバミピド錠100mg「アメル」", genericName: "レバミピド錠100mg", yjCode: "2329007F4029", manufacturer: "共和薬品工業", isGeneric: true },
    { name: "ムコスタ錠100mg", genericName: "レバミピド錠100mg", yjCode: "2329007F1020", manufacturer: "大塚製薬", isGeneric: false },
    { name: "アムロジピン錠5mg「サワイ」", genericName: "アムロジピンベシル酸塩錠5mg", yjCode: "2171013F4318", manufacturer: "沢井製薬", isGeneric: true },
    { name: "ノルバスク錠5mg", genericName: "アムロジピンベシル酸塩錠5mg", yjCode: "2171013F1068", manufacturer: "ファイザー", isGeneric: false },
    { name: "メトホルミン塩酸塩錠500mg「NIG」", genericName: "メトホルミン塩酸塩錠500mg", yjCode: "3961013F4038", manufacturer: "日医工岐阜工場", isGeneric: true },
    { name: "クラリスロマイシン錠200mg「サワイ」", genericName: "クラリスロマイシン錠200mg", yjCode: "6149017F4077", manufacturer: "沢井製薬", isGeneric: true },
    { name: "クラリス錠200", genericName: "クラリスロマイシン錠200mg", yjCode: "6149017F1021", manufacturer: "大正製薬", isGeneric: false },
    { name: "オメプラゾール錠10mg「日医工」", genericName: "オメプラゾール錠10mg", yjCode: "2329028F4020", manufacturer: "日医工", isGeneric: true },
    { name: "アトルバスタチン錠10mg「アメル」", genericName: "アトルバスタチンカルシウム水和物錠10mg", yjCode: "2189005F4217", manufacturer: "共和薬品工業", isGeneric: true },
    { name: "リピトール錠10mg", genericName: "アトルバスタチンカルシウム水和物錠10mg", yjCode: "2189005F1022", manufacturer: "アステラス製薬", isGeneric: false },
    { name: "セチリジン塩酸塩錠10mg「JG」", genericName: "セチリジン塩酸塩錠10mg", yjCode: "4490011F4073", manufacturer: "日本ジェネリック", isGeneric: true },
    { name: "ジルテック錠10", genericName: "セチリジン塩酸塩錠10mg", yjCode: "4490011F1023", manufacturer: "グラクソ・スミスクライン", isGeneric: false },
    { name: "カルボシステイン錠500mg「杏林」", genericName: "カルボシステイン錠500mg", yjCode: "2231002F4029", manufacturer: "杏林製薬", isGeneric: true },
  ];

  for (const m of sampleMedicines) {
    await db.insert(medicines).values(m).onConflictDoNothing();
  }

  console.log(`✅ 薬剤マスタ: ${sampleMedicines.length}件を投入`);
  console.log("\n🎉 シード完了！");
  console.log("  ログイン: http://localhost:3000/login");
  console.log("  メール: admin@rxscan.local");
  console.log("  パスワード: Password123!");

  process.exit(0);
}

seed().catch((err) => {
  console.error("シードエラー:", err);
  process.exit(1);
});
