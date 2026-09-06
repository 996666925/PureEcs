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
