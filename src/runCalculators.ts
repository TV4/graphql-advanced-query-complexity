import { ComplexityCalculator, ComplexityCalculatorArgs, ComplexityNode, Extra, ExtraMerger } from '.';
import { ComplexityCalculatorAccumulator } from './commonTypes';
import { ChildComplexity, getChildComplexity } from './getChildComplexity';
import { mergeExtraDefault } from './mergers/mergeExtraDefault';

export const runCalculators = ({
  calculators,
  calculatorArgs,
  extraMerger,
  children,
}: {
  calculators: ComplexityCalculator[];
  calculatorArgs: ComplexityCalculatorArgs;
  extraMerger?: ExtraMerger;
  children: ComplexityNode[] | null;
}): {
  thisCost: number;
  multiplier: number | null;
  cost: number;
  extra: Extra;
  childComplexity: ChildComplexity;
} => {
  const childComplexity = getChildComplexity(children);

  const accumulator: ComplexityCalculatorAccumulator = {
    cost: 0,
    multiplier: null,
    extra: {},
  };

  for (const calculator of calculators) {
    calculator(calculatorArgs, accumulator, childComplexity);
  }

  const cost = accumulator.cost + childComplexity.childComplexity * (accumulator.multiplier || 1);
  const negotiatedExtraMerger = extraMerger || mergeExtraDefault;
  const extra = negotiatedExtraMerger(calculatorArgs, accumulator, childComplexity);

  return { thisCost: accumulator.cost, multiplier: accumulator.multiplier, cost, extra, childComplexity };
};
