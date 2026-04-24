# doujin_buy_checker

同人即売会（コミケ・M3等）の購入リストを管理するPWA。
自宅PCでリストを作成し、会場スマホでオフライン巡回チェックできる。

## 技術スタック

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | SolidJS | 1.9 |
| ルーティング | @solidjs/router | 0.16 |
| ビルド | Vite | 8.0 |
| 言語 | TypeScript | 6.0 |
| CSS | UnoCSS (Tailwind互換) | 66.6 |
| UI基盤 | Kobalte | 0.13 |
| ローカルDB | Dexie.js (IndexedDB) | 4.4 |
| PWA | vite-plugin-pwa + Workbox | 1.2 / 7.4 |
| ID生成 | ULID (ulidx) | 2.4 |
| 同期サーバー | Cloudflare Workers + KV | - |
| パッケージマネージャー | pnpm | 10.33 |
| 開発環境 | Nix + Devenv + process-compose | - |

## セットアップ

```bash
# devenvで開発環境を構築（Node.js + pnpm が自動で入る）
devenv shell

# 開発サーバー起動（process-compose TUI）
devenv up

# または直接
pnpm dev

# プロダクションビルド
pnpm build
```

## プロジェクト構成

```
src/
  index.tsx              # エントリ（Router定義）
  hooks/                 # useLiveQuery等
  db/
    schema.ts            # Dexieスキーマ（events, circles, buyListItems, catalogSubscriptions）
    repositories/        # テーブル毎のCRUD
  services/              # budgetCalculator等
  components/            # AppShell, BudgetBar
  pages/                 # 8画面（イベント一覧, 購入リスト, サークル詳細, 予算, カタログ, 転送, 設定, カタログエディタ）
worker/                  # CF Workers同期サーバー（POST/GET /api/share）
schema/                  # カタログJSON Schema v1 + サンプル
```

## ライセンス

LGPL-3.0-or-later
