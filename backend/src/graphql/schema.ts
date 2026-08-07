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
    articles(filter: ArticleFilterInput): [Article!]!
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

  type Query {
    feeds: [Feed!]!
    feed(id: ID!): Feed
    articles(filter: ArticleFilterInput): [Article!]!
    article(id: ID!): Article
  }

  type Mutation {
    createFeed(input: CreateFeedInput!): Feed!
    updateFeed(id: ID!, input: UpdateFeedInput!): Feed!
    deleteFeed(id: ID!): Boolean!
    fetchFeeds: [FetchResult!]!
    markArticleRead(id: ID!, isRead: Boolean!): Article!
    markArticleStarred(id: ID!, isStarred: Boolean!): Article!
    deleteArticle(id: ID!): Boolean!
  }
`;
