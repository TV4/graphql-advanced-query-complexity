# @tv4/graphql-advanced-query-complexity

When you need to make rules about how your GraphQL server is allowed to be queried.

Main features:

* Limit the amount of times an field or an object may be queried
* Calculate complexity based on cost of individual fields or types
* Take lists into account so that a list of 2 items are calculated twice.
* Extendable with your own calculators

Although this package does everything [graphql-query-complexity](https://www.npmjs.com/package/graphql-query-complexity) does, and more, for simpler needs, have a look at that one.

## Installation

```bash
npm install @tv4/graphql-advanced-query-complexity
```

## Example usage

This example uses Apollo Server, but that is no requirement. 

### Create Apollo Server plugin
Create a new Apollo Server plugin with this code

```ts
import { getComplexity } from '@tv4/graphql-advanced-query-complexity';
import {
  fieldDirectiveCalculator,
  objectDirectiveCalculator,
} from '@tv4/graphql-advanced-query-complexity/dist/calculators';

export const complexityObjectDirective = createComplexityObjectDirective();
export const complexityFieldDirective = createComplexityFieldDirective();

const calculators = [
  objectDirectiveCalculator({ directive: complexityObjectDirective }),
  fieldDirectiveCalculator({ directive: complexityFieldDirective }),
];

const queryComplexityPlugin: ApolloServerPlugin<Context> = {
  requestDidStart: async () => ({
    didResolveOperation({ request }) {
      if (!request.query) {
        return Promise.resolve();
      }

      const complexity = getComplexity({
        calculators,
        schema,
        query: parse(request.query),
      });

      console.log(
        require('util').inspect(complexity, 
          { showHidden: true, 
            depth: null, 
            colors: true, 
            breakLength: 200 
          }
        )
      );

      return Promise.resolve();
    },
  }),
};

```

Add the plugin to the list of Apollo Server plugins.


```ts
export const server = new ApolloServer({
  plugins: [queryComplexityPlugin]
});
```


### Add the directives to your schema. 

* If you create your schema with code, you want to use the directives (`complexityObjectDirective` and `complexityFieldDirective`) created and exported in your plugins file, as is.
* If you create your schema with SDL (typically `.gql` files or the `gql` tag in Javascript/Typescript), you must first convert it to SDL

This example shows the SDL way. In your schema index file, add the two directives


```ts
import { complexityObjectDirective, complexityFieldDirective } from './your/plugin/file.ts'

const complexityObjectDirectiveSDL = createSDLFromDirective(complexityObjectDirective);
const complexityFieldDirectiveSDL = createSDLFromDirective(complexityFieldDirective);

export const schema = makeExecutableSchema({
  typeDefs: [
    complexityObjectDirectiveSDL,
    complexityFieldDirectiveSDL,
    otherPartsOfYourSchema
  ],
});
```

### Use the directives

In your schema, add the directives to a field. Here we create the new query `complexityExample` and give it a few directives (explained later)

```gql
type Query {
  complexityExample(amount: Int = 5): [Obj] @complexity(multiplier: "amount", maxTimes: 3, cost: 10)
}

type Obj {
  string: String @complexity(cost: 7)
}
```

```json
{
  "cost": 28,
  "extra": {
    "maxCalls": {
      "field-test": {
        "maxTimes": 3,
        "mergeValue": 4
      }
    }
  }
}

```