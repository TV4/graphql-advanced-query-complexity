import { deepmergeCustom } from 'deepmerge-ts';
import { Extra } from './queryComplexity';

const areAllNumbers = (values: ReadonlyArray<unknown>): values is ReadonlyArray<number> =>
  values.every((value) => typeof value === 'number');

const customMerge = (valueMergeStrategy: ValueMergeStrategy) =>
  deepmergeCustom({
    mergeOthers: (values, utils, meta) => {
      if (meta !== undefined && areAllNumbers(values)) {
        const numbers: ReadonlyArray<number> = values;
        const { key } = meta;

        if (key === 'mergeValue') {
          // TODO, rename mergeValue to 'value'
          if (valueMergeStrategy === 'sum') {
            return numbers.reduce((sum, value) => sum + value);
          }

          if (valueMergeStrategy === 'max') {
            return Math.max(...numbers);
          }
        }
      }

      return utils.defaultMergeFunctions.mergeOthers(values);
    },
  });

type ValueMergeStrategy = 'max' | 'sum';

export const mergeExtra = (valueMergeStrategy: ValueMergeStrategy, ...extras: Extra[]) => {
  if (!extras.length) {
    return {};
  }

  if (extras.length === 1) {
    return extras[0];
  }

  return customMerge(valueMergeStrategy)(...extras) as Extra[];
};
