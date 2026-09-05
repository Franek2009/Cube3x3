export interface NormalAppAsyncLifecycle {
  readonly cancelPlayback: () => void;
  readonly cancelVisualTransitions: () => void;
  readonly invalidateSolver: () => void;
  readonly synchronizeRenderer: () => void;
}

export function prepareNormalAppForSatisfactionRoom(
  lifecycle: NormalAppAsyncLifecycle
): void {
  lifecycle.cancelPlayback();
  lifecycle.cancelVisualTransitions();
  lifecycle.invalidateSolver();
  lifecycle.synchronizeRenderer();
}
