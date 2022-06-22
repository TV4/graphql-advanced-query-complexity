import { mergeExtraDefault } from './mergers/mergeExtraDefault';
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

import { ComplexityCalculatorAccumulator, GetNodeComplexity } from './commonTypes';
import { createFieldDirective } from './directives/fieldDirective';
import { createObjectDirective } from './directives/objectDirective';
import { maxCallPostCalculation } from './postCalculation/maxCallPostCalculation';
import { handleField } from './handleField';
import { handleFragmentSpread } from './handleFragmentSpread';
import { handleInlineFragment } from './handleInlineFragment';
import { createSDLFromDirective, isBoolean, nonNullable } from './utils';
import { mergeExtra } from './mergeExtra';
import { createServicesPostCalculation } from './postCalculation/servicesPostCalculation';
import { createMaxCostPostCalculation } from './postCalculation/maxCostPostCalculation';
import { createSingleCallServicesDirective } from './directives/singleCallServicesDirective';
import { ChildComplexity } from './getChildComplexity';

export {
  fieldCalculator,
  objectCalculator,
  createSDLFromDirective,
  createObjectDirective,
  createFieldDirective,
  createSingleCallServicesDirective,
  maxCallPostCalculation,
  createMaxCostPostCalculation,
  createServicesPostCalculation,
  mergeExtraDefault,
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
  options: ComplexityCalculatorArgs,
  accumulator: ComplexityCalculatorAccumulator,
  childComplexity: ChildComplexity
) => void;

export type ExtraMerger = (
  options: ComplexityCalculatorArgs,
  accumulator: ComplexityCalculatorAccumulator,
  childComplexity: ChildComplexity
) => Extra;

export interface QueryComplexityOptions {
  variables?: Record<string, any>;
  calculators: Array<ComplexityCalculator>;
  extraMerger?: ExtraMerger;
}

export type PostCalculation = (complexity: ComplexityCollector) => void;

export type ComplexityOptions = {
  calculators: ComplexityCalculator[];
  extraMerger?: ExtraMerger;
  schema: GraphQLSchema;
  query: DocumentNode;
  variables?: Record<string, any>;
  postCalculations?: PostCalculation[];
  onParseError?: (error: unknown, errors: GraphQLError[]) => void;
};

export function getComplexity(options: ComplexityOptions): Complexity {
  const errors: GraphQLError[] = [];

  try {
    const typeInfo = new TypeInfo(options.schema);
    const context = new ValidationContext(options.schema, options.query, typeInfo, (error) => errors.push(error));
    const visitor = new QueryComplexity(context, {
      calculators: options.calculators,
      extraMerger: options.extraMerger,
      variables: options.variables,
    });

    visit(options.query, visitWithTypeInfo(typeInfo, visitor));

    for (const postCalculation of options?.postCalculations || []) {
      postCalculation(visitor.complexity);
    }

    for (const complexityErrors of visitor.complexity.errors || []) {
      errors.push(complexityErrors);
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
      extra: {},
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
  extraMerger,
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
        typeDef,
        validationContext,
        variableValues,
        fields,
        includeDirectiveDef,
        skipDirectiveDef,
        getNodeComplexity: getChilds,
        calculators,
        extraMerger,
        schema,
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
  extra: Extra;
  errors: GraphQLError[];
  getTree: () => ComplexityNode[] | null;
};

export type ComplexityCollector = {
  cost: number;
  tree: ComplexityNode[] | null;
  extra: Extra;
  errors: GraphQLError[];
};

class QueryComplexity {
  context: ValidationContext;
  complexity: ComplexityCollector;
  options: QueryComplexityOptions;
  OperationDefinition: Record<string, any>;
  calculators: Array<ComplexityCalculator>;
  extraMerger?: ExtraMerger;
  includeDirectiveDef?: GraphQLDirective;
  skipDirectiveDef?: GraphQLDirective;
  variableValues: Record<string, any>;

  constructor(context: ValidationContext, options: QueryComplexityOptions) {
    this.context = context;
    this.complexity = { cost: 0, tree: null, extra: {}, errors: [] };
    this.options = options;
    this.calculators = options.calculators;
    this.extraMerger = options.extraMerger;
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
          extraMerger: this.extraMerger,
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

        const allExtra = [this.complexity.extra, complexityNode[0].extra].filter(nonNullable);

        this.complexity = {
          cost: this.complexity.cost + complexityNode[0].cost || 0,
          extra: allExtra.length ? mergeExtra('sum', ...allExtra) : {},
          tree: (this.complexity.tree || []).concat(complexityNode[0]),
          errors: [],
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
