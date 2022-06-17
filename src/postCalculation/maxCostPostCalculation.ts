import { PostCalculation } from '..';
import { GraphQLError } from 'graphql';

export const createMaxCostPostCalculation =
  ({ maxCost }: { maxCost: number }): PostCalculation =>
  (complexity) => {
    if (complexity.cost > maxCost) {
      complexity.errors.push(
        new GraphQLError(`Query is to complex. This query cost is ${complexity.cost} and max cost is ${maxCost}.`, {
          extensions: { complexity: { code: 'MAX_COST' } },
        })
      );
    }
  };
