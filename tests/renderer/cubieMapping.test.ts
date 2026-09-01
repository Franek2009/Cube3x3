import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { generateScramble } from '../../src/core/scramble/scrambler.ts';
import {
  mapCubeStateToCubies,
  type CubieRenderData,
  type Face
} from '../../src/renderer/cubieMapping.ts';

function bySlot(cubies: readonly CubieRenderData[], slot: string): CubieRenderData {
  const cubie = cubies.find((candidate) => candidate.slot === slot);

  if (cubie === undefined) {
    throw new Error(`Missing rendered slot: ${slot}`);
  }

  return cubie;
}

function stickerDirections(cubie: CubieRenderData): Record<string, Face> {
  return Object.fromEntries(cubie.stickers.map((sticker) => [sticker.face, sticker.direction]));
}

describe('mapCubeStateToCubies', () => {
  it('maps every solved cubie to its solved slot', () => {
    const cubies = mapCubeStateToCubies(solvedState());

    for (const cubie of cubies) {
      expect(cubie.id).toBe(`${cubie.kind}-${cubie.slot}`);
    }
  });

  it('maps solved corner stickers to matching world directions', () => {
    const corners = mapCubeStateToCubies(solvedState()).filter(
      (cubie) => cubie.kind === 'corner'
    );

    for (const corner of corners) {
      expect(corner.stickers.every((sticker) => sticker.face === sticker.direction)).toBe(true);
    }
  });

  it('maps solved edge stickers to matching world directions', () => {
    const edges = mapCubeStateToCubies(solvedState()).filter((cubie) => cubie.kind === 'edge');

    for (const edge of edges) {
      expect(edge.stickers.every((sticker) => sticker.face === sticker.direction)).toBe(true);
    }
  });

  it('keeps centers fixed with matching sticker directions', () => {
    const centers = mapCubeStateToCubies(solvedState()).filter(
      (cubie) => cubie.kind === 'center'
    );

    expect(centers).toEqual([
      { id: 'center-U', kind: 'center', slot: 'U', position: { x: 0, y: 1, z: 0 }, stickers: [{ face: 'U', direction: 'U' }] },
      { id: 'center-D', kind: 'center', slot: 'D', position: { x: 0, y: -1, z: 0 }, stickers: [{ face: 'D', direction: 'D' }] },
      { id: 'center-L', kind: 'center', slot: 'L', position: { x: -1, y: 0, z: 0 }, stickers: [{ face: 'L', direction: 'L' }] },
      { id: 'center-R', kind: 'center', slot: 'R', position: { x: 1, y: 0, z: 0 }, stickers: [{ face: 'R', direction: 'R' }] },
      { id: 'center-F', kind: 'center', slot: 'F', position: { x: 0, y: 0, z: 1 }, stickers: [{ face: 'F', direction: 'F' }] },
      { id: 'center-B', kind: 'center', slot: 'B', position: { x: 0, y: 0, z: -1 }, stickers: [{ face: 'B', direction: 'B' }] }
    ]);
  });

  it('moves the correct cubies into R-layer slots', () => {
    const cubies = mapCubeStateToCubies(solvedState().applyMove('R'));

    expect(bySlot(cubies, 'URF').id).toBe('corner-DFR');
    expect(bySlot(cubies, 'UBR').id).toBe('corner-URF');
    expect(bySlot(cubies, 'DRB').id).toBe('corner-UBR');
    expect(bySlot(cubies, 'DFR').id).toBe('corner-DRB');
    expect(bySlot(cubies, 'UR').id).toBe('edge-FR');
    expect(bySlot(cubies, 'BR').id).toBe('edge-UR');
  });

  it('moves the correct cubies into U-layer slots without twisting them', () => {
    const cubies = mapCubeStateToCubies(solvedState().applyMove('U'));

    expect(bySlot(cubies, 'URF').id).toBe('corner-UBR');
    expect(bySlot(cubies, 'UF').id).toBe('edge-UR');
    expect(stickerDirections(bySlot(cubies, 'URF'))).toEqual({ U: 'U', B: 'R', R: 'F' });
  });

  it.each([
    ['R', 'URF', { D: 'F', F: 'U', R: 'R' }],
    ['L', 'UFL', { U: 'F', L: 'L', B: 'U' }],
    ['F', 'URF', { U: 'R', F: 'F', L: 'U' }],
    ['B', 'ULB', { U: 'L', B: 'B', R: 'U' }]
  ] as const)('represents corner orientation after %s in slot %s', (move, slot, expected) => {
    const cubie = bySlot(mapCubeStateToCubies(solvedState().applyMove(move)), slot);

    expect(stickerDirections(cubie)).toEqual(expected);
  });

  it('represents all four edge flips after F', () => {
    const cubies = mapCubeStateToCubies(solvedState().applyMove('F'));

    expect(stickerDirections(bySlot(cubies, 'UF'))).toEqual({ F: 'F', L: 'U' });
    expect(stickerDirections(bySlot(cubies, 'FR'))).toEqual({ U: 'R', F: 'F' });
    expect(stickerDirections(bySlot(cubies, 'DF'))).toEqual({ F: 'F', R: 'D' });
    expect(stickerDirections(bySlot(cubies, 'FL'))).toEqual({ D: 'L', F: 'F' });
  });

  it('represents all four edge flips after B', () => {
    const cubies = mapCubeStateToCubies(solvedState().applyMove('B'));

    expect(stickerDirections(bySlot(cubies, 'UB'))).toEqual({ B: 'B', R: 'U' });
    expect(stickerDirections(bySlot(cubies, 'BR'))).toEqual({ D: 'R', B: 'B' });
    expect(stickerDirections(bySlot(cubies, 'DB'))).toEqual({ B: 'B', L: 'D' });
    expect(stickerDirections(bySlot(cubies, 'BL'))).toEqual({ U: 'L', B: 'B' });
  });

  it('returns solved render data after a move and its inverse', () => {
    const solved = mapCubeStateToCubies(solvedState());
    const restored = mapCubeStateToCubies(solvedState().applyMoves(['F', "F'"]));

    expect(restored).toEqual(solved);
  });

  it('returns exactly 26 cubies for a legal scramble', () => {
    const scramble = generateScramble(25, () => 0.42);
    const cubies = mapCubeStateToCubies(solvedState().applyMoves(scramble));

    expect(cubies).toHaveLength(26);
  });

  it('does not produce duplicate positions', () => {
    const state = solvedState().applyMoves(generateScramble(25, () => 0.73));
    const positions = mapCubeStateToCubies(state).map(
      (cubie) => `${cubie.position.x},${cubie.position.y},${cubie.position.z}`
    );

    expect(new Set(positions).size).toBe(26);
  });

  it('does not lose or duplicate cubies', () => {
    const state = solvedState().applyMoves(generateScramble(25, () => 0.91));
    const ids = mapCubeStateToCubies(state).map((cubie) => cubie.id);

    expect(new Set(ids).size).toBe(26);
    expect(ids.filter((id) => id.startsWith('corner-'))).toHaveLength(8);
    expect(ids.filter((id) => id.startsWith('edge-'))).toHaveLength(12);
    expect(ids.filter((id) => id.startsWith('center-'))).toHaveLength(6);
  });
});
