import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';

import { getComplexity } from '..';
import { fieldCalculator } from '../calculators/fieldCalculator';
import { objectCalculator } from '../calculators/objectCalculator';
import { createFieldDirective, createObjectDirective, createSDLFromDirective } from '..';

const objectDirectiveSDL = createSDLFromDirective(createObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createFieldDirective());

const calculators = [
  objectCalculator({ directive: createObjectDirective() }),
  fieldCalculator({ directive: createFieldDirective() }),
];

it('query variables', async () => {
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
    query ($amount: Int!) {
      complexityExample(amount: $amount) {
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
    variables: {
      amount: 4,
    },
  });

  expect(complexity.extra?.maxTimes['type-Obj'].maxTimes).toBe(3);
  expect(complexity.extra?.maxTimes['type-Obj'].value).toBe(4);
});
