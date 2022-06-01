import { ComplexityEstimator, ComplexityEstimatorArgs } from '..';

export default function (options?: { defaultComplexity?: number }): ComplexityEstimator {
  const defaultComplexity = options && typeof options.defaultComplexity === 'number' ? options.defaultComplexity : 1;
  return (args) => {
    return { cost: defaultComplexity, multiplier: null };
  };
}
