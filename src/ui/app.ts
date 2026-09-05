import { ALL_MOVES, isMove, type Move } from '../core/moves/moves.ts';
import {
  CUBE_ROTATIONS,
  createDefaultCubeOrientation,
  mapBaseMoveToUser,
  mapUserMoveToBase,
  rotateCubeOrientation,
  type CubeOrientation,
  type CubeRotation
} from '../core/orientation/cubeOrientation.ts';
import {
  analyzeSolution,
  SOLUTION_FACES,
  type SolutionFace
} from '../core/analysis/solutionAnalysis.ts';
import { SolveHistory } from '../core/results/SolveResults.ts';
import {
  clearSolveRecords,
  loadSolveRecords,
  saveSolveRecords,
  type KeyValueStorage
} from '../core/results/solveStorage.ts';
import { generateScramble } from '../core/scramble/scrambler.ts';
import { CubeSession } from '../core/session/CubeSession.ts';
import { SolverClient } from '../core/solver/SolverClient.ts';
import {
  formatElapsedTime,
  SolveTimer,
  type SolveTimerState
} from '../core/timer/SolveTimer.ts';
import { CubeRenderer } from '../renderer/CubeRenderer.ts';
import {
  AnimationTransitionCancelledError,
  createAnimationTransitionSettlement,
  type AnimationTransitionSettlement
} from './animationTransition.ts';
import { installKeyboardControls } from './keyboard.ts';
import { formatCubeActions, type CubeAction } from './cubeAction.ts';
import { installCubeDragControls } from './cubeDragControls.ts';
import { createDefaultKeybindings, type KeybindingMap } from './keybindings.ts';
import {
  clearStoredKeybindings,
  loadKeybindings,
  saveKeybindings
} from './keybindingStorage.ts';
import { createKeyboardSettingsController } from './keyboardSettings.ts';
import { SatisfactionRoomController } from './satisfactionRoom/SatisfactionRoomController.ts';
import { prepareNormalAppForSatisfactionRoom } from './satisfactionRoom/prepareNormalAppForSatisfactionRoom.ts';
import { installSatisfactionRoomShortcut } from './satisfactionRoom/satisfactionRoomShortcut.ts';
import { SolveCommandController } from './SolveCommandController.ts';
import {
  SolutionPlaybackController,
  type SolutionPlaybackState
} from './SolutionPlaybackController.ts';
import {
  prewarmSolverForApp,
  type SolverUiState
} from './solverStatus.ts';

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Required UI element not found: #${id}`);
  }

  return element as T;
}

interface FaceTransition extends AnimationTransitionSettlement {
  readonly kind: 'face';
  readonly move: Move;
  readonly fromState: ReturnType<CubeSession['getState']>;
  readonly toState: ReturnType<CubeSession['getState']>;
  readonly orientation: CubeOrientation;
}

interface RotationTransition extends AnimationTransitionSettlement {
  readonly kind: 'rotation';
  readonly rotation: CubeRotation;
  readonly state: ReturnType<CubeSession['getState']>;
  readonly fromOrientation: CubeOrientation;
  readonly toOrientation: CubeOrientation;
}

type VisualTransition = FaceTransition | RotationTransition;

export function initializeApp(): void {
  const session = new CubeSession();
  const timer = new SolveTimer();
  const solverClient = new SolverClient();
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
  const solverStatusElement = getRequiredElement<HTMLElement>('solver-status');
  const lastTimeElement = getRequiredElement<HTMLElement>('last-time');
  const bestTimeElement = getRequiredElement<HTMLElement>('best-time');
  const ao5Element = getRequiredElement<HTMLElement>('ao5');
  const ao12Element = getRequiredElement<HTMLElement>('ao12');
  const solveCountElement = getRequiredElement<HTMLElement>('solve-count');
  const recentSolvesElement = getRequiredElement<HTMLOListElement>('recent-solves');
  const historyElement = getRequiredElement<HTMLParagraphElement>('move-history');
  const orientationFrontElement = getRequiredElement<HTMLElement>('orientation-front');
  const orientationUpElement = getRequiredElement<HTMLElement>('orientation-up');
  const debugElement = getRequiredElement<HTMLPreElement>('debug-state');
  const controlsElement = getRequiredElement<HTMLDivElement>('move-controls');
  const rotationControlsElement = getRequiredElement<HTMLDivElement>('rotation-controls');
  const keyboardSettingsElement = getRequiredElement<HTMLDivElement>('keyboard-controls');
  const keyboardSettingsToggle = getRequiredElement<HTMLButtonElement>('keyboard-controls-toggle');
  const newScrambleButton = getRequiredElement<HTMLButtonElement>('new-scramble');
  const resetButton = getRequiredElement<HTMLButtonElement>('reset-cube');
  const solveButton = getRequiredElement<HTMLButtonElement>('solve-cube');
  const playSolutionButton = getRequiredElement<HTMLButtonElement>('play-solution');
  const clearHistoryButton = getRequiredElement<HTMLButtonElement>('clear-history');
  const solutionOutputElement = getRequiredElement<HTMLElement>('solution-output');
  const solutionSummaryElement = getRequiredElement<HTMLParagraphElement>('solution-summary');
  const solutionMovesElement = getRequiredElement<HTMLParagraphElement>('solution-moves');
  const solutionAnalysisElement = getRequiredElement<HTMLElement>('solution-analysis');
  const analysisHtmElement = getRequiredElement<HTMLElement>('analysis-htm');
  const analysisQtmElement = getRequiredElement<HTMLElement>('analysis-qtm');
  const analysisQuarterTurnsElement = getRequiredElement<HTMLElement>('analysis-quarter-turns');
  const analysisHalfTurnsElement = getRequiredElement<HTMLElement>('analysis-half-turns');
  const analysisScrambleLengthElement = getRequiredElement<HTMLElement>('analysis-scramble-length');
  const analysisFaceElements: Readonly<Record<SolutionFace, HTMLElement>> = {
    U: getRequiredElement<HTMLElement>('analysis-face-u'),
    D: getRequiredElement<HTMLElement>('analysis-face-d'),
    L: getRequiredElement<HTMLElement>('analysis-face-l'),
    R: getRequiredElement<HTMLElement>('analysis-face-r'),
    F: getRequiredElement<HTMLElement>('analysis-face-f'),
    B: getRequiredElement<HTMLElement>('analysis-face-b')
  };
  const playbackStatusElement = getRequiredElement<HTMLElement>('playback-status');
  const rendererContainer = getRequiredElement<HTMLDivElement>('cube-viewport');
  const cubeRenderer = new CubeRenderer(rendererContainer);
  let currentScramble: Move[] = [];
  let cubeOrientation = createDefaultCubeOrientation();
  const userActionHistory: CubeAction[] = [];
  const animationQueue: VisualTransition[] = [];
  let activeTransition: VisualTransition | undefined;
  let processingAnimations = false;
  let sessionGeneration = 0;
  let timerFrameId: number | undefined;
  let solverUiState: SolverUiState = 'preparing';
  let playbackState: SolutionPlaybackState = 'idle';
  let solutionOrientation = cubeOrientation;
  let keybindings: KeybindingMap = solveStorage === undefined
    ? createDefaultKeybindings()
    : loadKeybindings(solveStorage);

  const timerStatusLabels: Readonly<Record<SolveTimerState, string>> = {
    idle: 'Idle',
    ready: 'Ready',
    running: 'Running',
    stopped: 'Stopped'
  };
  const solverStatusLabels: Readonly<Record<SolverUiState, string>> = {
    preparing: 'Preparing solver…',
    ready: 'Solver ready',
    solving: 'Solving…',
    error: 'Solver unavailable'
  };

  let solveController: SolveCommandController;

  const updateCommandButtons = (): void => {
    const solution = solveController?.getCurrentSolution();
    const playbackIdle = playbackState === 'idle';

    solveButton.disabled = solverUiState !== 'ready' || !playbackIdle;
    playSolutionButton.disabled = (
      solverUiState !== 'ready' ||
      !playbackIdle ||
      timer.getState() === 'running' ||
      solution === undefined ||
      solution.length === 0
    );
  };

  const renderSolverStatus = (state: SolverUiState): void => {
    solverUiState = state;
    solverStatusElement.dataset.state = state;
    solverStatusElement.textContent = solverStatusLabels[state];
    updateCommandButtons();
  };

  const renderSolution = (result: Awaited<ReturnType<SolverClient['solve']>> | undefined): void => {
    solutionAnalysisElement.hidden = true;

    if (result === undefined) {
      solutionOutputElement.hidden = true;
      solutionSummaryElement.textContent = '';
      solutionMovesElement.textContent = '';
      solutionMovesElement.hidden = true;
      updateCommandButtons();
      return;
    }

    solutionOutputElement.hidden = false;
    solutionMovesElement.hidden = true;
    solutionMovesElement.textContent = '';

    if (result.solved) {
      if (result.depth === 0) {
        solutionSummaryElement.textContent = 'Cube is already solved.';
      } else {
        const userMoves = result.moves.map((move) => (
          mapBaseMoveToUser(solutionOrientation, move)
        ));
        const analysis = analyzeSolution(userMoves);
        solutionSummaryElement.textContent = `Solution · ${result.depth} ${result.depth === 1 ? 'move' : 'moves'}`;
        solutionMovesElement.textContent = userMoves.join(' ');
        solutionMovesElement.hidden = false;
        analysisHtmElement.textContent = `${analysis.htm} HTM`;
        analysisQtmElement.textContent = `${analysis.qtm} QTM`;
        analysisQuarterTurnsElement.textContent = String(analysis.quarterTurns);
        analysisHalfTurnsElement.textContent = String(analysis.halfTurns);
        analysisScrambleLengthElement.textContent = `${currentScramble.length} HTM`;
        for (const face of SOLUTION_FACES) {
          analysisFaceElements[face].textContent = String(analysis.faceUsage[face]);
        }
        solutionAnalysisElement.hidden = false;
      }
    } else if (result.reason === 'depth-limit') {
      solutionSummaryElement.textContent = 'No solution found within the depth limit.';
    } else {
      solutionSummaryElement.textContent = 'The current cube state is invalid.';
    }

    updateCommandButtons();
  };

  solveController = new SolveCommandController(solverClient, {
    onStateChange: renderSolverStatus,
    onResultChange: renderSolution,
    reportError: (error) => console.error('Solver solve failed', error)
  });

  const renderTimer = (now?: number): void => {
    timerPanelElement.dataset.state = timer.getState();
    timerTimeElement.textContent = formatElapsedTime(timer.getElapsedMs(now));
    timerStatusElement.textContent = timerStatusLabels[timer.getState()];
    updateCommandButtons();
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
    historyElement.textContent = formatCubeActions(userActionHistory);
    orientationFrontElement.textContent = cubeOrientation.userToBase.F;
    orientationUpElement.textContent = cubeOrientation.userToBase.U;
    renderTimer(now);
    debugElement.textContent = [
      `Solved: ${session.isSolved() ? 'yes' : 'no'}`,
      `Moves: ${history.length}`,
      `Front: ${cubeOrientation.userToBase.F}`,
      `Up: ${cubeOrientation.userToBase.U}`,
      '',
      `Corner permutation: [${state.cornerPermutation.join(', ')}]`,
      `Corner orientation: [${state.cornerOrientation.join(', ')}]`,
      '',
      `Edge permutation: [${state.edgePermutation.join(', ')}]`,
      `Edge orientation: [${state.edgeOrientation.join(', ')}]`
    ].join('\n');
  };

  const clearAnimationQueue = (): void => {
    activeTransition?.cancel();
    for (const transition of animationQueue.splice(0)) {
      transition.cancel();
    }
  };

  const enqueueAnimation = (
    move: Move,
    fromState: ReturnType<CubeSession['getState']>,
    toState: ReturnType<CubeSession['getState']>,
    orientation: CubeOrientation
  ): Promise<void> => {
    const settlement = createAnimationTransitionSettlement();
    animationQueue.push({
      kind: 'face', move, fromState, toState, orientation, ...settlement
    });
    void processAnimationQueue();
    return settlement.promise;
  };

  const enqueueRotationAnimation = (
    rotation: CubeRotation,
    state: ReturnType<CubeSession['getState']>,
    fromOrientation: CubeOrientation,
    toOrientation: CubeOrientation
  ): Promise<void> => {
    const settlement = createAnimationTransitionSettlement();
    animationQueue.push({
      kind: 'rotation', rotation, state, fromOrientation, toOrientation, ...settlement
    });
    void processAnimationQueue();
    return settlement.promise;
  };

  const processAnimationQueue = async (): Promise<void> => {
    if (processingAnimations) return;
    processingAnimations = true;
    const generation = sessionGeneration;

    try {
      while (animationQueue.length > 0 && generation === sessionGeneration) {
        const transition = animationQueue.shift();
        if (transition === undefined) break;
        activeTransition = transition;

        try {
          if (transition.kind === 'face') {
            await cubeRenderer.animateMove(
              transition.move,
              transition.fromState,
              transition.toState,
              transition.orientation
            );
          } else {
            await cubeRenderer.animateRotation(
              transition.state,
              transition.rotation,
              transition.fromOrientation,
              transition.toOrientation
            );
          }
          transition.complete();
        } catch (error) {
          transition.fail(error);
        } finally {
          if (activeTransition === transition) {
            activeTransition = undefined;
          }
        }
      }
    } finally {
      processingAnimations = false;
      if (animationQueue.length > 0) void processAnimationQueue();
    }
  };

  const playbackController = new SolutionPlaybackController({
    applyMove: async (move) => {
      const fromState = session.getState();
      const toState = session.applyMove(move, { recordHistory: false });
      solveController.invalidateCubeState();
      renderUi();
      await enqueueAnimation(move, fromState, toState, cubeOrientation);
    },
    onStateChange: (state) => {
      playbackState = state;
      playbackStatusElement.dataset.state = state;
      playbackStatusElement.textContent = state === 'playing'
        ? 'Playing solution…'
        : '';
      updateCommandButtons();
    },
    onComplete: () => {
      if (session.isSolved()) {
        playbackStatusElement.dataset.state = 'complete';
        playbackStatusElement.textContent = 'Playback complete.';
      } else {
        const error = new Error('Solution playback completed without solving the cube');
        playbackStatusElement.dataset.state = 'error';
        playbackStatusElement.textContent = 'Playback failed.';
        console.error('Solution playback failed', error);
      }
      updateCommandButtons();
    },
    reportError: (error) => {
      playbackStatusElement.dataset.state = 'error';
      playbackStatusElement.textContent = 'Playback failed.';
      console.error('Solution playback failed', error);
      updateCommandButtons();
    }
  });

  const applyUserMove = (userMove: Move): void => {
    playbackController.cancel();
    playbackStatusElement.textContent = '';
    playbackStatusElement.dataset.state = 'idle';
    const now = performance.now();
    const fromState = session.getState();
    const orientation = cubeOrientation;
    const baseMove = mapUserMoveToBase(orientation, userMove);

    if (timer.getState() === 'ready') {
      timer.start(now);
      startTimerUpdates();
    }

    const toState = session.applyMove(baseMove);
    userActionHistory.push(userMove);
    solveController.invalidateCubeState();

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
    void enqueueAnimation(baseMove, fromState, toState, orientation).catch((error) => {
      if (error instanceof AnimationTransitionCancelledError) return;
      console.error('Cube move animation failed', error);
    });
  };

  const applyUserRotation = (rotation: CubeRotation): void => {
    playbackController.cancel();
    playbackStatusElement.textContent = '';
    playbackStatusElement.dataset.state = 'idle';
    const fromOrientation = cubeOrientation;
    const toOrientation = rotateCubeOrientation(fromOrientation, rotation);
    const state = session.getState();

    cubeOrientation = toOrientation;
    userActionHistory.push(rotation);
    solveController.invalidateCubeState();
    renderUi();

    void enqueueRotationAnimation(
      rotation,
      state,
      fromOrientation,
      toOrientation
    ).catch((error) => {
      if (error instanceof AnimationTransitionCancelledError) return;
      console.error('Cube rotation animation failed', error);
    });
  };

  const applyUserAction = (action: CubeAction): void => {
    if (isMove(action)) {
      applyUserMove(action);
    } else {
      applyUserRotation(action);
    }
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

  for (const rotation of CUBE_ROTATIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move-button';
    button.textContent = rotation;
    button.setAttribute('aria-label', `Apply ${rotation} cube rotation`);
    button.addEventListener('click', () => applyUserRotation(rotation));
    rotationControlsElement.append(button);
  }

  const applyNewScramble = (): void => {
    playbackController.cancel();
    playbackStatusElement.textContent = '';
    playbackStatusElement.dataset.state = 'idle';
    clearAnimationQueue();
    sessionGeneration += 1;
    cancelTimerFrame();
    timer.prepare();
    session.reset();
    cubeOrientation = createDefaultCubeOrientation();
    userActionHistory.length = 0;
    currentScramble = generateScramble(25);
    session.applyScramble(currentScramble);
    solveController.invalidateCubeState();
    cubeRenderer.renderState(session.getState(), cubeOrientation);
    renderUi();
  };

  newScrambleButton.addEventListener('click', applyNewScramble);
  solveButton.addEventListener('click', () => {
    const snapshot = session.getState();
    solutionOrientation = cubeOrientation;
    void solveController.solve(snapshot);
  });
  playSolutionButton.addEventListener('click', () => {
    const solution = solveController.getCurrentSolution();
    if (solution === undefined || solution.length === 0) return;

    const playback = playbackController.play(solution);
    solveController.invalidateCubeState();
    void playback;
  });
  resetButton.addEventListener('click', () => {
    playbackController.cancel();
    playbackStatusElement.textContent = '';
    playbackStatusElement.dataset.state = 'idle';
    clearAnimationQueue();
    sessionGeneration += 1;
    cancelTimerFrame();
    timer.reset();
    session.reset();
    cubeOrientation = createDefaultCubeOrientation();
    userActionHistory.length = 0;
    solveController.invalidateCubeState();
    currentScramble = [];
    cubeRenderer.renderState(session.getState(), cubeOrientation);
    renderUi();
  });
  clearHistoryButton.addEventListener('click', () => {
    solveHistory.clear();
    if (solveStorage !== undefined) {
      clearSolveRecords(solveStorage);
    }
    renderStatistics();
  });

  const keyboardSettings = createKeyboardSettingsController(
    keyboardSettingsElement,
    keyboardSettingsToggle,
    {
      initialBindings: keybindings,
      onBindingsChange: (next) => {
        keybindings = next;
        if (solveStorage !== undefined) saveKeybindings(solveStorage, next);
      },
      onResetDefaults: (defaults) => {
        keybindings = defaults;
        if (solveStorage !== undefined) clearStoredKeybindings(solveStorage);
      }
    }
  );
  const removeKeyboardControls = installKeyboardControls({
    getBindings: () => keybindings,
    isCaptureActive: keyboardSettings.isCapturing,
    onAction: applyUserAction
  });
  const satisfactionRoom = new SatisfactionRoomController();
  const removeSatisfactionRoomShortcut = installSatisfactionRoomShortcut({
    isRoomOpen: () => satisfactionRoom.isOpen(),
    toggleRoom: () => {
      if (!satisfactionRoom.isOpen()) {
        keyboardSettings.cancelCapture();
        prepareNormalAppForSatisfactionRoom({
          cancelPlayback: () => {
            playbackController.cancel();
            playbackStatusElement.textContent = '';
            playbackStatusElement.dataset.state = 'idle';
          },
          cancelVisualTransitions: () => {
            clearAnimationQueue();
            sessionGeneration += 1;
          },
          invalidateSolver: () => solveController.invalidateCubeState(),
          synchronizeRenderer: () => cubeRenderer.renderState(
            session.getState(),
            cubeOrientation
          )
        });
      }
      satisfactionRoom.toggle();
    },
    closeRoom: () => satisfactionRoom.close()
  });
  const removeCubeDragControls = installCubeDragControls(
    cubeRenderer.getInteractionElement(),
    applyUserRotation
  );
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    removeKeyboardControls();
    removeSatisfactionRoomShortcut();
    removeCubeDragControls();
    keyboardSettings.dispose();
    satisfactionRoom.dispose();
  }, { once: true });

  renderStatistics();
  applyNewScramble();
  setTimeout(() => {
    void prewarmSolverForApp(
      solverClient,
      (state) => solveController.setServiceState(state),
      (error) => console.error('Solver prewarm failed', error)
    );
  }, 0);
}
