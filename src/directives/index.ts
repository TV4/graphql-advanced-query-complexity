import { astFromDirective } from '@graphql-tools/utils';
import { GraphQLDirective, print } from 'graphql';
import { createComplexityFieldDirective } from './complexityFieldDirective';
import { createComplexityObjectDirective } from './complexityObjectDirective';

export { createComplexityFieldDirective, createComplexityObjectDirective };

export const createSDLFromDirective = (directive: GraphQLDirective) => print(astFromDirective(directive));
