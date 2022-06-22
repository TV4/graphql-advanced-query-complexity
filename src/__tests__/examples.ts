import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';

import { getComplexity, maxCallPostCalculation, createMaxCostPostCalculation, createServicesPostCalculation } from '..';
import { fieldCalculator } from '../calculators/fieldCalculator';
import { objectCalculator } from '../calculators/objectCalculator';
import { createFieldDirective, createObjectDirective, createSDLFromDirective } from '..';

const objectDirectiveSDL = createSDLFromDirective(createObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createFieldDirective());

const calculators = [
  objectCalculator({ directive: createObjectDirective() }),
  fieldCalculator({ directive: createFieldDirective() }),
];

it('basic example', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      test(amount: Int = 5): [Obj] @complexity(multiplier: "amount", maxTimes: 3)
    }

    type Obj {
      string: String @complexity(cost: 7)
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

  expect(complexity.extra?.maxTimes['field-Query:test'].maxTimes).toBe(3);
  expect(complexity.extra?.maxTimes['field-Query:test'].value).toBe(4);
});

it('basic example 2', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      complexityExample(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
    }

    type Obj @objComplexity(maxTimes: 3) {
      string: String @complexity(cost: 7)
    }
  `;

  const query = gql`
    query {
      complexityExample(amount: 4) {
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
    postCalculations: [maxCallPostCalculation, createMaxCostPostCalculation({ maxCost: 5 })],
  });

  expect(complexity.extra?.maxTimes['type-Obj'].maxTimes).toBe(3);
  expect(complexity.extra?.maxTimes['type-Obj'].value).toBe(4);
});

it('services', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      panel: Panel
    }

    type Panel {
      listOfMovies(limit: Int!): [Movie] @complexity(multiplier: "limit")
    }

    type Movie @objComplexity(services: ["watched", "mylist"]) {
      title: String
      playback: String @complexity(services: ["engagement"])
    }
  `;

  const query = gql`
    query {
      panel {
        listOfMovies(limit: 4) {
          title
          playback
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
        watched: {
          calledOnce: true,
          cost: 70,
        },
        mylist: {
          cost: 10,
        },
        engagement: {
          maxTimes: 1,
        },
      }),
    ],
  });

  expect(complexity.cost).toBe(110);
  expect(complexity.errors?.[0].message).toBe('Service engagement may only be queried 1 times. Was queried 4 times');
});