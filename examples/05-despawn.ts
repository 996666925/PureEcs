/**
 * Entity despawn & generational indexing with params().system().
 *
 * Run: npx tsx examples/05-despawn.ts
 */

import { App, World, Entity, params, Query, Cmd } from '../src/index';

// ─── Define Components ───

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Name {
  constructor(public value: string = '') {}
}

class Lifetime {
  constructor(public ticks: number = 0) {}
}

// ─── Define Systems ───

function setup(world: World): void {
  const a = world.spawn();
  world.insertComponent(a, new Position(1, 1));
  world.insertComponent(a, new Name('A'));
  world.insertComponent(a, new Lifetime(2));

  const b = world.spawn();
  world.insertComponent(b, new Position(2, 2));
  world.insertComponent(b, new Name('B'));
  world.insertComponent(b, new Lifetime(4));

  const c = world.spawn();
  world.insertComponent(c, new Position(3, 3));
  world.insertComponent(c, new Name('C'));

  console.log(`[Startup] Spawned 3 entities. Alive: ${world.entityCount}`);
}

// Use Query() with Entity for guaranteed alignment
const lifetimeSystem = params(Query(Lifetime, Name, Entity), Cmd()).system((rows, commands) => {
  for (const [lifetime, name, entity] of rows) {
    lifetime.ticks--;
    if (lifetime.ticks <= 0) {
      console.log(`  ${name.value} expired!`);
      commands.despawn(entity);
    }
  }
});

function printAlive(world: World): void {
  console.log(`  Alive entities: ${world.entityCount}`);
  for (const [id, comps] of world.query(Name, Position)) {
    const [name, pos] = comps as [Name, Position];
    console.log(`    ${name.value} (${id}): (${pos.x}, ${pos.y})`);
  }
}

// ─── Generational indexing demo ───

function generationalDemo(): void {
  console.log('\n=== Generational Indexing Demo ===\n');

  const world = new World();

  const e1 = world.spawn();
  console.log(`Spawned: ${e1}`);

  world.insertComponent(e1, new Name('First'));
  console.log(`Has Name: ${world.hasComponent(e1, Name)}`);

  world.despawn(e1);
  console.log(`Despawned. Is alive: ${world.isAlive(e1)}`);

  const e2 = world.spawn();
  console.log(`Spawned: ${e2}`);

  console.log(`Old entity e1 is alive: ${world.isAlive(e1)}`);
  console.log(`New entity e2 is alive: ${world.isAlive(e2)}`);
}

// ─── Run ───

console.log('=== Despawn & Lifetime Demo ===\n');

const app = new App()
  .addStartupSystem(setup)
  .addSystem(lifetimeSystem)
  .addSystem(printAlive);

console.log('Running 5 ticks...\n');
app.run(5);

generationalDemo();
