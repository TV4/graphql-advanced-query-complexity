import { makeExecutableSchema } from '@graphql-tools/schema';
import { validateGraphQlDocuments } from '@graphql-tools/utils';
import gql from 'graphql-tag';
import { createComplexityObjectDirective, createComplexityFieldDirective } from '../directives';
import { fieldDirectiveCalculator } from '../calculators/fieldDirectiveCalculator';
import { objectDirectiveCalculator } from '../calculators/objectDirectiveCalculator';
import { getComplexity } from '..';
import { createSDLFromDirective } from '../directives';

const objectDirectiveSDL = createSDLFromDirective(createComplexityObjectDirective());
const fieldDirectiveSDL = createSDLFromDirective(createComplexityFieldDirective());

const calculators = [
  objectDirectiveCalculator({ directive: createComplexityObjectDirective() }),
  fieldDirectiveCalculator({ directive: createComplexityFieldDirective() }),
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

  //   console.log(JSON.stringify(complexity, null, 2));

  expect(complexity.extra?.maxCalls['field-test'].maxTimes).toBe(3);
  expect(complexity.extra?.maxCalls['field-test'].mergeValue).toBe(4);
});
