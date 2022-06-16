import { getDirectiveValues, GraphQLDirective } from 'graphql';

import { ComplexityCalculator, Extra } from '..';
import { isNumber, isString } from '../utils';
import { ComplexityServices } from './objectCalculator';

const getDeep = <T>(obj: Record<any, any>, path: string): T | null => {
  return (path.split('.').reduce((acc, part) => acc && acc[part], obj) || null) as T | null;
};

export const fieldCalculator = (options: { directive: GraphQLDirective }): ComplexityCalculator => {
  return (args) => {
    if (!args.field?.astNode) {
      return;
    }

    const directiveValues = getDirectiveValues(options.directive, args.field.astNode);

    // No directive
    if (!directiveValues) {
      return;
    }

    const extra: Extra = {};

    /**
     * Services
     */
    const services = directiveValues.services as string[] | undefined;
    if (services) {
      const servicesObj: ComplexityServices = Object.fromEntries(
        services.map((serviceName) => [serviceName, { value: 1 }])
      );
      extra.services = servicesObj;
    }

    /**
     * Max times
     */
    if (directiveValues.maxTimes) {
      extra.maxTimes = {
        [`field-${args.type.name}:${args.field.name}`]: {
          maxTimes: directiveValues.maxTimes,
          value: 1,
        },
      };
    }

    const cost = isNumber(directiveValues.cost) ? directiveValues.cost : 0;
    const multiplierString = isString(directiveValues.multiplier) ? directiveValues.multiplier : null;
    const multiplier = multiplierString ? getDeep<number>(args.args, multiplierString) || null : null;

    return { cost, multiplier, extra };
  };
};
