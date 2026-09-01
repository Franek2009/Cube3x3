import { ALL_MOVES, type Move } from '../core/moves/moves.ts';
import { generateScramble } from '../core/scramble/scrambler.ts';
import { CubeSession } from '../core/session/CubeSession.ts';
import { installKeyboardControls } from './keyboard.ts';

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Required UI element not found: #${id}`);
  }

  return element as T;
}

export function initializeApp(): void {
  const session = new CubeSession();
  const scrambleElement = getRequiredElement<HTMLParagraphElement>('scramble');
  const solvedElement = getRequiredElement<HTMLElement>('solved-status');
  const moveCountElement = getRequiredElement<HTMLElement>('move-count');
  const historyElement = getRequiredElement<HTMLParagraphElement>('move-history');
  const debugElement = getRequiredElement<HTMLPreElement>('debug-state');
  const controlsElement = getRequiredElement<HTMLDivElement>('move-controls');
  const newScrambleButton = getRequiredElement<HTMLButtonElement>('new-scramble');
  const resetButton = getRequiredElement<HTMLButtonElement>('reset-cube');
  let currentScramble: Move[] = [];

  const render = (): void => {
    const state = session.getState();
    const history = session.getMoveHistory();

    scrambleElement.textContent = currentScramble.length > 0
      ? currentScramble.join(' ')
      : 'No scramble applied';
    solvedElement.textContent = session.isSolved() ? 'Yes' : 'No';
    moveCountElement.textContent = String(history.length);
    historyElement.textContent = history.join(' ');
    debugElement.textContent = [
      `Solved: ${session.isSolved() ? 'yes' : 'no'}`,
      `Moves: ${history.length}`,
      '',
      `Corner permutation: [${state.cornerPermutation.join(', ')}]`,
      `Corner orientation: [${state.cornerOrientation.join(', ')}]`,
      '',
      `Edge permutation: [${state.edgePermutation.join(', ')}]`,
      `Edge orientation: [${state.edgeOrientation.join(', ')}]`
    ].join('\n');
  };

  const applyUserMove = (move: Move): void => {
    session.applyMove(move);
    render();
  };

  for (const move of ALL_MOVES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move-button';
    button.textContent = move;
    button.setAttribute('aria-label', `Apply ${move} move`);
    button.addEventListener('click', () => applyUserMove(move));
    controlsElement.append(button);
  }

  const applyNewScramble = (): void => {
    session.reset();
    currentScramble = generateScramble(25);
    session.applyScramble(currentScramble);
    render();
  };

  newScrambleButton.addEventListener('click', applyNewScramble);
  resetButton.addEventListener('click', () => {
    session.reset();
    currentScramble = [];
    render();
  });

  void installKeyboardControls(applyUserMove);

  applyNewScramble();
}
