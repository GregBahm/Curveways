# Orbit

A browser prototype for a node connection game. Requires Node.js; no packages to install.

Run `npm start` and open http://localhost:3000. Run geometry checks with `npm test`.

The floating setup panel previews changes immediately: choose 50–2,000 random nodes and 0–40 simultaneous repulsion passes. Easing adjustments reuse the same random field. Press Start to hide setup and begin playing on the full-window playfield. Reload to set up another game.

Select a start and end node, then move the pointer perpendicular to their chord to shape the first circular arc. Click to commit. After that, hover over a node to preview the next circular arc and click to extend the chain. Each arc inherits the previous endpoint tangent automatically; later arcs cannot be shaped manually. Crossing previews turn red and cannot be placed. Near zero curvature becomes a straight line; a direct reversal cannot continue smoothly. Escape cancels the preview while retaining the chain endpoint; Ctrl/Cmd+Z removes the last connection and restores the previous endpoint and direction. Resizing preserves board geometry.

Analytic segment/circle intersection checks reject crossings, tangencies, and overlaps. Connections may share endpoints. Passing through an unrelated node does not create a junction. The board is held in memory; refreshing starts over.


After each connection, every node is checked for a legal tangent continuation. If none remain, the game inverts its colors and displays the Game over setup panel. Right-click anywhere or press Ctrl/Cmd+Z to undo and resume, even after changing setup sliders. Start begins a fresh board using the current settings.

Scroll the wheel over the field to zoom around the pointer (0.2x–12x). Hold the middle mouse button and drag to pan. These controls also work on the game-over screen.
