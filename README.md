# RSS Security Dashboard

情報セキュリティに関する RSS を取得し、GraphQL で管理・閲覧できるダッシュボードの骨組みです。
`KazukiKandaKK/rss-sec-check` と同じドメインを、GraphQL + Apollo Server + Prisma + SQLite の構成で作り直しています。

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| 言語・ランタイム | Node.js 20 + TypeScript（strict） |
| GraphQL サーバー | Apollo Server 5 + Express |
| ORM | Prisma（SQLite 開発時、PostgreSQL 運用時） |
| RSS 取得 | `rss-parser` |
| バリデーション | Zod |
| ログ | pino |
| 実行・開発 | tsx / vitest |

## ディレクトリ構成

```
qr/
├── src/
│   ├── config/           # 環境変数・ロガー
│   ├── lib/              # Prisma クライアント・RSS パーサー・デフォルトフィード
│   ├── graphql/          # GraphQL スキーマ・スカラー
│   ├── features/         # ドメインモジュール
│   │   └── rss/          # Feed / Article ドメイン
│   │       ├── domain.ts
│   │       ├── schemas.ts
│   │       ├── repository.ts    # リポジトリ（Prisma / InMemory）
│   │       ├── service.ts       # ユースケース・バリデーション
│   │       ├── resolvers.ts     # GraphQL リゾルバー
│   │       └── service.test.ts
│   ├── scripts/          # フィード初期投入・取得スクリプト
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
cp .env.example .env   # 必要に応じて編集
npm run db:migrate
npm run seed
npm run dev
```

`.env` の `DATABASE_URL` を `postgresql://rss:rss@localhost:5432/rss` に変更すれば `docker-compose.yml` の PostgreSQL に接続できます。

## 主なスクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | tsx watch で開発サーバー起動（port 4000） |
| `npm run build` | Prisma Client 生成 + TypeScript コンパイル |
| `npm run start` | 本番用起動（`dist/index.js`） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | vitest 実行 |
| `npm run seed` | 初期セキュリティフィードを DB に投入 |
| `npm run fetch` | 有効なフィードを取得して記事を保存 |
| `npm run db:migrate` | マイグレーション作成・適用 |
| `npm run db:deploy` | CI/本番でマイグレーション適用 |

## GraphQL 例

```graphql
query {
  feeds {
    id
    name
    url
    category
    enabled
    articles {
      id
      title
      snippet
      publishedAt
      isRead
      isStarred
    }
  }
}

mutation {
  createFeed(input: {
    name: "Example Feed",
    url: "https://example.com/feed.xml",
    category: "News"
  }) {
    id
    name
  }
}

mutation {
  fetchFeeds {
    feedName
    inserted
    updated
    error
  }
}

mutation {
  markArticleRead(id: "<article-id>", isRead: true) {
    id
    isRead
  }
}
```

## 設計のポイント

- **ドメイン分離**: `domain.ts` に型を定義し、Prisma 実装は `repository.ts` で閉じ込めています。
- **リポジトリ差し替え**: `InMemoryRssRepository` を使うことで、テストを DB なしで実行できます。
- **RSS 取得**: `rss-parser` でフィードを取得し、記事本文ではなくタイトル・リンク・スニペットのみを保存します（著作権対応）。
- **更新保護**: 既存記事の再取得時に `isRead` / `isStarred` のフラグは失われません。

## 今後の拡張例

- 認証・認可（context にユーザー情報を注入）
- DataLoader による N+1 対策
- フロントエンド（React + Apollo Client）で管理画面 UI
- 記事検索・フィルタ・ページネーションの強化
- 定期 RSS 取得（GitHub Actions / BullMQ / node-cron）
