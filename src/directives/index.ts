import { astFromDirective } from '@graphql-tools/utils';
import { GraphQLDirective, print } from 'graphql';
import { createFieldDirective } from './fieldDirective';
import { createObjectDirective } from './objectDirective';

export { createFieldDirective, createObjectDirective };

export const createSDLFromDirective = (directive: GraphQLDirective) => print(astFromDirective(directive));
