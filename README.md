# @tv4/graphql-advanced-query-complexity

When you need to make rules about how your GraphQL server is allowed to be queried.

Main features:

- Objects can be annotated (e.g. with a cost), not just fields.
- Limit the amount of times an field or an object may be queried
- Support data loaded/cached/batched data. "Service" based calculation. If multiple services are called (in completely different places of the query tree) handle it as a single call to the service.
- Calculate complexity based on cost of individual fields or types
- Take lists into account so that a list of 2 items are calculated twice.
- Extendable with your own calculators

Although this package does everything [graphql-query-complexity](https://www.npmjs.com/package/graphql-query-complexity) does, and more, for simpler needs, have a look at that one.

## Simple example

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

## Service based example

Imagine this query:

```gql
query {
  panel {
    listOfMovies(limit: 4) {
      title
      playback
    }
  }
}
```

and this schema:

```gql
type Query {
  panel: Panel
}

type Panel {
  listOfMovies(limit: Int!): [Movie] @complexity(multiplier: "limit")
}

type Movie @objComplexity(services: ["watched", "mylist"]) {
  title: String
  playback: String @complexity(services: ["playback"])
}
```

the `Movie` type is annotated with the services `watched` and `mylist`. The `playback` field is annotated with the service `playback`. This can be read as "When a Movie is resolved, it's going to use the services `watched` and `mylist`".

When running the complexity calculator, you can supply data about what these different services means in terms of complexity:

```ts
const complexity = getComplexity({
  postCalculations: [
    createServicesPostCalculation({
      watched: {
        calledOnce: true,
        cost: 70,
      },
      mylist: {
        cost: 10,
      },
      playback: {
        maxTimes: 1,
      },
    }),
  ],
});
```

- `calledOnce` means that no matter how many times this service is called, it's going to count as 1 call. E.g. this is a batched call or something that you cache and use throughout the resolvemenet.
- `cost` every time you call this, this cost is going to be added to the final tally. If `calledOnce` is set to true, then the cost is only going to get inflicted once.
- `maxTimes` how many times this service may be called in a single query. Use e.g. for fields and types that are only supposed to be called once, and not in a list of items. In this example, the `playback` field is only supposed to be run on-demand for a single movie when the user wants to start a movie, and not as part of the listing of the movies.

## Advanced service based (cached/data loaded) example

Imagine that we have a query that resolves a list of movies and on each movie you can query for `duration` and `spokenLangauges` but to be able to resolve that you need to figure out what media files the user has access to. To get some performance into this, we cache the results, so that it doesn't matter if the user queries for only `duration` or `spokenLanguages` or if they query for both.

Example schema

```gql
type Query {
  panel: Panel
}

type Panel {
  movies(limit: Int): [Movie] @complexity(multiplier: "limit")
}

type Movie @singleCallServicesComplexity(services: ["mediaCalculator"]) {
  title: String
  duration: Int @complexity(services: ["mediaCalculator"])
  spokenLanguages: String @complexity(services: ["mediaCalculator"])
}
```

and query:

```gql
query {
  panel {
    movies(limit: 6) {
      title
      duration
      spokenLanguages
    }
  }
}
```

and calling function:

```ts
const complexity = getComplexity({
  schema,
  query,
  calculators: [
    objectCalculator({ directive: createObjectDirective() }),
    fieldCalculator({ directive: createFieldDirective() }),
    singleCallServicesObjectCalculator({ directive: createSingleCallServicesDirective() }),
  ],
  postCalculations: [
    createServicesPostCalculation({
      mediaCalculator: {
        cost: 100,
      },
    }),
  ],
});
```

In this example above we're queyring for `panel.movies` which is a list that we want 6 `Movie`'s from. On each movie we're asking for `duration` and `spokenLanguages` which both are annotated with `@complexity(services: ["mediaCalculator"])`. This means that we're using the `mediaCalculator` service 12 (6 x 2) times. As each call to the service comes with a cost of `100`, the final cost for this query is `1200`

However! The `Movie` type is annotated with `@singleCallServicesComplexity(services: ["mediaCalculator"])` which can be read as "Treat multiple calls to the `mediaCalculator` of any of my fields, or child fields as a single call". This means that it's only called 6 x 1 times and the final cost for the query is therefor `600`.

The `@singleCallServicesComplexity` directive may be added on both an object and a field.

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
  singleCallServicesObjectCalculator,
  maxCallPostCalculation,
  createMaxCostPostCalculation,
  createObjectDirective,
  createFieldDirective,
  createSingleCallServicesDirective,
} from '@tv4/graphql-advanced-query-complexity';

export const objectDirective = createObjectDirective();
export const fieldDirective = createFieldDirective();
export const singleCallDirective = createSingleCallServicesDirective();

const calculators = [
  objectCalculator({ directive: objectDirective }),
  fieldCalculator({ directive: fieldDirective }),
  singleCallServicesObjectCalculator({ directive: singleCallDirective }),
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
        variables: request.variables,
        postCalculations: [
          maxCallPostCalculation,
          createMaxCostPostCalculation({ maxCost: 6 }),
          // createServicesPostCalculation({
          //   myService: {
          //     cost: 100,
          //   },
          // }),
        ],
        // onParseError: (_error) => {},
      });

      console.log(complexity);

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

This example shows the SDL way. In your schema index file, add the directives

```ts
import { objectDirective, fieldDirective, singleCallDirective } from './your/plugin/file.ts';

const objectDirectiveSDL = createSDLFromDirective(objectDirective);
const fieldDirectiveSDL = createSDLFromDirective(fieldDirective);
const singleCallDirectiveSDL = createSDLFromDirective(singleCallDirective);

export const schema = makeExecutableSchema({
  typeDefs: [objectDirectiveSDL, fieldDirectiveSDL, singleCallDirective, otherPartsOfYourSchema],
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
  "extra": { "maxTimes": { "type-Obj": { "max": 3, "value": 4 } } },
  "errors": [
    "GraphQLError: type Obj may only be queried 3 times. Was queried 4 times",
    "GraphQLError: Query is to complex. This query cost is 28 and max cost is 5."
  ]
}
```

The errors are instances of `GraphQLError`.

### Act on the results.

`@tv4/graphql-advanced-query-complexity` does not do anything with the results. It's up to you to act on them. E.g. you might want to log the `cost` or `errors` to a tracing tool. Or probably throw any errors in the `errors` array, and that way block execution of the query.

## Usage

This package exports a few default directives and calculators. You're also free to write your own.

### Directives

The directives take an optional name, which is what you will use it in your schema file.

```ts
createFieldDirective({ name: 'complexity' });
createObjectDirective({ name: 'objComplexity' });
createSingleCallServicesDirective({ name: 'singleCallServicesComplexity' });
```

```gql
type Obj @objComplexity(maxTimes: 10) @singleCallServicesComplexity(services: ["myService", "anotherService"]) {}
type Query {
  field: String @complexity(maxTimes: 10) @singleCallServicesComplexity(services: ["myService"])
}
```

### Calculators

The default calculators take the corresponding directive as parameters.

```ts
objectCalculator({ directive: createObjectDirective() });
fieldCalculator({ directive: createFieldDirective() });
singleCallServicesObjectCalculator({ directive: createSingleCallServicesDirective() }),
```

## `getComplexity`

### Parameters

```ts
type ComplexityOptions = {
  calculators: ComplexityCalculator[];
  schema: GraphQLSchema;
  query: DocumentNode;
  variables?: Record<string, any>;
  onParseError?: (error: unknown, errors: GraphQLError[]) => void;
};
```

#### `variables`

Incoming query variables, in Apollo Server, set to

```ts
variables: request.variables;
```

#### `postCalculations`

By default, the `graphql-advanced-query-complexity` does not _do_ anything with the results. It simply calculates all values. You may however provide a "post calculation" which will check the results and possibly write one or many errors to the `errors` field of the output. A post calculation may modify any part of the calculated complexity.

Some default post calculators are provided.

- `createServicesPostCalculation` adds costs to _services_ if you use service based costs.
- `maxCallPostCalculation` will create errors if `maxTimes` is passed,
- `createMaxCostPostCalculation` will create an error if the cost of the query is over your limit.

```ts
postCalculations: [
  createServicesPostCalculation({
    myService: {
      cost: 100,
    },
  }),
  maxCallPostCalculation,
  createMaxCostPostCalculation({ maxCost: 6 }),
];
```

#### `onParseError`

```
onParseError?: (error: unknown, errors: GraphQLError[]) => void;
```

It may happen that no complexity can be calculated, most probably because of some error in the query. If you want to act on this, then `onParseError` may be used. The current error is passed as `error` and the errors collection as `errors`. You may push to this array inside your `onParseError` handler.

### Output

The output from `getComplexity` looks like this.

```ts
type Complexity = {
  cost: number;
  extra?: Record<string, any>;
  errors?: GraphQLError[];
  getTree: () => ComplexityNode | null;
};
```

- `cost` is the complete cost of the query

- `extra` is an arbitrary record your calculators may write to for individual nodes. This record is merged (and values are summed/maxed) to give a final record. Example using the built in calculators for "maxTimes":

  ```json
  {
    "extra": {
      "maxTimes": {
        "type-Obj": { "max": 3, "value": 4 }
      }
    }
  }
  ```

- `errors` is a list of errors that your `errorChecks` have created. Typically you'll want to throw these (or the first) errors, and block execution of the query.
- `getTree()` can be used for development purposes to get the entire traversed tree of calculated values.
