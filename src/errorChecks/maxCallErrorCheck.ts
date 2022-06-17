import { GraphQLError } from 'graphql';

import { ErrorCheck } from '..';
import { isNumber } from '../utils';

export const maxCallErrorCheck: ErrorCheck = (complexity) => {
  const maxTimes = complexity.extra?.maxTimes;

  if (!maxTimes) {
    return;
  }

  for (const key in maxTimes) {
    if (Object.prototype.hasOwnProperty.call(maxTimes, key)) {
      const max = maxTimes[key]?.maxTimes;
      const value = maxTimes[key]?.value;

      if (isNumber(max) && isNumber(value) && value > max) {
        const [type, actualKey] = key.split('-');

        complexity.errors.push(
          new GraphQLError(`${type} ${actualKey} may only be queried ${max} times. Was queried ${value} times`, {
            extensions: { complexity: { code: 'TYPE_CALLED_TO_MANY_TIMES' } },
          })
        );
      }
    }
  }
};
