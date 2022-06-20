import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLInputType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from 'graphql';

const DEFAULT_TYPE_COMPLEXITY_NAME = 'singleCallServices';

export type TypeComplexityDirectiveOptions = {
  name?: string;
};

type CustomTypeComplexityOptions = {
  services?: string[];
};

export const createSingleCallServicesDirective = (options?: TypeComplexityDirectiveOptions): GraphQLDirective => {
  const args: Record<
    keyof CustomTypeComplexityOptions,
    {
      type: GraphQLInputType;
      description: string;
    }
  > = {
    services: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      description: 'Services to treat as single calls',
    },
  };

  return new GraphQLDirective({
    name: options?.name || DEFAULT_TYPE_COMPLEXITY_NAME,
    description: '',
    locations: [DirectiveLocation.OBJECT],
    args,
  });
};
