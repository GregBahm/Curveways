import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from './sphere-geometry.js';
const p = (x, y, z) => g.unit({ x, y, z });
function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test('repeated node pairs allow distinct arcs and exact retracing in either direction', () => {
  const a = p(1, 0, 0),
    b = p(0, 1, 0),
    c = p(1, 1, 0);
  const first = g.throughArc(a, b, p(1, 1, 1)),
    differentApproach = g.throughArc(a, b, p(1, 1, -1));
  assert.equal(g.conflicts(first, differentApproach), false);
  assert.equal(g.legal(differentApproach, [first]), true);
  assert.equal(g.legal(g.throughArc(a, b, p(1, 1, 1)), [first]), true);
  const reverse = g.throughArc(b, a, p(1, 1, -1));
  assert.equal(g.legal(reverse, [first]), true);
  assert.equal(g.legal(g.throughArc(b, a, p(1, 1, 1)), [reverse]), true);
  assert.equal(g.legal(g.throughArc(b, a, p(1, 1, -1)), [reverse]), true);
  const indirect = [g.greatArc(a, c), g.greatArc(c, b)];
  assert.equal(g.legal(differentApproach, indirect), true);
  const history = [first];
  history.pop();
  assert.equal(g.legal(differentApproach, history), true);
  assert.equal(g.legal(g.throughArc({ ...a }, { ...b }, p(1, 1, -1)), [first]), true);
});
test('nearly tangent small circles do not invent crossings beside a shared node', () => {
  const a = { x: 0.006222088046432832, y: 0.003220363055832466, z: 0.9999754571398894 };
  const b = { x: 0.0012393641027113177, y: 0.0054712123389746604, z: 0.9999842647822829 };
  const mid = { x: 0.0018456760667177835, y: -0.00048027886093696587, z: 0.9999981814043825 };
  const target = { x: 0.004874186356069392, y: -0.00006513759181691707, z: 0.9999881189616507 };
  const first = g.throughArc(a, b, mid),
    next = g.tangentArc(b, target, g.endTangent(first));
  assert.equal(g.conflicts(first, next), false);
  assert.equal(g.conflicts(next, first), false);
  assert.equal(g.legal(next, [first]), true);
  assert.equal(g.hasLegalContinuation([target], [first]), true);
  assert.equal(g.conflicts(first, g.throughArc(b, a, mid)), false);
});
test('shared-node arcs still reject a second crossing away from their junction', () => {
  const a = p(1, 0, 0),
    b = p(0, 1, 0),
    mid = p(-1, 0, 0);
  const equator = g.throughArc(a, b, mid);
  const crossing = g.throughArc(a, p(-1, -1, 1), p(-1, 0, 0));
  assert.equal(g.conflicts(equator, crossing), true);
});
test('spherical random fields and easing remain on the surface', () => {
  let nodes = g.randomNodes(1000, seededRandom(1));
  for (let i = 0; i < 12; i++) nodes = g.easeNodes(nodes);
  assert.ok(nodes.every((node) => Math.abs(g.length(node) - 1) < 1e-12));
  assert.ok(nodes.some((node) => node.y < -0.5) && nodes.some((node) => node.y > 0.5));
});
test('arcs lie on the sphere and their supporting circle', () => {
  const a = p(1, 0, 0),
    b = p(0, 1, 0),
    mid = p(1, 1, 0.8),
    arc = g.throughArc(a, b, mid);
  assert.ok(g.distance(g.pointOnArc(arc, 0), a) < 1e-10);
  assert.ok(g.distance(g.pointOnArc(arc, 1), b) < 1e-10);
  for (let i = 0; i <= 100; i++) {
    const point = g.pointOnArc(arc, i / 100);
    assert.ok(Math.abs(g.length(point) - 1) < 1e-10);
    assert.ok(Math.abs(g.dot(point, arc.n) - arc.d) < 1e-10);
  }
});
test('continuations preserve the directed surface tangent', () => {
  const random = seededRandom(2);
  for (let i = 0; i < 100; i++) {
    const [a, b, c] = g.randomNodes(3, random),
      first = g.greatArc(a, b),
      t = g.endTangent(first),
      next = g.tangentArc(b, c, t);
    assert.ok(next);
    assert.ok(g.distance(g.unit(g.cross(next.n, g.sub(b, next.c))), t) < 1e-9);
    assert.ok(g.distance(g.pointOnArc(next, 1), c) < 1e-8);
    assert.equal(g.conflicts(first, next), false);
  }
});
test('shared junctions and exact retracing are legal but crossings are blocked', () => {
  const a = p(1, 0, 0),
    b = p(0, 1, 0),
    first = g.greatArc(a, b);
  assert.equal(g.conflicts(first, g.greatArc(b, p(-1, 0, 0))), false);
  assert.equal(g.conflicts(first, g.greatArc(b, a)), false);
  assert.equal(g.conflicts(first, g.greatArc(p(1, 1, 1), p(1, 1, -1))), true);
  assert.equal(g.conflicts(first, g.greatArc(p(-1, -1, 1), p(-1, -1, -1))), false);
});
test('partial overlap remains blocked and retracing does not bypass other crossings', () => {
  const a = p(1, 0, 0),
    b = p(0, 1, 0),
    first = g.greatArc(a, b),
    middle = p(1, 1, 0);
  assert.equal(g.conflicts(first, g.greatArc(a, middle)), true);
  assert.equal(g.conflicts(first, g.greatArc(middle, p(-1, 1, 0))), true);
  const crossing = g.greatArc(p(1, 1, 1), p(1, 1, -1));
  assert.equal(g.legal(g.greatArc(b, a), [first, crossing]), false);
});
test('a completed circle can be traced repeatedly without a false game over', () => {
  const a = p(1, 0, 0),
    b = p(0, 1, 0),
    first = g.greatArc(a, b),
    second = g.tangentArc(b, a, g.endTangent(first));
  const next = g.tangentArc(a, b, g.endTangent(second));
  assert.ok(g.sameTrace(first, next));
  assert.ok(g.legal(next, [first, second]));
  assert.ok(g.hasLegalContinuation([a, b], [first, second]));
});
