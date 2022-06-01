import {
  FragmentSpreadNode,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  ValidationContext,
  GraphQLFieldMap,
  GraphQLDirective,
  isCompositeType,
  GraphQLSchema,
} from 'graphql';
import { getChildComplexity } from './getChildComplexity';
import { ComplexityEstimator, ComplexityNode, GetNodeComplexity } from '.';

export const handleFragmentSpread = (
  childNode: FragmentSpreadNode,
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType,
  validationContext: ValidationContext,
  variableValues: Record<string, any>,
  fields: GraphQLFieldMap<any, any>,
  includeDirectiveDef: GraphQLDirective,
  skipDirectiveDef: GraphQLDirective,
  getNodeComplexity: GetNodeComplexity,
  estimators: Array<ComplexityEstimator>,
  schema: GraphQLSchema
): ComplexityNode | null => {
  const fragment = validationContext.getFragment(childNode.name.value);
  // Unknown fragment, should be caught by other validation rules
  if (!fragment) {
    throw new Error(`Unknown fragment ${childNode.name.value}`);
  }
  const fragmentType = validationContext.getSchema().getType(fragment.typeCondition.name.value);
  // Invalid fragment type, ignore. Should be caught by other validation rules
  if (!isCompositeType(fragmentType)) {
    throw new Error(`${fragment.typeCondition.name.value} is not a composite type`);
  }

  const children = getNodeComplexity(
    fragment,
    fragmentType,
    validationContext,
    includeDirectiveDef,
    skipDirectiveDef,
    variableValues,
    estimators,
    schema
  );

  const thisCost = 0; // TODO change
  const childComplexity = getChildComplexity(children);

  const cost = thisCost + childComplexity.childComplexity;

  return {
    name: `fragmentSpreadType_${fragment.name.value}_on_${fragment.typeCondition.name.value}`,
    cost: cost,
    thisCost: thisCost,
    children: childComplexity.children,
  };

  // const nodeComplexity = this.nodeComplexity(fragment, fragmentType);
  // if (isAbstractType(fragmentType)) {
  //   // Add fragment complexity for all possible types
  //   innerComplexities = addComplexities(
  //     nodeComplexity,
  //     complexities,
  //     this.context
  //       .getSchema()
  //       .getPossibleTypes(fragmentType)
  //       .map((t) => t.name)
  //   );
  // } else {
  //   // Add complexity for object type
  //   innerComplexities = addComplexities(nodeComplexity, complexities, [fragmentType.name]);
  // }
  // break;
};
