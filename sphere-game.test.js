import test from 'node:test';
import assert from 'node:assert/strict';
import * as geometry from './sphere-geometry.js';
import { createSphereGame } from './sphere-game.js';

async function setup({ forceDeadEnd = false, settings = {}, frames = null } = {}) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        value: id === 'count' ? '50' : '0',
        min: id === 'count' ? '50' : '0',
        max: id === 'count' ? '2000' : '40',
        step: id === 'count' ? '50' : '1',
        hidden: false,
        disabled: false,
        style: {},
        listeners: {},
        setAttribute() {},
        addEventListener(type, handler) {
          this.listeners[type] = handler;
        },
        setPointerCapture() {},
        hasPointerCapture: () => true,
        releasePointerCapture() {},
      });
    return elements.get(id);
  };
  const classes = new Set();
  const document = {
    getElementById: element,
    body: {
      classList: {
        toggle(name, on) {
          on ? classes.add(name) : classes.delete(name);
        },
      },
    },
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
  const nodes = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
  const calls = { rotations: 0, zooms: 0, pan: null };
  let rendered;
  const view = {
    render(state) {
      rendered = state;
    },
    pick: (event) => event.node ?? null,
    surfacePoint: (event) => event.surface ?? null,
    reset() {},
    snapshot: () => ({ camera: 'snapshot' }),
    restore(saved) {
      assert.equal(saved.camera, 'snapshot');
    },
    pan(dx, dy) {
      calls.pan = [dx, dy];
    },
    beginRotate() {
      calls.rotations++;
    },
    rotate() {
      calls.rotations++;
    },
    endRotate() {},
    zoomAt() {
      calls.zooms++;
    },
  };
  const values = new Map(Object.entries(settings));
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      values.set(key, value);
    },
  };
  let generations = 0;
  const game = createSphereGame({
    document,
    window: { addEventListener() {} },
    storage,
    requestFrame: (callback) => (frames ? frames.push(callback) : callback()),
    createView: () => view,
    geometry: {
      ...geometry,
      randomNodes(count, random) {
        return generations++ === 0 ? nodes : geometry.randomNodes(count, random);
      },
      hasLegalContinuation: forceDeadEnd ? () => false : geometry.hasLegalContinuation,
    },
  });
  if (!frames) await game.ready;
  const canvas = element('board');
  const move = (node) => canvas.listeners.pointermove({ node });
  const click = (node) => canvas.listeners.click({ button: 0, node });
  const undo = () => document.listeners.contextmenu({ preventDefault() {} });
  const firstArc = () => {
    click(nodes[0]);
    click(nodes[1]);
    click(nodes[1]);
  };
  return {
    game,
    element,
    canvas,
    document,
    classes,
    nodes,
    calls,
    values,
    move,
    click,
    undo,
    firstArc,
    get rendered() {
      return rendered;
    },
  };
}

test('first-arc previews, tangent continuation, and undo use the real controller', async () => {
  const h = await setup();
  await h.element('start').onclick();
  const [a, b, c] = h.nodes;
  h.click(a);
  h.move(b);
  assert.equal(h.rendered.preview.b, b);
  assert.equal(h.rendered.end, null);
  h.click(b);
  h.click(b);
  assert.equal(h.game.getState().arcs.length, 1);
  h.move(c);
  assert.equal(h.rendered.preview.b, c);
  assert.equal(h.rendered.invalid, false);
  h.click(c);
  assert.equal(h.game.getState().arcs.length, 2);
  h.undo();
  assert.equal(h.game.getState().start, b);
  assert.equal(h.game.getState().arcs.length, 1);
  h.click(a);
  h.click(b); // Complete the circle, then trace its initial segment again.
  assert.equal(h.game.getState().phase, 'playing');
  assert.equal(h.game.getState().arcs.length, 3);
  h.undo();
  assert.equal(h.game.getState().arcs.length, 2);
});

test('middle-drag pans and right-drag rotates without accidentally undoing', async () => {
  const h = await setup();
  await h.element('start').onclick();
  h.firstArc();
  h.click(h.nodes[2]);
  const send = (type, event) => h.canvas.listeners[type]({ preventDefault() {}, ...event });
  send('pointerdown', { button: 1, pointerId: 5, clientX: 100, clientY: 100 });
  send('pointermove', { pointerId: 5, clientX: 140, clientY: 120 });
  assert.deepEqual(h.calls.pan, [40, 20]);
  assert.equal(h.calls.rotations, 0);
  h.click(h.nodes[0]);
  assert.equal(h.game.getState().arcs.length, 2);
  send('pointerup', { pointerId: 5, clientX: 140, clientY: 120 });
  const context = () => h.document.listeners.contextmenu({ target: h.canvas, preventDefault() {} });
  send('pointerdown', { button: 2, pointerId: 6, clientX: 100, clientY: 100 });
  context();
  assert.equal(h.game.getState().arcs.length, 2);
  send('pointermove', { pointerId: 6, clientX: 102, clientY: 101 });
  assert.equal(h.calls.rotations, 1);
  send('pointermove', { pointerId: 6, clientX: 150, clientY: 120 });
  assert.equal(h.calls.rotations, 2);
  send('pointerup', { pointerId: 6, clientX: 100, clientY: 100 });
  context();
  assert.equal(h.game.getState().arcs.length, 2);
  send('pointerdown', { button: 2, pointerId: 7, clientX: 100, clientY: 100 });
  send('pointerup', { pointerId: 7, clientX: 102, clientY: 101 });
  context();
  assert.equal(h.game.getState().arcs.length, 1);
  send('pointerdown', { button: 2, pointerId: 8, clientX: 100, clientY: 100 });
  send('pointercancel', { pointerId: 8, clientX: 100, clientY: 100 });
  assert.equal(h.game.getState().arcs.length, 1);
  send('wheel', {});
  assert.equal(h.calls.zooms, 1);
});

test('game-over previews, slider regeneration, undo, and restart preserve the finished board', async () => {
  // Geometry has its own dead-end tests; force a dead end to isolate this UI lifecycle.
  const h = await setup({ forceDeadEnd: true });
  await h.element('start').onclick();
  h.firstArc();
  assert.equal(h.game.getState().phase, 'game-over');
  assert.ok(h.classes.has('game-over'));
  h.move(h.nodes[0]);
  assert.equal(h.rendered.invalid, false);
  h.click(h.nodes[0]);
  assert.equal(h.game.getState().arcs.length, 1);
  h.element('count').listeners.input();
  assert.equal(h.game.getState().arcs.length, 0);
  h.undo();
  assert.equal(h.game.getState().nodes.length, 3);
  assert.equal(h.game.getState().arcs.length, 0);
  assert.equal(h.game.getState().phase, 'playing');
  assert.equal(h.element('setup').hidden, true);
  h.firstArc();
  assert.equal(h.game.getState().phase, 'game-over');
  await h.element('start').onclick();
  assert.equal(h.game.getState().arcs.length, 0);
  assert.equal(h.game.getState().nodes.length, 50);
  assert.equal(h.game.getState().phase, 'playing');
});

test('settings preserve their existing storage keys and restore on the next initialization', async () => {
  const h = await setup({ settings: { 'orbit.board.count': '150' } });
  assert.equal(h.element('count').value, '150');
  h.element('count').value = '200';
  h.element('count').listeners.input();
  assert.equal(h.values.get('orbit.board.count'), '200');
  const restored = await setup({ settings: Object.fromEntries(h.values) });
  assert.equal(restored.element('count').value, '200');
  const invalid = await setup({ settings: { 'orbit.board.count': 'invalid' } });
  assert.equal(invalid.element('count').value, '50');
});

test('rapid slider changes cancel obsolete easing work before enabling Start', async () => {
  const frames = [];
  const h = await setup({ settings: { 'orbit.board.easing': '4' }, frames });
  assert.equal(h.element('start').disabled, true);
  h.element('count').value = '100';
  h.element('count').listeners.input();
  while (frames.length) {
    frames.shift()();
    await Promise.resolve();
  }
  await h.game.ready;
  assert.equal(h.game.getState().nodes.length, 100);
  assert.equal(h.element('start').disabled, false);
  assert.equal(h.game.getState().phase, 'setup');
});
