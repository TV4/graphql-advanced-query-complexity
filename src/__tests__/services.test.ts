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

it('called once with cost', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
    }

    type Obj @objComplexity(services: ["engagement"]) {
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
        engagement: {
          calledOnce: true,
          cost: 100,
        },
      }),
    ],
  });

  expect(complexity.extra?.services.engagement.value).toBe(4);
  expect(complexity.cost).toBe(100);
});

it('called multiple times with cost', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
    }

    type Obj @objComplexity(services: ["engagement"]) {
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
        engagement: {
          cost: 100,
        },
      }),
    ],
  });

  expect(complexity.extra?.services.engagement.value).toBe(4);
  expect(complexity.cost).toBe(400);
});

it('max times, creates error', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
    }

    type Obj @objComplexity(services: ["engagement"]) {
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
        engagement: {
          cost: 100,
          maxTimes: 3,
        },
      }),
    ],
  });

  expect(complexity.extra?.services.engagement.value).toBe(4);
  expect(complexity.cost).toBe(400);
  expect(complexity.errors?.[0].message).toBe('Service engagement may only be queried 3 times. Was queried 4 times');
});

it.todo('Should work on fields as well');
