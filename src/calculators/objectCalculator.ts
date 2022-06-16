import { getDirectiveValues, GraphQLDirective } from 'graphql';

import { ComplexityCalculator, Extra } from '..';

export type ComplexityServices = Record<string, { value: number }>;

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
        [`type-${args.fieldTypeName}`]: {
          maxTimes: directiveValues.maxTimes,
          value: 1,
        },
      };
    }

    return { extra };
  };
};
