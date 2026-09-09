import type { ComponentClass } from './component';
import { Stage, type SystemCondition } from './scheduler';

/** A resource class that stores the current value of a state machine. */
export class State<S> {
  private currentValue: S;
  private nextValue: S | undefined;
  private hasNextValue = false;
  private initialEnterPending = true;
  private readonly nextState: NextState<S>;

  constructor(initial: S) {
    this.currentValue = initial;
    this.nextState = new NextState(this);
  }

  /** Return the current state value. */
  get(): S {
    return this.currentValue;
  }

  /** Queue a state transition for the next StateTransition stage. */
  set(next: S): void {
    this.nextValue = next;
    this.hasNextValue = true;
  }

  /** Cancel a queued transition, if one exists. */
  clearNext(): void {
    this.hasNextValue = false;
    this.nextValue = undefined;
  }

  /** Access the Bevy-style deferred transition handle for this state. */
  getNextState(): NextState<S> {
    return this.nextState;
  }

  /** @internal */
  _takeNext(): { hasValue: boolean; value: S | undefined } {
    const result = { hasValue: this.hasNextValue, value: this.nextValue };
    this.clearNext();
    return result;
  }

  /** @internal */
  _takeInitialEnter(): boolean {
    if (!this.initialEnterPending) return false;
    this.initialEnterPending = false;
    return true;
  }

  /** @internal */
  _setCurrent(next: S): void {
    this.currentValue = next;
  }
}

/** A deferred state-transition handle, analogous to Bevy's NextState<S>. */
export class NextState<S> {
  private readonly state: State<S>;

  /** @internal */
  constructor(state: State<S>) {
    this.state = state;
  }

  set(next: S): void {
    this.state.set(next);
  }

  clear(): void {
    this.state.clearNext();
  }
}

/** Constructor used to identify a particular State resource. */
export type StateClass<S> = ComponentClass<State<S>>;

/**
 * Marks an entity to be despawned after it exits one particular state value.
 *
 * @example
 * ```ts
 * world.spawnWith(new MenuUi(), new DespawnOnExit(ScreenState, 'menu'));
 * ```
 */
export class DespawnOnExit<S> {
  readonly stateType: StateClass<S>;
  readonly state: S;

  constructor(stateType: StateClass<S>, state: S) {
    this.stateType = stateType;
    this.state = state;
  }

  /** @internal */
  matches(type: StateClass<unknown>, state: unknown): boolean {
    return this.stateType === type && Object.is(this.state, state);
  }
}

export type StateLifecycle = 'enter' | 'exit' | 'transition';

/** A stage that only runs while processing a matching state lifecycle event. */
export class StateStage<S> extends Stage {
  readonly isStateLifecycle = true;
  readonly lifecycle: StateLifecycle;
  readonly stateType: StateClass<S>;
  readonly state: S;
  readonly nextState: S | undefined;

  /** @internal */
  constructor(
    lifecycle: StateLifecycle,
    stateType: StateClass<S>,
    state: S,
    nextState?: S,
  ) {
    super(createStageLabel(lifecycle, stateType, state, nextState));
    this.lifecycle = lifecycle;
    this.stateType = stateType;
    this.state = state;
    this.nextState = nextState;
  }
}

interface StateStageCache<S> {
  enter: Map<S, StateStage<S>>;
  exit: Map<S, StateStage<S>>;
  transition: Map<S, Map<S, StateStage<S>>>;
}

const stageCaches = new WeakMap<StateClass<unknown>, StateStageCache<unknown>>();

function createStageLabel<S>(
  lifecycle: StateLifecycle,
  type: StateClass<S>,
  state: S,
  nextState?: S,
): string {
  const name = type.name || '<anonymous>';
  if (lifecycle === 'transition') {
    return `OnTransition(${name}: ${String(state)} -> ${String(nextState)})`;
  }
  const prefix = lifecycle === 'enter' ? 'OnEnter' : 'OnExit';
  return `${prefix}(${name}: ${String(state)})`;
}

function getCache<S>(type: StateClass<S>): StateStageCache<S> {
  let cache = stageCaches.get(type as StateClass<unknown>);
  if (!cache) {
    cache = { enter: new Map(), exit: new Map(), transition: new Map() };
    stageCaches.set(type as StateClass<unknown>, cache);
  }
  return cache as StateStageCache<S>;
}

/** Return the stage whose systems run when `state` is entered. */
export function OnEnter<S>(type: StateClass<S>, state: S): StateStage<S> {
  const cache = getCache(type);
  let stage = cache.enter.get(state);
  if (!stage) {
    stage = new StateStage('enter', type, state);
    cache.enter.set(state, stage);
  }
  return stage;
}

/** Return the stage whose systems run when `state` is exited. */
export function OnExit<S>(type: StateClass<S>, state: S): StateStage<S> {
  const cache = getCache(type);
  let stage = cache.exit.get(state);
  if (!stage) {
    stage = new StateStage('exit', type, state);
    cache.exit.set(state, stage);
  }
  return stage;
}

/** Return the stage whose systems run for one specific state transition. */
export function OnTransition<S>(type: StateClass<S>, from: S, to: S): StateStage<S> {
  const cache = getCache(type);
  let targets = cache.transition.get(from);
  if (!targets) {
    targets = new Map();
    cache.transition.set(from, targets);
  }
  let stage = targets.get(to);
  if (!stage) {
    stage = new StateStage('transition', type, from, to);
    targets.set(to, stage);
  }
  return stage;
}

/** Run a system only while the identified State resource has `state` as current. */
export function inState<S>(type: StateClass<S>, state: S): SystemCondition {
  return (world) => Object.is(world.getState(type).get(), state);
}
