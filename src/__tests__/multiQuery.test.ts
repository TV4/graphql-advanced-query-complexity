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

it('multi query document', async () => {
  const baseSchema = gql`
    ${fieldDirectiveSDL}
    ${objectDirectiveSDL}

    type Query {
      test(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
      test2(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
    }

    type Obj {
      string: String @complexity(cost: 7, maxTimes: 5)
    }
  `;

  const query = gql`
    query One {
      test(amount: 4) {
        string
      }
    }

    query Two {
      test2(amount: 2) {
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

  expect(complexity.cost).toBe(42); // 28 + 14
  expect(complexity.extra?.maxTimes['field-Obj:string'].maxTimes).toBe(5);
  expect(complexity.extra?.maxTimes['field-Obj:string'].value).toBe(6); // 4 + 2
});
