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
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    Dependency,
    DependencyFor,
    onCreateSchema,
    schemaHooks,
} from '../index.js';

describe('Dependency', () => {
    it('should be a function', () => {
        assert.equal(typeof Dependency, 'function');
    });

    it('should throw when the schema is not initialized', () => {
        const previous = Dependency.schema;

        Dependency.schema = undefined;

        assert.throws(() => Dependency(class Foo {}), TypeError);

        Dependency.schema = previous;
    });
});

describe('onCreateSchema()', () => {
    it('should register a hook, ignoring duplicates', () => {
        const before = schemaHooks.length;
        const handler = (): void => undefined;

        onCreateSchema(handler);
        onCreateSchema(handler);

        assert.equal(schemaHooks.length, before + 1);
    });
});

describe('DependencyFor()', () => {
    it('should return a class decorator function', () => {
        assert.equal(typeof DependencyFor({}), 'function');
    });

    it('should register a schema hook when applied to a class', () => {
        const before = schemaHooks.length;

        class MyType {}

        // applying the decorator only defers the wiring via a schema hook;
        // the hook body runs later, when the schema is created
        DependencyFor({})(MyType);

        assert.equal(schemaHooks.length, before + 1);
    });

    it('should work as a standard (TC39) class decorator invocation', () => {
        const before = schemaHooks.length;

        class MyType {}

        // standard decorators call (value, context); only the class name is
        // used and nothing is returned, so both conventions behave the same
        (DependencyFor({}) as any)(MyType, { kind: 'class', name: 'MyType' });

        assert.equal(schemaHooks.length, before + 1);
    });
});
