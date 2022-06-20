import { ChildComplexity, getChildComplexity } from './getChildComplexity';
import { mergeExtra } from './mergeExtra';
import { ComplexityCalculator, ComplexityCalculatorArgs, ComplexityNode, Extra } from '.';
import { nonNullable } from './utils';
import { ComplexityCalculatorAccumulator } from './commonTypes';

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
  const accumulator: ComplexityCalculatorAccumulator = {
    cost: 0,
    multiplier: null,
    extra: {},
  };

  for (const calculator of calculators) {
    calculator(calculatorArgs, accumulator);
  }

  const childComplexity = getChildComplexity(children);

  const cost = accumulator.cost + childComplexity.childComplexity * (accumulator.multiplier || 1);

  const allExtras = [accumulator.extra, childComplexity.extra].filter(nonNullable);
  const multipliedExtras = [...Array(accumulator.multiplier || 1)].map((_) => allExtras).flat();
  const extra = mergeExtra('sum', ...multipliedExtras);

  return { thisCost: accumulator.cost, multiplier: accumulator.multiplier, cost, extra, childComplexity };
};
