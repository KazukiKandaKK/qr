export const typeDefs = /* GraphQL */ `
  scalar DateTime

  type Feed {
    id: ID!
    name: String!
    url: String!
    category: String!
    enabled: Boolean!
    lastFetchedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    articles(filter: ArticleFilterInput, limit: Int, offset: Int): [Article!]!
  }

  type Article {
    id: ID!
    feedId: ID!
    feed: Feed!
    title: String!
    link: String!
    snippet: String!
    publishedAt: DateTime!
    fetchedAt: DateTime!
    isRead: Boolean!
    isStarred: Boolean!
  }

  input CreateFeedInput {
    name: String!
    url: String!
    category: String!
    enabled: Boolean
  }

  input UpdateFeedInput {
    name: String
    category: String
    enabled: Boolean
  }

  input ArticleFilterInput {
    feedId: ID
    isRead: Boolean
    isStarred: Boolean
    keyword: String
  }

  type FetchResult {
    feedName: String!
    feedUrl: String!
    inserted: Int!
    updated: Int!
    error: String
  }

  type Stats {
    feedCount: Int!
    articleCount: Int!
    readCount: Int!
    unreadCount: Int!
    starredCount: Int!
  }

  enum Role {
    ADMIN
    USER
  }

  type User {
    id: ID!
    email: String!
    name: String
    role: Role!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    email: String!
    password: String!
    name: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type AuditLog {
    id: ID!
    action: String!
    actorId: ID
    actorEmail: String
    targetId: ID
    targetType: String
    ip: String
    userAgent: String
    metadata: String
    createdAt: DateTime!
  }

  type UserDataExport {
    user: User!
    auditLogs: [AuditLog!]!
  }

  type Query {
    feeds(limit: Int, offset: Int): [Feed!]!
    feed(id: ID!): Feed
    articles(filter: ArticleFilterInput, limit: Int, offset: Int): [Article!]!
    article(id: ID!): Article
    stats: Stats!
    me: User
    auditLogs(limit: Int, offset: Int): [AuditLog!]!
  }

  type Mutation {
    createFeed(input: CreateFeedInput!): Feed!
    updateFeed(id: ID!, input: UpdateFeedInput!): Feed!
    deleteFeed(id: ID!): Boolean!
    fetchFeeds: [FetchResult!]!
    markArticleRead(id: ID!, isRead: Boolean!): Article!
    markArticleStarred(id: ID!, isStarred: Boolean!): Article!
    deleteArticle(id: ID!): Boolean!
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    exportMyData: UserDataExport!
    deleteMyAccount: Boolean!
  }
`;
