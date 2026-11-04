// Text stays upright while each anchor follows its station through the scene.
// When the view runs out of room, the chapter index still offers every stop.
export function createStationLabels(canvas, buttons, indexTrigger) {
  const sizes = new Map();
  let lastWidth = 0, lastHeight = 0;

  function hide(button) {
    if (document.activeElement === button) indexTrigger.focus({ preventScroll: true });
    button.hidden = true;
  }

  return function place(points) {
    const occupied = [];
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (width !== lastWidth || height !== lastHeight) {
      sizes.clear(); lastWidth = width; lastHeight = height;
    }
    const longLeader = width <= 600 && matchMedia('(orientation: portrait)').matches;
    for (const button of buttons) {
      const point = points.find(p => p.id === button.dataset.chapterTarget);
      if (!point?.visible) { hide(button); continue; }
      button.hidden = false;
      if (!sizes.has(button)) sizes.set(button, [button.offsetWidth, button.offsetHeight]);
      const [w, h] = sizes.get(button);
      const outside = point.x < width / 2 ? 'left' : 'right';
      const inside = outside === 'left' ? 'right' : 'left';
      const vertical = point.y < height / 2 ? 'upper' : 'lower';
      const other = vertical === 'upper' ? 'lower' : 'upper';
      const gap = longLeader && point.id === 'overview' ? 34 : 8;
      let placed = false;
      // Prefer unoccupied space outside the silhouette before turning inward.
      for (const side of [outside, vertical+'-'+outside, vertical+'-'+inside, other+'-'+inside, inside]) {
        const left = side.endsWith('left');
        const x = point.x + (left ? -8 : 8);
        const y = point.y;
        const rect = {
          x: left ? x-w : x, y: side.startsWith('upper-') ? y-h-gap : side.startsWith('lower-') ? y+gap : y-h/2,
          w, h,
        };
        if (rect.x < 4 || rect.x+w > width-4 || rect.y < 3 || rect.y+h > height-3) continue;
        if (occupied.some(b => rect.x < b.x+b.w+4 && rect.x+w+4 > b.x && rect.y < b.y+b.h && rect.y+h > b.y)) continue;
        // Keep every visible physical station reachable, even where its own label is suppressed.
        if (points.some(p => p.visible && p.id !== point.id && p.x > rect.x-6 && p.x < rect.x+w+6 && p.y > rect.y-6 && p.y < rect.y+h+6)) continue;
        button.style.left = x + 'px';
        button.style.top = y + 'px';
        button.dataset.side = side;
        occupied.push(rect);
        placed = true;
        break;
      }
      if (!placed) hide(button);
    }
  };
}
