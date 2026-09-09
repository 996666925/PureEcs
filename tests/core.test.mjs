import assert from 'node:assert/strict';
import test from 'node:test';

import {
  App,
  DefaultPlugin,
  EventReader,
  EventWriter,
  Trigger,
  InputPlugin,
  InputTarget,
  KeyboardInput,
  MouseInput,
  Res,
  ResMut,
  ResourceStore,
  SparseSet,
  defineState,
  State,
  NextState,
  DespawnOnExit,
  OnEnter,
  OnExit,
  OnTransition,
  inState,
  Stages,
  SystemSet,
  Timer,
  World,
  Entity,
  Query,
  With,
  params,
  system,
} from '../dist/pureecs.mjs';

test('State runs lifecycle systems, defers transitions, and gates systems by current state', () => {
  const Screen = defineState({ Menu: { initial: true }, Playing: {} });
  const Pause = defineState({ Running: { initial: true }, Paused: {} });

  const order = [];
  let updates = 0;
  const app = new App()
    .addState(Screen)
    .addState(Pause)
    .addSystem(OnEnter(Screen.Menu), () => order.push('enter:menu'))
    .addSystem(OnExit(Screen.Menu), () => order.push('exit:menu'))
    .addSystem(OnTransition(Screen.Menu, Screen.Playing), () => order.push('transition'))
    .addSystem(OnEnter(Screen.Playing), () => order.push('enter:playing'))
    .addSystemConfig(system(() => order.push('menu')).runIf(inState(Screen.Menu)))
    .addSystemConfig(system(() => order.push('playing')).runIf(inState(Screen.Playing)))
    .addSystem(Stages.Update, (world) => {
      updates++;
      if (updates === 1) {
        world.nextState(Screen).set(Screen.Playing);
        world.nextState(Pause).set(Pause.Paused);
      }
      if (updates === 2) world.nextState(Screen).set(Screen.Playing);
    });

  app.run(3);

  assert.deepEqual(order, [
    'enter:menu',
    'menu',
    'exit:menu',
    'transition',
    'enter:playing',
    'playing',
    'playing',
  ]);
  assert.equal(app.world.state(Screen).get(), Screen.Playing);
  assert.equal(app.world.state(Pause).get(), Pause.Paused);
});

test('DespawnOnExit removes only entities scoped to the exited state after OnExit', () => {
  const Screen = defineState({ Menu: { initial: true }, Playing: {} });

  let menuEntity;
  let playingEntity;
  let presentDuringExit = false;
  let updateCount = 0;
  const app = new App()
    .addState(Screen)
    .addStartupSystem((world) => {
      menuEntity = world.spawnWith(new DespawnOnExit(Screen.Menu));
      playingEntity = world.spawnWith(new DespawnOnExit(Screen.Playing));
    })
    .addSystem(OnExit(Screen.Menu), (world) => {
      presentDuringExit = world.isAlive(menuEntity);
    })
    .addSystem((world) => {
      updateCount++;
      if (updateCount === 1) world.nextState(Screen).set(Screen.Playing);
    });

  app.run(2);

  assert.equal(presentDuringExit, true);
  assert.equal(app.world.isAlive(menuEntity), false);
  assert.equal(app.world.isAlive(playingEntity), true);
});

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

test('SparseSet insert reports whether the entity was newly added', () => {
  const storage = new SparseSet();
  const first = { value: 1 };
  const replacement = { value: 2 };

  assert.equal(storage.insert(7, first), true);
  assert.equal(storage.insert(7, replacement), false);
  assert.strictEqual(storage.get(7), replacement);
  assert.equal(storage.length, 1);
});

test('spawnWith attaches components and preserves duplicate replacement semantics', () => {
  class Position {
    constructor(value) {
      this.value = value;
    }
  }
  class Tag {}

  const world = new World();
  const entity = world.spawnWith(new Position(1), new Tag(), new Position(2));

  assert.equal(world.entityCount, 1);
  assert.equal(world.getComponent(entity, Position)?.value, 2);
  assert.ok(world.hasComponent(entity, Tag));
  assert.equal(world.despawn(entity), true);
  assert.equal(world.entityCount, 0);
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

test('Entity-only queries visit every alive entity', () => {
  class Position {}

  const world = new World();
  const first = world.spawn();
  const second = world.spawn();
  world.spawn();
  world.despawn(second);
  world.insertComponent(first, new Position());

  const ids = [...world.query(Entity)].map(([id, components]) => {
    assert.equal(components.length, 1);
    assert.ok(components[0] instanceof Entity);
    return id;
  });

  assert.deepEqual(ids, [first.id, first.id + 2]);
});

test('Entity-only queries apply filters', () => {
  class Active {}

  const world = new World();
  const active = world.spawn();
  const inactive = world.spawn();
  world.insertComponent(active, new Active());

  const ids = [...world.queryFiltered([Entity], [{ type: 'without', component: Active }])]
    .map(([id]) => id);

  assert.deepEqual(ids, [inactive.id]);
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

test('observers synchronously receive global and entity-targeted triggers', () => {
  class Hit {
    constructor(value) {
      this.value = value;
    }
  }

  const order = [];
  const app = new App();
  const target = app.world.spawn();
  const otherTarget = app.world.spawn();

  app
    .addObserver(Hit, (trigger, world) => {
      assert.ok(trigger instanceof Trigger);
      order.push(`global:${trigger.event.value}:${trigger.target?.id ?? 'none'}`);
      if (trigger.event.value === 'first') world.trigger(new Hit('nested'));
    })
    .addObserver(Hit, target, (trigger) => {
      order.push(`target:${trigger.event.value}:${trigger.target?.id}`);
    })
    .addObserver(Hit, otherTarget, () => order.push('other'))
    .addSystem((world) => {
      world.triggerTargets(new Hit('first'), target);
      order.push('after-sync');
      world.commands.trigger(new Hit('deferred'));
    });

  app.update();

  assert.deepEqual(order, [
    `global:first:${target.id}`,
    'global:nested:none',
    `target:first:${target.id}`,
    'after-sync',
    'global:deferred:none',
  ]);

  app.world.despawn(target);
  app.world.triggerTargets(new Hit('after-despawn'), target);
  assert.deepEqual(order.slice(-1), [`global:after-despawn:${target.id}`]);
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

test('ordering constraints handle duplicate registrations of the same function', () => {
  const order = [];
  const repeated = () => order.push('repeated');
  const afterRepeated = () => order.push('after');

  const app = new App()
    .addSystem(repeated)
    .addSystem(repeated)
    .addSystemConfig(system(afterRepeated).after(repeated));

  app.update();
  assert.deepEqual(order, ['repeated', 'repeated', 'after']);
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
