import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  ValidationContext,
  GraphQLFieldMap,
  GraphQLDirective,
  GraphQLSchema,
} from 'graphql';
import { GetNodeComplexity, ComplexityCalculator } from '.';

export type CommonHandle = {
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType;
  validationContext: ValidationContext;
  variableValues: Record<string, any>;
  fields: GraphQLFieldMap<any, any>;
  includeDirectiveDef?: GraphQLDirective;
  skipDirectiveDef?: GraphQLDirective;
  getNodeComplexity: GetNodeComplexity;
  calculators: Array<ComplexityCalculator>;
  schema: GraphQLSchema;
};
