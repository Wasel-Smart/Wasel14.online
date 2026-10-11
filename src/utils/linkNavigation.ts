import type { MouseEvent } from 'react';

/** True for a plain left-click, i.e. one we should handle in-app. */
export function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/**
 * onClick for an <a href> that should navigate client-side.
 *
 * Plain clicks run `go()` (router navigation + analytics) and cancel the browser
 * default. Cmd/Ctrl/Shift/middle-click fall through, so "open in new tab",
 * "copy link address" and crawlers all work because the element is a real link.
 */
export function handleSpaLinkClick(event: MouseEvent<HTMLAnchorElement>, go: () => void): void {
  if (!isPlainLeftClick(event)) {
    return;
  }
  event.preventDefault();
  go();
}
