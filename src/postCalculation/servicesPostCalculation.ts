import { isNumber } from './../utils';
import { PostCalculation } from '..';
import { ComplexityServices } from '../calculators/objectCalculator';
import { GraphQLError } from 'graphql';

type ServicesPostCalculationArgs = Record<
  string,
  {
    calledOnce?: boolean;
    maxTimes?: number;
    cost?: number;
  }
>;

export const createServicesPostCalculation =
  (servicesConfig: ServicesPostCalculationArgs): PostCalculation =>
  (complexity) => {
    const servicesDataMap = complexity.extra.services as ComplexityServices;

    if (!servicesDataMap) {
      return;
    }

    for (const [serviceName, { value: serviceCalledTimes }] of Object.entries(servicesDataMap)) {
      const serviceConfig = servicesConfig[serviceName];

      if (!serviceConfig) {
        throw new Error(
          `Query complexity could not be calculated for operation. Service '${serviceName}' is missing in the createServicesPostCalculation arguments`
        );
      }

      if (serviceConfig.cost) {
        const cost = serviceConfig.calledOnce ? serviceConfig.cost : serviceConfig.cost * serviceCalledTimes;
        complexity.cost = complexity.cost + cost;
      }

      if (isNumber(serviceConfig.maxTimes) && serviceCalledTimes > serviceConfig.maxTimes) {
        const overLimitError = new GraphQLError(
          `Service ${serviceName} may only be queried ${serviceConfig.maxTimes} times. Was queried ${serviceCalledTimes} times`,
          {
            extensions: { complexity: { code: 'SERVICE_CALLED_TO_MANY_TIMES' } },
          }
        );

        complexity.errors.push(overLimitError);
      }
    }
  };
