/**
 * Resources example with params().system() for typed iteration.
 *
 * Run: npx tsx examples/04-resources.ts
 */

import { App, World, params } from '../src/index';

// ─── Define Resources ───

class GameConfig {
  constructor(
    public gravity: number = 9.8,
    public timeScale: number = 1.0,
    public maxEntities: number = 1000,
  ) {}
}

class Score {
  constructor(public value: number = 0) {}
}

class TickCounter {
  constructor(public count: number = 0) {}
}

// ─── Define Components ───

class Velocity {
  constructor(public y: number = 0) {}
}

class Position {
  constructor(public y: number = 0) {}
}

// ─── Define Systems ───

function readConfig(world: World): void {
  const config = world.getResource(GameConfig);
  if (config) {
    console.log(`  Config: gravity=${config.gravity}, timeScale=${config.timeScale}`);
  }
}

// Typed query iteration for physics — arrays for cache-friendly access
const physicsSystem = params(Position, Velocity).systemWithWorld((world, ids, positions, velocities) => {
  const config = world.getResource(GameConfig);
  if (!config) return;
  for (let i = 0; i < positions.length; i++) {
    velocities[i].y += config.gravity * config.timeScale * 0.016;
    positions[i].y += velocities[i].y * config.timeScale * 0.016;
  }
});

function scoreSystem(world: World): void {
  const score = world.getResource(Score);
  if (score) {
    score.value += 10;
    console.log(`  Score: ${score.value}`);
  }
}

function tickCounter(world: World): void {
  const counter = world.getResource(TickCounter);
  if (counter) counter.count++;
}

function printState(world: World): void {
  const counter = world.getResource(TickCounter);
  const score = world.getResource(Score);
  console.log(`  Tick: ${counter?.count ?? '?'}, Score: ${score?.value ?? '?'}`);

  for (const [id, comps] of world.query(Position, Velocity)) {
    const [pos, vel] = comps as [Position, Velocity];
    console.log(`  Entity ${id}: y=${pos.y.toFixed(2)}, vy=${vel.y.toFixed(2)}`);
  }
}

// ─── Run ───

console.log('=== Resources Demo ===\n');

const app = new App()
  .insertResource(new GameConfig(9.8, 1.0, 1000))
  .insertResource(new Score(0))
  .insertResource(new TickCounter(0));

app.addStartupSystem((world) => {
  const e = world.spawn();
  world.insertComponent(e, new Position(100));
  world.insertComponent(e, new Velocity(0));
});

app.addSystem(readConfig)
  .addSystem(physicsSystem)
  .addSystem(scoreSystem)
  .addSystem(tickCounter)
  .addSystem(printState);

console.log('Running 5 ticks...\n');
app.run(5);

console.log('\n--- Updating timeScale to 2.0 ---\n');
const config = app.world.getResource(GameConfig);
if (config) config.timeScale = 2.0;

app.run(3);
