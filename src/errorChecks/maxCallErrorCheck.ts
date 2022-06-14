import { GraphQLError } from 'graphql';
import { ErrorCheck } from '..';
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
