export type SatisfactionRoomStatus = 'scrambling' | 'solving' | 'solved' | 'error';

export interface SatisfactionRoomView {
  readonly rendererContainer: HTMLElement;
  setStatus(status: SatisfactionRoomStatus): void;
  dispose(): void;
}

const STATUS_LABELS: Readonly<Record<SatisfactionRoomStatus, string>> = {
  scrambling: 'Scrambling',
  solving: 'Solving',
  solved: 'Solved',
  error: 'Unable to continue'
};

export function createSatisfactionRoomView(
  ownerDocument: Document = document
): SatisfactionRoomView {
  const overlay = ownerDocument.createElement('div');
  overlay.className = 'satisfaction-room';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Satisfaction Room');

  const rendererContainer = ownerDocument.createElement('div');
  rendererContainer.className = 'satisfaction-room__stage';
  const statusElement = ownerDocument.createElement('p');
  statusElement.className = 'satisfaction-room__status';
  statusElement.setAttribute('role', 'status');
  const exitHint = ownerDocument.createElement('p');
  exitHint.className = 'satisfaction-room__exit';
  exitHint.textContent = 'Esc to exit';
  overlay.append(rendererContainer, statusElement, exitHint);
  ownerDocument.body.append(overlay);

  let disposed = false;
  return {
    rendererContainer,
    setStatus: (status) => {
      if (!disposed) statusElement.textContent = STATUS_LABELS[status];
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      overlay.remove();
    }
  };
}
