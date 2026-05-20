// PureEcs - A Bevy-like ECS framework for TypeScript

// Core
export { World, type SystemFn, type SystemAddOptions } from './world';
export { App, system, Stages, Stage, type SystemConfig } from './app';

// Plugin
export { type Plugin, PluginGroup, DefaultPlugin, createTimeSystem } from './plugin';

// System builder
export { params, Query, QueryDescriptor, ParamsBuilder, Res, ResourceDescriptor, Cmd, CommandsDescriptor, Local, LocalDescriptor } from './system';

// Scheduler
export { Scheduler, SystemBuilder, CircularDependencyError } from './scheduler';

// Entity
export { Entity } from './entity';

// Component
export type { ComponentClass } from './component';

// Query (internal engine)
export { QueryEngine } from './query';

// Filter functions
export { With, Without, Added, Changed, type QueryFilter, type WithFilter, type WithoutFilter, type AddedFilter, type ChangedFilter } from './query';

// Resource
export { ResourceStore } from './resource';

// Commands
export { Commands } from './commands';

// Change tracking
export { Mut, ChangeTrackers } from './change-tracking';

// Storage
export { SparseSet } from './storage';

// Timer
export { Timer, TimerMode, Time } from './timer';
