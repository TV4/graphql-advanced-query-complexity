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

it('get tree', async () => {
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

  expect(complexity.getTree()).toMatchSnapshot();
});
