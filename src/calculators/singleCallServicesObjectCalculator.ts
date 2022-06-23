import { getDirectiveValues, GraphQLDirective } from 'graphql';

import { ComplexityCalculator } from '..';

export type ComplexityServices = Record<string, { value: number }>;

export const singleCallServicesObjectCalculator = (options: { directive: GraphQLDirective }): ComplexityCalculator => {
  return (args, _accumulator, childComplexity) => {
    const schemaTypeNode = args.schema.getType(args.fieldTypeName);

    if (!schemaTypeNode?.astNode) {
      return;
    }

    const directiveValues = getDirectiveValues(options.directive, schemaTypeNode.astNode);
    const services = directiveValues?.services as string[] | undefined;

    // No directive
    if (!services) {
      return;
    }

    for (const service of services) {
      if (childComplexity.extra?.services?.[service]) {
        childComplexity.extra.services[service].value = 1;
      }
    }

    return;
  };
};
