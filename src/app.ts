import { World, type SystemFn, type SystemAddOptions } from './world';
import { type SystemConfig, Stage, SystemBuilder } from './scheduler';
import type { Plugin } from './plugin';

export { system, type SystemConfig, Stages, Stage } from './scheduler';

/**
 * App is the top-level entry point, similar to Bevy's App.
 * It owns the World and provides a fluent API for configuration.
 */
export class App {
  public readonly world: World = new World();

  /**
   * Add a system. Stage goes first, defaults to `Stages.Update` when omitted.
   *
   * @example
   * ```ts
   * app.addSystem(movement);
   * app.addSystem(Stages.PreUpdate, input);
   * app.addSystem(Stages.PostUpdate, render, { after: [movement] });
   * ```
   */
  addSystem(stage: Stage, fn: SystemFn, ordering?: SystemAddOptions): this;
  addSystem(fn: SystemFn): this;
  addSystem(stageOrFn: Stage | SystemFn, fn?: SystemFn, ordering?: SystemAddOptions): this {
    if (typeof stageOrFn === 'function') {
      this.world.addSystem(stageOrFn);
    } else {
      this.world.addSystem(stageOrFn, fn!, ordering);
    }
    return this;
  }

  /**
   * Add a system from a builder config.
   *
   * @example
   * ```ts
   * app.addSystemConfig(system(fn).inStage(Stages.PreUpdate).after(otherFn));
   * ```
   */
  addSystemConfig(config: SystemConfig | SystemBuilder): this {
    const resolved = config instanceof SystemBuilder ? config.build() : config;
    this.world.addSystemConfig(resolved);
    return this;
  }

  /** Add a startup system. */
  addStartupSystem(fn: SystemFn): this {
    this.world.addStartupSystem(fn);
    return this;
  }

  /** Insert a custom stage before an existing stage. */
  addStageBefore(newStage: Stage, before: Stage): this {
    this.world.addStageBefore(newStage, before);
    return this;
  }

  /** Insert a custom stage after an existing stage. */
  addStageAfter(newStage: Stage, after: Stage): this {
    this.world.addStageAfter(newStage, after);
    return this;
  }

  /** Insert a resource. */
  insertResource<T>(resource: T): this {
    this.world.insertResource(resource);
    return this;
  }

  /**
   * Add a plugin. Plugins encapsulate reusable logic (systems, resources, stages).
   * PluginGroup can bundle multiple plugins together.
   *
   * @example
   * ```ts
   * app.addPlugin(new PhysicsPlugin());
   *
   * // Or a group of plugins
   * app.addPlugin(new PluginGroup()
   *   .add(new InputPlugin())
   *   .add(new RenderPlugin())
   * );
   * ```
   */
  addPlugin(plugin: Plugin): this {
    plugin.build(this);
    return this;
  }

  /** Run the app for a single tick. */
  update(): void {
    this.world.update();
  }

  /** Run the app for a fixed number of ticks. */
  run(ticks: number = 1): void {
    this.world.run(ticks);
  }
}
