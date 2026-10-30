import * as SphereGeometry from './sphere-geometry.js';
import { createSphereView } from './sphere-view.js';

export function createSphereGame({
  document = globalThis.document,
  window = globalThis.window,
  storage = globalThis.localStorage,
  requestFrame = globalThis.requestAnimationFrame,
  createView = createSphereView,
  geometry = SphereGeometry,
} = {}) {
  const {
    greatArc,
    throughArc,
    tangentArc,
    endTangent,
    legal,
    hasLegalContinuation,
    randomNodes,
    easeNodes,
    distance,
  } = geometry;
  const $ = (id) => document.getElementById(id),
    canvas = $('board');
  let view;
  try {
    view = createView(canvas);
  } catch (error) {
    $('setup').insertAdjacentHTML(
      'afterbegin',
      '<p>This game requires WebGL. Enable hardware acceleration in your browser and reload.</p>',
    );
    console.error(error);
    throw error;
  }
  let nodes = [],
    arcs = [],
    start = null,
    end = null,
    hover = null,
    preview = null,
    invalid = false;
  let phase = 'setup',
    finishedGame = null,
    generation = 0,
    seed = Math.floor(Math.random() * 4294967296);
  let gesture = null;
  function draw() {
    view.render({ nodes, arcs, start, end, hover, preview, invalid });
  }
  function message(text) {
    canvas.setAttribute('aria-description', text);
  }
  function setPhase(value) {
    phase = value;
    document.body.classList.toggle('game-over', phase === 'game-over');
    $('game-over').hidden = phase !== 'game-over';
    $('setup').hidden = phase === 'playing';
  }
  function cancel() {
    start = arcs.at(-1)?.b ?? null;
    end = preview = hover = null;
    invalid = false;
    draw();
  }
  function commit() {
    if (!preview || invalid) return;
    arcs.push(preview);
    cancel();
    if (!hasLegalContinuation(nodes, arcs)) {
      finishedGame = { nodes, arcs: [...arcs], camera: view.snapshot() };
      setPhase('game-over');
      message('Game over. No legal moves remain. Right-click to undo or start a new game.');
    }
  }
  function updatePointer(event) {
    if (phase === 'setup') return;
    hover = view.pick(event, nodes);
    if (arcs.length) {
      end = hover && hover !== start ? hover : null;
      const arc = end ? tangentArc(start, end, endTangent(arcs.at(-1))) : null;
      preview = arc || (end ? greatArc(start, end) : null);
      invalid = !!end && !legal(arc, arcs);
    } else if (start && end) {
      const point = view.surfacePoint(event);
      preview =
        point && distance(point, start) > 0.001 && distance(point, end) > 0.001
          ? throughArc(start, end, point)
          : preview || greatArc(start, end);
      invalid = !legal(preview, arcs);
    } else {
      preview = start && hover && hover !== start ? greatArc(start, hover) : null;
      invalid = false;
    }
    canvas.style.cursor = hover || end ? 'pointer' : 'crosshair';
    draw();
  }
  canvas.addEventListener('pointermove', (event) => {
    if (gesture) {
      if (event.pointerId === gesture.pointerId) {
        if (gesture.button === 1) {
          view.pan(event.clientX - gesture.x, event.clientY - gesture.y);
          gesture.x = event.clientX;
          gesture.y = event.clientY;
        } else {
          if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4)
            gesture.dragged = true;
          if (gesture.dragged) view.rotate(event);
        }
      }
      return;
    }
    updatePointer(event);
  });
  canvas.addEventListener('pointerleave', () => {
    if (gesture) return;
    hover = null;
    if (arcs.length) {
      end = preview = null;
    } else if (!end) preview = null;
    draw();
  });
  canvas.addEventListener('click', (event) => {
    if (phase !== 'playing' || gesture || event.button !== 0) return;
    updatePointer(event);
    if (arcs.length) {
      commit();
      return;
    }
    if (start && end) {
      commit();
      return;
    }
    if (!hover) return;
    if (!start) {
      start = hover;
      message('Choose another node, then move to shape the first arc.');
    } else if (hover !== start) {
      end = hover;
      preview = greatArc(start, end);
    }
    draw();
  });
  canvas.addEventListener('pointerdown', (event) => {
    if ((event.button !== 1 && event.button !== 2) || gesture) return;
    event.preventDefault();
    gesture = {
      pointerId: event.pointerId,
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      dragged: false,
    };
    canvas.setPointerCapture(event.pointerId);
    if (event.button === 2) view.beginRotate(event);
    canvas.style.cursor = 'grabbing';
  });
  function stopGesture(event, canceled = false) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const click =
      gesture.button === 2 &&
      !gesture.dragged &&
      Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 4;
    gesture = null;
    view.endRotate();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = 'crosshair';
    if (!canceled && click && phase !== 'setup') undo();
  }
  canvas.addEventListener('pointerup', stopGesture);
  canvas.addEventListener('pointercancel', (event) => stopGesture(event, true));
  canvas.addEventListener('lostpointercapture', () => {
    gesture = null;
    view.endRotate();
    canvas.style.cursor = 'crosshair';
  });
  canvas.addEventListener('auxclick', (event) => {
    if (event.button === 1) event.preventDefault();
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      if (gesture) return;
      view.zoomAt(event);
      updatePointer(event);
    },
    { passive: false },
  );
  function undo() {
    if (phase === 'game-over' && finishedGame) {
      ++generation;
      nodes = finishedGame.nodes;
      arcs = finishedGame.arcs;
      view.restore(finishedGame.camera);
      finishedGame = null;
      setPhase('playing');
      $('start').disabled = false;
    }
    if (arcs.length) {
      arcs.pop();
      cancel();
    } else if (phase === 'playing') cancel();
  }
  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    // Canvas right-clicks undo on release, after distinguishing a click from a drag.
    if (event.target !== canvas && !gesture && phase !== 'setup') undo();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') cancel();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });
  for (const id of ['count', 'easing']) {
    const input = $(id),
      key = `orbit.board.${id}`;
    try {
      const saved = storage.getItem(key),
        value = Number(saved);
      if (saved !== null && saved.trim() !== '' && Number.isFinite(value)) {
        const min = Number(input.min),
          max = Number(input.max),
          step = Number(input.step) || 1;
        input.value = String(
          Math.max(min, Math.min(max, min + Math.round((value - min) / step) * step)),
        );
      }
    } catch {}
    $(`${id}-value`).textContent = Number(input.value).toLocaleString();
    input.addEventListener('input', () => {
      if (phase === 'playing') return;
      $(`${id}-value`).textContent = Number(input.value).toLocaleString();
      try {
        storage.setItem(key, input.value);
      } catch {}
      generate();
    });
  }
  async function generate() {
    const token = ++generation,
      count = Number($('count').value),
      passes = Number($('easing').value);
    $('start').disabled = true;
    arcs = [];
    cancel();
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    nodes = randomNodes(count, random);
    view.reset();
    draw();
    for (let pass = 0; pass < passes; pass++) {
      nodes = easeNodes(nodes);
      if (pass % 3 === 0) {
        draw();
        await new Promise(requestFrame);
        if (token !== generation) return;
      }
    }
    draw();
    $('start').disabled = false;
  }
  $('start').onclick = async () => {
    if ($('start').disabled) return;
    if (phase === 'game-over') {
      finishedGame = null;
      setPhase('setup');
      $('setup').hidden = true;
      seed = Math.floor(Math.random() * 4294967296);
      await generate();
    }
    setPhase('playing');
    message(
      'Choose a starting node. Middle-drag pans, right-drag rotates, and the scroll wheel zooms.',
    );
  };
  return {
    ready: generate(),
    getState: () => ({ phase, nodes: [...nodes], arcs: [...arcs], start, end, invalid }),
  };
}
