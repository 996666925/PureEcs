import { World, type SystemFn, type SystemAddOptions } from './world';
import { type SystemConfig, Stage, SystemBuilder } from './scheduler';
import type { Plugin } from './plugin';
import type { ComponentClass } from './component';
import type { StateClass } from './state';

export { system, type SystemConfig, Stages, Stage } from './scheduler';

/**
 * App is the top-level entry point, similar to Bevy's App.
 * It owns the World and provides a fluent API for configuration.
 */
export class App {
  public readonly world: World = new World();
  private plugins: Plugin[] = [];
  private destroyed = false;

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
    this.assertActive();
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
    this.assertActive();
    const resolved = config instanceof SystemBuilder ? config.build() : config;
    this.world.addSystemConfig(resolved);
    return this;
  }

  /** Add a startup system. */
  addStartupSystem(fn: SystemFn): this {
    this.assertActive();
    this.world.addStartupSystem(fn);
    return this;
  }

  /** Insert a custom stage before an existing stage. */
  addStageBefore(newStage: Stage, before: Stage): this {
    this.assertActive();
    this.world.addStageBefore(newStage, before);
    return this;
  }

  /** Insert a custom stage after an existing stage. */
  addStageAfter(newStage: Stage, after: Stage): this {
    this.assertActive();
    this.world.addStageAfter(newStage, after);
    return this;
  }

  /** Insert a resource. */
  insertResource<T>(resource: T): this {
    this.assertActive();
    this.world.insertResource(resource);
    return this;
  }

  /** Register a State resource and its initial value. */
  initState<S>(type: StateClass<S>, initial: S): this {
    this.assertActive();
    this.world.initState(type, initial);
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
    this.assertActive();
    plugin.build(this);
    this.plugins.push(plugin);
    return this;
  }

  /** Register an event channel for an event class. */
  addEvent<T>(eventType: ComponentClass<T>): this {
    this.assertActive();
    this.world.initEvent(eventType);
    return this;
  }

  /** Run the app for a single tick. */
  update(): void {
    this.assertActive();
    this.world.update();
  }

  /** Run the app for a fixed number of ticks. */
  run(ticks: number = 1): void {
    this.assertActive();
    this.world.run(ticks);
  }

  /** Dispose plugins in reverse order, releasing external resources such as DOM listeners. */
  destroy(): void {
    if (this.destroyed) return;
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      this.plugins[i].destroy?.(this);
    }
    this.destroyed = true;
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('App has been destroyed');
    }
  }
}
