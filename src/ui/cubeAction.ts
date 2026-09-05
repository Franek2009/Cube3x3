import type { Move } from '../core/moves/moves.ts';
import type { CubeRotation } from '../core/orientation/cubeOrientation.ts';

export type CubeAction = Move | CubeRotation;

export function formatCubeActions(actions: readonly CubeAction[]): string {
  return actions.join(' ');
}
