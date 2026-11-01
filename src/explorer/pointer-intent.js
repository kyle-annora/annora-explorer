/** Distinguish a click from an orbit, even when a drag returns to its start.
 * All distances are CSS pixels. This owns no camera state or animation clock. */
export function createPointerIntent(slop = 5) {
  const active = new Set();
  let press = null, completedClick = false, clickStreak = 0;
  const move = event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > slop)
      press.moved = true;
  };
  return {
    down(event) {
      active.add(event.pointerId); completedClick = false;
      press = active.size === 1 && event.button === 0 && event.isPrimary
        ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
        : null;
    },
    move,
    up(event) {
      move(event);
      const click = active.has(event.pointerId) && press?.id === event.pointerId && !press.moved;
      active.delete(event.pointerId); press = null; completedClick = Boolean(click);
      clickStreak = completedClick ? clickStreak + 1 : 0;
      return completedClick;
    },
    cancel(event) {
      // OrbitControls releases pointer capture after a normal pointerup too.
      // That release must not erase an already completed double-click candidate.
      if (!active.has(event.pointerId) && press?.id !== event.pointerId) return;
      active.delete(event.pointerId); press = null; completedClick = false; clickStreak = 0;
    },
    canDoubleClick() { return completedClick && clickStreak >= 2 && active.size === 0; },
  };
}
