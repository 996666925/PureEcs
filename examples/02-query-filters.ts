/**
 * Query filters with scoped Query() descriptors.
 *
 * Run: npx tsx examples/02-query-filters.ts
 */

import { App, World, params, Query, With, Without } from '../src/index';

// ─── Define Components ───

class Health {
  constructor(public hp: number = 100) { }
}

class Poisoned { }

class Regeneration {
  constructor(public rate: number = 5) { }
}

class Name {
  constructor(public value: string = '') { }
}

// ─── Define Systems ───

function setup(world: World): void {
  const knight = world.spawn();
  world.insertComponent(knight, new Health(100));
  world.insertComponent(knight, new Name('Knight'));

  const rogue = world.spawn();
  world.insertComponent(rogue, new Health(80));
  world.insertComponent(rogue, new Poisoned);
  world.insertComponent(rogue, new Name('Rogue'));

  const healer = world.spawn();
  world.insertComponent(healer, new Health(90));
  world.insertComponent(healer, new Regeneration(10));
  world.insertComponent(healer, new Name('Healer'));
}

// ✨ Query() scopes filters to a specific fetch — filters only apply to that query group
const poisonSystem = params(
  Query(Health, With(Poisoned), Without(Regeneration))
).system((healths) => {
  for (const health of healths) {
    health.hp -= 10;
    console.log(`  Poison deals 10 damage! HP: ${health.hp}`);
  }
});

const regenSystem = params(
  Query(Health, Regeneration)
).system((healths) => {
  // healths: Health[]
  for (const [health] of healths) {
    health.hp += 10;
    console.log(`  Regen heals 10! HP: ${health.hp}`);
  }
});

function printAll(world: World): void {
  console.log('--- Status ---');
  for (const [, comps] of world.query(Health, Name)) {
    const [health, name] = comps as [Health, Name];
    console.log(`  ${name.value}: HP=${health.hp}`);
  }
}

// ─── Run ───

const app = new App()
  .addStartupSystem(setup)
  .addSystem(printAll)
  .addSystem(poisonSystem)
  .addSystem(regenSystem);

console.log('Running 3 ticks...\n');
app.run(3);
