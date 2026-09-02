export interface SolverPrewarmClient {
  prewarm(): Promise<void>;
}

export type SolverServiceUiState = 'preparing' | 'ready' | 'error';
export type SolverUiState = SolverServiceUiState | 'solving';

export async function prewarmSolverForApp(
  client: SolverPrewarmClient,
  onStateChange: (state: SolverServiceUiState) => void,
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
