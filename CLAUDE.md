# CLAUDE.md

## プロジェクト概要

同人即売会の購入リスト管理PWA。オフラインファースト・認証不要・シンプル設計。

## 技術スタック

- **フレームワーク**: SolidJS 1.9 + TypeScript 6.0
- **ビルド**: Vite 8.0
- **CSS**: UnoCSS 66.6（Tailwind互換、`uno.config.ts` でショートカット定義）
- **UI基盤**: Kobalte 0.13（ヘッドレスUIコンポーネント）
- **ルーティング**: @solidjs/router 0.16（`Router` の `root` propにAppShell、子に `Route`）
- **ローカルDB**: Dexie.js 4.4（IndexedDB ラッパー、`src/db/schema.ts`）
- **PWA**: vite-plugin-pwa 1.2 + Workbox 7.4
- **ID生成**: ulidx 2.4（ULID）
- **同期サーバー**: Cloudflare Workers + KV（`worker/`）
- **パッケージマネージャー**: pnpm 10.33
- **開発環境**: Nix + Devenv + process-compose

## コマンド

```bash
devenv up       # 開発サーバー起動（process-compose）
pnpm dev        # Vite devサーバー直接起動
pnpm build      # プロダクションビルド
pnpm preview    # ビルド結果プレビュー
```

## アーキテクチャ

- `src/db/schema.ts` — Dexieスキーマ定義（Event, Circle, BuyListItem, CatalogSubscription）
- `src/db/repositories/` — テーブル毎のCRUD関数
- `src/hooks/useLiveQuery.ts` — Dexie liveQueryをSolidJSシグナルに変換
- `src/services/` — ビジネスロジック（予算計算等）
- `src/pages/` — 8画面（lazy import）
- `src/components/` — 共有コンポーネント（AppShell, BudgetBar）
- `worker/src/index.ts` — CF Workers（2エンドポイント: POST/GET /api/share）
- `schema/` — カタログJSON Schema v1

## 規約

- パスエイリアス: `~/` → `src/`
- DB操作は必ず `repositories/` 経由
- IndexedDBのID生成には `ulid()` を使用
- カタログJSON仕様は `schema/catalog.v1.schema.json` に準拠
