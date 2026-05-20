/**
 * Basic example: params().system() with automatic type inference (SoA arrays).
 *
 * Run: npx tsx examples/01-basic.ts
 */

import { App, Cmd, Res, Stages, World, params } from '../src/index';

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

  console.log('[Startup] Spawned entities');
}

// ✨ params().system() — callback parameters are auto-typed arrays!
const movementSystem = params(Position, Velocity).system((positions, velocities) => {
  // positions: Position[], velocities: Velocity[]
  for (let i = 0; i < positions.length; i++) {
    positions[i].x += velocities[i].x;
    positions[i].y += velocities[i].y;
  }
});

const printSystem = params(Position, Name).system((positions, names) => {
  for (let i = 0; i < positions.length; i++) {
    console.log(`  ${names[i].value}: (${positions[i].x.toFixed(1)}, ${positions[i].y.toFixed(1)})`);
  }
});

export class TestResource {

}

const testSystem = params(Position, Res(TestResource), Cmd()).system((positions, res, cmd) => {

  console.log(res);
  console.log(cmd);

});

// ─── Run ───

const app = new App()
  .addStartupSystem(spawnEntities)
  .addSystem(Stages.Startup, movementSystem)
  .addSystem(printSystem)
  .insertResource(new TestResource())
  .addSystem(testSystem);
  
app.update();
