import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  ValidationContext,
  GraphQLFieldMap,
  GraphQLDirective,
  GraphQLSchema,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  OperationDefinitionNode,
} from 'graphql';
import { ComplexityCalculator, ComplexityNode } from '.';

export type NodeComplexityBase = {
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType;
  validationContext: ValidationContext;
  variableValues: Record<string, any>;
  includeDirectiveDef?: GraphQLDirective;
  skipDirectiveDef?: GraphQLDirective;
  calculators: Array<ComplexityCalculator>;
  schema: GraphQLSchema;
};

export type CommonHandle = NodeComplexityBase & {
  getNodeComplexity: GetNodeComplexity;
  fields: GraphQLFieldMap<any, any>;
};

export type GetNodeComplexity = (
  props: NodeComplexityBase & {
    node: FieldNode | FragmentDefinitionNode | InlineFragmentNode | OperationDefinitionNode;
  }
) => ComplexityNode[] | null;
