import { getDirectiveValues, GraphQLDirective, GraphQLError } from 'graphql';

import { ComplexityCalculator, ErrorCheck, Extra } from '..';
import { isNumber } from '../utils';

export const maxCallErrorCheck: ErrorCheck = (complexity) => {
  const maxCalls = complexity.extra?.maxCalls;

  if (!maxCalls) {
    return;
  }

  const errors: GraphQLError[] = [];

  for (const key in maxCalls) {
    if (Object.prototype.hasOwnProperty.call(maxCalls, key)) {
      const maxTimes = maxCalls[key]?.maxTimes;
      const mergeValue = maxCalls[key]?.mergeValue;

      if (isNumber(maxTimes) && isNumber(mergeValue) && mergeValue > maxTimes) {
        const [type, actualKey] = key.split('-');

        errors.push(
          new GraphQLError(
            `${type} ${actualKey} may only be queried ${maxTimes} times. Was queried ${mergeValue} times`,
            {
              extensions: { complexity: { code: 'TYPE_CALLED_TO_MANY_TIMES' } },
            }
          )
        );
      }
    }
  }

  return errors.length ? errors : undefined;
};

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
