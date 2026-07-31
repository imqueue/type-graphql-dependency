/*!
 * @imqueue/type-graphql-dependency - Declarative GraphQL dependency loading
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * If you want to use this code in a closed source (commercial) project, you can
 * purchase a proprietary commercial license. Please contact us at
 * <support@imqueue.com> to get commercial licensing options.
 */
/**
 * `@imqueue/graphql-dependency` for `type-graphql` — declare cross-service
 * dependencies on the decorated classes you already have, instead of on raw
 * `GraphQLObjectType` values.
 *
 * The engine underneath is `@imqueue/graphql-dependency`, and the concepts are
 * its concepts: a bulk **loader** per type, **requirements** describing which
 * types own which, and an optional **initializer** that pre-fills fields the
 * requirement filters need. What this package changes is where they are written.
 * {@link DependencyFor} is a class decorator, so a type's relations sit on the
 * class that defines it, and {@link Dependency} resolves a class back to its
 * dependency description at request time.
 *
 * @remarks
 * `type-graphql` builds its schema from decorated classes, which means the
 * `GraphQLObjectType` a class becomes does not exist while the decorators are
 * running. Every declaration is therefore deferred: {@link DependencyFor}
 * registers a hook rather than wiring anything, and the hooks run once the schema
 * is built.
 *
 * **Running them is the application's job.** Nothing here calls them. After
 * building the schema, pass it to every hook in {@link schemaHooks} — miss that
 * step and no dependency is ever registered, no error is raised, and the
 * dependency fields simply stay empty:
 *
 * ```typescript
 * const schema = await buildSchema({ resolvers: [...] });
 *
 * schemaHooks.forEach(hook => hook(schema));
 * ```
 *
 * Because the wiring is deferred, the mistakes it catches surface then rather
 * than at start-up: a class that is not a GraphQL type, a relation naming a field
 * that does not exist, a filter referring to an unknown field. All of them throw
 * `TypeError` from inside the hook, so run the hooks during boot rather than
 * lazily on first request.
 *
 * @example
 * ```typescript
 * import {
 *     Dependency,
 *     DependencyFor,
 *     schemaHooks,
 * } from '@imqueue/type-graphql-dependency';
 * import { buildSchema, ObjectType } from 'type-graphql';
 *
 * @DependencyFor<Partial<Consumer>>({
 *     require: [
 *         [() => ApiKey, [{ as: 'apiKeys', filter: { consumerId: 'id' } }]],
 *     ],
 *     async load(context, filter, fields) {
 *         const { data } = await context.consumer.listConsumer(filter, fields);
 *
 *         return data;
 *     },
 * })
 * @ObjectType()
 * export class Consumer {
 *     // ... field definitions ...
 * }
 *
 * // once, at boot
 * const schema = await buildSchema({ resolvers: [ConsumerResolver] });
 *
 * schemaHooks.forEach(hook => hook(schema));
 *
 * // later, in a resolver
 * await Dependency(Consumer).load(data, context, fields);
 * ```
 *
 * @packageDocumentation
 */
export * from './src/index.js';
