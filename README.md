# PureEcs

一个受 [Bevy](https://bevyengine.org/) 启发的 TypeScript ECS (Entity-Component-System) 框架。纯 TypeScript 实现，零依赖，强类型推断。

## 快速开始

```ts
import { App, World, params, Query, With, Without, Res, Cmd } from 'pureecs';

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

`params()` 还支持注入资源和命令，以单值（非数组）传入回调：

```ts
const system = params(Position, Velocity, Res(DeltaTime), Cmd())
  .system((positions, velocities, dt, commands) => {
    // positions: Position[], velocities: Velocity[]
    // dt: DeltaTime (单值，来自 world.getResource())
    // commands: Commands (单值，来自 world.commands)
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

### 系统本地状态：Local

`Local(factory)` 提供按系统隔离的可变状态，首次执行时惰性初始化，后续复用同一实例：

```ts
import { Local, params } from 'pureecs';

params(Position, Local(() => ({ total: 0 }))).system((positions, acc) => {
  acc.total += positions.length;
  console.log(`累计处理: ${acc.total}`);
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
| `.system(fn)` | 组件数组 + 资源/命令单值 | 操作组件、读资源、发命令 |
| `.systemWithEntity(fn)` | `entityIds` + 组件数组 + 资源/命令 | 需要实体 ID |
| `.systemWithWorld(fn)` | `world` + `entityIds` + 组件数组 + 资源/命令 | 需要访问 World |

```ts
// 需要实体 ID — 配合 systemWithEntity
params(Lifetime, Name).systemWithEntity((ids, lifetimes, names) => {
  for (let i = 0; i < ids.length; i++) {
    if (lifetimes[i].ticks <= 0) {
      console.log(`Entity ${ids[i]} expired!`);
    }
  }
});

// 注入资源 + 命令，避免手动取 world
params(Lifetime, Name, Res(DeltaTime), Cmd())
  .systemWithEntity((ids, lifetimes, names, dt, commands) => {
    for (let i = 0; i < ids.length; i++) {
      lifetimes[i].ticks -= dt.value;
      if (lifetimes[i].ticks <= 0) {
        commands.despawn({ id: ids[i], generation: 0 } as Entity);
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

## Plugin 机制

Plugin 将系统、资源、阶段等封装为可复用模块：

```ts
import { App, Plugin, PluginGroup, params, Res } from 'pureecs';

class PhysicsPlugin implements Plugin {
  build(app: App): void {
    app.insertResource(new Gravity(9.8));
    app.addSystem(gravitySystem);
    app.addSystem(Stages.PreUpdate, collisionSystem);
  }
}

class RenderPlugin implements Plugin {
  build(app: App): void {
    app.addSystem(Stages.PostUpdate, renderSystem);
  }
}

// 单个插件
new App().addPlugin(new PhysicsPlugin());

// 插件组 — 批量注册
const plugins = new PluginGroup()
  .add(new InputPlugin())
  .add(new PhysicsPlugin())
  .add(new RenderPlugin());

new App().addPlugin(plugins).update();
```

## 资源（Resource）

资源是全局单例数据，以 class 作为标识。通过 `Res()` 注入到系统中：

```ts
class GameConfig {
  constructor(public gravity: number = 9.8) {}
}
class Score {
  constructor(public value: number = 0) {}
}

// 插入
app.insertResource(new GameConfig(9.8));
app.insertResource(new Score());

// 在系统中通过 Res() 注入（单值）
params(Position, Res(GameConfig)).system((positions, config) => {
  for (const pos of positions) {
    pos.y -= config.gravity;
  }
});

// 也可以直接通过 world 访问
function mySystem(world: World): void {
  const config = world.getResource(GameConfig);
  if (config) {
    // 使用 config.gravity
  }
}
```

## 内置资源：Timer

`Timer` 是一个内置资源，用于跟踪经过时间，支持单次和重复模式：

```ts
import { Timer, TimerMode, ResMut, params } from 'pureecs';

// 插入定时器
app.insertResource(new Timer(2, TimerMode.Repeating));

// 在系统中使用
params(ResMut(Timer)).system((timer) => {
  timer.tick(0.016); // 每帧推进 16ms
  if (timer.justFinished()) {
    console.log('每 2 秒触发一次！');
  }
});
```

| 方法 | 描述 |
|------|------|
| `tick(delta)` | 推进计时器 |
| `finished()` | 是否已结束 |
| `justFinished()` | 是否刚结束（本 tick 内） |
| `reset()` | 重置为 0 |
| `fraction()` | 完成比例 [0, 1] |
| `remaining()` | 剩余时间 |
| `pause()` / `unpause()` | 暂停/恢复 |

## 内置资源：Time

`Time` 是全局时间资源，提供帧间隔（delta）和总运行时长。添加 `DefaultPlugin` 即可自动注入并每帧更新：

```ts
import { DefaultPlugin, Res, params } from 'pureecs';

const app = new App();
app.addPlugin(new DefaultPlugin()); // 自动注入 Time + 每帧更新
app.addSystem(movement);
app.update(); // 无需手动传 delta
```

`DefaultPlugin` 内部做了两件事：
1. `app.insertResource(new Time())`
2. 注册 `createTimeSystem()` 到 `Stages.First`，用 `Date.now()` 测量帧间隔

系统中直接读 `Res(Time)`即可：

```ts
params(Position, Velocity, Res(Time)).system((pos, vel, time) => {
  for (let i = 0; i < pos.length; i++) {
    pos[i].x += vel[i].x * time.delta;
  }
});

// 变速 / 暂停
params(Res(Time)).system((time) => {
  time.relativeSpeed = 0.5; // 慢放
  time.pause();             // 暂停
  time.unpause();           // 恢复
});
```

| 属性/方法 | 描述 |
|-----------|------|
| `update(delta)` | 每帧更新，传入真实秒数 |
| `delta` | 有效帧间隔（= realDelta × relativeSpeed，暂停时为 0） |
| `elapsed` | 总运行时长 |
| `relativeSpeed` | 时间倍速，默认 1.0 |
| `pause()` / `unpause()` / `paused()` | 暂停/恢复控制 |

## 命令（Commands）

Commands 提供延迟 World 变更机制——在系统执行期间排队，在阶段结束后批量应用，避免借用冲突。通过 `Cmd()` 注入：

```ts
// 注入 Commands
params(Position, Cmd()).system((positions, commands) => {
  commands.spawn()
    .with(new Position(10, 5))
    .with(new Velocity(-1, 0));
});
```

也可以直接通过 world 访问：

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
| `Res()` | 资源参数描述符 |
| `Cmd()` | 命令参数描述符 |
| `Local()` | 系统本地状态描述符，惰性初始化 |
| `With()` / `Without()` | 组件存在过滤器 |
| `Added()` / `Changed()` | 变更跟踪过滤器 |
| `Mut<T>` | 可变组件引用，标记变更 |
| `Stages` | 内置阶段：Startup / First / PreUpdate / Update / PostUpdate / Last |
| `Stage` | 自定义阶段 |
| `Commands` / `SpawnBuilder` | 延迟世界变更 |
| `Plugin` / `PluginGroup` / `DefaultPlugin` | 插件机制，`DefaultPlugin` 内置 Time |
| `createTimeSystem()` | 返回一个用 wall-clock 更新 Time 的系统 |
| `Timer` / `TimerMode` | 内置定时器资源，单次/重复模式 |
| `Time` | 全局时间资源，帧 delta + 总时长 + 变速 |
| `system()` | SystemBuilder 工厂函数 |

## License

MIT
