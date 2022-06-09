# graphql-advanced-query-complexity

When you need to make rules about how your GraphQL server is allowed to be queried.

Main features:

- Limit the amount of times an field or an object may be queried
- Calculate complexity based on cost of individual fields or types
- Take lists into account so that a list of 2 items are calculated twice.
- Extendable with your own calculators

Although this package does everything [graphql-query-complexity](https://www.npmjs.com/package/graphql-query-complexity) does, and more. For simpler needs, have a look at that one.
