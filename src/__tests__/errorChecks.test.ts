import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';

import { getComplexity } from '..';
import { fieldCalculator } from '../calculators/fieldCalculator';
import { objectCalculator } from '../calculators/objectCalculator';
import { createFieldDirective, createObjectDirective, createSDLFromDirective } from '..';
import { maxCallErrorCheck, createMaxCostErrorCheck } from '..';

const objectDirectiveSDL = createSDLFromDirective(createObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createFieldDirective());

const calculators = [
  objectCalculator({ directive: createObjectDirective() }),
  fieldCalculator({ directive: createFieldDirective() }),
];

it('type queried to many times', async () => {
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
    errorChecks: [maxCallErrorCheck], // <-- This is causing errors
  });

  expect(complexity.errors?.length).toBe(1);
  expect(complexity.errors?.[0].message).toBe('type Obj may only be queried 3 times. Was queried 4 times');
});

it('over cost', async () => {
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
    errorChecks: [createMaxCostErrorCheck({ maxCost: 6 })], // <-- This is causing errors
  });

  expect(complexity.errors?.length).toBe(1);
  expect(complexity.errors?.[0].message).toBe('Query is to complex. This query cost is 7 and max cost is 6.');
});
