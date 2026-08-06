# QR GraphQL Skeleton

本格運用を見据えた GraphQL アプリの骨組みです。
機能を継ぎ足ししやすいよう、ドメイン層・リポジトリ層・サービス層・GraphQL 層に分離しています。

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| 言語・ランタイム | Node.js 20 + TypeScript（strict） |
| GraphQL サーバー | Apollo Server 5 + Express |
| バリデーション | Zod |
| ORM | Prisma（SQLite 開発時、PostgreSQL 運用時） |
| ログ | pino |
| 実行・開発 | tsx / vitest |

## ディレクトリ構成

```
qr/
├── src/
│   ├── config/           # 環境変数・ロガー
│   ├── lib/              # Prisma クライアント
│   ├── graphql/          # GraphQL スキーマ定義
│   ├── features/         # ドメインモジュール
│   │   └── qrCode/       # QRコード ドメイン
│   │       ├── domain.ts
│   │       ├── schemas.ts
│   │       ├── repository.ts    # リポジトリ実装（Prisma / InMemory）
│   │       ├── service.ts       # ユースケース・バリデーション
│   │       ├── resolvers.ts     # GraphQL リゾルバー
│   │       └── service.test.ts
│   ├── app.ts            # Express + ApolloServer 組み立て
│   └── index.ts          # サーバー起動
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.yml    # PostgreSQL 開発用
├── .env.example
└── package.json
```

## セットアップ

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

`.env` の `DATABASE_URL` を `postgresql://...` に変更すれば `docker-compose.yml` の PostgreSQL に接続できます。

## 主なスクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | tsx watch で開発サーバー起動 |
| `npm run build` | Prisma Client 生成 + TypeScript コンパイル |
| `npm run start` | 本番用起動（`dist/index.js`） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | vitest 実行 |
| `npm run db:migrate` | マイグレーション作成・適用 |
| `npm run db:deploy` | CI/本番でマイグレーション適用 |

## GraphQL 例

```graphql
query {
  qrCodes {
    id
    title
    content
    createdAt
  }
}

mutation {
  createQrCode(input: { title: "サンプル", content: "https://example.com" }) {
    id
    title
    content
    createdAt
  }
}
```

## 設計のポイント

- **ドメイン分離**: `domain.ts` に型を定義し、Prisma 実装は `repository.ts` で閉じ込めています。
- **リポジトリ差し替え**: `InMemoryQrCodeRepository` を使うことで、テストやローカル実行を DB なしで動作させられます。
- **スキーマ拡張**: `src/features/<domain>/` を追加し、`src/graphql/schema.ts` / `src/app.ts` でモジュールを繋ぐだけで機能追加できます。
- **Zod バリデーション**: 入力検証をサービス層で一元化しています。

## 今後の拡張例

- ユーザー認証・認可（context にユーザー情報を注入）
- DataLoader による N+1 対策
- Redis セッション / ジョブキュー
- ファイルアップロード（QR 画像生成・保存）
- フロントエンド（React + Apollo Client）
