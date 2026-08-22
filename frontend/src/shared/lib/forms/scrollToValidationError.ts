export const VALIDATION_ERROR_SELECTOR = '[data-validation-error="true"], [aria-invalid="true"]';

type ValidationRoot = Pick<ParentNode, 'querySelector'>;

type ScrollValidationOptions = {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  focus?: boolean;
};

export function findFirstValidationError(root: ValidationRoot): HTMLElement | null {
  return root.querySelector<HTMLElement>(VALIDATION_ERROR_SELECTOR);
}

export function scrollToValidationTarget(target: HTMLElement | null, options: ScrollValidationOptions = {}): boolean {
  if (!target) return false;

  const reduceMotion = document.documentElement.dataset.motion !== 'full'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  target.scrollIntoView({
    behavior: reduceMotion ? 'auto' : (options.behavior ?? 'smooth'),
    block: options.block ?? 'center',
    inline: 'nearest',
  });

  if (options.focus === true) {
    const focusTarget = target.matches('input, textarea, select, button, [tabindex]:not([tabindex="-1"])')
      ? target
      : target.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
    focusTarget?.focus({ preventScroll: true });
  }

  return true;
}

export function scrollToFirstValidationError(root: ValidationRoot | null, options: ScrollValidationOptions = {}): void {
  if (!root) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scrollToValidationTarget(findFirstValidationError(root), options);
    });
  });
}

export function scrollToValidationAnchor(anchor: string, options: ScrollValidationOptions = {}): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scrollToValidationTarget(document.getElementById(anchor), options);
    });
  });
}
