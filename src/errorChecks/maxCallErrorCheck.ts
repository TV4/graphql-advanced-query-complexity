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
      const value = maxCalls[key]?.value;

      if (isNumber(maxTimes) && isNumber(value) && value > maxTimes) {
        const [type, actualKey] = key.split('-');

        errors.push(
          new GraphQLError(`${type} ${actualKey} may only be queried ${maxTimes} times. Was queried ${value} times`, {
            extensions: { complexity: { code: 'TYPE_CALLED_TO_MANY_TIMES' } },
          })
        );
      }
    }
  }

  return errors.length ? errors : undefined;
};
