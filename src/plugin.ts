import type { App } from './app';
import { Time } from './timer';
import type { SystemFn } from './scheduler';
import { Stages } from './scheduler';
import { params, Res } from './system';
import { InputPlugin } from './input';

/**
 * A plugin encapsulates reusable logic — systems, resources, stages, etc.
 * Implement `build()` to register everything with the App.
 *
 * @example
 * ```ts
 * class PhysicsPlugin implements Plugin {
 *   build(app: App): void {
 *     app.insertResource(new Gravity(9.8));
 *     app.addSystem(gravitySystem);
 *     app.addSystem(PhysicsStage, collisionSystem);
 *   }
 * }
 * ```
 */
export interface Plugin {
  build(app: App): void;
}

/**
 * A group of plugins that are added to the App together.
 * PluginGroup itself implements Plugin, so it can be nested.
 *
 * @example
 * ```ts
 * const core = new PluginGroup()
 *   .add(new InputPlugin())
 *   .add(new PhysicsPlugin())
 *   .add(new RenderPlugin());
 *
 * new App().addPlugin(core).update();
 * ```
 */
export class PluginGroup implements Plugin {
  private plugins: Plugin[] = [];

  add(plugin: Plugin): this {
    this.plugins.push(plugin);
    return this;
  }

  build(app: App): void {
    for (const plugin of this.plugins) {
      plugin.build(app);
    }
  }
}

/**
 * Create a system that updates the `Time` resource each frame
 * using wall-clock time (`Date.now()`).
 *
 * Register it at `Stages.First` so other systems see the correct delta.
 *
 * @example
 * ```ts
 * app.addPlugin(new DefaultPlugin());
 * // Or manually:
 * app.insertResource(new Time());
 * app.addSystem(Stages.First, createTimeSystem());
 * ```
 */
export function createTimeSystem(): SystemFn {
  let last = Date.now() / 1000;

  return params(Res(Time)).system((time) => {
    const now = Date.now() / 1000;
    const delta = now - last;
    last = now;
    time.update(delta);
  });
}

/**
 * Built-in plugin that inserts the `Time` resource and registers
 * a system to update it each frame using wall-clock time.
 *
 * Other systems can then read `Res(Time)` for frame-delta-aware logic.
 *
 * @example
 * ```ts
 * new App().addPlugin(new DefaultPlugin()).update();
 * ```
 */
export class DefaultPlugin implements Plugin {
  build(app: App): void {
    app.insertResource(new Time());
    app.addSystem(Stages.First, createTimeSystem());
    app.addPlugin(new InputPlugin());
  }
}
