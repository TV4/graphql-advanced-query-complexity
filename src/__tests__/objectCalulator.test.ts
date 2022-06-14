import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';

import { createSDLFromDirective, getComplexity } from '..';
import { fieldCalculator } from '../calculators/fieldCalculator';
import { objectCalculator } from '../calculators/objectCalculator';
import { createFieldDirective } from '../directives/fieldDirective';
import { createObjectDirective } from '../directives/objectDirective';

const objectDirectiveSDL = createSDLFromDirective(createObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createFieldDirective());

const calculators = [
  objectCalculator({ directive: createObjectDirective() }),
  fieldCalculator({ directive: createFieldDirective() }),
  // simpleCalculator({ defaultComplexity: 0 }),
];

describe('Max times object called', () => {
  it('simple object', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Main
      }

      type Main {
        obj1: Obj
        obj2: Obj
        obj3: Obj
        obj4: Obj
      }

      type Obj @objComplexity(max: 3) {
        string: String
      }
    `;

    const query = gql`
      query {
        test {
          obj1 {
            string
          }
          obj2 {
            string
          }
          obj3 {
            string
          }
          obj4 {
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

    expect(complexity.cost).toBe(0);
    expect(complexity.extra?.maxCalls['type-Obj'].max).toBe(3);
    expect(complexity.extra?.maxCalls['type-Obj'].value).toBe(4);
  });

  it('list', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(limit: Int): [Obj] @complexity(multiplier: "limit")
      }

      type Obj @objComplexity(max: 3) {
        string: String
      }
    `;

    const query = gql`
      query {
        test(limit: 4) {
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

    expect(complexity.cost).toBe(0);
    expect(complexity.extra?.maxCalls['type-Obj'].max).toBe(3);
    expect(complexity.extra?.maxCalls['type-Obj'].value).toBe(4);
  });

  it('winning path', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(limit: Int): [Main] @complexity(multiplier: "limit")
      }

      union Main = Winning | Losing

      type Obj @objComplexity(max: 10) {
        string: String
      }

      type Winning {
        obj1: Obj
        obj2: Obj
        obj3: Obj
      }

      type Losing {
        obj1: Obj
        obj2: Obj
      }
    `;

    /**
     * Winning path does 3 calls for Obj
     * `test` array is called 4 times making it 12 calls for Obj in total
     */
    const query = gql`
      query {
        test(limit: 4) {
          ... on Winning {
            obj1 {
              string
            }
            obj2 {
              string
            }
            obj3 {
              string
            }
          }
          ... on Losing {
            obj1 {
              string
            }
            obj2 {
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

    expect(complexity.cost).toBe(0);
    expect(complexity.extra?.maxCalls['type-Obj'].max).toBe(10);
    expect(complexity.extra?.maxCalls['type-Obj'].value).toBe(12);
  });

  it('multiple objects', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Main
      }

      type Main {
        obj1: Obj1
        obj2: Obj2
        obj3: Obj2
      }

      type Obj1 @objComplexity(max: 3) {
        string: String
      }

      type Obj2 @objComplexity(max: 3) {
        string: String
      }
    `;

    const query = gql`
      query {
        test {
          obj1 {
            string
          }
          obj2 {
            string
          }
          obj3 {
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

    expect(complexity.cost).toBe(0);
    expect(complexity.extra?.maxCalls['type-Obj1'].max).toBe(3);
    expect(complexity.extra?.maxCalls['type-Obj1'].value).toBe(1);
    expect(complexity.extra?.maxCalls['type-Obj2'].max).toBe(3);
    expect(complexity.extra?.maxCalls['type-Obj2'].value).toBe(2);
  });

  it('fragment', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Main
      }

      type Main {
        obj1: Obj1
        obj2: Obj2
        obj3: Obj2
      }

      type Obj1 @objComplexity(max: 3) {
        string: String
      }

      type Obj2 @objComplexity(max: 3) {
        string: String
      }
    `;

    const query = gql`
      fragment obj1 on Obj1 {
        string
      }

      fragment obj2 on Obj2 {
        string
      }
      query {
        test {
          obj1 {
            ...obj1
          }
          obj2 {
            ...obj2
          }
          obj3 {
            ...obj2
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

    expect(complexity.cost).toBe(0);
    expect(complexity.extra?.maxCalls['type-Obj1'].max).toBe(3);
    expect(complexity.extra?.maxCalls['type-Obj1'].value).toBe(1);
    expect(complexity.extra?.maxCalls['type-Obj2'].max).toBe(3);
    expect(complexity.extra?.maxCalls['type-Obj2'].value).toBe(2);
  });

  it('objects and lists', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: TestObj
      }

      union Union = unionObj1 | unionObj2

      type TestObj {
        union(amount: Int = 5): [Union] @complexity(multiplier: "amount")
        simpleObj(amount: Int = 4): [SimpleObj] @complexity(multiplier: "amount")
      }

      # Will max be called 4 times
      type SimpleObj @objComplexity(max: 5) {
        simpleObjStr: String
      }

      # Will max be called 5 times. Should fail
      type unionObj1 @objComplexity(max: 4) {
        unionObj1Str: String
      }

      # Will max be called 5 times
      type unionObj2 @objComplexity(max: 10) {
        unionObj2Str: String
      }
    `;

    const query = gql`
      query {
        test {
          union {
            ... on unionObj1 {
              unionObj1Str
            }
            ... on unionObj2 {
              unionObj2Str
            }
          }
          simpleObj {
            simpleObjStr
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

    expect(complexity.cost).toBe(0);

    expect(complexity.extra?.maxCalls['type-SimpleObj'].max).toBe(5);
    expect(complexity.extra?.maxCalls['type-SimpleObj'].value).toBe(4);

    expect(complexity.extra?.maxCalls['type-unionObj1'].max).toBe(4);
    expect(complexity.extra?.maxCalls['type-unionObj1'].value).toBe(5);

    expect(complexity.extra?.maxCalls['type-unionObj2'].max).toBe(10);
    expect(complexity.extra?.maxCalls['type-unionObj2'].value).toBe(5);
  });
});
