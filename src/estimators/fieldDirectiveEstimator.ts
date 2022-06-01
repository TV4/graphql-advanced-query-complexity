import { getDirectiveValues, GraphQLDirective } from 'graphql';
import { ComplexityEstimator } from '../queryComplexity';
import { isNumber, isString } from '../utils';

const getDeep = <T>(obj: Record<any, any>, path: string): T | null => {
  return (path.split('.').reduce((acc, part) => acc && acc[part], obj) || null) as T | null;
};

export const fieldDirectiveEstimator = (options: { directive: GraphQLDirective }): ComplexityEstimator => {
  return (args) => {
    if (!args.field?.astNode) {
      return;
    }

    const directiveValues = getDirectiveValues(options.directive, args.field.astNode);

    // No directive
    if (!directiveValues) {
      return;
    }

    const cost = isNumber(directiveValues.cost) ? directiveValues.cost : 0;
    const multiplierString = isString(directiveValues.multiplier) ? directiveValues.multiplier : null;
    const multiplier = multiplierString ? getDeep<number>(args.args, multiplierString) || null : null;

    return { cost, multiplier };
  };
};
