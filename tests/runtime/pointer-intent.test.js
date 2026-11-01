import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointerIntent } from '../../src/explorer/pointer-intent.js';

const pointer = (patch = {}) => ({ pointerId: 1, clientX: 100, clientY: 100, button: 0, isPrimary: true, ...patch });

test('a stationary click and small hand movement select once; capture release preserves double click', () => {
  const intent = createPointerIntent();
  intent.down(pointer()); intent.move(pointer({ clientX: 103 }));
  assert.equal(intent.up(pointer({ clientX: 102 })), true);
  intent.cancel(pointer());
  assert.equal(intent.canDoubleClick(), false, 'inspection needs two valid clicks');
  intent.down(pointer()); assert.equal(intent.up(pointer()), true);
  intent.cancel(pointer());
  assert.equal(intent.canDoubleClick(), true);
  assert.equal(intent.up(pointer()), false, 'a second release cannot reuse the same press');
});

test('an orbit returning to its start never becomes a click or double-click inspection', () => {
  const intent = createPointerIntent();
  intent.down(pointer()); intent.move(pointer({ clientX: 140 }));
  intent.move(pointer({ clientX: 100 }));
  assert.equal(intent.up(pointer()), false);
  assert.equal(intent.canDoubleClick(), false);
  intent.down(pointer()); assert.equal(intent.up(pointer()), true);
  assert.equal(intent.canDoubleClick(), false, 'a click following an orbit cannot complete a double click');
  intent.down(pointer());
  assert.equal(intent.up(pointer({ clientY: 106 })), false, 'last movement is checked even without a move event');
});

test('pinching, secondary buttons, cancellation and lost capture cannot select a component', () => {
  const intent = createPointerIntent();
  intent.down(pointer()); intent.down(pointer({ pointerId: 2, isPrimary: false }));
  assert.equal(intent.up(pointer({ pointerId: 2 })), false);
  assert.equal(intent.up(pointer()), false);
  intent.down(pointer({ button: 2 }));
  assert.equal(intent.up(pointer()), false);
  intent.down(pointer()); intent.cancel(pointer());
  assert.equal(intent.up(pointer()), false);
  assert.equal(intent.canDoubleClick(), false);
  intent.down(pointer());
  assert.equal(intent.up(pointer()), true, 'a fresh single touch still works after cancellation');
});
