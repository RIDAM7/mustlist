/**
 * In-page navigation without `#` in the URL: scroll to a section and move
 * keyboard focus there, as a fragment link would, but leave the address as it is.
 * Browser only.
 */
export function goToSection(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  // Headings and <main> are not focusable by default; make them focusable by script only.
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
}
