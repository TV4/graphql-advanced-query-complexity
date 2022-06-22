import { mergeExtraDefault } from './mergeExtraDefault';
import { getDirectiveValues, GraphQLDirective } from 'graphql';
import { ComplexityCalculatorArgs, Extra, ExtraMerger } from '..';
import { mergeExtra } from '../mergeExtra';
import { nonNullable } from '../utils';
import { ChildComplexity } from '../getChildComplexity';
import { ComplexityCalculatorAccumulator } from '../commonTypes';

const getSingleCallServiceServices = (
  options: { directive: GraphQLDirective },
  args: ComplexityCalculatorArgs
): undefined | string[] => {
  const schemaTypeNode = args.schema.getType(args.fieldTypeName);

  if (!schemaTypeNode?.astNode) {
    return;
  }

  const directiveValues = getDirectiveValues(options.directive, schemaTypeNode.astNode);
  const services = directiveValues?.services as string[] | undefined;

  return services;
};

const mergeSingleCallServiceExtra = (
  accumulator: ComplexityCalculatorAccumulator,
  childComplexity: ChildComplexity,
  services: string[]
): Extra => {
  const inputChildExtra = [childComplexity.extra].filter(nonNullable);
  const multipliedChildExtras = [...Array(accumulator.multiplier || 1)].map((_) => inputChildExtra).flat();
  const childExtra = mergeExtra('sum', ...multipliedChildExtras);

  for (const service of services) {
    if (childExtra.services?.[service]) {
      childExtra.services[service].value = 1;
    }
  }

  const inputThisExtra = [accumulator.extra].filter(nonNullable);
  const multipliedThisExtra = [...Array(accumulator.multiplier || 1)].map((_) => inputThisExtra).flat();
  const thisExtra = mergeExtra('sum', ...multipliedThisExtra);

  return mergeExtra('sum', childExtra, thisExtra);
};

export const createSingleCallServiceExtraMerger =
  (options: { directive: GraphQLDirective }): ExtraMerger =>
  (args, accumulator, childComplexity) => {
    const services = getSingleCallServiceServices(options, args);

    // No directive
    if (!services) {
      return mergeExtraDefault(args, accumulator, childComplexity);
    }

    return mergeSingleCallServiceExtra(accumulator, childComplexity, services);
  };
