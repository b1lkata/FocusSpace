import { useLayoutEffect } from 'react';

// Keep native HTML controls and the accessibility tree inside the active dialog.
export function useModalAccessibility(active: string | undefined) {
  useLayoutEffect(() => {
    if (!active) return;
    const modal = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1);
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const background = Array.from(document.querySelectorAll<HTMLElement>('[data-modal-background]'));
    background.forEach(element => { element.inert = true; });
    const controls = () => Array.from(modal.querySelectorAll<HTMLElement>('button,input,textarea,select,[tabindex]'))
      .filter(element => !element.hasAttribute('disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0);
    (modal.querySelector<HTMLElement>('[data-initial-focus]') ?? controls()[0] ?? modal).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const list = controls(), first = list[0], last = list.at(-1);
      if (!first) { event.preventDefault(); modal.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      background.forEach(element => { element.inert = false; });
      const target = previous?.isConnected && previous !== document.body ? previous : document.querySelector<HTMLElement>('[data-command-trigger]');
      target?.focus();
    };
  }, [active]);
}
