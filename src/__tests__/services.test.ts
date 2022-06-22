import { createSingleCallServicesDirective } from './../directives/singleCallServicesDirective';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';

import {
  createFieldDirective,
  createObjectDirective,
  createSDLFromDirective,
  createServicesPostCalculation,
  getComplexity,
  singleCallServicesObjectCalculator,
} from '..';
import { fieldCalculator } from '../calculators/fieldCalculator';
import { objectCalculator } from '../calculators/objectCalculator';
import { createSingleCallServiceExtraMerger } from '../mergers/createSingleCallServiceExtraMerger';

const objectDirectiveSDL = createSDLFromDirective(createObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createFieldDirective());
const singleCallServicesDirectiveSDL = createSDLFromDirective(createSingleCallServicesDirective());

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

  it('multiple services', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      }

      type Obj {
        obj1: Obj1
        obj2: Obj2
        obj3: Obj3
      }

      type Obj1 @objComplexity(services: ["serviceX"]) {
        string: String
      }

      type Obj2 @objComplexity(services: ["serviceX", "serviceY"]) {
        string: String
      }

      type Obj3 @objComplexity(services: ["serviceZ", "serviceY"]) {
        string: String
      }
    `;

    const query = gql`
      query {
        test(amount: 4) {
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
      postCalculations: [
        createServicesPostCalculation({
          serviceX: {
            cost: 100,
          },
          serviceY: {
            calledOnce: true,
            cost: 1000,
          },
          serviceZ: {
            cost: 10000,
          },
        }),
      ],
    });

    /**
     * obj1 uses serviceX: 4 * 100 = 400
     * obj2 uses serviceX: 4 * 100 = 400, and serviceY
     * obj3 uses serviceZ: 4 * 10 000 = 40000, and serviceY
     * serviceY is marked ass calledOnce, and one call is 1000
     *
     * sum: 41800
     */
    expect(complexity.cost).toBe(41800);
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

    /**
     * string is called 4 times and uses serviceX = 4 * 100
     * string2 is called 4 times and uses serviceX = 4 * 100 _and_ serviceY = 4 * 20.
     */
    expect(complexity.cost).toBe(880);
  });
});

describe.only('single call service directive', () => {
  it('called multiple times, multiple fields, with cost', async () => {
    const baseSchema = gql`
      ${fieldDirectiveSDL}
      ${objectDirectiveSDL}
      ${singleCallServicesDirectiveSDL}

      type Query {
        test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      }

      #
      type Obj @singleCallServices(services: ["serviceX"]) {
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
      calculators: [
        ...calculators,
        singleCallServicesObjectCalculator({ directive: createSingleCallServicesDirective() }),
      ],
      schema,
      query,
      extraMerger: createSingleCallServiceExtraMerger({ directive: createSingleCallServicesDirective() }),
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

    // console.log(
    //   require('util').inspect(complexity.getTree(), { showHidden: true, depth: null, colors: true, breakLength: 200 })
    // );

    /**
     * string is called 4 times and uses serviceX = 4 * 100.
     * string2 is called 4 times and uses serviceX = 4 * 100 _and_ serviceY = 4 * 20.
     *
     * However, serviceX is annotated as @singleCallServices which means that it's only
     * going to count as 1. So the 4+4 calls, costing 100 each, is only going to be
     * counted as 1 at the cost of 100.
     *
     * So final cost is 100 + 4 * 20.
     */
    expect(complexity.cost).toBe(180);
  });
});
