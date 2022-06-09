import { ChildComplexity, getChildComplexity } from './getChildComplexity';
import { mergeExtra } from './mergeExtra';
import { ComplexityCalculator, ComplexityCalculatorArgs, ComplexityNode, Extra } from '.';
import { nonNullable } from './utils';

export const runCalculators = ({
  calculators,
  calculatorArgs,
  children,
}: {
  calculators: ComplexityCalculator[];
  calculatorArgs: ComplexityCalculatorArgs;
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

  for (const calculator of calculators) {
    const calculatorValues = calculator(calculatorArgs);

    if (!calculatorValues) {
      continue;
    }

    if ('extra' in calculatorValues) {
      if (thisExtra) {
        thisExtra = mergeExtra('max', calculatorValues.extra, thisExtra);
      } else {
        thisExtra = calculatorValues.extra;
      }
    }

    /**
     * Multiplier is set to the highest of all values if more are given
     */
    if (
      'multiplier' in calculatorValues &&
      calculatorValues.multiplier !== null &&
      (multiplier === null || calculatorValues.multiplier > multiplier)
    ) {
      multiplier = calculatorValues.multiplier;
    }

    if ('cost' in calculatorValues && typeof calculatorValues.cost === 'number' && !isNaN(calculatorValues.cost)) {
      thisCost = thisCost + calculatorValues.cost;
    }
  }

  const childComplexity = getChildComplexity(children);

  const cost = thisCost + childComplexity.childComplexity * (multiplier || 1);

  const allExtras = [thisExtra, childComplexity.extra].filter(nonNullable);
  const multipliedExtras = [...Array(multiplier || 1)].map((_) => allExtras).flat();
  const extra = mergeExtra('sum', ...multipliedExtras);

  return { thisCost, multiplier, cost, extra, childComplexity };
};
