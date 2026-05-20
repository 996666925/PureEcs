/**
 * Commands example with Query(Entity) for per-entity access.
 *
 * Run: npx tsx examples/03-commands.ts
 */

import { App, World, params, Query, Entity } from '../src/index';

// ─── Define Components ───

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Name {
  constructor(public value: string = '') {}
}

class Timer {
  constructor(public remaining: number = 0) {}
}

// ─── Define Systems ───

function setup(world: World): void {
  world.commands.spawn()
    .with(new Position(0, 0))
    .with(new Name('Timer Entity'))
    .with(new Timer(3));

  world.commands.spawn()
    .with(new Position(5, 5))
    .with(new Name('Persistent Entity'));

  console.log('[Startup] Spawned 2 entities via commands');
}

// Use Query() for AND-joined per-entity tuples
const timerSystem = params(Query(Timer, Name, Entity)).system((rows) => {
  for (const [timer, name, entity] of rows) {
    timer.remaining--;
    console.log(`  ${name.value} timer: ${timer.remaining}`);
    if (timer.remaining <= 0) {
      console.log(`  ${name.value} (${entity}) expired!`);
    }
  }
});

const printSystem = params(Query(Name, Position, Entity)).system((rows) => {
  for (const [name, pos, entity] of rows) {
    console.log(`  ${name.value} (${entity}): (${pos.x}, ${pos.y})`);
  }
});

// ─── Run ───

console.log('=== Commands Demo ===\n');

const app = new App()
  .addStartupSystem(setup)
  .addSystem(timerSystem)
  .addSystem(printSystem);

console.log('Running 5 ticks...\n');
app.run(5);
