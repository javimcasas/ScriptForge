// ─── SESSION GUARD ───────────────────────────────────────────────
// When any same-origin API call returns 401 the SmartMatrix session has
// expired while the page stayed open. Instead of leaving the UI silently
// broken (forcing the user to close the window), bounce to the hub, which
// re-checks its own session and shows the login screen. The bounce goes
// through /launch/<app> with the current route in the hash, so signing in
// again brings the user back to the page they were on.
(function () {
  const LAUNCH_URL = "https://hubsmartmatrix.com/launch/scriptforge";
  const realFetch = window.fetch.bind(window);
  let redirecting = false;

  window.fetch = async function (...args) {
    const res = await realFetch(...args);
    if (res.status === 401 && !redirecting) {
      try {
        const input = args[0];
        const raw = input instanceof Request ? input.url : String(input);
        const u = new URL(raw, location.href);
        if (u.origin === location.origin) {
          redirecting = true;
          location.replace(LAUNCH_URL + location.hash);
        }
      } catch (_) {
        /* ignore malformed URLs */
      }
    }
    return res;
  };
})();
