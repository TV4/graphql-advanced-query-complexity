import { createMaxCostErrorCheck } from './errorChecks/maxCostErrorCheck';
import {
  DocumentNode,
  FieldNode,
  FragmentSpreadNode,
  GraphQLCompositeType,
  GraphQLDirective,
  GraphQLError,
  GraphQLField,
  GraphQLFieldMap,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  InlineFragmentNode,
  Kind,
  OperationDefinitionNode,
  TypeInfo,
  ValidationContext,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { getDirectiveValues, getVariableValues } from 'graphql/execution/values';
import { fieldCalculator } from './calculators/fieldCalculator';
import { objectCalculator } from './calculators/objectCalculator';

import { GetNodeComplexity } from './commonTypes';
import { createFieldDirective } from './directives/fieldDirective';
import { createObjectDirective } from './directives/objectDirective';
import { maxCallErrorCheck } from './errorChecks/maxCallErrorCheck';
import { handleField } from './handleField';
import { handleFragmentSpread } from './handleFragmentSpread';
import { handleInlineFragment } from './handleInlineFragment';
import { createSDLFromDirective, isBoolean, nonNullable } from './utils';

export {
  fieldCalculator,
  objectCalculator,
  createSDLFromDirective,
  createObjectDirective,
  createFieldDirective,
  maxCallErrorCheck,
  createMaxCostErrorCheck,
};

export type ComplexityNode = {
  name: string;
  children: ComplexityNode[] | null;
  isInlineFragmentType?: boolean;
  args?: Record<string, any>;
  selected?: boolean;
  multiplier?: number | null;
  cost: number;
  thisCost?: number;
  extra?: Extra;
};

export type ComplexityCalculatorArgs = {
  fieldTypeName: string;
  type: GraphQLCompositeType;
  field?: GraphQLField<any, any>;
  node: FieldNode | InlineFragmentNode;
  args: { [key: string]: any };
  schema: GraphQLSchema;
};

export type Extra = Record<string, any>;

export type ComplexityCalculator = (
  options: ComplexityCalculatorArgs
) => { cost: number; multiplier: number | null } | { extra: Extra } | void;

// TODO: Not all of these are used, are they? Fix
export interface QueryComplexityOptions {
  // The query variables. This is needed because the variables are not available
  // in the visitor of the graphql-js library
  variables?: Record<string, any>;
  // specify operation name only when pass multi-operation documents
  operationName?: string;
  calculators: Array<ComplexityCalculator>;
}

export type ErrorCheck = (complexity: ComplexityCollector) => GraphQLError[] | void;

export type ComplexityOptions = {
  calculators: ComplexityCalculator[];
  schema: GraphQLSchema;
  query: DocumentNode;
  variables?: Record<string, any>;
  operationName?: string;
  errorChecks?: ErrorCheck[];
  onParseError?: (error: unknown, errors: GraphQLError[]) => void;
};

export function getComplexity(options: ComplexityOptions): Complexity {
  const errors: GraphQLError[] = [];

  try {
    const typeInfo = new TypeInfo(options.schema);
    const context = new ValidationContext(options.schema, options.query, typeInfo, (error) => errors.push(error));
    const visitor = new QueryComplexity(context, {
      calculators: options.calculators,
      variables: options.variables,
      operationName: options.operationName,
    });

    visit(options.query, visitWithTypeInfo(typeInfo, visitor));

    for (const errorCheck of options?.errorChecks || []) {
      const maybeErrors = errorCheck(visitor.complexity);
      if (maybeErrors?.length) {
        errors.push(...maybeErrors);
      }
    }

    return {
      cost: visitor.complexity.cost,
      extra: visitor.complexity.extra,
      errors,
      getTree: () => visitor.complexity.tree,
    };
  } catch (error) {
    if (options.onParseError) {
      options.onParseError(error, errors);
    }
    return {
      cost: 0,
      errors,
      getTree: () => null,
    };
  }
}

const includeNode = ({
  childNode,
  includeDirectiveDef,
  skipDirectiveDef,
  variableValues,
}: {
  childNode: FieldNode | FragmentSpreadNode | InlineFragmentNode;
  includeDirectiveDef?: GraphQLDirective;
  skipDirectiveDef?: GraphQLDirective;
  variableValues: Record<string, any>;
}): boolean => {
  let includeNode = true;
  let skipNode = false;

  for (const directive of childNode.directives ?? []) {
    const directiveName = directive.name.value;
    switch (directiveName) {
      case 'include': {
        if (!includeDirectiveDef) {
          return true;
        }

        const values = getDirectiveValues(includeDirectiveDef, childNode, variableValues || {});
        const ifClause = values?.if;
        includeNode = isBoolean(ifClause) ? ifClause : true;
        break;
      }
      case 'skip': {
        if (!skipDirectiveDef) {
          return false;
        }

        const values = getDirectiveValues(skipDirectiveDef, childNode, variableValues || {});
        const ifClause = values?.if;
        skipNode = isBoolean(ifClause) ? ifClause : false;
        break;
      }
    }
  }

  return includeNode && !skipNode;
};

const getChilds: GetNodeComplexity = ({
  node,
  typeDef,
  validationContext,
  includeDirectiveDef,
  skipDirectiveDef,
  variableValues,
  calculators,
  schema,
}) => {
  let fields: GraphQLFieldMap<any, any> = {};
  if (typeDef instanceof GraphQLObjectType || typeDef instanceof GraphQLInterfaceType) {
    fields = typeDef.getFields();
  }

  if (!node.selectionSet) {
    throw new Error('No selectionSet, probably not real error and this throw should be removed');
  }

  const children = node.selectionSet.selections.map(
    (childNode: FieldNode | FragmentSpreadNode | InlineFragmentNode) => {
      if (!includeNode({ childNode, includeDirectiveDef, skipDirectiveDef, variableValues })) {
        return null;
      }

      const fieldData = {
        typeDef: typeDef,
        validationContext: validationContext,
        variableValues: variableValues,
        fields: fields,
        includeDirectiveDef: includeDirectiveDef,
        skipDirectiveDef: skipDirectiveDef,
        getNodeComplexity: getChilds,
        calculators: calculators,
        schema: schema,
      };

      switch (childNode.kind) {
        case Kind.FIELD: {
          return handleField({ childNode, ...fieldData });
        }
        case Kind.INLINE_FRAGMENT: {
          return handleInlineFragment({ childNode, ...fieldData });
        }
        case Kind.FRAGMENT_SPREAD: {
          return handleFragmentSpread({ childNode, ...fieldData });
        }
        default: {
          throw new Error(`Unsupported node kind ${(childNode as any)?.kind}`);
        }
      }
    }
  );

  return children.filter(nonNullable);
};

export type Complexity = {
  cost: number;
  extra?: Extra;
  errors?: GraphQLError[];
  getTree: () => ComplexityNode | null;
};

export type ComplexityCollector = {
  cost: number;
  tree: ComplexityNode | null;
  extra?: Extra;
  errors?: GraphQLError[];
};

class QueryComplexity {
  context: ValidationContext;
  complexity: ComplexityCollector;
  options: QueryComplexityOptions;
  OperationDefinition: Record<string, any>;
  calculators: Array<ComplexityCalculator>;
  includeDirectiveDef?: GraphQLDirective;
  skipDirectiveDef?: GraphQLDirective;
  variableValues: Record<string, any>;

  constructor(context: ValidationContext, options: QueryComplexityOptions) {
    this.context = context;
    this.complexity = { cost: 0, tree: null };
    this.options = options;
    this.calculators = options.calculators;
    this.variableValues = {};
    this.OperationDefinition = {
      enter: this.onOperationDefinitionEnter,
    };

    const includeDirectiveDef = this.context.getSchema().getDirective('include');
    if (includeDirectiveDef) {
      this.includeDirectiveDef = includeDirectiveDef;
    }

    const skipDirectiveDef = this.context.getSchema().getDirective('skip');
    if (skipDirectiveDef) {
      this.skipDirectiveDef = skipDirectiveDef;
    }
  }

  onOperationDefinitionEnter(operation: OperationDefinitionNode): void {
    if (typeof this.options.operationName === 'string' && this.options.operationName !== operation.name?.value) {
      return;
    }

    const variableValues = getVariableValues(
      this.context.getSchema(),
      operation.variableDefinitions ?? [],
      this.options.variables ?? {}
    ).coerced;

    if (!variableValues) {
      throw new Error(
        `Query complexity could not be calculated for operation of type ${operation.operation}. Variable values can not be read`
      );
    }

    this.variableValues = variableValues;

    switch (operation.operation) {
      case 'query':
        const queryType = this.context.getSchema().getQueryType();
        if (!queryType) {
          throw new Error(
            `Query complexity could not be calculated for operation of type ${operation.operation}. No queryType found`
          );
        }

        const complexityNode = getChilds({
          node: operation,
          typeDef: queryType,
          validationContext: this.context,
          includeDirectiveDef: this.includeDirectiveDef,
          skipDirectiveDef: this.skipDirectiveDef,
          variableValues: this.variableValues,
          calculators: this.calculators,
          schema: this.context.getSchema(),
        });

        if (!complexityNode) {
          throw new Error(
            `Query complexity could not be calculated for operation of type ${operation.operation}. No complexityNode found`
          );
        }

        if (complexityNode.length !== 1) {
          throw new Error(
            `Query complexity could not be calculated for operation of type ${operation.operation}. Multiple results found`
          );
        }

        this.complexity = {
          cost: complexityNode[0].cost || 0,
          extra: complexityNode[0].extra,
          tree: complexityNode[0],
        };

        console.log(
          require('util').inspect(this.complexity, { showHidden: true, depth: null, colors: true, breakLength: 200 })
        );

        break;
      case 'mutation':
        // TODO: Add
        // this.complexity += this.nodeComplexity(operation, this.context.getSchema().getMutationType()!);
        break;
      case 'subscription':
        // TODO: Add
        // this.complexity += this.nodeComplexity(operation, this.context.getSchema().getSubscriptionType()!);
        break;
      default:
        throw new Error(`Query complexity could not be calculated for operation of type ${operation.operation}`);
    }
  }
}
