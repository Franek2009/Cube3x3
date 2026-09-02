import { ALL_MOVES, type Move } from '../core/moves/moves.ts';
import { SolveHistory } from '../core/results/SolveResults.ts';
import {
  clearSolveRecords,
  loadSolveRecords,
  saveSolveRecords,
  type KeyValueStorage
} from '../core/results/solveStorage.ts';
import { generateScramble } from '../core/scramble/scrambler.ts';
import { CubeSession } from '../core/session/CubeSession.ts';
import {
  formatElapsedTime,
  SolveTimer,
  type SolveTimerState
} from '../core/timer/SolveTimer.ts';
import { CubeRenderer } from '../renderer/CubeRenderer.ts';
import { installKeyboardControls } from './keyboard.ts';

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Required UI element not found: #${id}`);
  }

  return element as T;
}

interface MoveTransition {
  readonly move: Move;
  readonly fromState: ReturnType<CubeSession['getState']>;
  readonly toState: ReturnType<CubeSession['getState']>;
}

export function initializeApp(): void {
  const session = new CubeSession();
  const timer = new SolveTimer();
  let solveStorage: KeyValueStorage | undefined;

  try {
    solveStorage = window.localStorage;
  } catch {
    solveStorage = undefined;
  }

  const solveHistory = new SolveHistory(
    solveStorage === undefined ? [] : loadSolveRecords(solveStorage)
  );
  const scrambleElement = getRequiredElement<HTMLParagraphElement>('scramble');
  const solvedElement = getRequiredElement<HTMLElement>('solved-status');
  const moveCountElement = getRequiredElement<HTMLElement>('move-count');
  const timerTimeElement = getRequiredElement<HTMLElement>('timer-time');
  const timerStatusElement = getRequiredElement<HTMLElement>('timer-status');
  const timerPanelElement = getRequiredElement<HTMLElement>('timer-panel');
  const lastTimeElement = getRequiredElement<HTMLElement>('last-time');
  const bestTimeElement = getRequiredElement<HTMLElement>('best-time');
  const ao5Element = getRequiredElement<HTMLElement>('ao5');
  const ao12Element = getRequiredElement<HTMLElement>('ao12');
  const solveCountElement = getRequiredElement<HTMLElement>('solve-count');
  const recentSolvesElement = getRequiredElement<HTMLOListElement>('recent-solves');
  const historyElement = getRequiredElement<HTMLParagraphElement>('move-history');
  const debugElement = getRequiredElement<HTMLPreElement>('debug-state');
  const controlsElement = getRequiredElement<HTMLDivElement>('move-controls');
  const newScrambleButton = getRequiredElement<HTMLButtonElement>('new-scramble');
  const resetButton = getRequiredElement<HTMLButtonElement>('reset-cube');
  const clearHistoryButton = getRequiredElement<HTMLButtonElement>('clear-history');
  const rendererContainer = getRequiredElement<HTMLDivElement>('cube-viewport');
  const cubeRenderer = new CubeRenderer(rendererContainer);
  let currentScramble: Move[] = [];
  const animationQueue: MoveTransition[] = [];
  let processingAnimations = false;
  let sessionGeneration = 0;
  let timerFrameId: number | undefined;

  const timerStatusLabels: Readonly<Record<SolveTimerState, string>> = {
    idle: 'Idle',
    ready: 'Ready',
    running: 'Running',
    stopped: 'Stopped'
  };

  const renderTimer = (now?: number): void => {
    timerPanelElement.dataset.state = timer.getState();
    timerTimeElement.textContent = formatElapsedTime(timer.getElapsedMs(now));
    timerStatusElement.textContent = timerStatusLabels[timer.getState()];
  };

  const cancelTimerFrame = (): void => {
    if (timerFrameId !== undefined) {
      cancelAnimationFrame(timerFrameId);
      timerFrameId = undefined;
    }
  };

  const updateRunningTimer = (now: number): void => {
    timerFrameId = undefined;

    if (timer.getState() !== 'running') return;

    renderTimer(now);
    timerFrameId = requestAnimationFrame(updateRunningTimer);
  };

  const startTimerUpdates = (): void => {
    if (timerFrameId === undefined) {
      timerFrameId = requestAnimationFrame(updateRunningTimer);
    }
  };

  const formatStatistic = (timeMs: number | undefined): string => (
    timeMs === undefined ? '—' : formatElapsedTime(timeMs)
  );

  const renderStatistics = (): void => {
    const records = solveHistory.getAll();

    lastTimeElement.textContent = formatStatistic(solveHistory.getLast()?.timeMs);
    bestTimeElement.textContent = formatStatistic(solveHistory.getBest()?.timeMs);
    ao5Element.textContent = formatStatistic(solveHistory.getAo5());
    ao12Element.textContent = formatStatistic(solveHistory.getAo12());
    solveCountElement.textContent = String(records.length);
    recentSolvesElement.replaceChildren();

    for (const record of records.slice(-5).reverse()) {
      const item = document.createElement('li');
      item.textContent = formatElapsedTime(record.timeMs);
      recentSolvesElement.append(item);
    }
  };

  const renderUi = (now?: number): void => {
    const state = session.getState();
    const history = session.getMoveHistory();

    scrambleElement.textContent = currentScramble.length > 0
      ? currentScramble.join(' ')
      : 'No scramble applied';
    solvedElement.textContent = session.isSolved() ? 'Yes' : 'No';
    moveCountElement.textContent = String(history.length);
    historyElement.textContent = history.join(' ');
    renderTimer(now);
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

  const processAnimationQueue = async (): Promise<void> => {
    if (processingAnimations) return;
    processingAnimations = true;
    const generation = sessionGeneration;

    try {
      while (animationQueue.length > 0 && generation === sessionGeneration) {
        const transition = animationQueue.shift();
        if (transition === undefined) break;

        await cubeRenderer.animateMove(
          transition.move,
          transition.fromState,
          transition.toState
        );
      }
    } finally {
      processingAnimations = false;
      if (animationQueue.length > 0) void processAnimationQueue();
    }
  };

  const applyUserMove = (move: Move): void => {
    const now = performance.now();
    const fromState = session.getState();

    if (timer.getState() === 'ready') {
      timer.start(now);
      startTimerUpdates();
    }

    const toState = session.applyMove(move);

    if (session.isSolved() && timer.getState() === 'running') {
      const finalTime = timer.stop(now);
      cancelTimerFrame();
      solveHistory.add({
        timeMs: finalTime,
        scramble: [...currentScramble],
        moveCount: session.getMoveHistory().length,
        completedAt: Date.now()
      });
      if (solveStorage !== undefined) {
        saveSolveRecords(solveStorage, solveHistory.getAll());
      }
      renderStatistics();
    }

    renderUi(now);
    animationQueue.push({ move, fromState, toState });
    void processAnimationQueue();
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
    animationQueue.length = 0;
    sessionGeneration += 1;
    cancelTimerFrame();
    timer.prepare();
    session.reset();
    currentScramble = generateScramble(25);
    session.applyScramble(currentScramble);
    cubeRenderer.renderState(session.getState());
    renderUi();
  };

  newScrambleButton.addEventListener('click', applyNewScramble);
  resetButton.addEventListener('click', () => {
    animationQueue.length = 0;
    sessionGeneration += 1;
    cancelTimerFrame();
    timer.reset();
    session.reset();
    currentScramble = [];
    cubeRenderer.renderState(session.getState());
    renderUi();
  });
  clearHistoryButton.addEventListener('click', () => {
    solveHistory.clear();
    if (solveStorage !== undefined) {
      clearSolveRecords(solveStorage);
    }
    renderStatistics();
  });

  void installKeyboardControls(applyUserMove);

  renderStatistics();
  applyNewScramble();
}
