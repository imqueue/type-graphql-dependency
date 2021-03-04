# @imqueue/type-graphql-dependency

[![Build Status](https://travis-ci.com/type-graphql-dependency/type-graphql-dependency.svg?branch=master)](https://travis-ci.com/imqueue/type-graphql-dependency)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](https://rawgit.com/imqueue/type-graphql-dependency/master/LICENSE)

Adoption of @imqueue/graphql-dependency for use with type-graphql.

# Install

~~~bash
npm i --save @imqueue/type-graphql-dependency
~~~

# Usage

This module allows describing cross-service dependencies and fetch user 
requested data in an optimal manner in a schemas defined using type-graphql
library.

Example:

~~~typescript
import {
    Dependency,
    DependencyFor,
    schemaHooks,
} from '@imqueue/type-graphql-dependency';
import {  Ctx, Info } from 'type-graphql';
import { fieldsMap } from 'graphql-fields-list';

@DependencyFor<Partial<Consumer>>({
   // this defines dependency relations for Consumer object.
   // refers to: @imqueue/graphql-dependency:Dependency.require()
   require: [
       [() => ApiKey, [
           { as: 'apiKeys', filter: { 'consumerId': 'id' } }],
       ],
   ],
   // this defines initializer for Consumer, all dependencies will wait
   // for initializer to finish before load
   // refers to: @imqueue/graphql-dependency:Dependency.defineInitializer()
   async init(
       context: Context,
       result: Partial<Consumer>,
       fields?: FieldsInput,
   ): Promise<DataInitializerResult> {
       // ... do initializer stuff here ...
       return result;
   },
   // this defines loader for Consumer entity, which should be used by
   // other entities, which depend on Consumer
   // refers to: @imqueue/graphql-dependency:Dependency.defineLoader()
   async load(
       context: Context,
       filter: ConsumerListInput,
       fields?: FieldsInput,
   ): Promise<Partial<Consumer>[]> {
       const { data } = await context.consumer.listConsumer(filter, fields);
       return toConsumers(data);
   },
})
@ObjectType()
export class Consumer {
    // ... Consumer fields definitions goes here ...
}

// now within a resolver:
async function consumerResolver(
    @Ctx() context: Context,
    @Info() info: GraphQLResolveInfo,
) {
    // load consumer data from some service or database
    const data = await loadConsumers(/* ... */);
    // fill dependent data into loaded data
    await Dependency(Consumer).load(data, context, fieldsMap(info));
    return data;
}

// Now where schema is created using type-graphql:
const schema = await buildSchema({
    // your schema options due to type-graphql docs
});
// and
(schemaHooks || []).forEach(handle => handle && handle(schema));
// so now all deps initialized within schema
~~~

# License

[ISC](https://github.com/imqueue/type-graphql-dependency/blob/master/LICENSE)
