# Cube3x3

[![CI](https://github.com/Franek2009/Cube3x3/actions/workflows/ci.yml/badge.svg)](https://github.com/Franek2009/Cube3x3/actions/workflows/ci.yml)

[Live demo](https://franek2009.github.io/Cube3x3/)

Cube3x3 is a browser-based interactive Rubik's Cube 3×3 simulator, speedcubing timer, and Two-Phase solver. It combines an immutable cube engine with an animated Three.js visualization and keeps solving work off the UI thread.

## Features

- Interactive Three.js 3D cube with animated moves.
- All standard `U`, `D`, `L`, `R`, `F`, and `B` face moves, including prime and double variants.
- Discrete mouse and touch reorientation plus `x`, `y`, and `z` whole-cube rotations.
- Front/Up indicators that reflect the current user-facing cube orientation.
- Configurable physical-key keyboard shortcuts for all moves and rotations.
- Legal scramble generation, solve timer, move count, and action history.
- Locally persisted solve history with Last, Best, Ao5, and Ao12 statistics.
- Two-Phase solver running in a Web Worker.
- Animated solution playback with HTM, QTM, and face-usage analysis.
- Local persistence for solve records and keyboard settings.

## Controls

Every face move and cube rotation is available through the on-screen controls. The default physical-key bindings use `U`, `D`, `L`, `R`, `F`, and `B` for clockwise face turns and `Shift` with those keys for prime turns. `X`, `Y`, and `Z` similarly reorient the whole cube, with `Shift` selecting the prime variant. Double moves and rotations are available from the buttons, and every shortcut can be changed or cleared in **Keyboard controls**.

Drag across the cube with a mouse, pen, or touch input to reorient it by one discrete quarter turn. Use the mouse wheel or a pinch gesture to zoom. Reorientation changes the Front/Up frame used to interpret subsequent face moves; it does not alter the underlying base-coordinate cube state.

## Solver

The solver uses a Kociemba-inspired Two-Phase approach with compact coordinates, precomputed move tables, and pruning tables. Initialization and search run in a Web Worker so they do not block cube interaction or rendering.

Solutions can be played back move by move. The accompanying analysis reports Half Turn Metric (HTM), Quarter Turn Metric (QTM), quarter and half turns, scramble length, and per-face usage. Solutions are intended to be practical and short, but are not guaranteed to be optimal.

## Timer and statistics

Creating a new scramble prepares the timer. The first user face move starts it, and the face move that returns the cube to solved stops it and records the result. Whole-cube rotations do not start or stop the timer and do not increase the solve move count.

Completed solves are stored in the browser and summarized as Last, Best, Ao5, and Ao12. No WCA penalty or DNF workflow is implemented.

## Architecture

The cube engine is independent of Three.js and the UI. An immutable `CubeState` stores corner and edge permutations and orientations; moves produce new states without mutating their inputs. The renderer displays those states and maintains visual orientation separately, while the solver converts them into compact search coordinates. Worker isolation keeps solver initialization and search outside the main browser thread.

## Tech stack

- TypeScript
- Vite
- Three.js
- Vitest
- GitHub Actions

## Development

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Run verification and preview the production build with:

```sh
npm test
npm run build
npm run preview
```

## Testing

The suite contains more than 800 automated tests covering cube invariants, moves, parsing and serialization, scramble generation, solver coordinates and search, Worker/client communication, timer and solve history, cube orientation, keyboard controls, solution playback, cancellation, and error paths.

## Data and privacy

Solve history and keyboard settings are stored locally in the browser using `localStorage`. The application has no account system, backend, or cross-device cloud sync.

## Known limitations

- Persistence is local to the current browser and origin, with no cross-device synchronization.
- Solver output is not guaranteed to be optimal.
- The initial JavaScript bundle is relatively large; further loading and bundle optimization is future work.

## License

Cube3x3 is available under the [MIT License](LICENSE).
