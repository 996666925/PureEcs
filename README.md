# PureEcs

一个受 [Bevy](https://bevyengine.org/) 启发的 TypeScript ECS (Entity-Component-System) 框架。纯 TypeScript 实现，零依赖，强类型推断。

## 快速开始

```ts
import { App, World, params, Query } from 'pureecs';

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

const movement = params(Query(Position, Velocity)).system((rows) => {
  // rows: [Position, Velocity][] — AND-joined per entity
  for (const [pos, vel] of rows) {
    pos.x += vel.x;
    pos.y += vel.y;
  }
});

const print = params(Query(Position, Name)).system((rows) => {
  for (const [pos, name] of rows) {
    console.log(`${name.value}: (${pos.x}, ${pos.y})`);
  }
});

// 3. 构建 App 并运行
new App()
  .addStartupSystem(spawn)
  .addSystem(movement)
  .addSystem(print)
  .update();
```

## 测试与 Benchmark

```bash
pnpm test
pnpm benchmark
```

Benchmark 默认使用 10,000 个实体执行 100 次联合查询，可通过
`BENCH_ENTITIES` 和 `BENCH_ITERATIONS` 调整规模。每次 push 或 pull request
都会由 GitHub Actions 自动执行构建、测试和 benchmark。benchmark action 会将
`main` 分支的结果保存为历史基线，并在后续提交或 PR 中逐项计算耗时变化；单项
变慢达到 5% 时会在检查结果中告警。

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
// 纯组件描述符是独立查询 — 无 AND 关系
const system = params(Position, Velocity).system((positions, velocities) => {
  // positions: 所有拥有 Position 的实体
  // velocities: 所有拥有 Velocity 的实体（独立查询）
});

// 如果需要处理同一个实体的多个组件，请使用 Query()：
// 它只遍历一次，并保证组件来自同一个实体
const movement = params(Query(Position, Velocity)).system((rows) => {
  for (const [position, velocity] of rows) {
    position.x += velocity.x;
  }
});
```

`params()` 还支持注入必需资源和命令，以单值（非数组）传入回调。缺少 `Res()`
声明的资源时，系统会抛出包含资源类型的错误：

```ts
const system = params(Position, Velocity, Res(DeltaTime), Cmd())
  .system((positions, velocities, dt, commands) => {
    // positions: Position[], velocities: Velocity[]
    // dt: DeltaTime (单值，来自 world.getResource())
    // commands: Commands (单值，来自 world.commands)
  });
```

## 查询与过滤

### 多组件联合查询（Tuple AoS）

`Query()` 内传入多个组件，返回 tuple 数组。**仅返回同时拥有所有组件的实体**（AND 语义），与纯组件描述符的独立查询不同：

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

### 单实体查询：Single

`Single()` 与 `Query()` 用法完全一致，但只取**第一个**匹配实体的组件，作为单值（可能为 `undefined`）：

```ts
import { Single, With } from 'pureecs';

// 单组件
params(Single(Player)).system((player) => {
  // player: Player | undefined
  if (player) console.log(`玩家位置: (${player.x}, ${player.y})`);
});

// 多组件元组
params(Single(Position, Velocity)).system((movement) => {
  // movement: [Position, Velocity] | undefined
  if (movement) {
    const [pos, vel] = movement;
    pos.x += vel.x;
  }
});

// 带过滤器
params(Single(Camera, With(Active))).system((camera) => {
  // camera: Camera | undefined
  if (camera) camera.zoom += 0.1;
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

### ResMut<T> —— 可变资源

`ResMut()` 注入一个资源的可变包装器。调用 `get()` 会标记资源在当前 tick
发生变化，`peek()` 只读且不会标记。它与 `world.getResourceMut()` 返回相同的
`ResourceMut<T>` 包装器：

```ts
params(ResMut(GameState)).system((stateMut) => {
  const state = stateMut.get();
  state.score += 1;
});
```

可通过 `world.isResourceChanged(GameState)` 在当前 tick 内检查变更。

## 系统变体

| 方法 | 额外参数 | 适用场景 |
|------|---------|---------|
| `.system(fn)` | 组件数组 + 资源/命令单值 | 操作组件、读资源、发命令 |
| `.systemForEach(fn)` | 单个 `Query()` 的组件逐实体传入 | 高频查询，避免结果数组和 tuple 分配 |
| `.systemWithWorld(fn)` | `world` + `entityIds` + 组件数组 + 资源/命令 | 需要访问 World |

`systemForEach()` 是单个 `Query()` 的无分配快捷路径。组件会作为位置参数传入，
不会创建查询结果数组或每实体 tuple：

```ts
params(Query(Position, Velocity)).systemForEach((position, velocity) => {
  position.x += velocity.x;
});
```

它只接受一个 `Query()` 描述符；需要资源、命令或多个参数时请使用 `.system()`。

```ts
// 推荐：用 Query(Entity, ...) 获取实体 ID（Guaranteed alignment）
params(Query(Lifetime, Name, Entity), Cmd())
  .system((rows, commands) => {
    // rows: [Lifetime, Name, Entity][]
    for (const [lifetime, name, entity] of rows) {
      if (lifetime.ticks <= 0) {
        commands.despawn(entity);
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

### 条件系统与系统集

系统可按条件执行，也可以加入 `SystemSet` 共享条件、启停状态和排序约束：

```ts
import { SystemSet, system } from 'pureecs';

const gameplay = new SystemSet('gameplay')
  .runIf((world) => !world.getResource(GamePaused)?.value);

app.addSystemConfig(
  system(move).inSet(gameplay).runIf(() => playerReady)
);

gameplay.enabled(false); // 暂停整个系统集
```

`system(fn).enabled(false)` 可单独禁用系统；`beforeSet()` / `afterSet()`
可声明同一阶段内相对于系统集的顺序。系统和目标系统集必须在同一阶段，
跨阶段顺序由阶段本身决定。

## Plugin 机制

Plugin 将系统、资源、阶段等封装为可复用模块：

```ts
import { App, Plugin, PluginGroup, InputPlugin, Stages } from 'pureecs';

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

## 输入系统（Input）

`InputPlugin` 提供 Bevy 风格的键盘和鼠标输入追踪，默认监听 `document`，自动维护三种状态：

- **pressed** — 当前是否按住
- **justPressed** — 当前帧刚按下
- **justReleased** — 当前帧刚松开

```ts
import { App, InputPlugin, params, Res, KeyboardInput, MouseInput, MousePosition, MouseWheel, InputTarget } from 'pureecs';

// 默认监听 document
const app = new App()
  .addPlugin(new InputPlugin());

// 或指定目标元素（如 canvas）
app.insertResource(new InputTarget(canvas));
// 可选阻止默认事件（如滚轮缩放）
app.insertResource(new InputTarget(canvas, /* preventDefault */ true));

// 在系统中通过 Res() 读取输入
params(Res(KeyboardInput), Res(MouseInput), Res(MousePosition), Res(MouseWheel))
  .system((keys, mouseButtons, cursor, wheel) => {
    // keys: KeyboardInput — 拥有完整的 KeyCode 自动完成
    if (keys.justPressed('Space'))        jump();
    if (keys.pressed('KeyW'))             moveForward();
    if (keys.anyPressed(['KeyA', 'KeyD'])) strafe();

    if (mouseButtons.justPressed('Left'))  fire();

    // 鼠标
    lookAt(cursor.x, cursor.y);

    // 滚轮
    if (wheel.y !== 0) zoom(wheel.y);
  });
```

| 类 | 类型 | 描述 |
|---|---|---|
| `KeyboardInput` | resource | 键盘输入状态，继承 `Input<KeyCode>`；`KeyCode` 为 `'KeyW'`、`'Space'`、`'ArrowUp'` 等 ~80 个标准键的联合类型 |
| `MouseInput` | resource | 鼠标按钮状态，继承 `Input<MouseButton>`；`MouseButton` = `'Left' \| 'Right' \| 'Middle' \| 'Back' \| 'Forward'` |
| `MousePosition` | resource | 当前光标坐标 + `inBounds` |
| `MouseWheel` | resource | 帧内累积滚轮增量 |
| `InputTarget` | resource（可选） | 指定事件监听目标元素，不设置则默认 `document` |
| `InputPlugin` | plugin | 注册所有 input 资源 + 自动监听 + 清理 |

当应用不再使用时调用 `app.destroy()`。它会按插件注册的反向顺序清理插件持有的外部资源，
`InputPlugin` 会移除已注册的 DOM 事件监听器；销毁后的 App 不能再次运行或配置。

## 资源（Resource）

资源是全局单例数据，以 class 作为标识。通过 `Res()` 注入到系统中；缺失的必需资源会在系统执行时抛出明确错误。

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
  const value = timer.get();
  value.tick(0.016); // 每帧推进 16ms
  if (value.justFinished()) {
    console.log('每 2 秒触发一次！');
  }
});
```

| 方法 | 描述 |
|------|------|
| `tick(delta)` | 推进计时器（`delta` 必须是非负有限数） |
| `finished()` | 是否已结束 |
| `justFinished()` | 是否刚结束（本 tick 内） |
| `reset()` | 重置为 0 |
| `fraction()` | 完成比例 [0, 1] |
| `remaining()` | 剩余时间 |
| `pause()` / `unpause()` | 暂停/恢复 |

## 内置资源：Time

`Time` 是全局时间资源，提供帧间隔（delta）和总运行时长。添加 `DefaultPlugin` 即可自动注入并每帧更新：

```ts
import { DefaultPlugin, Query, Res, params } from 'pureecs';

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
params(Query(Position, Velocity), Res(Time)).system((rows, time) => {
  for (const [pos, vel] of rows) {
    pos.x += vel.x * time.delta;
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

## 事件

事件按类型注册，写入后可在同一 tick 的后续系统中读取，并在 tick 结束时自动清空：

```ts
import { App, EventReader, EventWriter, params } from 'pureecs';

class Damage {
  constructor(public amount: number) {}
}

const app = new App()
  .addEvent(Damage)
  .addSystem(params(EventWriter(Damage)).system((writer) => {
    writer.send(new Damage(10));
  }))
  .addSystem(params(EventReader(Damage)).system((reader) => {
    for (const event of reader.read()) {
      console.log(event.amount);
    }
  }));
```

`EventWriter(Type)` 只负责发送，`EventReader(Type)` 为每个系统维护独立读取游标。
读取器只能看到其执行前已发送的事件，因此发送系统应排在读取系统之前；所有
事件都会在 tick 结束时清空。

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
| `Query()` | 多实体查询描述符，返回数组 |
| `Single()` | 单实体查询描述符，返回单值 (或 `undefined`) |
| `Res()` / `ResMut()` | 资源读 / 可变资源参数描述符 |
| `Cmd()` | 命令参数描述符 |
| `Local()` | 系统本地状态描述符，惰性初始化 |
| `With()` / `Without()` | 组件存在过滤器 |
| `Added()` / `Changed()` | 变更跟踪过滤器 |
| `Mut<T>` / `ResourceMut<T>` | 可变组件 / 资源引用，调用 `get()` 标记变更 |
| `Stages` | 内置阶段：Startup / First / PreUpdate / Update / PostUpdate / Last |
| `Stage` | 自定义阶段 |
| `Commands` / `SpawnBuilder` | 延迟世界变更 |
| `Events` / `EventWriter` / `EventReader` | 按类型发送和读取帧内事件 |
| `SystemSet` | 共享系统条件、启停和排序约束 |
| `App.destroy()` | 清理插件资源（包括输入事件监听） |
| `Plugin` / `PluginGroup` / `DefaultPlugin` | 插件机制，`DefaultPlugin` 内置 Time（输入请显式添加 `InputPlugin`） |
| `Input` | 泛型输入追踪器基类，记录 pressed/justPressed/justReleased |
| `KeyboardInput` / `MouseInput` | 可通过 `Res()` 注入的键盘 / 鼠标按钮资源 |
| `InputPlugin` | 输入插件，默认监听 document 上的键鼠事件 |
| `InputTarget` | 可选资源，指定事件监听目标元素 |
| `MousePosition` / `MouseWheel` | 鼠标位置 / 滚轮增量资源 |
| `KeyCode` / `MouseButton` | 键码 / 鼠标按钮类型 |
| `createTimeSystem()` | 返回一个用 wall-clock 更新 Time 的系统 |
| `Timer` / `TimerMode` | 内置定时器资源，单次/重复模式 |
| `Time` | 全局时间资源，帧 delta + 总时长 + 变速 |
| `system()` / `SystemBuilder` | 系统配置与条件、系统集、排序构建器 |

## License

MIT
