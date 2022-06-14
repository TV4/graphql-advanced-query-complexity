import { CommonHandle } from './handleTypes';
import { mergeExtra } from './mergeExtra';
import { getArgumentValues } from '@graphql-tools/utils';
import {
  FieldNode,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  ValidationContext,
  GraphQLFieldMap,
  GraphQLDirective,
  getNamedType,
  isCompositeType,
  GraphQLSchema,
} from 'graphql';

import { getChildComplexity } from './getChildComplexity';
import { ComplexityCalculator, ComplexityCalculatorArgs, ComplexityNode, Extra, GetNodeComplexity } from '.';
import { runCalculators } from './runCalculators';

const BUILT_IN_SCALAR_NAMES = ['String', 'Int', 'Float', 'Boolean', 'ID'];
const isBuiltInScalar = (typeName: string) => BUILT_IN_SCALAR_NAMES.includes(typeName);

export const handleField = ({
  childNode,
  typeDef,
  validationContext,
  variableValues,
  fields,
  includeDirectiveDef,
  skipDirectiveDef,
  getNodeComplexity,
  calculators,
  schema,
}: CommonHandle & {
  childNode: FieldNode;
}): ComplexityNode | null => {
  const field = fields[childNode.name.value];
  // Invalid field, should be caught by other validation rules
  if (!field) {
    return null;
  }
  const fieldType = getNamedType(field.type);
  const fieldTypeName = fieldType.name;

  const schemaTypeNode = schema.getType(fieldTypeName);

  if (!schemaTypeNode?.astNode) {
    if (!isBuiltInScalar(fieldTypeName)) {
      // This should never happen
      throw new Error(`Could not find type ${fieldTypeName} in schema`);
    }
  } else {
    //console.log('Run type directives calculators here!', schemaTypeNode);
  }

  // Get arguments
  let args: { [key: string]: any };
  try {
    args = getArgumentValues(field, childNode, variableValues || {});
  } catch (e) {
    validationContext.reportError(e as unknown as any);
    return null;
  }

  const children: ComplexityNode[] | null = isCompositeType(fieldType)
    ? getNodeComplexity({
        node: childNode,
        typeDef: fieldType,
        validationContext,
        includeDirectiveDef,
        skipDirectiveDef,
        variableValues,
        calculators,
        schema,
      })
    : [];

  const name = `field_${childNode.name.value}`;

  const calculatorArgs: ComplexityCalculatorArgs = {
    fieldTypeName,
    args,
    field,
    node: childNode,
    type: typeDef,
    schema,
  };

  const { multiplier, thisCost, cost, childComplexity, extra } = runCalculators({
    calculatorArgs,
    calculators,
    children,
  });

  return {
    name,
    args,
    cost,
    thisCost,
    multiplier,
    children: childComplexity.children,
    extra,
  };
};
