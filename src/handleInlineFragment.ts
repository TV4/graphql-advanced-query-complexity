import {
  GraphQLDirective,
  GraphQLFieldMap,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  InlineFragmentNode,
  isCompositeType,
  ValidationContext,
} from 'graphql';

import { ComplexityEstimator, ComplexityEstimatorArgs, ComplexityNode, GetNodeComplexity } from './queryComplexity';
import { runEstimators } from './runEstimators';

export const handleInlineFragment = (
  childNode: InlineFragmentNode,
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType,
  validationContext: ValidationContext,
  variableValues: Record<string, any>,
  _fields: GraphQLFieldMap<any, any>,
  includeDirectiveDef: GraphQLDirective,
  skipDirectiveDef: GraphQLDirective,
  getNodeComplexity: GetNodeComplexity,
  estimators: Array<ComplexityEstimator>,
  schema: GraphQLSchema
): ComplexityNode => {
  let inlineFragmentType: GraphQLNamedType = typeDef;
  if (childNode.typeCondition && childNode.typeCondition.name) {
    inlineFragmentType = validationContext.getSchema().getType(childNode.typeCondition.name.value)!;
    if (!isCompositeType(inlineFragmentType)) {
      throw new Error(`${childNode.typeCondition.name.value} is not a composite type`);
    }
  }

  const fieldTypeName = childNode.typeCondition?.name?.value;

  if (!fieldTypeName) {
    throw new Error('fieldTypeName does not exist, this should not be able to happen');
  }
  const estimatorArgs: ComplexityEstimatorArgs = {
    args: {},
    fieldTypeName: fieldTypeName,
    node: childNode,
    type: typeDef,
    schema,
  };

  const children = getNodeComplexity(
    childNode,
    inlineFragmentType,
    validationContext,
    includeDirectiveDef,
    skipDirectiveDef,
    variableValues,
    estimators,
    schema
  );

  const { multiplier, cost, extra, childComplexity } = runEstimators({
    estimatorArgs,
    estimators,
    children,
  });

  return {
    name: `inlineFragmentType_${childNode.typeCondition?.name.value}`,
    cost,
    thisCost: childComplexity.childComplexity,
    multiplier,
    children: childComplexity.children,
    extra,
    isInlineFragmentType: true,
  };
};
