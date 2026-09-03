let lockCount = 0;
let scrollY = 0;
let originalOverflow = '';
let originalTouchAction = '';

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  if (lockCount === 0) {
    scrollY = window.scrollY || window.pageYOffset;
    const body = document.body;
    originalOverflow = body.style.overflow;
    originalTouchAction = body.style.touchAction;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
  }

  lockCount++;
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  if (lockCount <= 1) {
    const body = document.body;
    body.style.overflow = originalOverflow || '';
    body.style.touchAction = originalTouchAction || '';
    lockCount = 0;
  } else {
    lockCount--;
  }
}
