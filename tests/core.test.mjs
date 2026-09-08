import assert from 'node:assert/strict';
import test from 'node:test';

import {
  App,
  DefaultPlugin,
  EventReader,
  EventWriter,
  InputPlugin,
  InputTarget,
  KeyboardInput,
  MouseInput,
  Res,
  ResMut,
  ResourceStore,
  SystemSet,
  Timer,
  World,
  Entity,
  Query,
  With,
  params,
  system,
} from '../dist/pureecs.mjs';

test('keyboard and mouse input use distinct resources', () => {
  const app = new App().addPlugin(new InputPlugin());
  const keyboard = app.world.getResource(KeyboardInput);
  const mouse = app.world.getResource(MouseInput);

  assert.ok(keyboard instanceof KeyboardInput);
  assert.ok(mouse instanceof MouseInput);
  assert.notStrictEqual(keyboard, mouse);
});

test('stale entity handles cannot access a reused entity id', () => {
  class Value {
    constructor(value) {
      this.value = value;
    }
  }

  const world = new World();
  const stale = world.spawn();
  world.insertComponent(stale, new Value('old'));
  world.despawn(stale);
  const current = world.spawn();

  assert.equal(stale.id, current.id);
  assert.equal(world.insertComponent(stale, new Value('stale')), false);
  assert.equal(world.getComponent(stale, Value), undefined);
  assert.equal(world.getComponent(current, Value), undefined);
});

test('despawn removes every owned component after component removal and reinsertion', () => {
  class Position {}
  class Velocity {}
  class Health {}

  const world = new World();
  const entity = world.spawn();
  world.insertComponent(entity, new Position());
  world.insertComponent(entity, new Velocity());
  world.insertComponent(entity, new Health());
  world.removeComponent(entity, Velocity);
  world.insertComponent(entity, new Velocity());

  assert.equal(world.despawn(entity), true);
  const reused = world.spawn();
  assert.equal(world.getComponent(reused, Position), undefined);
  assert.equal(world.getComponent(reused, Velocity), undefined);
  assert.equal(world.getComponent(reused, Health), undefined);
});

test('resource removal returns the removed resource', () => {
  class Resource {}

  const store = new ResourceStore();
  const resource = new Resource();
  store.insert(Resource, resource);

  assert.strictEqual(store.remove(Resource), resource);
  assert.equal(store.has(Resource), false);
});

test('a finished one-shot timer only reports justFinished for one tick', () => {
  const timer = new Timer(1);
  timer.tick(1);
  assert.equal(timer.justFinished(), true);

  timer.tick(0.1);
  assert.equal(timer.justFinished(), false);
  assert.throws(() => new Timer(0), RangeError);
  assert.throws(() => timer.tick(-1), RangeError);
});

test('Res reports an absent required resource before invoking the system', () => {
  class RequiredResource {}

  const world = new World();
  const system = params(Res(RequiredResource)).system(() => {});
  assert.throws(() => system(world), /Required resource is missing: RequiredResource/);
});

test('systemForEach visits Query rows without materializing tuples', () => {
  class Position {
    constructor(value) {
      this.value = value;
    }
  }
  class Velocity {
    constructor(value) {
      this.value = value;
    }
  }

  const world = new World();
  const matched = world.spawn();
  world.insertComponent(matched, new Position(1));
  world.insertComponent(matched, new Velocity(2));
  const unmatched = world.spawn();
  world.insertComponent(unmatched, new Position(10));

  const values = [];
  const movement = params(Query(Position, Velocity))
    .systemForEach((position, velocity) => values.push(position.value + velocity.value));

  movement(world);
  assert.deepEqual(values, [3]);
});

test('With filters select only entities carrying the filtered component', () => {
  class Position {}
  class Active {}

  const world = new World();
  const active = world.spawn();
  world.insertComponent(active, new Position());
  world.insertComponent(active, new Active());
  const inactive = world.spawn();
  world.insertComponent(inactive, new Position());

  const values = [];
  const querySystem = params(Query(Position, With(Active))).systemForEach((position) => values.push(position));
  querySystem(world);

  assert.equal(values.length, 1);
  assert.ok(values[0] instanceof Position);
});

test('systemForEach supports three-fetch queries and Entity handles', () => {
  class Position {
    constructor(value) {
      this.value = value;
    }
  }
  class Velocity {
    constructor(value) {
      this.value = value;
    }
  }
  class Active {}

  const world = new World();
  const first = world.spawn();
  world.insertComponent(first, new Position(1));
  world.insertComponent(first, new Velocity(2));
  world.insertComponent(first, new Active());
  const second = world.spawn();
  world.insertComponent(second, new Position(10));
  world.insertComponent(second, new Velocity(20));

  const sums = [];
  params(Query(Position, Velocity, Active))
    .systemForEach((position, velocity, active) => {
      sums.push(position.value + velocity.value + (active ? 1 : 0));
    })(world);
  assert.deepEqual(sums, [4]);

  const entities = [];
  params(Query(Entity, With(Position)))
    .systemForEach((entity) => entities.push(entity))(world);
  assert.equal(entities.length, 2);
  assert.ok(entities.some((entity) => entity.equals(first)));
  assert.ok(entities.some((entity) => entity.equals(second)));
});

test('DefaultPlugin works without a DOM input target', () => {
  const app = new App().addPlugin(new DefaultPlugin());
  assert.doesNotThrow(() => app.update());
});

test('ResMut marks a resource as changed when accessed mutably', () => {
  class Counter {
    value = 0;
  }

  let changed = false;
  const app = new App()
    .insertResource(new Counter())
    .addSystem(params(ResMut(Counter)).system((counter) => {
      counter.get().value++;
    }))
    .addSystem((world) => {
      changed = world.isResourceChanged(Counter);
    });

  app.update();
  assert.equal(app.world.getResource(Counter)?.value, 1);
  assert.equal(changed, true);
  assert.equal(app.world.isResourceChanged(Counter), false);
});

test('events are delivered in the same tick and cleared after it', () => {
  class Hit {
    constructor(value) {
      this.value = value;
    }
  }

  const received = [];
  const app = new App()
    .addEvent(Hit)
    .addSystem(params(EventWriter(Hit)).system((writer) => writer.send(new Hit('now'))))
    .addSystem(params(EventReader(Hit)).system((reader) => {
      received.push(...reader.read().map((event) => event.value));
    }));

  app.update();
  assert.deepEqual(received, ['now']);
  assert.deepEqual(app.world.getRequiredEvents(Hit).readAfter(-1).events, []);
});

test('system conditions, enabled state, and system sets control execution order', () => {
  const order = [];
  const physics = new SystemSet('physics');
  const active = new SystemSet('active').runIf(() => true);

  const render = () => order.push('render');
  const simulate = () => order.push('simulate');
  const disabled = () => order.push('disabled');

  const app = new App()
    .addSystemConfig(system(render).afterSet(physics))
    .addSystemConfig(system(simulate).inSet(physics).inSet(active))
    .addSystemConfig(system(disabled).enabled(false))
    .addSystemConfig(system(() => order.push('condition')).runIf(() => false));

  app.update();
  assert.deepEqual(order, ['simulate', 'render']);

  physics.enabled(false);
  app.update();
  assert.deepEqual(order, ['simulate', 'render', 'render']);
});

test('App.destroy removes InputPlugin event listeners', () => {
  class CountingTarget extends EventTarget {
    added = 0;
    removed = 0;

    addEventListener(...args) {
      this.added++;
      return super.addEventListener(...args);
    }

    removeEventListener(...args) {
      this.removed++;
      return super.removeEventListener(...args);
    }
  }

  const target = new CountingTarget();
  const app = new App()
    .addPlugin(new InputPlugin())
    .insertResource(new InputTarget(target));

  app.update();
  assert.ok(target.added > 0);
  app.destroy();
  assert.equal(target.removed, target.added);
  assert.throws(() => app.update(), /App has been destroyed/);
});
