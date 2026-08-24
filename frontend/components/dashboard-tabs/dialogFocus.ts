export const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusFirst(container: HTMLElement | null, fallback?: HTMLElement | null) {
  const target = container?.querySelector<HTMLElement>(focusableSelector) || fallback;
  window.requestAnimationFrame(() => target?.focus());
}

export function trapFocus(event: KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

export function isolateBackground(container: HTMLElement | null) {
  const parent = container?.parentElement;
  if (!container || !parent) return () => undefined;
  const siblings = Array.from(parent.children).filter((node) => node !== container) as HTMLElement[];
  const previous = siblings.map((node) => ({
    node,
    ariaHidden: node.getAttribute("aria-hidden"),
    inert: Boolean((node as HTMLElement & { inert?: boolean }).inert),
  }));
  previous.forEach(({ node }) => {
    node.setAttribute("aria-hidden", "true");
    (node as HTMLElement & { inert?: boolean }).inert = true;
  });
  return () => previous.forEach(({ node, ariaHidden, inert }) => {
    if (ariaHidden === null) node.removeAttribute("aria-hidden");
    else node.setAttribute("aria-hidden", ariaHidden);
    (node as HTMLElement & { inert?: boolean }).inert = inert;
  });
}
