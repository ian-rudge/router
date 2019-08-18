import { routerTest } from '@servall/router-testing';
import * as bodyparser from 'koa-bodyparser';
import { extract } from '@servall/mapper';
import { ApiField, getApiFields } from './decorators';
import { RouteFactory, HttpMethod, propagateErrors } from './index';

test('api field', () => {
  class MyEntity {
    propertyA: boolean = true;

    propertyB: string = 'default';

    @ApiField()
    propertyC: number = 12;
  }

  expect(getApiFields(MyEntity)).toEqual({ propertyC: true });
  expect(extract(new MyEntity(), getApiFields(MyEntity))).toEqual({ propertyC: 12 });
});

test('api field nested', () => {
  class MyOtherEntity {
    @ApiField()
    propertyA: boolean = true;

    propertyB: string = 'default';
  }

  class MyEntity {
    propertyA: boolean = true;

    propertyB: string = 'default';

    @ApiField()
    propertyC: number = 12;

    @ApiField(() => MyOtherEntity)
    other?: MyOtherEntity = new MyOtherEntity();
  }

  expect(getApiFields(MyEntity)).toEqual({ propertyC: true, other: { propertyA: true } });
  expect(extract(new MyEntity(), getApiFields(MyEntity))).toEqual({
    propertyC: 12,
    other: {
      propertyA: true,
    },
  });
});

test('api field recursion 1', () => {
  class EntityA {
    @ApiField(() => EntityB) entityB!: unknown;
  }
  class EntityB {
    @ApiField(() => EntityA) entityA!: unknown;
  }

  expect(getApiFields(EntityA)).toEqual({
    entityB: {
      entityA: false,
    },
  });
});

test('api field recursion 2', () => {
  class EntityA {
    @ApiField(() => EntityC) entityC!: unknown;
  }
  class EntityB {
    @ApiField(() => EntityA) entityA!: unknown;
    @ApiField(() => EntityC) entityC!: unknown;
  }
  class EntityC {
    @ApiField(() => EntityB) entityB!: unknown;
  }

  expect(getApiFields(EntityA)).toEqual({
    entityC: {
      entityB: {
        entityA: false,
        entityC: false,
      },
    },
  });
});

test('api field arr', () => {
  class MyOtherEntity {
    @ApiField()
    propertyA: boolean = true;

    propertyB: string = 'default';
  }

  class MyEntity {
    propertyA: boolean = true;

    propertyB: string = 'default';

    @ApiField()
    propertyC: number = 12;

    @ApiField(() => [MyOtherEntity])
    other?: MyOtherEntity[] = [new MyOtherEntity(), new MyOtherEntity()];
  }

  expect(getApiFields(MyEntity)).toEqual({ propertyC: true, other: [{ propertyA: true }] });
  expect(extract(new MyEntity(), getApiFields(MyEntity))).toEqual({
    propertyC: 12,
    other: [{ propertyA: true }, { propertyA: true }],
  });
});

test('api field subclassing', () => {
  class MyOtherEntity {
    @ApiField()
    propertyA: boolean = true;

    propertyB: string = 'default';
  }

  class MyEntity extends MyOtherEntity {
    @ApiField()
    propertyC: number = 12;
  }

  expect(getApiFields(MyEntity)).toEqual({ propertyC: true, propertyA: true });
  expect(extract(new MyEntity(), getApiFields(MyEntity))).toEqual({
    propertyC: 12,
    propertyA: true,
  });
});

test('api field with custom type', () => {
  class MyEntity {
    @ApiField({ baz: true })
    propertyC: object = { foo: 'bar', baz: 'bat' };
  }

  expect(getApiFields(MyEntity)).toEqual({ propertyC: { baz: true } });
  expect(extract(new MyEntity(), getApiFields(MyEntity))).toEqual({
    propertyC: {
      baz: 'bat',
    },
  });
});

test('api field in returning', async () => {
  class MyEntity {
    propertyA: boolean = true;

    @ApiField()
    propertyB: string = 'default';

    @ApiField()
    propertyC: number = 12;
  }

  const factory: RouteFactory<{}> = {
    getDependencies() {
      return {};
    },

    middleware() {
      return [bodyparser(), propagateErrors(true)];
    },

    create() {
      return [
        {
          path: '/test',
          method: HttpMethod.GET,
          async action() {
            return new MyEntity();
          },
          returning: getApiFields(MyEntity),
        },
      ];
    },
  };

  await routerTest(factory, {}, async test => {
    await test.get('/test').expect({
      // note no propertyA
      propertyB: 'default',
      propertyC: 12,
    });
  });
});

test('api field merging', () => {
  class MyEntity {
    @ApiField()
    propertyA: boolean = true;

    propertyB: string = 'default';

    @ApiField()
    propertyC: number = 12;
  }

  expect(getApiFields(MyEntity, { propertyA: false })).toEqual({
    propertyA: false,
    propertyC: true,
  });
});
