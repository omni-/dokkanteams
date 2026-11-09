import { reactive } from 'vue';
import type { RotationSpot } from '../core/analysis.ts';
import type { Unit } from '../core/types.ts';

/** Where a dragged unit came from. */
export type DragOrigin =
  | { kind: 'list' }
  | { kind: 'team' }
  | { kind: 'rotation' }
  | { kind: 'battlefield'; team: number; slot: number };

/**
 * What the pointer is over. Elements opt in with `data-drop` (plus `data-member`, `data-team`, `data-slot`,
 * `data-rotation-unit`, `data-rotation-slot`, `data-rotation-floaters`).
 */
export type DropTarget =
  | { kind: 'team'; beforeId: number | null }
  | { kind: 'rotation'; spot: RotationSpot | null }
  | { kind: 'battlefield'; team: number; slot: number | null };

type DropHandler = (unit: Unit, origin: DragOrigin, target: DropTarget | null) => void;

export const drag = reactive<{
  unit: Unit | null;
  origin: DragOrigin | null;
  target: DropTarget | null;
  x: number;
  y: number;
}>({ unit: null, origin: null, target: null, x: 0, y: 0 });

// A mouse drag starts after a small movement. Touch needs a long press so the grid can still scroll.
const MOUSE_START_DISTANCE = 5;
const TOUCH_HOLD_MS = 280;
const TOUCH_SLOP = 8;
const EDGE_SCROLL_ZONE = 48;
const EDGE_SCROLL_SPEED = 18;

let pending: {
  unit: Unit;
  origin: DragOrigin;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  holdTimer?: ReturnType<typeof setTimeout>;
} | null = null;
let dropHandler: DropHandler | null = null;
let scrollFrame = 0;

export function onDrop(handler: DropHandler): void {
  dropHandler = handler;
}

/** Call from a pointerdown on anything that can be dragged. Plain clicks and taps still go through. */
export function startDrag(event: PointerEvent, unit: Unit, origin: DragOrigin): void {
  if (pending || drag.unit) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  // Stops a mouse drag from selecting text along the way. The click still fires.
  if (event.pointerType === 'mouse') event.preventDefault();

  pending = {
    unit,
    origin,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    startX: event.clientX,
    startY: event.clientY,
  };
  if (event.pointerType !== 'mouse') {
    pending.holdTimer = setTimeout(() => pending && begin(pending.startX, pending.startY), TOUCH_HOLD_MS);
  }

  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('contextmenu', preventDefault);
}

function begin(x: number, y: number) {
  if (!pending) return;
  drag.unit = pending.unit;
  drag.origin = pending.origin;
  move(x, y);
  window.getSelection()?.removeAllRanges();
  document.body.classList.add('dragging');
  // Once a touch drag starts, stop the page from scrolling under the finger.
  if (pending.pointerType !== 'mouse') window.addEventListener('touchmove', preventDefault, { passive: false });
  scrollFrame = requestAnimationFrame(scrollNearEdges);
}

function onPointerMove(event: PointerEvent) {
  if (!pending || event.pointerId !== pending.pointerId) return;

  if (!drag.unit) {
    const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
    if (pending.pointerType === 'mouse') {
      if (distance < MOUSE_START_DISTANCE) return;
      begin(event.clientX, event.clientY);
    } else {
      // The finger moved before the long press finished, so this is a scroll.
      if (distance > TOUCH_SLOP) cancel();
      return;
    }
  }

  event.preventDefault();
  move(event.clientX, event.clientY);
}

function onPointerUp(event: PointerEvent) {
  if (!pending || event.pointerId !== pending.pointerId) return;

  if (drag.unit && drag.origin) {
    dropHandler?.(drag.unit, drag.origin, drag.target);
    swallowNextClick();
  }
  cancel();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drag.unit) {
    swallowNextClick();
    cancel();
  }
}

function cancel() {
  if (pending?.holdTimer) clearTimeout(pending.holdTimer);
  pending = null;
  cancelAnimationFrame(scrollFrame);
  drag.unit = null;
  drag.origin = null;
  drag.target = null;
  document.body.classList.remove('dragging');
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', cancel);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('contextmenu', preventDefault);
  window.removeEventListener('touchmove', preventDefault);
}

function move(x: number, y: number) {
  drag.x = x;
  drag.y = y;
  drag.target = findTarget(x, y);
}

function findTarget(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const zone = element?.closest<HTMLElement>('[data-drop]');
  if (!element || !zone) return null;

  if (zone.dataset.drop === 'team') {
    const member = element.closest<HTMLElement>('[data-member]');
    if (!member || !zone.contains(member)) return { kind: 'team', beforeId: null };
    const rect = member.getBoundingClientRect();
    const after = x > rect.left + rect.width / 2;
    const next = member.dataset.next ? Number(member.dataset.next) : null;
    return { kind: 'team', beforeId: after ? next : Number(member.dataset.member) };
  }

  if (zone.dataset.drop === 'rotation') {
    const spot = element.closest<HTMLElement>('[data-rotation-unit], [data-rotation-slot], [data-rotation-floaters]');
    return { kind: 'rotation', spot: spot && zone.contains(spot) ? rotationSpot(spot) : null };
  }

  if (zone.dataset.drop === 'battlefield') {
    const slot = element.closest<HTMLElement>('[data-slot]');
    return {
      kind: 'battlefield',
      team: Number(zone.dataset.team),
      slot: slot && zone.contains(slot) ? Number(slot.dataset.slot) : null,
    };
  }

  return null;
}

function rotationSpot(element: HTMLElement): RotationSpot {
  const { rotationUnit, rotationSlot } = element.dataset;
  if (rotationUnit) return { kind: 'unit', unitId: Number(rotationUnit) };
  if (rotationSlot) {
    const [rotation, position] = rotationSlot.split('-').map(Number);
    return { kind: 'slot', rotation, position };
  }
  return { kind: 'floaters' };
}

// Scroll lists marked with data-drag-scroll when the pointer sits near their top or bottom edge.
function scrollNearEdges() {
  if (!drag.unit) return;

  const list = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLElement>('[data-drag-scroll]');
  if (list) {
    const rect = list.getBoundingClientRect();
    const fromTop = drag.y - rect.top;
    const fromBottom = rect.bottom - drag.y;
    let step = 0;
    if (fromTop < EDGE_SCROLL_ZONE) step = -EDGE_SCROLL_SPEED * (1 - fromTop / EDGE_SCROLL_ZONE);
    else if (fromBottom < EDGE_SCROLL_ZONE) step = EDGE_SCROLL_SPEED * (1 - fromBottom / EDGE_SCROLL_ZONE);
    if (step !== 0) {
      list.scrollTop += step;
      drag.target = findTarget(drag.x, drag.y);
    }
  }

  scrollFrame = requestAnimationFrame(scrollNearEdges);
}

// The pointerup that ends a drag can also produce a click on the tile under it; that click isn't a tap.
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 120);
}

function preventDefault(event: Event) {
  event.preventDefault();
}
