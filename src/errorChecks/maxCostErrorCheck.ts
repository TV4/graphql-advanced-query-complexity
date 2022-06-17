import { GraphQLError } from 'graphql';

import { ErrorCheck } from '..';

export const createMaxCostErrorCheck =
  ({ maxCost }: { maxCost: number }): ErrorCheck =>
  (complexity) => {
    if (complexity.cost > maxCost) {
      complexity.errors.push(
        new GraphQLError(`Query is to complex. This query cost is ${complexity.cost} and max cost is ${maxCost}.`, {
          extensions: { complexity: { code: 'MAX_COST' } },
        })
      );
    }
  };
