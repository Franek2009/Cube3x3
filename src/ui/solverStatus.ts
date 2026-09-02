export interface SolverPrewarmClient {
  prewarm(): Promise<void>;
}

export type SolverUiState = 'preparing' | 'ready' | 'error';

export async function prewarmSolverForApp(
  client: SolverPrewarmClient,
  onStateChange: (state: SolverUiState) => void,
  reportError: (error: unknown) => void = console.error
): Promise<void> {
  onStateChange('preparing');

  try {
    await client.prewarm();
    onStateChange('ready');
  } catch (error) {
    reportError(error);
    onStateChange('error');
  }
}
