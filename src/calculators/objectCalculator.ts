import { getDirectiveValues, GraphQLDirective } from 'graphql';

import { ComplexityCalculator, Extra } from '..';

export const objectCalculator = (options: { directive: GraphQLDirective }): ComplexityCalculator => {
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
        maxTimes: {
          [`type-${args.fieldTypeName}`]: {
            maxTimes: directiveValues.maxTimes,
            value: 1,
          },
        },
      };

      return { extra };
    }
  };
};
