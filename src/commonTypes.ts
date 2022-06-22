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
import { ComplexityCalculator, ComplexityNode, Extra, ExtraMerger } from '.';

export type NodeComplexityBase = {
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType;
  validationContext: ValidationContext;
  variableValues: Record<string, any>;
  includeDirectiveDef?: GraphQLDirective;
  skipDirectiveDef?: GraphQLDirective;
  calculators: Array<ComplexityCalculator>;
  extraMerger?: ExtraMerger;
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

export type ComplexityCalculatorAccumulator = {
  cost: number;
  multiplier: number | null;
  extra: Extra;
};
