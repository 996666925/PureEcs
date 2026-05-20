/**
 * Timer and Time resources — tracking elapsed time.
 * Designed to be used with `Res<Timer>` / `ResMut<Timer>` / `Res<Time>` in systems.
 *
 * @example Timer
 * ```ts
 * const timer = new Timer(2, TimerMode.Repeating);
 * timer.tick(delta);
 * if (timer.justFinished()) {
 *   console.log('Fired!');
 * }
 * ```
 *
 * @example Time
 * ```ts
 * const time = new Time();
 * time.update(0.016);
 * console.log(time.delta, time.elapsed);
 * ```
 */

/** Timer repeat mode */
export const TimerMode = {
  /** Fire once and stay finished */
  Once: 'once',
  /** Reset after firing (elapsed wraps around) */
  Repeating: 'repeating',
} as const;

export type TimerMode = (typeof TimerMode)[keyof typeof TimerMode];

export class Timer {
  readonly duration: number;
  readonly mode: TimerMode;

  private elapsed: number = 0;
  private _justFinished: boolean = false;
  private _paused: boolean = false;

  constructor(duration: number, mode: TimerMode = TimerMode.Once) {
    this.duration = duration;
    this.mode = mode;
  }

  /** Advance the timer by `delta` seconds. Call once per tick in a system. */
  tick(delta: number): this {
    if (this._paused || this.elapsed >= this.duration) return this;
    this._justFinished = false;
    this.elapsed += delta;
    if (this.elapsed >= this.duration) {
      this._justFinished = true;
      if (this.mode === TimerMode.Repeating) {
        this.elapsed %= this.duration;
      } else {
        this.elapsed = this.duration; // clamp
      }
    }
    return this;
  }

  /** Whether the timer has finished (elapsed >= duration). */
  finished(): boolean {
    return this.elapsed >= this.duration;
  }

  /** Whether the timer finished during the most recent tick. */
  justFinished(): boolean {
    return this._justFinished;
  }

  /** Reset elapsed to 0. */
  reset(): this {
    this.elapsed = 0;
    this._justFinished = false;
    return this;
  }

  /** Completion fraction in [0, 1]. */
  fraction(): number {
    return Math.min(this.elapsed / this.duration, 1);
  }

  /** Remaining time until finished. */
  remaining(): number {
    return Math.max(this.duration - this.elapsed, 0);
  }

  /** Remaining time as a fraction in [0, 1]. */
  fractionRemaining(): number {
    return 1 - this.fraction();
  }

  /** Elapsed time in seconds. */
  elapsedSecs(): number {
    return this.elapsed;
  }

  /** Pause the timer. */
  pause(): this {
    this._paused = true;
    return this;
  }

  /** Resume the timer. */
  unpause(): this {
    this._paused = false;
    return this;
  }

  /** Whether the timer is paused. */
  paused(): boolean {
    return this._paused;
  }

  get elapsedTime(): number {
    return this.elapsed;
  }

  get remainingTime(): number {
    return this.remaining();
  }
}

// ─── Time ───

/**
 * Global time resource — provides frame delta and total elapsed time.
 * Call `time.update(realDelta)` once per frame (e.g. from requestAnimationFrame).
 * Systems read it via `Res<Time>` for movement, animations, etc.
 *
 * @example
 * ```ts
 * app.insertResource(new Time());
 *
 * // In your game loop
 * time.update(delta);
 * app.update();
 *
 * // In a system
 * params(Position, Velocity, Res(Time)).system((pos, vel, time) => {
 *   for (let i = 0; i < pos.length; i++) {
 *     pos[i].x += vel[i].x * time.delta;
 *   }
 * });
 * ```
 */
export class Time {
  /** Effective delta this frame (real delta × relativeSpeed, 0 when paused). */
  private _delta: number = 0;

  /** Total elapsed time since creation. */
  private _elapsed: number = 0;

  /** Multiplier applied to real delta. 1.0 = normal, 0.5 = half speed. */
  private _relativeSpeed: number = 1.0;

  private _paused: boolean = false;

  /**
   * Update the global time. Call this once per frame with the real-world delta
   * (e.g. the elapsed seconds from requestAnimationFrame).
   *
   * When paused, delta becomes 0 and elapsed does not advance.
   */
  update(delta: number): void {
    if (this._paused) {
      this._delta = 0;
      return;
    }
    this._delta = delta * this._relativeSpeed;
    this._elapsed += this._delta;
  }

  /** Effective delta this frame. Real delta × relativeSpeed, 0 when paused. */
  get delta(): number {
    return this._delta;
  }

  /** Total elapsed time since creation. */
  get elapsed(): number {
    return this._elapsed;
  }

  /** Time multiplier. 1.0 = normal, 0.5 = half speed, 2.0 = double speed. */
  get relativeSpeed(): number {
    return this._relativeSpeed;
  }

  set relativeSpeed(speed: number) {
    this._relativeSpeed = Math.max(0, speed);
  }

  pause(): void {
    this._paused = true;
  }

  unpause(): void {
    this._paused = false;
  }

  paused(): boolean {
    return this._paused;
  }
}
