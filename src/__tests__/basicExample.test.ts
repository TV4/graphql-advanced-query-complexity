import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';

import { getComplexity, maxCallErrorCheck, createMaxCostErrorCheck } from '..';
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
      test(amount: Int = 5): [Obj] @complexity(multiplier: "amount", max: 3)
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

  expect(complexity.extra?.maxCalls['field-Query:test'].max).toBe(3);
  expect(complexity.extra?.maxCalls['field-Query:test'].value).toBe(4);
});

it('basic example 2', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      complexityExample(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
    }

    type Obj @objComplexity(max: 3) {
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
    errorChecks: [maxCallErrorCheck, createMaxCostErrorCheck({ maxCost: 5 })],
  });

  console.log(require('util').inspect(complexity, { showHidden: true, depth: null, colors: true, breakLength: 200 }));

  expect(complexity.extra?.maxCalls['type-Obj'].max).toBe(3);
  expect(complexity.extra?.maxCalls['type-Obj'].value).toBe(4);
});
