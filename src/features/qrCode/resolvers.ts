import { GraphQLScalarType, Kind } from 'graphql';
import { QrCodeService } from './service';

export const dateTimeScalar = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  description: 'ISO-8601 date time',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return value as string;
  },
  parseValue(value) {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    throw new Error('DateTime parse error: expected string or number');
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    throw new Error('DateTime literal parse error: expected string');
  },
});

export const createQrCodeResolvers = (service: QrCodeService) => ({
  DateTime: dateTimeScalar,
  Query: {
    qrCodes: () => service.list(),
    qrCode: (_: unknown, args: { id: string }) => service.getById(args.id),
  },
  Mutation: {
    createQrCode: (
      _: unknown,
      args: { input: { title: string; content: string } },
    ) => service.create(args.input),
    deleteQrCode: (_: unknown, args: { id: string }) => service.delete(args.id),
  },
});
