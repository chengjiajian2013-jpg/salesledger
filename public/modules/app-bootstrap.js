// SalesLedger - authenticated application bootstrap

let started = false;

/**
 * Start the authenticated workspaces exactly once after the document is ready.
 * `initCoreApp` may return an async startup callback for legacy initialization.
 */
export function bootstrapAuthenticatedApp({ initCoreApp, initFenghuaWorkspace }) {
  if (typeof initCoreApp !== 'function' || typeof initFenghuaWorkspace !== 'function') {
    throw new TypeError('bootstrapAuthenticatedApp requires both workspace initializers');
  }

  const run = async () => {
    if (started) return false;
    started = true;

    const startCore = initCoreApp();
    if (typeof startCore === 'function') {
      await startCore();
    }
    initFenghuaWorkspace();
    return true;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    void run();
  }

  return run;
}
