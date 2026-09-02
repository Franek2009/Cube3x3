import { ALL_MOVES, type Move } from '../core/moves/moves.ts';
import { generateScramble } from '../core/scramble/scrambler.ts';
import { CubeSession } from '../core/session/CubeSession.ts';
import { CubeRenderer } from '../renderer/CubeRenderer.ts';
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
  const rendererContainer = getRequiredElement<HTMLDivElement>('cube-viewport');
  const cubeRenderer = new CubeRenderer(rendererContainer);
  let currentScramble: Move[] = [];
  const moveQueue: Move[] = [];
  let processingMoves = false;
  let sessionGeneration = 0;

  const renderUi = (): void => {
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

  const processMoveQueue = async (): Promise<void> => {
    if (processingMoves) return;
    processingMoves = true;
    const generation = sessionGeneration;

    try {
      while (moveQueue.length > 0 && generation === sessionGeneration) {
        const move = moveQueue.shift();
        if (move === undefined) break;
        const fromState = session.getState();
        const toState = session.applyMove(move);
        renderUi();
        await cubeRenderer.animateMove(move, fromState, toState);
      }
    } finally {
      processingMoves = false;
      if (moveQueue.length > 0) void processMoveQueue();
    }
  };

  const applyUserMove = (move: Move): void => {
    moveQueue.push(move);
    void processMoveQueue();
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
    moveQueue.length = 0;
    sessionGeneration += 1;
    session.reset();
    currentScramble = generateScramble(25);
    session.applyScramble(currentScramble);
    cubeRenderer.renderState(session.getState());
    renderUi();
  };

  newScrambleButton.addEventListener('click', applyNewScramble);
  resetButton.addEventListener('click', () => {
    moveQueue.length = 0;
    sessionGeneration += 1;
    session.reset();
    currentScramble = [];
    cubeRenderer.renderState(session.getState());
    renderUi();
  });

  void installKeyboardControls(applyUserMove);

  applyNewScramble();
}
