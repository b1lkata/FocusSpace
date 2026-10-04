import { useRef, type PointerEvent, type RefObject } from 'react';
export function usePlayerDismiss(dialog: RefObject<HTMLDialogElement | null>) {
  const start = useRef<{ id: number; x: number; y: number } | undefined>(undefined);
  const reset = () => { start.current = undefined; dialog.current?.style.removeProperty('--player-pull'); dialog.current?.removeAttribute('data-dragging'); };
  return {
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      const target = event.target as HTMLElement;
      if (event.button !== 0 || event.currentTarget.scrollTop > 2 || target.closest('button,input,select,textarea,a') || !target.closest('[data-player-drag],.audio-record')) return;
      event.currentTarget.setAttribute('data-dragging', 'true');
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLDialogElement>) {
      const origin = start.current; if (!origin || origin.id !== event.pointerId) return;
      const dy = Math.max(0, event.clientY - origin.y), dx = Math.abs(event.clientX - origin.x);
      event.currentTarget.style.setProperty('--player-pull', `${dx > dy ? 0 : Math.min(dy, 500)}px`);
    },
    onPointerUp(event: PointerEvent<HTMLDialogElement>) {
      const origin = start.current; if (!origin || origin.id !== event.pointerId) return;
      const dy = event.clientY - origin.y, dx = Math.abs(event.clientX - origin.x);
      reset(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (dy >= 96 && dy > dx * 1.5) event.currentTarget.close();
    },
    onPointerCancel: reset,
    onLostPointerCapture: reset,
  };
}
