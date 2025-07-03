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
    DataInitializer,
    DataLoader,
    Dependency as BaseDependency,
    DependencyFilterOptions,
    DependencyOptionsGetter,
    GraphQLDependency,
} from '@imqueue/graphql-dependency';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';

export type CreateSchemaHook = (schema: GraphQLSchema) => void;

export const schemaHooks: CreateSchemaHook[] = [];

export function onCreateSchema(handler: CreateSchemaHook) {
    if (!~schemaHooks.indexOf(handler)) {
        schemaHooks.push(handler);
    }
}

export interface DependentTypeRelations {
    as: string;
    filter: { [foreignField: string]: /*localField: */string };
}

export type DependentType = Function | Function[];

export interface DependsOptions<T> {
    require?: [() => DependentType, DependentTypeRelations[]][];
    init?: DataInitializer<T>;
    load?: DataLoader<T>;
}

export interface DependencyInterface<T> {
    (type: Function): GraphQLDependency<T>;
    schema?: GraphQLSchema;
}

/**
 * Abstracts Dependency from @imqueue/graphql-dependency to make it possible
 * to work with a plain classes from type-graphql. This function is not intended
 * to be used to define dependencies, only to refer already defined
 * dependencies.
 *
 * To define dependencies for type-graphql classes use @DependencyFor()
 * decorator instead.
 *
 * @example
 * import { Dependency } from './src/decorators';
 * // ... in a resolver, before data return:
 * await Dependency(Consumer).load(context, data, fields);
 *
 * @param {Function} type
 * @return {GraphQLDependency<any>}
 * @constructor
 */
export const Dependency: DependencyInterface<any> = (
    type: Function,
): GraphQLDependency<any> => {
    const { schema } = Dependency;

    if (!schema) {
        throw new TypeError('Either GraphQL schema was not initialized, ' +
            'nor any dependencies defied!');
    }

    // noinspection TypeScriptRedundantGenericType
    const targetType = schema.getType(type.name) as GraphQLObjectType<any, any>;

    if (!targetType || !targetType.getFields) {
        throw new TypeError(`Invalid loaderOf target: ${
            type.name } - not a GraphQL type!`);
    }

    return BaseDependency(targetType as any);
}

// noinspection JSUnusedGlobalSymbols
/**
 * Decorator for describing dependencies between graphql entities, using
 * their type-graphql definitions as classes and @imqueue/graphql-dependency
 * as an engine.
 *
 * This decorator simply wrap native graphql-js-based implementation of
 * graphql-dependency from @imqueue and operates with a similar concepts:
 *  - requires
 *  - initializers
 *  - loaders
 * @see https://github.com/imqueue/graphql-dependency
 *
 * @example
 * // Let's assume we want to decorate Consumer objects to be dependent on
 * // nested ApiKey objects:
 * @DependencyFor<Partial<Consumer>>({
 *    // this defines dependency relations for Consumer object.
 *    // refers to: @imqueue/graphql-dependency:Dependency.require()
 *    require: [
 *        [() => ApiKey, [
 *          { as: 'apiKeys', filter: { 'consumerId': 'id' } }],
 *        ],
 *    ],
 *    // this defines initializer for Consumer, all dependencies will wait
 *    // for initializer to finish before load
 *    // refers to: @imqueue/graphql-dependency:Dependency.defineInitializer()
 *    async init(
 *        context: Context,
 *        result: Partial<Consumer>,
 *        fields?: FieldsInput,
 *    ): Promise<DataInitializerResult> {
 *        // ... do initializer stuff here ...
 *        return result;
 *    },
 *    // this defines loader for Consumer entity, which should be used by
 *    // other entities, which depend on Consumer
 *    // refers to: @imqueue/graphql-dependency:Dependency.defineLoader()
 *    async load(
 *        context: Context,
 *        filter: ConsumerListInput,
 *        fields?: FieldsInput,
 *    ): Promise<Partial<Consumer>[]> {
 *        const { data } = await context.consumer.listConsumer(filter, fields);
 *        return toConsumers(data);
 *    },
 * })
 * @ObjectType()
 * export class Consumer {
 *     // ... Consumer fields definitions goes here ...
 * }
 *
 * // now within a resolver:
 * import { Dependency } from './src/decorators';
 * // ... in a resolver, before data return:
 * await Dependency(Consumer).load(data, context, fields);
 *
 * @param {DependsOptions<T>} options
 * @return {(target: any) => void}
 * @constructor
 */
export function DependencyFor<T>(options: DependsOptions<T>) {
    return (target: any) => onCreateSchema(schema => {
        if (!Dependency.schema) {
            Dependency.schema = schema;
        }

        const targetName = target.name;
        const targetType = schema.getType(targetName) as GraphQLObjectType;

        if (!targetType || !targetType.getFields) {
            throw new TypeError(`Invalid DependencyOf target: ${
                targetName} - not a GraphQL type!`);
        }

        if (options.require) {
            for (const [thunk, relations] of options.require) {
                const type = thunk();
                // noinspection SuspiciousTypeOfGuard
                const isList = type instanceof Array;
                const typeName = isList
                    ? (type as unknown as ((...args: any[]) => {})[])[0].name
                    : (type as (...args: any[]) => {}).name;
                const dep = schema.getType(typeName) as GraphQLObjectType;

                if (!dep || !dep.getFields) {
                    throw new TypeError(`Invalid dependent type given: ${
                        typeName } - not a GraphQL type!`);
                }

                const requireArgs: DependencyOptionsGetter[] = [];

                for (const relation of relations) {
                    const targetField = targetType.getFields()[relation.as];
                    const filter: DependencyFilterOptions = {};

                    if (!targetField) {
                        throw new TypeError(
                            `Invalid target field specified on ${
                                target.name } -> ${
                                typeName }.as = ${
                                relation.as }`,
                        );
                    }

                    for (const foreignName of Object.keys(relation.filter)) {
                        const localName = relation.filter[foreignName];
                        const foreign = dep.getFields()[foreignName];
                        const local = targetType.getFields()[localName];

                        if (!foreign) {
                            throw new TypeError(
                                `Invalid foreign field specified on ${
                                    targetName } -> ${ typeName }.filter[${
                                    foreignName
                                }] - no such GraphQL field defined!`);
                        }

                        if (!local) {
                            throw new TypeError(
                                `Invalid local field specified on ${
                                    targetName } -> ${ typeName }.filter[${
                                    foreignName }] = ${
                                    local } - no such GraphQL field defined!`,
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
            BaseDependency(targetType as any).defineInitializer(options.init);
        }

        if (options.load) {
            BaseDependency(targetType as any).defineLoader(options.load);
        }
    });
}
