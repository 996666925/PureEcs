/**
 * System ordering example: stages + before/after + Query() with filters.
 *
 * Run: npx tsx examples/07-system-ordering.ts
 */

import { App, World, params, Query, system, Stages, Stage, With, Without } from '../src/index';

// ─── Define Components ───

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public x: number = 0, public y: number = 0) {}
}

class RenderData {
  constructor(public lastX: number = 0, public lastY: number = 0) {}
}

class Enemy {}
class Player {}

// ─── Define Systems ───

const input = params(Velocity).system((velocities) => {
  console.log('  [PreUpdate] input: setting velocity');
  for (const vel of velocities) {
    vel.x = 1;
  }
});

const movement = params(Position, Velocity).system((positions, velocities) => {
  console.log('  [Update] movement: applying velocity');
  for (let i = 0; i < positions.length; i++) {
    positions[i].x += velocities[i].x;
    positions[i].y += velocities[i].y;
  }
});

const render = params(Position, RenderData).system((positions, renderDatas) => {
  console.log('  [PostUpdate] render: drawing');
  for (let i = 0; i < positions.length; i++) {
    renderDatas[i].lastX = positions[i].x;
    renderDatas[i].lastY = positions[i].y;
  }
});

function setup(world: World): void {
  const e = world.spawn();
  world.insertComponent(e, new Position(0, 0));
  world.insertComponent(e, new Velocity(0, 0));
  world.insertComponent(e, new RenderData(0, 0));
}

// ─── Approach 1: Stage options ───

console.log('=== Approach 1: Stage Options ===\n');

const app1 = new App()
  .addStartupSystem(setup)
  .addSystem(Stages.PreUpdate, input)
  .addSystem(movement)
  .addSystem(Stages.PostUpdate, render);

console.log('Tick 1:');
app1.update();

// ─── Approach 2: system() builder ───

console.log('\n=== Approach 2: system() Builder ===\n');

const app2 = new App()
  .addStartupSystem(setup)
  .addSystemConfig(system(input).inStage(Stages.PreUpdate))
  .addSystemConfig(system(movement).inStage(Stages.Update))
  .addSystemConfig(system(render).inStage(Stages.PostUpdate));

console.log('Tick 1:');
app2.update();

// ─── Approach 3: Custom stage ───

console.log('\n=== Approach 3: Custom Stages ===\n');

const PhysicsStage = new Stage('Physics');

const physicsSys = params(Position, Velocity).system((positions, velocities) => {
  for (let i = 0; i < positions.length; i++) {
    console.log(`  [Physics] pos=(${positions[i].x}, ${positions[i].y})`);
  }
});

const app3 = new App()
  .addStartupSystem(setup)
  .addStageAfter(PhysicsStage, Stages.PreUpdate)
  .addSystem(Stages.PreUpdate, input)
  .addSystem(PhysicsStage, physicsSys)
  .addSystem(Stages.Update, movement)
  .addSystem(Stages.PostUpdate, render);

console.log('Stage order: PreUpdate -> Physics -> Update -> PostUpdate\n');
console.log('Tick 1:');
app3.update();

// ─── Approach 4: Stage + before/after ───

console.log('\n=== Approach 4: Stage + before/after ===\n');

const audio = params(Position).system((positions) => {
  for (const pos of positions) {
    console.log(`  [PostUpdate] audio at (${pos.x}, ${pos.y})`);
  }
});

const app4 = new App()
  .addStartupSystem(setup)
  .addSystem(Stages.PreUpdate, input)
  .addSystem(Stages.Update, movement)
  .addSystemConfig(system(audio).inStage(Stages.PostUpdate).after(render))
  .addSystemConfig(system(render).inStage(Stages.PostUpdate));

console.log('Tick 1:');
app4.update();

// ─── Approach 5: Query() with With/Without filters ───

console.log('\n=== Approach 5: Query() with Scoped Filters ===\n');

function setupFilters(world: World): void {
  const p = world.spawn();
  world.insertComponent(p, new Position(0, 0));
  world.insertComponent(p, new Player);

  const e1 = world.spawn();
  world.insertComponent(e1, new Position(5, 5));
  world.insertComponent(e1, new Enemy);

  const e2 = world.spawn();
  world.insertComponent(e2, new Position(10, 10));
  world.insertComponent(e2, new Enemy);
}

// Only process enemies — Query() scopes filters to the specific fetch
const enemyMovement = params(
  Query(Position, With(Enemy), Without(Player))
).system((positions) => {
  for (const pos of positions) {
    console.log(`  Enemy at (${pos.x}, ${pos.y})`);
  }
});

const app5 = new App()
  .addStartupSystem(setupFilters)
  .addSystem(enemyMovement);

console.log('Tick 1:');
app5.update();
