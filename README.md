# Curveways

A browser game about tracing a continuous chain of circular arcs across a sphere. Built with Three.js; requires Node.js and a browser with WebGL 2.

## Run

Run `npm install`, then `npm start`, and open http://localhost:3000. Run `npm test` for geometry, camera, and game-state checks.

## Play

- Adjust the floating setup panel to preview 50–2,000 nodes and 0–40 easing passes. Settings persist across refreshes. Nodes are sampled uniformly over the entire sphere, then repel nearby nodes along its surface.
- Press Start. Select two visible nodes, move over the sphere to shape the first arc, and click to place it. Before selecting the second node, hovering previews the shortest surface route.
- Hover over each next node to preview a circular arc that inherits the previous arc's directed surface tangent. Click to extend the chain. Every arc lies on the sphere; these are small-circle arcs, including great circles as a special case.
- Middle-button drag pans the sphere in screen space; right-button drag rotates it. A right-click without dragging undoes on release. Scroll zooms around the pointer. Nodes on the far side are hidden and cannot be selected; rotate to reach them. Rotation is available while shaping or previewing an arc.
- Arcs may meet at shared node endpoints. Crossings elsewhere, overlaps, and retracing are invalid. Intersection checks use the sphere geometry, independently of the current camera view.
- Each directed node pair can be connected once: A to B once and B to A once. Indirect routes do not count. Undo frees the removed directed connection.
- The sphere and controls are grayscale. The chain gradients from deep blue to bright cyan across its full surface length, updating on placement and undo. Invalid previews are red.
- Right-click or Ctrl/Cmd+Z undoes. Escape cancels the current preview while retaining the chain endpoint.
- If every possible next connection is blocked, colors invert and the Game over setup panel appears. Hover still previews blocked moves. Undo restores play, including after adjusting the new-game settings. Start generates a new board.

The board and chain are held in memory; refreshing returns to setup with the saved slider settings. Easing reuses the same random seed while adjusting sliders; refreshing or starting another game uses a new seed.

## Implementation

`sphere-geometry.js` contains pure vector math, surface easing, circular arcs, and analytic intersection checks. `sphere-view.js` handles Three.js rendering, picking, zoom, and trackball rotation. `sphere-game.js` manages input and game state. Dependencies are served locally; no CDN is required.

The original planar sources and tests remain as a reference. The active entry point is `sphere-game.js`.

## 2D checkpoint

The working planar prototype is committed on `main` at `ef6d8ce` (Build playable 2D Curveways prototype). The spherical version is on `sphere-prototype`. To return to 2D, stop the server, switch to `main`, then run `npm start` again.
