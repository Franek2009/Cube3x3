import type { CubeState } from '../core/cube/CubeState.ts';

export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

export interface Position3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface StickerRenderData {
  readonly face: Face;
  readonly direction: Face;
}

export interface CubieRenderData {
  readonly id: string;
  readonly kind: 'corner' | 'edge' | 'center';
  readonly slot: string;
  readonly position: Position3D;
  readonly stickers: readonly StickerRenderData[];
}

interface SlotDefinition {
  readonly name: string;
  readonly faces: readonly Face[];
}

const CORNER_SLOTS: readonly SlotDefinition[] = [
  { name: 'URF', faces: ['U', 'R', 'F'] },
  { name: 'UFL', faces: ['U', 'F', 'L'] },
  { name: 'ULB', faces: ['U', 'L', 'B'] },
  { name: 'UBR', faces: ['U', 'B', 'R'] },
  { name: 'DFR', faces: ['D', 'F', 'R'] },
  { name: 'DLF', faces: ['D', 'L', 'F'] },
  { name: 'DBL', faces: ['D', 'B', 'L'] },
  { name: 'DRB', faces: ['D', 'R', 'B'] }
];

const EDGE_SLOTS: readonly SlotDefinition[] = [
  { name: 'UR', faces: ['U', 'R'] },
  { name: 'UF', faces: ['U', 'F'] },
  { name: 'UL', faces: ['U', 'L'] },
  { name: 'UB', faces: ['U', 'B'] },
  { name: 'DR', faces: ['D', 'R'] },
  { name: 'DF', faces: ['D', 'F'] },
  { name: 'DL', faces: ['D', 'L'] },
  { name: 'DB', faces: ['D', 'B'] },
  { name: 'FR', faces: ['F', 'R'] },
  { name: 'FL', faces: ['F', 'L'] },
  { name: 'BL', faces: ['B', 'L'] },
  { name: 'BR', faces: ['B', 'R'] }
];

const CENTER_FACES: readonly Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];

const FACE_VECTORS: Readonly<Record<Face, Position3D>> = {
  U: { x: 0, y: 1, z: 0 },
  D: { x: 0, y: -1, z: 0 },
  L: { x: -1, y: 0, z: 0 },
  R: { x: 1, y: 0, z: 0 },
  F: { x: 0, y: 0, z: 1 },
  B: { x: 0, y: 0, z: -1 }
};

function positionForFaces(faces: readonly Face[]): Position3D {
  return faces.reduce<Position3D>(
    (position, face) => ({
      x: position.x + FACE_VECTORS[face].x,
      y: position.y + FACE_VECTORS[face].y,
      z: position.z + FACE_VECTORS[face].z
    }),
    { x: 0, y: 0, z: 0 }
  );
}

function movableCubieData(
  kind: 'corner' | 'edge',
  slots: readonly SlotDefinition[],
  permutation: readonly number[],
  orientation: readonly number[]
): CubieRenderData[] {
  return slots.map((slot, slotIndex) => {
    const cubieIndex = permutation[slotIndex];
    const cubie = slots[cubieIndex];
    const cubieOrientation = orientation[slotIndex];

    return {
      id: `${kind}-${cubie.name}`,
      kind,
      slot: slot.name,
      position: positionForFaces(slot.faces),
      stickers: cubie.faces.map((face, stickerIndex) => ({
        face,
        direction: slot.faces[(stickerIndex + cubieOrientation) % slot.faces.length]
      }))
    };
  });
}

export function mapCubeStateToCubies(state: CubeState): CubieRenderData[] {
  const corners = movableCubieData(
    'corner',
    CORNER_SLOTS,
    state.cornerPermutation,
    state.cornerOrientation
  );
  const edges = movableCubieData(
    'edge',
    EDGE_SLOTS,
    state.edgePermutation,
    state.edgeOrientation
  );
  const centers = CENTER_FACES.map<CubieRenderData>((face) => ({
    id: `center-${face}`,
    kind: 'center',
    slot: face,
    position: FACE_VECTORS[face],
    stickers: [{ face, direction: face }]
  }));

  return [...corners, ...edges, ...centers];
}
