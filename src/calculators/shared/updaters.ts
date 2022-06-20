import { Extra } from '../..';
import { ComplexityCalculatorAccumulator } from '../../commonTypes';
import { mergeExtra } from '../../mergeExtra';

export const updateExtra = (extra: Extra, accumulator: ComplexityCalculatorAccumulator) => {
  if (accumulator.extra) {
    accumulator.extra = mergeExtra('max', extra, accumulator.extra);
  } else {
    accumulator.extra = extra;
  }
};

export const updateCost = (cost: number, accumulator: ComplexityCalculatorAccumulator) => {
  if (!isNaN(cost)) {
    accumulator.cost = accumulator.cost + cost;
  }
};

export const updateMultiplier = (multiplier: number | null, accumulator: ComplexityCalculatorAccumulator) => {
  if (multiplier) {
    if (accumulator.multiplier) {
      if (multiplier > accumulator.multiplier) {
        accumulator.multiplier = multiplier;
      }
    } else {
      accumulator.multiplier = multiplier;
    }
  }
};
