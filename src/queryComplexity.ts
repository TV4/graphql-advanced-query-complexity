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
} from "graphql";
import {
  getDirectiveValues,
  getVariableValues,
} from "graphql/execution/values";

import { handleField } from "./handleField";
import { handleFragmentSpread } from "./handleFragmentSpread";
import { handleInlineFragment } from "./handleInlineFragment";
import { isBoolean, nonNullable } from "./utils";

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

export type ComplexityEstimatorArgs = {
  fieldTypeName: string;
  type: GraphQLCompositeType;
  field?: GraphQLField<any, any>;
  node: FieldNode | InlineFragmentNode;
  args: { [key: string]: any };
  schema: GraphQLSchema;
};

export type Extra = Record<string, any>;

export type ComplexityEstimator = (
  options: ComplexityEstimatorArgs
) => { cost: number; multiplier: number | null } | { extra: Extra } | void;

// Complexity can be anything that is supported by the configured estimators
export type Complexity = any;

export interface QueryComplexityOptions {
  // The maximum allowed query complexity, queries above this threshold will be rejected
  maximumComplexity: number;

  // The query variables. This is needed because the variables are not available
  // in the visitor of the graphql-js library
  variables?: Record<string, any>;

  // specify operation name only when pass multi-operation documents
  operationName?: string;

  // Optional callback function to retrieve the determined query complexity
  // Will be invoked whether the query is rejected or not
  // This can be used for logging or to implement rate limiting
  onComplete?: (complexity: number) => void;

  // Optional function to create a custom error
  createError?: (max: number, actual: number) => GraphQLError;

  // An array of complexity estimators to use for estimating the complexity
  estimators: Array<ComplexityEstimator>;
}

function queryComplexityMessage(max: number, actual: number): string {
  return (
    `The query exceeds the maximum complexity of ${max}. ` +
    `Actual complexity is ${actual}`
  );
}

export type ComplexityPostCheck = (complexity: PublicComplexity) => void;

export function getComplexity(options: {
  estimators: ComplexityEstimator[];
  schema: GraphQLSchema;
  query: DocumentNode;
  variables?: Record<string, any>;
  operationName?: string;
  postChecks?: ComplexityPostCheck[];
}): PublicComplexity {
  const typeInfo = new TypeInfo(options.schema);

  const errors: GraphQLError[] = [];
  const context = new ValidationContext(
    options.schema,
    options.query,
    typeInfo,
    (error) => errors.push(error)
  );
  const visitor = new QueryComplexity(context, {
    // Maximum complexity does not matter since we're only interested in the calculated complexity.
    maximumComplexity: Infinity,
    estimators: options.estimators,
    variables: options.variables,
    operationName: options.operationName,
  });

  visit(options.query, visitWithTypeInfo(typeInfo, visitor));

  for (const postCheck of options?.postChecks || []) {
    postCheck(visitor.complexity);
  }

  // Throw first error if any
  if (errors.length) {
    throw errors.pop();
  }

  return visitor.complexity;
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
      case "include": {
        const values = getDirectiveValues(
          includeDirectiveDef,
          childNode,
          variableValues || {}
        );
        const ifClause = values?.if;
        includeNode = isBoolean(ifClause) ? ifClause : true;
        break;
      }
      case "skip": {
        const values = getDirectiveValues(
          skipDirectiveDef,
          childNode,
          variableValues || {}
        );
        const ifClause = values?.if;
        skipNode = isBoolean(ifClause) ? ifClause : false;
        break;
      }
    }
  }

  return includeNode && !skipNode;
};

export type GetNodeComplexity = (
  node:
    | FieldNode
    | FragmentDefinitionNode
    | InlineFragmentNode
    | OperationDefinitionNode,
  typeDef: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType,
  validationContext: ValidationContext,
  includeDirectiveDef: GraphQLDirective,
  skipDirectiveDef: GraphQLDirective,
  variableValues: Record<string, any>,
  estimators: Array<ComplexityEstimator>,
  schema: GraphQLSchema
) => ComplexityNode[] | null;

const getChilds: GetNodeComplexity = (
  node,
  typeDef,
  validationContext,
  includeDirectiveDef,
  skipDirectiveDef,
  variableValues,
  estimators,
  schema
) => {
  let fields: GraphQLFieldMap<any, any> = {};
  if (
    typeDef instanceof GraphQLObjectType ||
    typeDef instanceof GraphQLInterfaceType
  ) {
    fields = typeDef.getFields();
  }

  if (!node.selectionSet) {
    throw new Error(
      "No selectionSet, probably not real error and this throw should be removed"
    );
  }

  const children = node.selectionSet.selections.map(
    (childNode: FieldNode | FragmentSpreadNode | InlineFragmentNode) => {
      if (
        !includeNode(
          childNode,
          includeDirectiveDef,
          skipDirectiveDef,
          variableValues
        )
      ) {
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
            estimators,
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
            estimators,
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
            estimators,
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
};

class QueryComplexity {
  context: ValidationContext;
  complexity: PublicComplexity;
  options: QueryComplexityOptions;
  OperationDefinition: Record<string, any>;
  estimators: Array<ComplexityEstimator>;
  includeDirectiveDef: GraphQLDirective;
  skipDirectiveDef: GraphQLDirective;
  variableValues: Record<string, any>;

  constructor(context: ValidationContext, options: QueryComplexityOptions) {
    if (
      !(
        typeof options.maximumComplexity === "number" &&
        options.maximumComplexity > 0
      )
    ) {
      throw new Error("Maximum query complexity must be a positive number");
    }

    this.context = context;
    this.complexity = { cost: 0, tree: null };
    this.options = options;

    this.includeDirectiveDef = this.context
      .getSchema()
      .getDirective("include")!;
    this.skipDirectiveDef = this.context.getSchema().getDirective("skip")!;
    this.estimators = options.estimators;
    this.variableValues = {};

    this.OperationDefinition = {
      enter: this.onOperationDefinitionEnter,
      leave: this.onOperationDefinitionLeave,
    };
  }

  onOperationDefinitionEnter(operation: OperationDefinitionNode): void {
    if (
      typeof this.options.operationName === "string" &&
      this.options.operationName !== operation.name?.value
    ) {
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
      case "query":
        // this.complexity += this.nodeComplexity(operation, this.context.getSchema().getQueryType()!);
        const x = getChilds(
          operation,
          this.context.getSchema().getQueryType()!,
          this.context,
          this.includeDirectiveDef,
          this.skipDirectiveDef,
          this.variableValues,
          this.estimators,
          this.context.getSchema()
        );

        if (!x) {
          throw new Error("x is null");
        }

        if (x.length !== 1) {
          throw new Error("x.length !== 1");
        }

        this.complexity = {
          cost: x[0].cost || 0,
          extra: x[0].extra,
          //cost: (x[0].cost || 0) * (x[0].multiplier || 1),
          tree: x[0],
        };
        break;
      case "mutation":
        // TODO: Add
        // this.complexity += this.nodeComplexity(operation, this.context.getSchema().getMutationType()!);
        break;
      case "subscription":
        // TODO: Add
        // this.complexity += this.nodeComplexity(operation, this.context.getSchema().getSubscriptionType()!);
        break;
      default:
        throw new Error(
          `Query complexity could not be calculated for operation of type ${operation.operation}`
        );
    }
  }

  onOperationDefinitionLeave(operation: OperationDefinitionNode): void {
    if (
      typeof this.options.operationName === "string" &&
      this.options.operationName !== operation.name?.value
    ) {
      return;
    }

    if (this.options.onComplete) {
      this.options.onComplete(this.complexity.cost);
    }

    if (this.complexity.cost > this.options.maximumComplexity) {
      this.context.reportError(this.createError());
    }
  }

  createError(): GraphQLError {
    if (typeof this.options.createError === "function") {
      return this.options.createError(
        this.options.maximumComplexity,
        this.complexity.cost
      );
    }
    return new GraphQLError(
      queryComplexityMessage(
        this.options.maximumComplexity,
        this.complexity.cost
      )
    );
  }
}
