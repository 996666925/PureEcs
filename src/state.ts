import { Stage, type SystemCondition } from './scheduler';

export interface StateMemberOptions {
  readonly initial?: boolean;
}

export type StateSpec = Record<string, StateMemberOptions>;

export type StateDefinition<S extends StateSpec> = {
  readonly [K in keyof S]: StateMember<S, K & string>;
};

export type StateMember<S extends StateSpec, K extends string = keyof S & string> = {
  readonly definition: StateDefinition<S>;
  readonly key: K;
};
export type StateValue<D extends StateDefinition<StateSpec>> = D[keyof D & string];

const initialKeys = new WeakMap<object, string>();

/** Define an enum-like state machine. Exactly one member must set `{ initial: true }`. */
export function defineState<const S extends StateSpec>(spec: S): StateDefinition<S> {
  const initial = Object.keys(spec).filter((key) => spec[key]?.initial);
  if (initial.length !== 1) {
    throw new Error('A state definition must have exactly one { initial: true } member');
  }
  const definition = {} as StateDefinition<S>;
  for (const key of Object.keys(spec)) {
    Object.defineProperty(definition, key, {
      enumerable: true,
      value: Object.freeze({ definition, key }),
    });
  }
  initialKeys.set(definition, initial[0]);
  return Object.freeze(definition);
}

type AnyDefinition = StateDefinition<StateSpec>;
type AnyMember = StateMember<StateSpec, string>;

export class StateStore<S extends StateSpec> {
  private currentValue: StateMember<S>;
  private nextValue: StateMember<S> | undefined;
  private initialEnterPending = true;
  private readonly nextState: NextStateHandle<S>;

  readonly definition: StateDefinition<S>;
  constructor(definition: StateDefinition<S>) {
    this.definition = definition;
    const initialKey = initialKeys.get(definition as object);
    if (!initialKey) throw new Error('State definition has no initial member');
    this.currentValue = (definition as Record<string, StateMember<S>>)[initialKey];
    this.nextState = new NextStateHandle(this);
  }

  get(): StateMember<S> {
    return this.currentValue;
  }

  set(next: StateMember<S>): void {
    assertMember(this.definition, next);
    this.nextValue = next;
  }

  clearNext(): void {
    this.nextValue = undefined;
  }

  getNextState(): NextStateHandle<S> {
    return this.nextState;
  }

  _takeNext(): StateMember<S> | undefined {
    const result = this.nextValue;
    this.nextValue = undefined;
    return result;
  }

  _takeInitialEnter(): boolean {
    if (!this.initialEnterPending) return false;
    this.initialEnterPending = false;
    return true;
  }

  _setCurrent(next: StateMember<S>): void {
    assertMember(this.definition, next);
    this.currentValue = next;
  }
}

export class NextStateHandle<S extends StateSpec> {
  private readonly state: StateStore<S>;
  constructor(state: StateStore<S>) { this.state = state; }

  set(next: StateMember<S>): void {
    this.state.set(next);
  }

  clear(): void {
    this.state.clearNext();
  }
}

function assertMember<S extends StateSpec>(definition: StateDefinition<S>, member: AnyMember): void {
  if (!member || member.definition !== definition) {
    throw new Error('State member belongs to a different state definition');
  }
}

export class DespawnOnExit<S extends StateSpec> {
  readonly definition: StateDefinition<S>;
  readonly state: StateMember<S>;

  constructor(state: StateMember<S>) {
    this.definition = state.definition;
    this.state = state;
  }

  matches(definition: AnyDefinition, state: AnyMember): boolean {
    return this.definition === definition && this.state === state;
  }
}

export type StateLifecycle = 'enter' | 'exit' | 'transition';

export class StateStage<S extends StateSpec> extends Stage {
  readonly isStateLifecycle = true;
  readonly lifecycle: StateLifecycle;
  readonly definition: StateDefinition<S>;
  readonly state: StateMember<S>;
  readonly nextState?: StateMember<S>;

  constructor(
    lifecycle: StateLifecycle,
    definition: StateDefinition<S>,
    state: StateMember<S>,
    nextState?: StateMember<S>,
  ) {
    super(createStageLabel(lifecycle, state, nextState));
    this.lifecycle = lifecycle;
    this.definition = definition;
    this.state = state;
    this.nextState = nextState;
  }
}

interface StateStageCache<S extends StateSpec> {
  enter: Map<StateMember<S>, StateStage<S>>;
  exit: Map<StateMember<S>, StateStage<S>>;
  transition: Map<StateMember<S>, Map<StateMember<S>, StateStage<S>>>;
}

const stageCaches = new WeakMap<object, StateStageCache<StateSpec>>();

function createStageLabel(lifecycle: StateLifecycle, state: AnyMember, nextState?: AnyMember): string {
  if (lifecycle === 'transition') return `OnTransition(${state.key} -> ${String(nextState?.key)})`;
  return `${lifecycle === 'enter' ? 'OnEnter' : 'OnExit'}(${state.key})`;
}

function getCache<S extends StateSpec>(definition: StateDefinition<S>): StateStageCache<S> {
  let cache = stageCaches.get(definition as object);
  if (!cache) {
    cache = { enter: new Map(), exit: new Map(), transition: new Map() } as StateStageCache<S>;
    stageCaches.set(definition as object, cache as StateStageCache<StateSpec>);
  }
  return cache as StateStageCache<S>;
}

export function OnEnter<S extends StateSpec>(state: StateMember<S>): StateStage<S> {
  const cache = getCache(state.definition);
  let stage = cache.enter.get(state);
  if (!stage) {
    stage = new StateStage('enter', state.definition, state);
    cache.enter.set(state, stage);
  }
  return stage;
}

export function OnExit<S extends StateSpec>(state: StateMember<S>): StateStage<S> {
  const cache = getCache(state.definition);
  let stage = cache.exit.get(state);
  if (!stage) {
    stage = new StateStage('exit', state.definition, state);
    cache.exit.set(state, stage);
  }
  return stage;
}

export function OnTransition<S extends StateSpec>(from: StateMember<S>, to: StateMember<S>): StateStage<S> {
  if (from.definition !== to.definition) {
    throw new Error('OnTransition members must belong to the same state definition');
  }
  const cache = getCache(from.definition);
  let targets = cache.transition.get(from);
  if (!targets) {
    targets = new Map();
    cache.transition.set(from, targets);
  }
  let stage = targets.get(to);
  if (!stage) {
    stage = new StateStage('transition', from.definition, from, to);
    targets.set(to, stage);
  }
  return stage;
}

export function inState<S extends StateSpec>(state: StateMember<S>): SystemCondition {
  return (world) => world.state(state.definition).get() === state;
}

/** Retained only as a type name for code that imports state types internally. */
