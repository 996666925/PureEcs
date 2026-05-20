/**
 * Basic example: params().system() with automatic type inference (SoA arrays).
 *
 * Run: npx tsx examples/01-basic.ts
 */

import { App, Cmd, DefaultPlugin, Entity, Query, Res, Stages, Time, Timer, TimerMode, Without, World, params } from '../src/index';
import { Local } from '../src/system';

// ─── Define Components ───

class Position {
  constructor(public x: number = 0, public y: number = 0) { }
}

class Velocity {
  constructor(public x: number = 0, public y: number = 0) { }
}

class Name {
  constructor(public value: string = '') { }
}

// ─── Define Systems ───

function spawnEntities(world: World): void {
  const player = world.spawn();
  world.insertComponent(player, new Position(0, 0));
  world.insertComponent(player, new Velocity(1, 0));
  world.insertComponent(player, new Name('Player'));

  world.commands.spawn()
    .with(new Position(10, 5))
    .with(new Velocity(-1, 1))
    .with(new Name('Enemy'));

  world.commands.spawn()
    .with(new Position(3, 7))
    .with(new Name('Static Object'));

  world.commands.spawn()
    .with(new Name('C'));

  console.log('[Startup] Spawned entities');
}

// ✨ params().system() — callback parameters are auto-typed arrays!
// Use Query() for AND-joined per-entity tuples (recommended)
const movementSystem = params(Query(Position, Velocity)).system((rows) => {
  // rows: [Position, Velocity][]
  for (const [pos, vel] of rows) {
    pos.x += vel.x;
    pos.y += vel.y;
  }
});

const printSystem = params(Query(Position, Name)).system((rows) => {
  for (const [pos, name] of rows) {
    console.log(`  ${name.value}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
  }
});

const testSystem = params(Local(() => ({ a: 233 })), Query(Position, Entity), Res(Time), Cmd())
  .system((state, queries, time, cmd) => {
    console.log(state);
    console.log(time.delta);
  });
// ─── Run ───

const app = new App()
  .addPlugin(new DefaultPlugin())
  .addStartupSystem(spawnEntities)
  .addSystem(Stages.Startup, movementSystem)
  .addSystem(printSystem)
  .insertResource(new Timer(2, TimerMode.Repeating))
  .addSystem(testSystem);

app.update();
