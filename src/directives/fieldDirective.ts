import { DirectiveLocation, GraphQLDirective, GraphQLInputType, GraphQLInt, GraphQLString } from 'graphql';

type TypeComplexityDirectiveOptions = {
  name?: string;
};

type CustomComplexityOptions = {
  multiplier?: string;
  cost?: number;
  max?: number;
};

const DEFAULT_COMPLEXITY_NAME = 'complexity';

export const createFieldDirective = (options?: TypeComplexityDirectiveOptions): GraphQLDirective => {
  const args: Record<
    keyof CustomComplexityOptions,
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
    max: {
      type: GraphQLInt,
      description: 'Max time this type can be requested in a single query',
    },
  };

  return new GraphQLDirective({
    name: options?.name || DEFAULT_COMPLEXITY_NAME,
    description: '',
    locations: [DirectiveLocation.FIELD_DEFINITION],
    args,
  });
};
