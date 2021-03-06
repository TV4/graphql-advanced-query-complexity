import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLInputType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from 'graphql';

const DEFAULT_TYPE_COMPLEXITY_NAME = 'objComplexity';

export type TypeComplexityDirectiveOptions = {
  name?: string;
};

type CustomTypeComplexityOptions = {
  // services?: string[];
  maxTimes?: number;
  // initCost?: number;
  // perItemCost?: number;
  // batchSize?: number;
  services?: string[];
};

export const createObjectDirective = (options?: TypeComplexityDirectiveOptions): GraphQLDirective => {
  const args: Record<
    keyof CustomTypeComplexityOptions,
    {
      type: GraphQLInputType;
      description: string;
    }
  > = {
    maxTimes: {
      type: GraphQLInt,
      description: 'Max time this type can be requested in a single query',
    },
    services: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      description: 'Services resolvement of this calls',
    },
    /**
     * Not yet implemented
     */
    // services: {
    //   type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    //   description: "Name(s) of the services called for this type",
    // },
    // initCost: {
    //   type: GraphQLInt,
    //   description: "Cost first time this type is requested",
    // },
    // perItemCost: {
    //   type: GraphQLInt,
    //   description:
    //     "Additional costs to be added when requested subsequent times after the first",
    // },
    // batchSize: {
    //   type: GraphQLInt,
    //   description:
    //     "When requested more times than this, treat it as a new initial request",
    // },
  };

  return new GraphQLDirective({
    name: options?.name || DEFAULT_TYPE_COMPLEXITY_NAME,
    description: '',
    locations: [DirectiveLocation.OBJECT],
    args,
  });
};
