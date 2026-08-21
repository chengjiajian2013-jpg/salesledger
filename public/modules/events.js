// SalesLedger - event binding boundary

/**
 * Wrap an event registration function so repeated bootstrap calls are safe.
 * A failed bind does not permanently lock the application in a half-bound state.
 */
export function createIdempotentBinder(bind) {
  if (typeof bind !== 'function') {
    throw new TypeError('createIdempotentBinder requires a function');
  }

  let bound = false;
  return function bindOnce() {
    if (bound) return false;
    bound = true;
    try {
      bind();
      return true;
    } catch (error) {
      bound = false;
      throw error;
    }
  };
}
