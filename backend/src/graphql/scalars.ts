import { GraphQLScalarType, Kind } from 'graphql';

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
