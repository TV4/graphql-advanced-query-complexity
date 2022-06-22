import { ExtraMerger } from '..';
import { mergeExtra } from '../mergeExtra';
import { nonNullable } from '../utils';

export const mergeExtraDefault: ExtraMerger = (_options, accumulator, childComplexity) => {
  const allExtras = [accumulator.extra, childComplexity.extra].filter(nonNullable);
  const multipliedExtras = [...Array(accumulator.multiplier || 1)].map((_) => allExtras).flat();
  const extra = mergeExtra('sum', ...multipliedExtras);
  return extra;
};
