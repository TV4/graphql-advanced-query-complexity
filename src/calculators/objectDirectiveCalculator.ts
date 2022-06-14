import { getDirectiveValues, GraphQLDirective, GraphQLError } from 'graphql';

import { ComplexityCalculator, ErrorCheck, Extra } from '..';
import { isNumber } from '../utils';

export const objectDirectiveCalculator = (options: { directive: GraphQLDirective }): ComplexityCalculator => {
  return (args) => {
    const schemaTypeNode = args.schema.getType(args.fieldTypeName);

    if (!schemaTypeNode?.astNode) {
      return;
    }

    const directiveValues = getDirectiveValues(options.directive, schemaTypeNode.astNode);

    // No directive
    if (!directiveValues) {
      return;
    }

    if (directiveValues.maxTimes) {
      const extra: Extra = {
        maxCalls: {
          [`type-${args.fieldTypeName}`]: {
            maxTimes: directiveValues.maxTimes,
            mergeValue: 1,
          },
        },
      };

      return { extra };
    }
  };
};
