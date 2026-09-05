import { describe, expect, it } from 'vitest';

import { formatCubeActions, type CubeAction } from '../../src/ui/cubeAction.ts';

describe('cube actions', () => {
  it('formats user moves and rotations in input order', () => {
    const actions: CubeAction[] = ['y', 'F', "R'", 'x2', 'U'];

    expect(formatCubeActions(actions)).toBe("y F R' x2 U");
  });

  it('formats an empty history as empty text', () => {
    expect(formatCubeActions([])).toBe('');
  });
});
