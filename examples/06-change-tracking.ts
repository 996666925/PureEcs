/**
 * Change tracking example with params() + Added/Changed filters + Mut<T>.
 *
 * Run: npx tsx examples/06-change-tracking.ts
 */

import { App, World, Mut, params, Query, Added, Changed } from '../src/index';

// ─── Define Components ───

class Health {
  constructor(public hp: number = 100) {}
}

class Score {
  constructor(public value: number = 0) {}
}

// ─── Define Systems ───

function setup(world: World): void {
  const e1 = world.spawn();
  world.insertComponent(e1, new Health(100));

  const e2 = world.spawn();
  world.insertComponent(e2, new Health(80));
  world.insertComponent(e2, new Score(0));

  console.log('[Startup] Spawned 2 entities');
}

const damageSystem = params(Health).system((healths) => {
  for (const health of healths) {
    health.hp -= 5;
  }
});

// Detect newly added Health — Query with Added filter
const detectAdded = params(
  Query(Health, Added(Health))
).system((healths) => {
  for (const health of healths) {
    console.log(`  [Added] New entity with Health: hp=${health.hp}`);
  }
});

// Detect changed Health — Query with Changed filter
const detectChanged = params(
  Query(Health, Changed(Health))
).system((healths) => {
  for (const health of healths) {
    console.log(`  [Changed] Health changed to: hp=${health.hp}`);
  }
});

function printAll(world: World): void {
  console.log('  Status:');
  for (const [id, comps] of world.query(Health)) {
    const [health] = comps as [Health];
    console.log(`    Entity ${id}: hp=${health.hp}`);
  }
}

// ─── Mut<T> demo ───

function mutDemo(): void {
  console.log('\n=== Mut<T> Demo ===\n');

  const world = new World();
  const e = world.spawn();
  world.insertComponent(e, new Score(0));

  const scoreMut = world.getComponentMut(e, Score);
  if (scoreMut) {
    console.log(`  Peek: ${scoreMut.peek().value}`);

    const score = scoreMut.get();
    score.value += 100;
    console.log(`  Get + modify: ${score.value}`);
  }

  for (const [, comps] of world.queryFiltered([Score], [Changed(Score)])) {
    const [score] = comps as [Score];
    console.log(`  [Changed detected] Score=${score.value}`);
  }
}

// ─── Run ───

console.log('=== Change Tracking Demo ===\n');

const app = new App()
  .addStartupSystem(setup)
  .addSystem(damageSystem)
  .addSystem(detectChanged)
  .addSystem(printAll);

console.log('Running 3 ticks...\n');
app.run(3);

mutDemo();
