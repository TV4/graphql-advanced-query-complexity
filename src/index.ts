import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  GraphQLCompositeType,
  GraphQLDirective,
  GraphQLError,
  GraphQLField,
  GraphQLFieldMap,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  InlineFragmentNode,
  isAbstractType,
  Kind,
  OperationDefinitionNode,
  TypeInfo,
  ValidationContext,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { getDirectiveValues, getVariableValues } from 'graphql/execution/values';

import { handleField } from './handleField';
import { handleFragmentSpread } from './handleFragmentSpread';
import { handleInlineFragment } from './handleInlineFragment';
import { isBoolean, nonNullable } from './utils';

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
  // The maximum allowed query complexity, queries above this threshold will be rejected
  maximumComplexity: number;

  // The query variables. This is needed because the variables are not available
  // in the visitor of the graphql-js library
  variables?: Record<string, any>;

  // specify operation name only when pass multi-operation documents
  operationName?: string;
  calculators: Array<ComplexityCalculator>;
}

// TODO Fix
function queryComplexityMessage(max: number, actual: number): string {
  return `The query exceeds the maximum complexity of ${max}. ` + `Actual complexity is ${actual}`;
}

export type ErrorCheck = (complexity: PublicComplexity) => GraphQLError[] | void;

export function getComplexity(options: {
  calculators: ComplexityCalculator[];
  schema: GraphQLSchema;
  query: DocumentNode;
  variables?: Record<string, any>;
  operationName?: string;
  errorChecks?: ErrorCheck[];
}): PublicComplexity {
  const typeInfo = new TypeInfo(options.schema);

  const errors: GraphQLError[] = [];
  const context = new ValidationContext(options.schema, options.query, typeInfo, (error) => errors.push(error));
  const visitor = new QueryComplexity(context, {
    // Maximum complexity does not matter since we're only interested in the calculated complexity.
    maximumComplexity: Infinity,
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

  // Throw first error if any
  // if (errors.length) {
  //   throw errors.pop();
  // }

  return {
    ...visitor.complexity,
    errors,
  };
}

const includeNode = (
  childNode: FieldNode | FragmentSpreadNode | InlineFragmentNode,
  includeDirectiveDef: GraphQLDirective,
  skipDirectiveDef: GraphQLDirective,
  variableValues: Record<string, any>
): boolean => {
  let includeNode = true;
  let skipNode = false;

  for (const directive of childNode.directives ?? []) {
    const directiveName = directive.name.value;
    switch (directiveName) {
      case 'include': {
        const values = getDirectiveValues(includeDirectiveDef, childNode, variableValues || {});
        const ifClause = values?.if;
        includeNode = isBoolean(ifClause) ? ifClause : true;
        break;
      }
      case 'skip': {
        const values = getDirectiveValues(skipDirectiveDef, childNode, variableValues || {});
        const ifClause = values?.if;
        skipNode = isBoolean(ifClause) ? ifClause : false;
        break;
      }
    }
  }

  return includeNode && !skipNode;
};

export type GetNodeComplexity = (
  node: FieldNode | FragmentDefinitionNode | InlineFragmentNode | OperationDefinitionNode,
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType,
  validationContext: ValidationContext,
  includeDirectiveDef: GraphQLDirective,
  skipDirectiveDef: GraphQLDirective,
  variableValues: Record<string, any>,
  calculators: Array<ComplexityCalculator>,
  schema: GraphQLSchema
) => ComplexityNode[] | null;

const getChilds: GetNodeComplexity = (
  node,
  typeDef,
  validationContext,
  includeDirectiveDef,
  skipDirectiveDef,
  variableValues,
  calculators,
  schema
) => {
  let fields: GraphQLFieldMap<any, any> = {};
  if (typeDef instanceof GraphQLObjectType || typeDef instanceof GraphQLInterfaceType) {
    fields = typeDef.getFields();
  }

  if (!node.selectionSet) {
    throw new Error('No selectionSet, probably not real error and this throw should be removed');
  }

  const children = node.selectionSet.selections.map(
    (childNode: FieldNode | FragmentSpreadNode | InlineFragmentNode) => {
      if (!includeNode(childNode, includeDirectiveDef, skipDirectiveDef, variableValues)) {
        return null;
      }

      switch (childNode.kind) {
        case Kind.FIELD: {
          return handleField(
            childNode,
            typeDef,
            validationContext,
            variableValues,
            fields,
            includeDirectiveDef,
            skipDirectiveDef,
            getChilds,
            calculators,
            schema
          );
        }
        case Kind.INLINE_FRAGMENT: {
          return handleInlineFragment(
            childNode,
            typeDef,
            validationContext,
            variableValues,
            fields,
            includeDirectiveDef,
            skipDirectiveDef,
            getChilds,
            calculators,
            schema
          );
        }
        case Kind.FRAGMENT_SPREAD: {
          return handleFragmentSpread(
            childNode,
            typeDef,
            validationContext,
            variableValues,
            fields,
            includeDirectiveDef,
            skipDirectiveDef,
            getChilds,
            calculators,
            schema
          );
        }
        default: {
          throw new Error(`Unsupported node kind ${(childNode as any)?.kind}`);
        }
      }
    }
  );

  return children.filter(nonNullable);
};

export type PublicComplexity = {
  cost: number;
  tree: ComplexityNode | null;
  extra?: Extra;
  errors?: GraphQLError[];
};

class QueryComplexity {
  context: ValidationContext;
  complexity: PublicComplexity;
  options: QueryComplexityOptions;
  OperationDefinition: Record<string, any>;
  calculators: Array<ComplexityCalculator>;
  includeDirectiveDef: GraphQLDirective;
  skipDirectiveDef: GraphQLDirective;
  variableValues: Record<string, any>;

  constructor(context: ValidationContext, options: QueryComplexityOptions) {
    if (!(typeof options.maximumComplexity === 'number' && options.maximumComplexity > 0)) {
      throw new Error('Maximum query complexity must be a positive number');
    }

    this.context = context;
    this.complexity = { cost: 0, tree: null };
    this.options = options;

    this.includeDirectiveDef = this.context.getSchema().getDirective('include')!;
    this.skipDirectiveDef = this.context.getSchema().getDirective('skip')!;
    this.calculators = options.calculators;
    this.variableValues = {};

    this.OperationDefinition = {
      enter: this.onOperationDefinitionEnter,
    };
  }

  onOperationDefinitionEnter(operation: OperationDefinitionNode): void {
    if (typeof this.options.operationName === 'string' && this.options.operationName !== operation.name?.value) {
      return;
    }

    // Get variable values from variables that are passed from options, merged
    // with default values defined in the operation
    this.variableValues = getVariableValues(
      this.context.getSchema(),
      operation.variableDefinitions ?? [],
      this.options.variables ?? {}
    ).coerced!;

    switch (operation.operation) {
      case 'query':
        // this.complexity += this.nodeComplexity(operation, this.context.getSchema().getQueryType()!);
        const x = getChilds(
          operation,
          this.context.getSchema().getQueryType()!,
          this.context,
          this.includeDirectiveDef,
          this.skipDirectiveDef,
          this.variableValues,
          this.calculators,
          this.context.getSchema()
        );

        if (!x) {
          throw new Error('x is null');
        }

        if (x.length !== 1) {
          console.log('output length is a strange format');
          console.log(require('util').inspect(x, { showHidden: true, depth: null, colors: true, breakLength: 200 }));
          //throw new Error('x.length !== 1');
          break;
        }

        this.complexity = {
          cost: x[0].cost || 0,
          extra: x[0].extra,
          //cost: (x[0].cost || 0) * (x[0].multiplier || 1),
          tree: x[0],
        };
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
