(() => {
  "use strict";

  const queueKey = "fieldwork.pendingDiscoveryViews";
  let restored = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(queueKey));
    if (Array.isArray(saved)) restored = saved.filter(id => typeof id === "string");
  } catch {
    // The queue still works in memory when browser storage is unavailable.
  }
  const pending = new Set(restored);
  const seen = new Set(pending);
  let sending = false;
  let flushTimer;
  let observer;
  const dwellTimers = new Map();

  function saveQueue() {
    try {
      if (pending.size) sessionStorage.setItem(queueKey, JSON.stringify([...pending]));
      else sessionStorage.removeItem(queueKey);
    } catch {
      // The local server remains the permanent record.
    }
  }

  function scheduleFlush(delay) {
    if (pending.size && !sending && !flushTimer) flushTimer = setTimeout(flush, delay);
  }

  async function flush() {
    clearTimeout(flushTimer);
    flushTimer = null;
    if (sending || !pending.size) return;
    sending = true;
    const ids = [...pending].slice(0, 100);
    let retryDelay = 0;
    try {
      const response = await fetch("/api/discovery-views", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ids}), keepalive: true,
      });
      if (!response.ok) throw Error("Could not save discovery views");
      const result = await response.json();
      if (!Array.isArray(result.seenIds)) throw Error("Unexpected discovery view response");
      // The endpoint also acknowledges repeats and skips IDs removed from the workspace.
      for (const id of ids) pending.delete(id);
      saveQueue();
    } catch {
      retryDelay = 5000;
    } finally {
      sending = false;
      scheduleFlush(retryDelay);
    }
  }

  function mark(id) {
    if (document.hidden || !id || seen.has(id)) return;
    seen.add(id);
    pending.add(id);
    saveQueue();
    scheduleFlush(120);
    document.dispatchEvent(new Event("discoveryviewschange"));
  }

  function remember(artists) {
    for (const artist of artists) {
      if (artist.discoverySeenAt) seen.add(artist.id);
    }
  }

  function mergeSavedViews(current, incoming) {
    // A polling response that only confirms views should leave mounted cards and focus alone.
    const stamps = new Map(incoming.filter(a => a.discoverySeenAt).map(a => [a.id, a.discoverySeenAt]));
    const previousSize = seen.size;
    for (const artist of current) {
      if (stamps.has(artist.id)) {
        artist.discoverySeenAt = stamps.get(artist.id);
        seen.add(artist.id);
      }
    }
    if (seen.size !== previousSize) document.dispatchEvent(new Event("discoveryviewschange"));
  }

  function stopObserving() {
    observer?.disconnect();
    observer = null;
    for (const timer of dwellTimers.values()) clearTimeout(timer);
    dwellTimers.clear();
  }

  function canBrowse() {
    return !document.hidden && !document.querySelector("dialog[open]") &&
      !document.body.classList.contains("navopen");
  }

  function observeCards() {
    stopObserving();
    if (!canBrowse() || !window.IntersectionObserver) return;
    const cards = document.querySelectorAll("[data-discovery-id]");
    if (!cards.length) return;
    observer = new IntersectionObserver((entries, active) => {
      if (active !== observer) return;
      for (const entry of entries) {
        const card = entry.target;
        const id = card.dataset.discoveryId;
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
          clearTimeout(dwellTimers.get(card));
          dwellTimers.delete(card);
        } else if (canBrowse() && !seen.has(id) && !dwellTimers.has(card)) {
          dwellTimers.set(card, setTimeout(() => {
            dwellTimers.delete(card);
            if (active === observer && card.isConnected && canBrowse()) {
              mark(id);
              active.unobserve(card);
            }
          }, 1000));
        }
      }
    }, {threshold: 0.5});
    for (const card of cards) {
      if (!seen.has(card.dataset.discoveryId)) observer.observe(card);
    }
  }

  // Cancel partial views while a dialog, navigation drawer or another tab covers the inbox.
  const overlays = new MutationObserver(observeCards);
  overlays.observe(document.body, {attributes: true, attributeFilter: ["class"]});
  overlays.observe(document.querySelector("#dialog"), {attributes: true, attributeFilter: ["open"]});
  document.addEventListener("visibilitychange", () => {
    observeCards();
    if (document.hidden) flush();
  });
  window.addEventListener("pagehide", () => { stopObserving(); flush(); });
  window.addEventListener("pageshow", observeCards);
  window.addEventListener("online", flush);
  scheduleFlush(0);
  window.DiscoveryViews = {
    mark, remember, mergeSavedViews, observeCards,
    has: id => seen.has(id),
    snapshot: () => new Set(seen),
  };
})();
