import { describe, expect, it } from 'vitest';
import { createSatisfactionRoomView } from '../../src/ui/satisfactionRoom/satisfactionRoomView.ts';

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  className = '';
  textContent = '';
  removed = false;
  append(...children: FakeElement[]): void { this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  remove(): void { this.removed = true; }
}

class FakeDocument {
  readonly body = new FakeElement();
  createElement(): FakeElement { return new FakeElement(); }
}

describe('Satisfaction Room view', () => {
  it('creates an accessible overlay, updates status, and disposes idempotently', () => {
    const document = new FakeDocument();
    const view = createSatisfactionRoomView(document as unknown as Document);
    const overlay = document.body.children[0];
    expect(overlay?.className).toBe('satisfaction-room');
    expect(overlay?.attributes.get('role')).toBe('dialog');
    expect(overlay?.attributes.get('aria-modal')).toBe('true');
    expect(view.rendererContainer.className).toBe('satisfaction-room__stage');

    view.setStatus('solving');
    expect(overlay?.children[1]?.textContent).toBe('Solving');
    view.setStatus('solved');
    expect(overlay?.children[1]?.textContent).toBe('Solved');

    view.dispose();
    view.dispose();
    expect(overlay?.removed).toBe(true);
  });
});
