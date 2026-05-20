/**
 * Commands example with params().systemWithWorld() for World access.
 *
 * Run: npx tsx examples/03-commands.ts
 */

import { App, World, params } from '../src/index';

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

// systemWithWorld gives access to world + entity IDs array + typed component arrays
const timerSystem = params(Timer, Name).systemWithWorld((world, ids, timers, names) => {
  for (let i = 0; i < ids.length; i++) {
    timers[i].remaining--;
    console.log(`  ${names[i].value} timer: ${timers[i].remaining}`);
    if (timers[i].remaining <= 0) {
      console.log(`  ${names[i].value} expired!`);
    }
  }
});

const printSystem = params(Name, Position).systemWithEntity((ids, names, positions) => {
  for (let i = 0; i < ids.length; i++) {
    console.log(`  ${names[i].value} (${ids[i]}): (${positions[i].x}, ${positions[i].y})`);
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
