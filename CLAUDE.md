# RxScan — 処方箋OCR登録システム

調剤薬局チェーン向けの処方箋OCR登録システム。

## コマンド

```bash
npm run dev          # 開発サーバー (localhost:3000)
npm run build        # プロダクションビルド
npm run typecheck    # tsc --noEmit
npm run db:push      # Drizzle スキーマ反映（開発用）
npm run db:migrate   # マイグレーション実行
npm run db:seed      # 初期データ投入
npm run db:studio    # Drizzle Studio GUI
```

## セットアップ

1. `.env.local` に環境変数を設定（`.env.example` 参照）
2. PostgreSQL 起動
3. `npm run db:push` でスキーマ反映
4. `npm run db:seed` で初期データ投入
5. `npm run dev` で起動

**デフォルトログイン:** admin@rxscan.local / Password123!

## 技術スタック

- Next.js 15 App Router + TypeScript strict
- tRPC v11 + Drizzle ORM (PostgreSQL)
- NextAuth.js v5 (Credentials + TOTP)
- Tailwind CSS + shadcn/ui
- OCR: Google Document AI → Gemini 2.5 Flash → Claude Vision (fallback)

## フェーズ実装状況

- **Phase 1** ✅ MVP: 認証・アップロード・OCR・レビュー画面・基本CRUD
- **Phase 2** ✅ 業務実用化: 薬剤マスタ突合・TOTP・監査ログ・マルチテナント
- **Phase 3** ✅ 拡張: ダッシュボード統計・Claude Visionフォールバック・アレルギーアラート

## 主要ファイル

- `src/server/db/schema.ts` — Drizzle スキーマ（全テーブル定義）
- `src/server/routers/` — tRPC ルーター（prescription/patient/medicine/store）
- `src/server/services/ocr/` — OCR パイプライン（Document AI → Gemini → Claude）
- `src/app/(dashboard)/prescriptions/[id]/review/page.tsx` — メイン画面
- `src/components/prescription/` — 処方箋UI コンポーネント

## 開発ルール

1. **any 禁止** — Zod + tRPC で型を通す
2. **エラーメッセージは日本語**
3. **個人情報をログに出さない** — audit-logger.ts の sanitizeDetails を参照
4. **監査ログ必須** — logAudit() を患者・処方箋操作時に呼ぶ
5. **画像は S3 のみ** — presigned URL で取得
