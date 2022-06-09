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

import { ComplexityCalculator, ComplexityCalculatorArgs, ComplexityNode, GetNodeComplexity } from '.';
import { runCalculators } from './runCalculators';

export const handleInlineFragment = (
  childNode: InlineFragmentNode,
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType,
  validationContext: ValidationContext,
  variableValues: Record<string, any>,
  _fields: GraphQLFieldMap<any, any>,
  includeDirectiveDef: GraphQLDirective,
  skipDirectiveDef: GraphQLDirective,
  getNodeComplexity: GetNodeComplexity,
  calculators: Array<ComplexityCalculator>,
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
  const calculatorArgs: ComplexityCalculatorArgs = {
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
    calculators,
    schema
  );

  const { multiplier, cost, extra, childComplexity } = runCalculators({
    calculatorArgs,
    calculators,
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
