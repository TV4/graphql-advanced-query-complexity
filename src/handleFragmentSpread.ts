import { FragmentSpreadNode, isCompositeType } from 'graphql';

import { ComplexityNode } from '.';
import { CommonHandle } from './commonTypes';
import { getChildComplexity } from './getChildComplexity';

export const handleFragmentSpread = ({
  // typeDef,
  // fields
  childNode,
  validationContext,
  variableValues,
  includeDirectiveDef,
  skipDirectiveDef,
  getNodeComplexity,
  calculators,
  schema,
}: CommonHandle & {
  childNode: FragmentSpreadNode;
}): ComplexityNode | null => {
  const fragment = validationContext.getFragment(childNode.name.value);

  /**
   * Unknown fragment, should be caught by other validation rules
   */
  if (!fragment) {
    throw new Error(`Unknown fragment ${childNode.name.value}`);
  }
  const fragmentType = validationContext.getSchema().getType(fragment.typeCondition.name.value);

  /**
   * Invalid fragment type, ignore. Should be caught by other validation rules
   */
  if (!isCompositeType(fragmentType)) {
    throw new Error(`${fragment.typeCondition.name.value} is not a composite type`);
  }

  const children = getNodeComplexity({
    node: fragment,
    typeDef: fragmentType,
    validationContext,
    includeDirectiveDef,
    skipDirectiveDef,
    variableValues,
    calculators,
    schema,
  });

  const thisCost = 0;
  const childComplexity = getChildComplexity(children);

  const cost = thisCost + childComplexity.childComplexity;

  return {
    name: `fragmentSpreadType_${fragment.name.value}_on_${fragment.typeCondition.name.value}`,
    cost,
    thisCost,
    children: childComplexity.children,
  };
};
