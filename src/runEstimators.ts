import { ChildComplexity, getChildComplexity } from './getChildComplexity';
import { mergeExtra } from './mergeExtra';
import { ComplexityEstimator, ComplexityEstimatorArgs, ComplexityNode, Extra } from '.';
import { nonNullable } from './utils';

export const runEstimators = ({
  estimators,
  estimatorArgs,
  children,
}: {
  estimators: ComplexityEstimator[];
  estimatorArgs: ComplexityEstimatorArgs;
  children: ComplexityNode[] | null;
}): {
  thisCost: number;
  multiplier: number | null;
  cost: number;
  extra: Extra;
  childComplexity: ChildComplexity;
} => {
  let thisCost = 0;
  let multiplier: number | null = null;
  let thisExtra: Extra | undefined = undefined;

  for (const estimator of estimators) {
    const estimatorValues = estimator(estimatorArgs);

    if (!estimatorValues) {
      continue;
    }

    if ('extra' in estimatorValues) {
      if (thisExtra) {
        thisExtra = mergeExtra('max', estimatorValues.extra, thisExtra);
      } else {
        thisExtra = estimatorValues.extra;
      }
    }

    /**
     * Multiplier is set to the highest of all values if more are given
     */
    if (
      'multiplier' in estimatorValues &&
      estimatorValues.multiplier !== null &&
      (multiplier === null || estimatorValues.multiplier > multiplier)
    ) {
      multiplier = estimatorValues.multiplier;
    }

    if ('cost' in estimatorValues && typeof estimatorValues.cost === 'number' && !isNaN(estimatorValues.cost)) {
      thisCost = thisCost + estimatorValues.cost;
    }
  }

  const childComplexity = getChildComplexity(children);

  const cost = thisCost + childComplexity.childComplexity * (multiplier || 1);

  const allExtras = [thisExtra, childComplexity.extra].filter(nonNullable);
  const multipliedExtras = [...Array(multiplier || 1)].map((_) => allExtras).flat();
  const extra = mergeExtra('sum', ...multipliedExtras);

  return { thisCost, multiplier, cost, extra, childComplexity };
};
