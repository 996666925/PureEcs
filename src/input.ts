/**
 * Bevy-style input system for PureEcs.
 *
 * Tracks keyboard keys and mouse buttons with three states:
 *   pressed — currently held down
 *   just_pressed — first tick of being down
 *   just_released — first tick of being up
 *
 * The `InputPlugin` listens on `document` by default.
 * Insert an `InputTarget` resource to redirect events to a specific element (e.g. canvas).
 *
 * @example
 * ```ts
 * // Default — listens on document
 * new App().addPlugin(new InputPlugin());
 *
 * // Custom target — only capture events on the canvas
 * const app = new App().addPlugin(new InputPlugin());
 * app.insertResource(new InputTarget(canvas));
 * ```
 */

import type { App } from './app';
import type { Plugin } from './plugin';
import { Stages } from './scheduler';
import type { SystemFn } from './scheduler';

// ─── KeyCode ───

/** All standard `KeyboardEvent.code` values for type-safe autocomplete. */
export type KeyCode =
  // Letters
  | 'KeyA' | 'KeyB' | 'KeyC' | 'KeyD' | 'KeyE' | 'KeyF' | 'KeyG' | 'KeyH'
  | 'KeyI' | 'KeyJ' | 'KeyK' | 'KeyL' | 'KeyM' | 'KeyN' | 'KeyO' | 'KeyP'
  | 'KeyQ' | 'KeyR' | 'KeyS' | 'KeyT' | 'KeyU' | 'KeyV' | 'KeyW' | 'KeyX'
  | 'KeyY' | 'KeyZ'
  // Digits
  | 'Digit0' | 'Digit1' | 'Digit2' | 'Digit3' | 'Digit4'
  | 'Digit5' | 'Digit6' | 'Digit7' | 'Digit8' | 'Digit9'
  // Function keys
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9'
  | 'F10' | 'F11' | 'F12'
  // Arrows
  | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
  // Modifiers
  | 'ShiftLeft' | 'ShiftRight' | 'ControlLeft' | 'ControlRight'
  | 'AltLeft' | 'AltRight' | 'MetaLeft' | 'MetaRight'
  // Navigation / editing
  | 'Escape' | 'Tab' | 'CapsLock' | 'Space'
  | 'Enter' | 'Backspace' | 'Delete' | 'Insert'
  | 'Home' | 'End' | 'PageUp' | 'PageDown'
  // Numpad
  | 'Numpad0' | 'Numpad1' | 'Numpad2' | 'Numpad3' | 'Numpad4'
  | 'Numpad5' | 'Numpad6' | 'Numpad7' | 'Numpad8' | 'Numpad9'
  | 'NumpadAdd' | 'NumpadSubtract' | 'NumpadMultiply' | 'NumpadDivide'
  | 'NumpadDecimal' | 'NumpadEnter'
  // Punctuation
  | 'Backquote' | 'Minus' | 'Equal' | 'BracketLeft' | 'BracketRight'
  | 'Backslash' | 'Semicolon' | 'Quote' | 'Comma' | 'Period' | 'Slash'
  // Media
  | 'PrintScreen' | 'ScrollLock' | 'Pause' | 'ContextMenu'
  // Catch-all for any other KeyboardEvent.code value
  | (string & {});

// ─── MouseButton ───

/** Mouse button identifiers. */
export type MouseButton = 'Left' | 'Right' | 'Middle' | 'Back' | 'Forward';

// ─── Input<T> ───

/**
 * Generic input-state tracker. Maintains three sets per frame:
 * - `pressed` — keys/buttons currently held.
 * - `justPressed` — first tick of hold (cleared at end of frame).
 * - `justReleased` — first tick of release (cleared at end of frame).
 *
 * Stored as a **resource** in the World:
 * `Input<KeyCode>` for keyboard, `Input<MouseButton>` for mouse.
 */
export class Input<T> {
  private _pressed = new Set<T>();
  private _justPressed = new Set<T>();
  private _justReleased = new Set<T>();

  // ---- Feeder methods ----

  /** Mark `key` as pressed this frame. Call on keydown/mousedown. */
  press(key: T): void {
    if (!this._pressed.has(key)) {
      this._pressed.add(key);
      this._justPressed.add(key);
      this._justReleased.delete(key);
    }
  }

  /** Mark `key` as released this frame. Call on keyup/mouseup. */
  release(key: T): void {
    if (this._pressed.has(key)) {
      this._pressed.delete(key);
      this._justReleased.add(key);
      this._justPressed.delete(key);
    }
  }

  // ---- Query methods ----

  /** Returns `true` while the key/button is held. */
  pressed(key: T): boolean { return this._pressed.has(key); }

  /** Returns `true` only on the first tick the key/button was pressed. */
  justPressed(key: T): boolean { return this._justPressed.has(key); }

  /** Returns `true` only on the first tick after the key/button was released. */
  justReleased(key: T): boolean { return this._justReleased.has(key); }

  /** Returns `true` if any of the given keys are currently held. */
  anyPressed(keys: T[]): boolean { return keys.some((k) => this._pressed.has(k)); }

  /** Returns `true` if any of the given keys were just pressed this frame. */
  anyJustPressed(keys: T[]): boolean { return keys.some((k) => this._justPressed.has(k)); }

  /** Returns the read-only set of currently held keys. */
  pressedSet(): ReadonlySet<T> { return this._pressed; }

  // ---- Maintenance ----

  /** Clear transient "just" states. Called automatically each frame. */
  clear(): void {
    this._justPressed.clear();
    this._justReleased.clear();
  }
}

// ─── MouseWheel ───

/**
 * Accumulated mouse-wheel delta for the current frame.
 * Positive `y` = scroll down, positive `x` = scroll right.
 * Reset each frame by `InputPlugin`.
 */
export class MouseWheel {
  x = 0;
  y = 0;

  feed(event: { deltaX: number; deltaY: number; deltaMode: number }): void {
    const scale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 800 : 1;
    this.x += event.deltaX * scale;
    this.y += event.deltaY * scale;
  }

  clear(): void {
    this.x = 0;
    this.y = 0;
  }
}

// ─── MousePosition ───

/** Current cursor position in screen coordinates. */
export class MousePosition {
  x = 0;
  y = 0;
  /** True if the cursor is inside the tracked element. */
  inBounds = false;

  feed(clientX: number, clientY: number): void {
    this.x = clientX;
    this.y = clientY;
  }
}

// ─── InputTarget ───

/**
 * Optional resource to redirect input event listening to a specific element.
 * If not set, `InputPlugin` defaults to `document`.
 *
 * @example
 * ```ts
 * app.insertResource(new InputTarget(canvas));
 * ```
 */
export class InputTarget {
  /** The element to attach event listeners to. */
  readonly target: EventTarget;

  /** Whether to prevent default behaviour on the listened events. */
  readonly preventDefault: boolean;

  constructor(target: EventTarget, preventDefault = false) {
    this.target = target;
    this.preventDefault = preventDefault;
  }
}

// ─── InputPlugin ───

/**
 * Plugin that registers input resources and automatically listens on
 * `document` (or a custom `InputTarget` resource) for keyboard/mouse events.
 *
 * Transient "just pressed / just released" states are cleared every frame.
 *
 * @example
 * ```ts
 * const app = new App()
 *   .addPlugin(new InputPlugin())
 *   .addSystem(myInputSystem);
 * ```
 */
export class InputPlugin implements Plugin {
  build(app: App): void {
    // Register input resources
    app.insertResource(new Input<KeyCode>());
    app.insertResource(new Input<MouseButton>());
    app.insertResource(new MouseWheel());
    app.insertResource(new MousePosition());

    // Startup system — attaches event listeners once
    app.addStartupSystem(initInputListeners());

    // Per-frame cleanup
    app.addSystem(Stages.Last, clearInputSystem());
  }
}

// ─── Internal: listener setup ───

function initInputListeners(): SystemFn {
  let attached = false;

  return (world) => {
    if (attached) return;
    attached = true;

    const targetResource = world.getResource(InputTarget);
    const target = targetResource?.target ?? document;
    const preventDefault = targetResource?.preventDefault ?? false;

    const keys = world.getResource<Input<KeyCode>>(Input)!;
    const mouseInput = world.getResource<Input<MouseButton>>(Input)!;
    const wheel = world.getResource(MouseWheel)!;
    const cursor = world.getResource(MousePosition)!;

    const opts: AddEventListenerOptions = { passive: !preventDefault };

    // Keyboard
    target.addEventListener('keydown', (e) => {
      if (preventDefault) e.preventDefault();
      keys.press((e as KeyboardEvent).code);
      // Update modifier keys that don't fire on their own
      if ((e as KeyboardEvent).shiftKey) keys.press('ShiftLeft');
      if ((e as KeyboardEvent).ctrlKey) keys.press('ControlLeft');
      if ((e as KeyboardEvent).altKey) keys.press('AltLeft');
      if ((e as KeyboardEvent).metaKey) keys.press('MetaLeft');
    }, opts);
    target.addEventListener('keyup', (e) => {
      if (preventDefault) e.preventDefault();
      keys.release((e as KeyboardEvent).code);
      if (!(e as KeyboardEvent).shiftKey) keys.release('ShiftLeft');
      if (!(e as KeyboardEvent).ctrlKey) keys.release('ControlLeft');
      if (!(e as KeyboardEvent).altKey) keys.release('AltLeft');
      if (!(e as KeyboardEvent).metaKey) keys.release('MetaLeft');
    }, opts);

    // Mouse buttons
    target.addEventListener('mousedown', (e) => {
      if (preventDefault) e.preventDefault();
      mouseInput.press(mapButton((e as MouseEvent).button));
    }, opts);
    target.addEventListener('mouseup', (e) => {
      if (preventDefault) e.preventDefault();
      mouseInput.release(mapButton((e as MouseEvent).button));
    }, opts);

    // Mouse move
    target.addEventListener('mousemove', (e) => {
      if (preventDefault) e.preventDefault();
      cursor.feed((e as MouseEvent).clientX, (e as MouseEvent).clientY);
      cursor.inBounds = true;
    }, opts);
    target.addEventListener('mouseleave', () => {
      cursor.inBounds = false;
    }, opts);
    target.addEventListener('mouseenter', (e) => {
      cursor.feed((e as MouseEvent).clientX, (e as MouseEvent).clientY);
      cursor.inBounds = true;
    }, opts);

    // Wheel
    target.addEventListener('wheel', (e) => {
      if (preventDefault) e.preventDefault();
      wheel.feed(e as WheelEvent);
    }, opts);

    // Prevent context menu when we're preventing default
    if (preventDefault) {
      target.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  };
}

/** Map DOM MouseEvent.button (0-4) to MouseButton. */
export function mapButton(button: number): MouseButton {
  switch (button) {
    case 0: return 'Left';
    case 1: return 'Middle';
    case 2: return 'Right';
    case 3: return 'Back';
    case 4: return 'Forward';
    default: return 'Left';
  }
}

// ─── Internal: per-frame cleanup ───

function clearInputSystem(): SystemFn {
  return (world) => {
    world.getResource<Input<KeyCode>>(Input)?.clear();
    world.getResource<Input<MouseButton>>(Input)?.clear();
    world.getResource(MouseWheel)?.clear();
  };
}
