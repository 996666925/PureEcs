import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';

import { QueryEngine, World } from '../dist/pureecs.mjs';

class Position {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

class Velocity {
  constructor(x = 1, y = 1) {
    this.x = x;
    this.y = y;
  }
}

class Active {}

const entityCount = Number(process.env.BENCH_ENTITIES ?? 10_000);
const iterations = Number(process.env.BENCH_ITERATIONS ?? 100);
const setupIterations = Math.min(iterations, 10);
const results = [];

if (!Number.isSafeInteger(entityCount) || entityCount < 1) {
  throw new RangeError('BENCH_ENTITIES must be a positive integer');
}
if (!Number.isSafeInteger(iterations) || iterations < 1) {
  throw new RangeError('BENCH_ITERATIONS must be a positive integer');
}

function createWorld() {
  const world = new World();
  for (let i = 0; i < entityCount; i++) {
    const entity = world.spawn();
    world.insertComponent(entity, new Position(i, i));
    if (i % 2 === 0) world.insertComponent(entity, new Velocity(1, 1));
    if (i % 4 === 0) world.insertComponent(entity, new Active());
  }
  return world;
}

function measure(name, operations, fn, count = iterations) {
  fn();
  const started = performance.now();
  let checksum = 0;
  for (let i = 0; i < count; i++) checksum += fn();
  const elapsedMs = performance.now() - started;
  const totalOperations = operations * count;
  const throughput = totalOperations / (elapsedMs / 1_000);
  console.log(
    `${name}: ${elapsedMs.toFixed(2)} ms | `
    + `${throughput.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec | `
    + `checksum ${checksum}`,
  );
  results.push({ name, unit: 'ms', value: elapsedMs });
  return elapsedMs;
}

console.log(`PureEcs benchmark (${entityCount.toLocaleString()} entities, ${iterations} iterations)`);

measure(
  'spawn + insert Position/Velocity',
  entityCount * 2,
  () => {
    createWorld();
    return entityCount;
  },
  setupIterations,
);

const world = createWorld();
const positionQuery = new QueryEngine([Position]);
const movementQuery = new QueryEngine([Position, Velocity]);
const activeMovementQuery = new QueryEngine(
  [Position, Velocity],
  [{ type: 'with', component: Active }],
);

measure('getComponent lookup', entityCount, () => {
  let checksum = 0;
  for (let i = 0; i < entityCount; i++) {
    checksum += world.getComponent(world.getEntityById(i), Position)?.x ?? 0;
  }
  return checksum;
});

measure('QueryEngine.forEach Position', entityCount, () => {
  let checksum = 0;
  positionQuery.forEach(world, (_entityId, components) => {
    checksum += components[0].x;
  });
  return checksum;
});

measure('QueryEngine.forEach Position + Velocity', entityCount / 2, () => {
  let checksum = 0;
  movementQuery.forEach(world, (_entityId, components) => {
    const position = components[0];
    const velocity = components[1];
    position.x += velocity.x;
    checksum += position.x;
  });
  return checksum;
});

measure('QueryEngine.forEach with With(Active)', entityCount / 4, () => {
  let checksum = 0;
  activeMovementQuery.forEach(world, (_entityId, components) => {
    checksum += components[0].y + components[1].y;
  });
  return checksum;
});

measure('QueryEngine.iter Position + Velocity', entityCount / 2, () => {
  let checksum = 0;
  for (const [_entityId, components] of movementQuery.iter(world)) {
    checksum += components[0].x + components[1].y;
  }
  return checksum;
});

measure(
  'despawn entities',
  entityCount / 2,
  () => {
    const temporaryWorld = createWorld();
    let checksum = 0;
    for (let i = 0; i < entityCount; i += 2) {
      checksum += temporaryWorld.despawn(temporaryWorld.getEntityById(i)) ? 1 : 0;
    }
    return checksum;
  },
  setupIterations,
);

if (process.env.BENCHMARK_OUTPUT) {
  writeFileSync(process.env.BENCHMARK_OUTPUT, `${JSON.stringify(results, null, 2)}\n`);
}
