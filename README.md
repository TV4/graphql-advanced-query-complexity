# @tv4/graphql-advanced-query-complexity

When you need to make rules about how your GraphQL server is allowed to be queried.

Main features:

- Limit the amount of times an field or an object may be queried
- Calculate complexity based on cost of individual fields or types
- Take lists into account so that a list of 2 items are calculated twice.
- Extendable with your own calculators

Although this package does everything [graphql-query-complexity](https://www.npmjs.com/package/graphql-query-complexity) does, and more, for simpler needs, have a look at that one.

## Example schema with directives

```gql
type Query {
  exampleQuery(amount: Int!): [Obj] @complexity(multiplier: "amount", cost: 10, maxTimes: 1)
}

type Obj @objComplexity(maxTimes: 10) {
  string: String @complexity(cost: 7)
}
```

Here's an example schema with directives. Let's break it down:

First the `exampleQuery` field:

- `@complexity(multiplier: "amount")`. The `exampleQuery` returns a _list_, the more items it's returning, the more complex will the query be. The `multiplier` directive value is your way of telling the calculators how many items that will (at most) be returned. You most probably want to specify the multiplier on _all_ your lists.
- `@complexity(cost: 10)`. When you call this field, a cost of 10 will be added to the total cost. This does not take children or the multiplier into account but is the cost for _this_ specicific field.
- `@complexity(maxTimes: 1)`. The maximum amount of times this field may be queried in a single query.

the `Obj` type:

- `@objComplexity(maxTimes: 10)` Notice that this directive is on the _type_! At most this type may be queried for 10 times, no matter _where_ it is used. So in our example, if you were to do query this schema with `exampleQuery(amount: 11)` it would be an error.
- `@complexity(cost: 7)`. Same as the complexity on exampleQuery.

Querying this example schema with the query:

```gql
query {
  test(amount: 11) {
    string
  }
}
```

would return:

- Information about that the maxTimes of `Obj` is passed. It's only allowed 10 times but you're querying for it 11 times.
- Information about the cost which is:
  - `string` requested 11 times at the cost of 7 per time = 77.
  - `exampleQuery` having a cost of 10.
  - Total cost of 77 + 10 = 87

## Installation

```bash
npm install @tv4/graphql-advanced-query-complexity
```

## Example usage

This example uses Apollo Server, but that is no requirement. Works with every Graph server that have some kind of lifecycle hook you can hook in to.

### Create Apollo Server plugin

Create a new Apollo Server plugin with this code

```ts
import { 
  getComplexity,
  fieldCalculator,
  objectCalculator,
  maxCallErrorCheck,
  createMaxCostErrorCheck
} from '@tv4/graphql-advanced-query-complexity';

export const objectDirective = createObjectDirective();
export const fieldDirective = createFieldDirective();

const calculators = [
  objectCalculator({ directive: objectDirective }),
  fieldCalculator({ directive: fieldDirective }),
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
        errorChecks: [
          maxCallErrorCheck,
          createMaxCostErrorCheck({ maxCost: 6 })
        ],
        onValidationError: (_error) => {},
        
        
                // TODO FIX THESE
        variables?: Record<string, any>;
        operationName?: string;
      });

      console.log(
        require('util').inspect(complexity, { showHidden: true, depth: null, colors: true, breakLength: 200 })
      );

      return Promise.resolve();
    },
  }),
};
```

Add the plugin to the list of Apollo Server plugins.

```ts
export const server = new ApolloServer({
  plugins: [queryComplexityPlugin],
});
```

### Add the directives to your schema.

- If you create your schema with code, you want to use the directives (`objectDirective` and `fieldDirective`) created and exported in your plugins file, as is.
- If you create your schema with SDL (typically `.gql` files or the `gql` tag in Javascript/Typescript), you must first convert it to SDL

This example shows the SDL way. In your schema index file, add the two directives

```ts
import { objectDirective, fieldDirective } from './your/plugin/file.ts';

const objectDirectiveSDL = createSDLFromDirective(objectDirective);
const fieldDirectiveSDL = createSDLFromDirective(fieldDirective);

export const schema = makeExecutableSchema({
  typeDefs: [objectDirectiveSDL, fieldDirectiveSDL, otherPartsOfYourSchema],
});
```

### Use the directives

In your schema, add the directives to a field. Here we create the new query `complexityExample` and give it a few directives (explained later)

```gql
type Query {
  complexityExample(amount: Int = 5): [Obj] @complexity(multiplier: "amount")
}

type Obj @objComplexity(maxTimes: 3) {
  string: String @complexity(cost: 7)
}
```

### Query the Graph server

Start your Graph server and query it with

```gql
query {
  test(amount: 4) {
    string
  }
}
```

### Inspect the results

As we added a `console.log` statement to our Apollo server plugin this is now printed to the console:

```json
{
  "cost": 28,
  "extra": {
    "maxCalls": {
      "type-Obj": {
        "maxTimes": 3,
        "mergeValue": 4
      }
    }
  }
}
```

### Act on the results.

By default
