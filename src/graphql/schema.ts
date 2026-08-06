export const typeDefs = /* GraphQL */ `
  scalar DateTime

  type QrCode {
    id: ID!
    title: String!
    content: String!
    createdAt: DateTime!
  }

  input CreateQrCodeInput {
    title: String!
    content: String!
  }

  type Query {
    qrCodes: [QrCode!]!
    qrCode(id: ID!): QrCode
  }

  type Mutation {
    createQrCode(input: CreateQrCodeInput!): QrCode!
    deleteQrCode(id: ID!): Boolean!
  }
`;
