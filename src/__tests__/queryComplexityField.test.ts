import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';
import { createComplexityObjectDirective, createComplexityFieldDirective } from '../directives';
import { fieldDirectiveCalculator } from '../calculators/fieldDirectiveCalculator';
import { objectDirectiveCalculator } from '../calculators/objectDirectiveCalculator';
import { getComplexity } from '..';
import { createSDLFromDirective } from '../directives';

const objectDirectiveSDL = createSDLFromDirective(createComplexityObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createComplexityFieldDirective());

const calculators = [
  objectDirectiveCalculator({ directive: createComplexityObjectDirective() }),
  fieldDirectiveCalculator({ directive: createComplexityFieldDirective() }),
];

describe('Basics', () => {
  it('string', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: String @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(7);
  });

  it('enum', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Enum @complexity(cost: 7)
      }

      enum Enum {
        VAL1
        VAL2
      }
    `;

    const query = gql`
      query {
        test
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(7);
  });

  it('simple object', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj
      }

      type Obj {
        string: String @complexity(cost: 1)
        number: Int @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test {
          string
          number
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(8);
  });

  it('simple object with multi cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj @complexity(cost: 2)
      }

      type Obj {
        string: String @complexity(cost: 1)
        number: Int @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test {
          string
          number
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(10);
  });

  it('union', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Union
      }

      union Union = Obj1 | Obj2

      type Obj1 {
        string: String @complexity(cost: 1)
      }

      type Obj2 {
        number: Int @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test {
          ... on Obj1 {
            string
          }
          ... on Obj2 {
            number
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(7);
    expect(true).toBe(true);
  });

  it('union with multi cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Union @complexity(cost: 2)
      }

      union Union = Obj1 | Obj2

      type Obj1 {
        string: String @complexity(cost: 1)
      }

      type Obj2 {
        number: Int @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test {
          ... on Obj1 {
            string
          }
          ... on Obj2 {
            number
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(9);
    expect(true).toBe(true);
  });

  it('interface', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Interface
      }

      interface Interface {
        string: String
      }

      type Impl1 implements Interface {
        string: String @complexity(cost: 1)
      }

      type Impl2 implements Interface {
        string: String @complexity(cost: 7)
        number: Int @complexity(cost: 2)
      }
    `;

    const query = gql`
      query {
        test {
          ... on Impl1 {
            string
          }
          ... on Impl2 {
            number
            string
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(9);
    expect(true).toBe(true);
  });

  it('interface with multi cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Interface @complexity(cost: 3)
      }

      interface Interface {
        string: String
      }

      type Impl1 implements Interface {
        string: String @complexity(cost: 1)
      }

      type Impl2 implements Interface {
        string: String @complexity(cost: 7)
        number: Int @complexity(cost: 2)
        interface: ImplInterface2 @complexity(cost: 3)
      }

      interface Interface2 {
        number: Int
      }

      type ImplInterface2 implements Interface2 {
        number: Int @complexity(cost: 5)
      }
    `;

    const query = gql`
      query {
        test {
          ... on Impl1 {
            string
          }
          ... on Impl2 {
            number
            string
            interface {
              number
            }
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(20);
    expect(true).toBe(true);
  });

  it.skip('Not yet implemented interface with cost on interface', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Interface
      }

      interface Interface {
        string: String @complexity(cost: 1)
      }

      type Impl1 implements Interface {
        string: String
      }

      type Impl2 implements Interface {
        string: String
        number: Int
      }
    `;

    const query = gql`
      query {
        test {
          ... on Impl1 {
            string
          }
          ... on Impl2 {
            number
            string
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(9);
    expect(true).toBe(true);
  });

  it('nested object', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj
      }

      type Obj {
        string: String @complexity(cost: 2)
        obj2: Obj2 @complexity(cost: 5)
      }

      type Obj2 {
        number: String @complexity(cost: 1)
        string: String @complexity(cost: 6)
      }
    `;

    const query = gql`
      query {
        test {
          string
          obj2 {
            number
            string
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(14);
  });

  it('nested object with unions', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj
      }

      type Obj {
        string: String @complexity(cost: 2)
        obj2: Obj2 @complexity(cost: 5)
        union: Union
      }

      type Obj2 {
        number: String @complexity(cost: 1)
        string: String @complexity(cost: 6)
      }

      union Union = Obj3 | Obj4

      type Obj3 {
        number: String @complexity(cost: 2)
        string: String @complexity(cost: 3)
      }

      type Obj4 {
        number: String @complexity(cost: 4)
        string: String @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test {
          string
          obj2 {
            number
            string
          }
          union {
            ... on Obj3 {
              number
              string
            }
            ... on Obj4 {
              number
              string
            }
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(25);
  });

  it('fragment', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj
      }

      type Obj {
        string: String @complexity(cost: 1)
        number: Int @complexity(cost: 7)
      }
    `;

    const query = gql`
      fragment obj on Obj {
        string
        number
      }

      query {
        test {
          ...obj
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    // console.log(require('util').inspect(complexity, { showHidden: true, depth: null, colors: true, breakLength: 200 }));

    expect(complexity.cost).toBe(8);
  });

  it('fragment with multi cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj @complexity(cost: 2)
      }

      type Obj {
        string: String @complexity(cost: 1)
        number: Int @complexity(cost: 7)
      }
    `;

    const query = gql`
      fragment obj on Obj {
        string
        number
      }

      query {
        test {
          ...obj
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(10);
  });

  it('custom scalar', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      scalar Scalar

      type Query {
        test: Scalar @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(7);
  });

  it('skip and include', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj
      }

      type Obj {
        string: String @complexity(cost: 1)
        number: Int @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test {
          string @skip(if: true)
          number @include(if: true)
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(7);
  });
});

describe('Lists', () => {
  it('without multiplier', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: [String] @complexity(cost: 7)
      }
    `;

    const query = gql`
      query {
        test
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(7);
  });

  it('string with multiplier', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(limit: Int): [String] @complexity(cost: 7, multiplier: "limit")
      }
    `;

    /**
     * A scalar is currently always worth 0
     * so the multiplier multiplies by 0, meaning that only the `cost`
     * is taken into account
     *
     */
    const query = gql`
      query {
        test(limit: 5)
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(7);
  });

  it('nested multipliers', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(limit: Int): [Obj] @complexity(cost: 7, multiplier: "limit")
      }

      type Obj {
        deepObj(amount: Int = 5): [Obj2] @complexity(cost: 6, multiplier: "amount")
      }

      type Obj2 {
        string: String @complexity(cost: 2)
      }
    `;

    /**
     * 2
     * 2 * 5 + 6 = 16
     * 16 * 4 + 7 = 71
     */

    const query = gql`
      query {
        test(limit: 4) {
          deepObj {
            string
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(71);
  });
});

describe('Multiple paths', () => {
  it('objects and lists', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj @complexity(cost: 2)
      }

      union Union = Obj3 | Obj4

      type Obj {
        deepObj2(amount: Int = 5): [Union] @complexity(cost: 6, multiplier: "amount")
        deepObj3(amount: Int = 4): [Obj2] @complexity(cost: 6, multiplier: "amount")
      }

      type Obj2 {
        string: String @complexity(cost: 2)
      }

      type Obj3 {
        string: String @complexity(cost: 2)
      }

      type Obj4 {
        string: String @complexity(cost: 7)
      }
    `;

    /**
     * test.deepObj2[Obj4].string most expensive winning
     * 7 * 5 + 6 = 41
     *
     * 2 * 4 + 6 = 14
     *
     * 41 + 14 + 2 = 57
     */

    const query = gql`
      query {
        test {
          deepObj2 {
            ... on Obj3 {
              string
            }
            ... on Obj4 {
              string
            }
          }
          deepObj3 {
            string
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.cost).toBe(57);
  });
});

describe('maxItems on field', () => {
  it('simple object', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount", maxTimes: 3)
      }

      type Obj {
        string: String
      }
    `;

    const query = gql`
      query {
        test(amount: 4) {
          string
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.extra?.maxCalls['field-Query:test'].maxTimes).toBe(3);
    expect(complexity.extra?.maxCalls['field-Query:test'].mergeValue).toBe(4);
  });

  it('deep object', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        main: Main
      }

      type Main {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount", maxTimes: 3)
      }

      type Obj {
        string: String
      }
    `;

    const query = gql`
      query {
        main {
          test(amount: 4) {
            string
          }
        }
      }
    `;

    const schema = makeExecutableSchema({ typeDefs: [baseSchema] });
    const validationResults = await validateGraphQlDocuments(schema, [{ document: query }]);
    expect(validationResults).toEqual([]);

    const complexity = getComplexity({
      calculators,
      schema,
      query,
    });

    expect(complexity.extra?.maxCalls['field-Main:test'].maxTimes).toBe(3);
    expect(complexity.extra?.maxCalls['field-Main:test'].mergeValue).toBe(4);
  });
});
