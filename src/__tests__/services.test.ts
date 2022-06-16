import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';

import {
  createFieldDirective,
  createObjectDirective,
  createSDLFromDirective,
  createServicesPostCalculation,
  getComplexity,
} from '..';
import { fieldCalculator } from '../calculators/fieldCalculator';
import { objectCalculator } from '../calculators/objectCalculator';

const objectDirectiveSDL = createSDLFromDirective(createObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createFieldDirective());

const calculators = [
  objectCalculator({ directive: createObjectDirective() }),
  fieldCalculator({ directive: createFieldDirective() }),
];

describe('object directive', () => {
  it('called once with cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      }

      type Obj @objComplexity(services: ["serviceX"]) {
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
      postCalculations: [
        createServicesPostCalculation({
          serviceX: {
            calledOnce: true,
            cost: 100,
          },
        }),
      ],
    });

    expect(complexity.extra?.services.serviceX.value).toBe(4);
    expect(complexity.cost).toBe(100);
  });

  it('called multiple times with cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      }

      type Obj @objComplexity(services: ["serviceX"]) {
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
      postCalculations: [
        createServicesPostCalculation({
          serviceX: {
            cost: 100,
          },
        }),
      ],
    });

    expect(complexity.extra?.services.serviceX.value).toBe(4);
    expect(complexity.cost).toBe(400);
  });

  it('max times, creates error', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      }

      type Obj @objComplexity(services: ["serviceX"]) {
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
      postCalculations: [
        createServicesPostCalculation({
          serviceX: {
            cost: 100,
            maxTimes: 3,
          },
        }),
      ],
    });

    expect(complexity.extra?.services.serviceX.value).toBe(4);
    expect(complexity.cost).toBe(400);
    expect(complexity.errors?.[0].message).toBe('Service serviceX may only be queried 3 times. Was queried 4 times');
  });

  it('both normal cost and service cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test: Obj
      }

      type Obj @objComplexity(services: ["serviceX"]) {
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
      postCalculations: [
        createServicesPostCalculation({
          serviceX: {
            cost: 100,
            maxTimes: 3,
          },
        }),
      ],
    });

    expect(complexity.cost).toBe(108); // 8 + 100
  });

  it('union', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(limit: Int): [Main] @complexity(multiplier: "limit")
      }

      union Main = First | Second

      type ObjFirst @objComplexity(services: ["first"]) {
        string: String
      }

      type ObjSecond @objComplexity(services: ["second"]) {
        string: String
      }

      type First {
        obj1: ObjFirst
        obj2: ObjFirst
        obj3: ObjFirst
      }

      type Second {
        obj1: ObjSecond
        obj2: ObjSecond
        obj3: ObjSecond
      }
    `;

    const query = gql`
      query {
        test(limit: 4) {
          ... on First {
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
          ... on Second {
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
    expect(complexity.extra?.services.first.value).toBe(12); // 4 * 3
    expect(complexity.extra?.services.second.value).toBe(8); // 4 * 2
  });
});

describe('field directive', () => {
  it('called multiple times with cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      }

      type Obj {
        string: String @complexity(services: ["serviceX"])
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
      postCalculations: [
        createServicesPostCalculation({
          serviceX: {
            cost: 100,
          },
        }),
      ],
    });

    expect(complexity.extra?.services.serviceX.value).toBe(4);
    expect(complexity.cost).toBe(400);
  });

  it('called multiple times, multiple fields, with cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      }

      type Obj {
        string: String @complexity(services: ["serviceX"])
        string2: String @complexity(services: ["serviceX", "serviceY"])
      }
    `;

    const query = gql`
      query {
        test(amount: 4) {
          string
          string2
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
      postCalculations: [
        createServicesPostCalculation({
          serviceX: {
            cost: 100,
          },
          serviceY: {
            cost: 20,
          },
        }),
      ],
    });

    expect(complexity.cost).toBe(880); // 4 * 100 + 4 * 100  + 4 * 20
  });
});
