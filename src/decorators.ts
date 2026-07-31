/* tslint:disable:ban-types */
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
import {
    type DataInitializer,
    type DataLoader,
    Dependency as BaseDependency,
    type DependencyFilterOptions,
    type DependencyOptionsGetter,
    GraphQLDependency,
} from '@imqueue/graphql-dependency';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';

/**
 * A deferred piece of dependency wiring, run once the `type-graphql` schema
 * exists and the classes it was declared against have become GraphQL types.
 */
export type CreateSchemaHook = (schema: GraphQLSchema) => void;

/**
 * Every deferred wiring hook registered so far, in the order it was registered.
 *
 * @remarks
 * Applying {@link DependencyFor} appends to this array; nothing in this package
 * ever drains it. Running the hooks is the application's job, once the schema is
 * built:
 *
 * ```typescript
 * const schema = await buildSchema({ resolvers: [...] });
 *
 * schemaHooks.forEach(hook => hook(schema));
 * ```
 *
 * Skip that and no dependency is registered at all. There is no warning — the
 * decorated classes look wired and their dependency fields stay empty.
 */
export const schemaHooks: CreateSchemaHook[] = [];

/**
 * Registers a hook to run when the schema is created, ignoring a handler already
 * registered.
 *
 * @remarks
 * {@link DependencyFor} uses this internally; call it directly to defer wiring of
 * your own that also needs the finished schema. De-duplication is by function
 * identity, so a named function passed twice is stored once while two identical
 * inline arrows are two hooks.
 *
 * @param handler - the hook to run with the built schema
 */
export function onCreateSchema(handler: CreateSchemaHook) {
    if (!~schemaHooks.indexOf(handler)) {
        schemaHooks.push(handler);
    }
}

/**
 * One relation from the decorated class to a dependent class: where the loaded
 * objects are attached, and how they are matched.
 */
export interface DependentTypeRelations {
    /**
     * The name of the field on the decorated class the loaded objects are written
     * to. It must be a field of the generated GraphQL type, or the hook throws
     * `TypeError` when the schema is created.
     */
    as: string;

    /**
     * How to find the dependent objects belonging to each instance: each key is a
     * field of the *dependent* type that its loader filters on, and each value is
     * the field on the *decorated* class supplying the values.
     *
     * @remarks
     * The direction is easy to read backwards, so: key is foreign, value is local.
     * `{ consumerId: 'id' }` on a `Consumer` requiring `ApiKey` means "filter api
     * keys by `consumerId`, using each consumer's `id`". Both names are checked
     * against the schema and an unknown one throws `TypeError`.
     */
    filter: { [foreignField: string]: /*localField: */ string };
}

/**
 * The class a requirement points at, named through a thunk.
 *
 * @remarks
 * A bare class and a single-element array behave identically — only the first
 * element is read, and only for its name. The array form is a readability
 * convention for "many of these", matching how the relation's target field is
 * typed; whether one object or a list is attached is decided by that field's own
 * GraphQL type, not by this.
 */
export type DependentType = Function | Function[];

/**
 * What {@link DependencyFor} declares for one class — any combination of
 * requirements, an initializer and a loader.
 *
 * @remarks
 * All three are optional, and each maps onto its `@imqueue/graphql-dependency`
 * counterpart. Passing none is legal and registers a hook that does nothing.
 *
 * @typeParam T - the shape of the entity being described, usually a `Partial` of
 *                the decorated class
 */
export interface DependsOptions<T> {
    /**
     * The classes this one owns, each paired with its relations — a thunk naming
     * the dependent class, and one {@link DependentTypeRelations} per relation to
     * it. Deferred through a thunk so a class can require another that is not
     * defined yet, which is what makes circular relations expressible.
     */
    require?: [() => DependentType, DependentTypeRelations[]][];

    /**
     * An async routine that fills extra fields on this class's objects before its
     * dependencies load, for values a requirement filter needs but the initial
     * result does not carry.
     *
     * @remarks
     * Registered without naming the fields it fills, which means every dependency
     * of this class waits for it. Declaring those fields — and so letting
     * unrelated dependencies load alongside it — needs the underlying
     * `defineInitializer()`, which takes them.
     */
    init?: DataInitializer<T>;

    /**
     * The bulk fetch for this class, called whenever another class requires it.
     * Every object it returns must carry an `id`, and it must accept a set of
     * values per filter key rather than one.
     */
    load?: DataLoader<T>;
}

/**
 * The callable {@link Dependency} exposes: a class in, its dependency description
 * out, plus the schema it resolves classes against.
 *
 * @typeParam T - the entity type the returned description is for
 */
export interface DependencyInterface<T> {
    (type: Function): GraphQLDependency<T>;

    /**
     * The built schema used to turn a class into its GraphQL type.
     *
     * @remarks
     * Set automatically by the first {@link DependencyFor} hook to run, so it is
     * populated as a side effect of wiring rather than by configuration. Until
     * then it is `undefined` and {@link Dependency} throws — which is why a
     * `Dependency()` call before the schema hooks have run cannot work, even
     * though the schema itself may already exist.
     *
     * Assignable, if an application needs to point it at a particular schema or
     * reset it between schemas in a test.
     */
    schema?: GraphQLSchema;
}

/**
 * The dependency description for a `type-graphql` class — the runtime half of
 * this package, for loading dependencies inside a resolver.
 *
 * @remarks
 * This looks up a description; it does not define one. Use {@link DependencyFor}
 * to declare loaders, requirements and initializers, and this to reach the
 * `load()` that resolves them.
 *
 * It works by mapping the class to the GraphQL type of the same name in
 * {@link DependencyInterface.schema} and delegating to
 * `Dependency` from `@imqueue/graphql-dependency`. So the class name and the
 * GraphQL type name have to agree: giving `@ObjectType` an explicit `name`
 * option that differs from the class name breaks the lookup.
 *
 * @example
 * ```typescript
 * import { Dependency } from '@imqueue/type-graphql-dependency';
 *
 * // in a resolver, before returning the data
 * await Dependency(Consumer).load(data, context, fields);
 * ```
 *
 * @param type - the decorated class whose dependencies to resolve
 * @returns the dependency description registered for that class's GraphQL type
 * @throws TypeError if the schema has not been handed to the hooks in
 *         {@link schemaHooks} yet, or if the class is not a GraphQL object type
 *         in it
 */
export const Dependency: DependencyInterface<any> = (
    type: Function,
): GraphQLDependency<any> => {
    const { schema } = Dependency;

    if (!schema) {
        throw new TypeError(
            'Either GraphQL schema was not initialized, ' +
                'nor any dependencies defied!',
        );
    }

    // noinspection TypeScriptRedundantGenericType
    const targetType = schema.getType(type.name) as GraphQLObjectType<any, any>;

    if (!targetType || !targetType.getFields) {
        throw new TypeError(
            `Invalid loaderOf target: ${type.name} - not a GraphQL type!`,
        );
    }

    return BaseDependency(targetType as any);
};

// noinspection JSUnusedGlobalSymbols
/**
 * Class decorator declaring how a `type-graphql` entity is loaded and what it
 * depends on, wiring it into `@imqueue/graphql-dependency`.
 *
 * @remarks
 * Applying it does not wire anything. It registers a hook on {@link schemaHooks},
 * because the `GraphQLObjectType` the class becomes does not exist while the
 * decorator runs. The declarations only reach the engine once the application
 * passes the built schema to those hooks.
 *
 * That deferral moves every validation failure to the same later moment. Inside
 * the hook, a `TypeError` is raised for a class that is not a GraphQL object type
 * in the schema, a relation whose `as` names no field on it, or a `filter` naming
 * a field on neither side. Running the hooks during boot rather than lazily is
 * what turns these into start-up failures instead of per-request ones.
 *
 * It works with both decorator conventions: the legacy
 * `experimentalDecorators` form and standard TC39 decorators. Only the class name
 * is read and nothing is returned, so both behave identically.
 *
 * @example
 * ```typescript
 * // Consumer owns a list of ApiKey objects, loaded in bulk
 * @DependencyFor<Partial<Consumer>>({
 *     require: [
 *         [() => ApiKey, [
 *             // attach to Consumer.apiKeys; filter api keys by consumerId,
 *             // feeding it each consumer's own id
 *             { as: 'apiKeys', filter: { consumerId: 'id' } },
 *         ]],
 *     ],
 *     // pre-fills fields the requirement filters need; every dependency of
 *     // Consumer waits for it, since the fields it fills are not declared here
 *     async init(
 *         context: Context,
 *         result: Partial<Consumer>[],
 *         fields?: FieldsInput,
 *     ): Promise<DataInitializerResult> {
 *         return keyById(await context.consumer.enrich(result));
 *     },
 *     // how other entities load Consumer when they require it
 *     async load(
 *         context: Context,
 *         filter: ConsumerListInput,
 *         fields?: FieldsInput,
 *     ): Promise<Partial<Consumer>[]> {
 *         const { data } = await context.consumer.listConsumer(filter, fields);
 *
 *         return toConsumers(data);
 *     },
 * })
 * @ObjectType()
 * export class Consumer {
 *     // ... field definitions ...
 * }
 * ```
 *
 * @param options - the loader, requirements and initializer to declare
 * @returns the class decorator to apply
 * @see {@link https://github.com/imqueue/graphql-dependency}
 */
export function DependencyFor<T>(options: DependsOptions<T>) {
    return (target: any) =>
        onCreateSchema(schema => {
            if (!Dependency.schema) {
                Dependency.schema = schema;
            }

            const targetName = target.name;
            const targetType = schema.getType(targetName) as GraphQLObjectType;

            if (!targetType || !targetType.getFields) {
                throw new TypeError(
                    `Invalid DependencyOf target: ${
                        targetName
                    } - not a GraphQL type!`,
                );
            }

            if (options.require) {
                for (const [thunk, relations] of options.require) {
                    const type = thunk();
                    // noinspection SuspiciousTypeOfGuard
                    const isList = type instanceof Array;
                    const typeName = isList
                        ? (type as unknown as ((...args: any[]) => {})[])[0]
                              .name
                        : (type as (...args: any[]) => {}).name;
                    const dep = schema.getType(typeName) as GraphQLObjectType;

                    if (!dep || !dep.getFields) {
                        throw new TypeError(
                            `Invalid dependent type given: ${
                                typeName
                            } - not a GraphQL type!`,
                        );
                    }

                    const requireArgs: DependencyOptionsGetter[] = [];

                    for (const relation of relations) {
                        const targetField = targetType.getFields()[relation.as];
                        const filter: DependencyFilterOptions = {};

                        if (!targetField) {
                            throw new TypeError(
                                `Invalid target field specified on ${
                                    target.name
                                } -> ${typeName}.as = ${relation.as}`,
                            );
                        }

                        for (const foreignName of Object.keys(
                            relation.filter,
                        )) {
                            const localName = relation.filter[foreignName];
                            const foreign = dep.getFields()[foreignName];
                            const local = targetType.getFields()[localName];

                            if (!foreign) {
                                throw new TypeError(
                                    `Invalid foreign field specified on ${
                                        targetName
                                    } -> ${typeName}.filter[${
                                        foreignName
                                    }] - no such GraphQL field defined!`,
                                );
                            }

                            if (!local) {
                                throw new TypeError(
                                    `Invalid local field specified on ${
                                        targetName
                                    } -> ${typeName}.filter[${foreignName}] = ${
                                        local
                                    } - no such GraphQL field defined!`,
                                );
                            }

                            filter[foreignName] = local as any;
                        }

                        requireArgs.push(() => ({
                            as: targetField as any,
                            filter,
                        }));
                    }

                    BaseDependency(targetType as any).require(
                        dep as any,
                        ...requireArgs,
                    );
                }
            }

            if (options.init) {
                BaseDependency(targetType as any).defineInitializer(
                    options.init as any,
                );
            }

            if (options.load) {
                BaseDependency(targetType as any).defineLoader(
                    options.load as any,
                );
            }
        });
}
