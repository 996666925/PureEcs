# PureEcs

一个受 [Bevy](https://bevyengine.org/) 启发的 TypeScript ECS (Entity-Component-System) 框架。纯 TypeScript 实现，零依赖，强类型推断。

## 快速开始

```ts
import { App, World, params, Query, With, Without } from 'pureecs';

// 1. 定义组件（普通 class）
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}
class Velocity {
  constructor(public x: number = 0, public y: number = 0) {}
}
class Name {
  constructor(public value: string = '') {}
}

// 2. 定义系统
function spawn(world: World): void {
  const player = world.spawn();
  world.insertComponent(player, new Position(0, 0));
  world.insertComponent(player, new Velocity(1, 0));
  world.insertComponent(player, new Name('Player'));
}

const movement = params(Position, Velocity).system((positions, velocities) => {
  for (let i = 0; i < positions.length; i++) {
    positions[i].x += velocities[i].x;
    positions[i].y += velocities[i].y;
  }
});

const print = params(Position, Name).system((positions, names) => {
  for (let i = 0; i < positions.length; i++) {
    console.log(`${names[i].value}: (${positions[i].x}, ${positions[i].y})`);
  }
});

// 3. 构建 App 并运行
new App()
  .addStartupSystem(spawn)
  .addSystem(movement)
  .addSystem(print)
  .update();
```

## 核心概念

### Entity（实体）

实体是组件的容器，使用带 generational indexing 的轻量 ID。

```ts
const entity = world.spawn();           // 生成实体
world.despawn(entity);                  // 销毁实体
world.isAlive(entity);                  // 检查实体是否存活
```

### Component（组件）

组件是纯 TypeScript class——不需要注册、不需要继承。

```ts
class Health {
  constructor(public hp: number = 100) {}
}
class Poisoned {}
```

通过 `world` 进行 CRUD：

```ts
world.insertComponent(entity, new Health(80));
world.getComponent(entity, Health);     // Health | undefined
world.removeComponent(entity, Health);
world.hasComponent(entity, Health);     // boolean
```

### System（系统）

系统是一个接收 `World` 并对其进行操作的函数。通过 `params()` 构建器声明式定义查询：

```ts
const system = params(Position, Velocity).system((positions, velocities) => {
  // positions: Position[], velocities: Velocity[]
  // 匹配同时拥有 Position 和 Velocity 的实体
});
```

## 查询与过滤

### 多组件合并查询（Tuple AoS）

`Query()` 内传入多个组件，返回 tuple 数组：

```ts
const sys = params(Query(Position, Hp)).system((rows) => {
  // rows: [Position, Hp][]
  for (const [pos, hp] of rows) {
    pos.x += 1;
    hp.value -= 5;
  }
});
```

### 过滤器：With / Without

```ts
import { Query, With, Without } from 'pureecs';

// 仅敌人（拥有 Enemy 组件，不含 Player 组件）
const enemySys = params(
  Query(Position, With(Enemy), Without(Player))
).system((positions) => {
  // positions: Position[]
});
```

### 变更追踪：Added / Changed

```ts
import { Query, Added, Changed } from 'pureecs';

// 仅新添加 Health 的实体
params(Query(Health, Added(Health))).system((healths) => {
  // ...
});

// 仅 Health 发生变化的实体
params(Query(Health, Changed(Health))).system((healths) => {
  // ...
});
```

### Mut<T> —— 标记变化

通过 `world.getComponentMut()` 获取可变引用，修改时会自动标记变化：

```ts
const scoreMut = world.getComponentMut(entity, Score);
if (scoreMut) {
  const score = scoreMut.get();  // 标记 changed
  score.value += 100;
}
```

## 系统变体

| 方法 | 额外参数 | 适用场景 |
|------|---------|---------|
| `.system(fn)` | 组件数组 | 只操作组件数据 |
| `.systemWithEntity(fn)` | `entityIds` + 组件数组 | 需要实体 ID |
| `.systemWithWorld(fn)` | `world` + `entityIds` + 组件数组 | 需要访问 World |

```ts
// 需要实体 ID — 配合 systemWithEntity
params(Lifetime, Name).systemWithEntity((ids, lifetimes, names) => {
  for (let i = 0; i < ids.length; i++) {
    if (lifetimes[i].ticks <= 0) {
      console.log(`Entity ${ids[i]} expired!`);
    }
  }
});

// 需要访问 World（例如 despawn、读资源）— 用 systemWithWorld
params(Lifetime, Name).systemWithWorld((world, ids, lifetimes, names) => {
  for (let i = 0; i < ids.length; i++) {
    if (lifetimes[i].ticks <= 0) {
      world.commands.despawn({ id: ids[i], generation: 0 } as Entity);
    }
  }
});
```

## 阶段调度

系统按阶段执行，内置阶段镜像 Bevy 的调度模型：

```
First → PreUpdate → Update → PostUpdate → Last
```

```ts
import { App, Stages } from 'pureecs';

new App()
  .addSystem(Stages.PreUpdate, inputSystem)
  .addSystem(movementSystem)                          // 默认 Stages.Update
  .addSystem(Stages.PostUpdate, renderSystem);
```

### 自定义阶段

```ts
const PhysicsStage = new Stage('Physics');

new App()
  .addStageAfter(PhysicsStage, Stages.PreUpdate)      // PreUpdate → Physics → Update
  .addSystem(Stages.PreUpdate, input)
  .addSystem(PhysicsStage, physics)
  .addSystem(movement);
```

### 排序约束

```ts
app.addSystem(Stages.PostUpdate, audio, { after: [render] });
// audio 在 render 之后、同一阶段内其他系统之前执行
```

## 资源（Resource）

资源是全局单例数据，以 class 作为标识：

```ts
class GameConfig {
  constructor(public gravity: number = 9.8) {}
}

// 插入
app.insertResource(new GameConfig(9.8));

// 在系统中读取
function mySystem(world: World): void {
  const config = world.getResource(GameConfig);
  if (config) {
    // 使用 config.gravity
  }
}
```

## 命令（Commands）

Commands 提供延迟 World 变更机制——在系统执行期间排队，在阶段结束后批量应用，避免借用冲突：

```ts
function spawnEnemy(world: World): void {
  world.commands.spawn()
    .with(new Position(10, 5))
    .with(new Velocity(-1, 0))
    .with(new Name('Enemy'));
}

function killEntity(world: World, entity: Entity): void {
  world.commands.despawn(entity);
}
```

## 实体生成索引

实体 ID 使用代际索引。反序列化（despawn）后，之前的 Entity 引用会"失效"——即使索引被新实体复用，旧引用也不会再匹配：

```ts
const e1 = world.spawn();       // Entity(0v0)
world.despawn(e1);
const e2 = world.spawn();       // Entity(0v1) — 不同的 generation

world.isAlive(e1);              // false
world.isAlive(e2);              // true
```

## API 总览

| 导出 | 描述 |
|------|------|
| `App` | 应用入口，持有 World |
| `World` | ECS 核心：实体、组件、资源、系统调度 |
| `Entity` | 实体标识符 |
| `params()` | 系统构建器函数 |
| `Query()` | 查询描述符 |
| `With()` / `Without()` | 组件存在过滤器 |
| `Added()` / `Changed()` | 变更跟踪过滤器 |
| `Mut<T>` | 可变组件引用，标记变更 |
| `Stages` | 内置阶段：Startup / First / PreUpdate / Update / PostUpdate / Last |
| `Stage` | 自定义阶段 |
| `Commands` / `SpawnBuilder` | 延迟世界变更 |
| `system()` | SystemBuilder 工厂函数 |

## License

MIT
