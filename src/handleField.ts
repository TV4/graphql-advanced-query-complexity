import { mergeExtra } from "./mergeExtra";
import { getArgumentValues } from "@graphql-tools/utils";
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
} from "graphql";

import { getChildComplexity } from "./getChildComplexity";
import {
  ComplexityEstimator,
  ComplexityEstimatorArgs,
  ComplexityNode,
  Extra,
  GetNodeComplexity,
} from ".";
import { runEstimators } from "./runEstimators";

const BUILT_IN_SCALAR_NAMES = ["String", "Int", "Float", "Boolean", "ID"];
const isBuiltInScalar = (typeName: string) =>
  BUILT_IN_SCALAR_NAMES.includes(typeName);

export const handleField = (
  childNode: FieldNode,
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
    //console.log('Run type directives estimators here!', schemaTypeNode);
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
    ? getNodeComplexity(
        childNode,
        fieldType,
        validationContext,
        includeDirectiveDef,
        skipDirectiveDef,
        variableValues,
        estimators,
        schema
      )
    : [];

  const name = `field_${childNode.name.value}`;

  const estimatorArgs: ComplexityEstimatorArgs = {
    fieldTypeName,
    args,
    field,
    node: childNode,
    type: typeDef,
    schema,
  };

  const { multiplier, thisCost, cost, childComplexity, extra } = runEstimators({
    estimatorArgs,
    estimators,
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
