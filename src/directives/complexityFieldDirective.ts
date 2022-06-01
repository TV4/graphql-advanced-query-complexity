import { astFromDirective } from '@graphql-tools/utils';
import { DirectiveLocation, GraphQLDirective, GraphQLInputType, GraphQLInt, GraphQLString, print } from 'graphql';

type TypeComplexityDirectiveOptions = {
  name?: string;
};

type CustomAdvComplexityOptions = {
  multiplier?: string;
  cost?: number;
  maxTimes?: number;
};

const DEFAULT_ADV_COMPLEXITY_NAME = 'advComplexity';

export const createComplexityFieldDirectiveSDL = (options?: TypeComplexityDirectiveOptions) =>
  print(astFromDirective(createComplexityFieldDirective(options)));

export const createComplexityFieldDirective = (options?: TypeComplexityDirectiveOptions): GraphQLDirective => {
  const args: Record<
    keyof CustomAdvComplexityOptions,
    {
      type: GraphQLInputType;
      description: string;
    }
  > = {
    cost: {
      type: GraphQLInt,
      description: 'Cost per item',
    },
    multiplier: {
      type: GraphQLString,
      description: 'Field to be used as multiplier',
    },
    maxTimes: {
      type: GraphQLInt,
      description: 'Max time this type can be requested in a single query',
    },
  };

  return new GraphQLDirective({
    name: options?.name || DEFAULT_ADV_COMPLEXITY_NAME,
    description: '',
    locations: [DirectiveLocation.FIELD_DEFINITION],
    args,
  });
};
