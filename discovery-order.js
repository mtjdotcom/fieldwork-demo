(() => {
  "use strict";

  function byName(a, b) {
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  }

  function score(artist) {
    return Number.isFinite(artist.tasteMatch?.score) ? artist.tasteMatch.score : 0;
  }

  function makeSeed() {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)),
      value => value.toString(16).padStart(8, "0")).join("");
  }

  function randomKey(seed, id) {
    // Stable per artist, so filtering or removing someone preserves the random draw.
    const text = seed + "\u0000" + id;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    }
    // MurmurHash3 finalizer disperses keys even when artist IDs share a prefix.
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    return (hash ^ (hash >>> 16)) >>> 0;
  }

  function chanceAt(index, chance) {
    // Every prefix gets the nearest whole number of chance places.
    return Math.round((index + 1) * chance / 100) > Math.round(index * chance / 100);
  }

  function order(artists, { mode = "taste", chance = 0, seed = "", seenIds = new Set() } = {}) {
    if (mode === "name") return artists.slice().sort(byName);
    const percent = Math.min(100, Math.max(0, Math.round(Number(chance) || 0)));
    const byTaste = percent < 100
      ? artists.slice().sort((a, b) => score(b) - score(a) || byName(a, b))
      : [];
    if (!percent) return byTaste;
    const byChance = artists
      .map(artist => ({
        artist,
        seen: seenIds.has(artist.id),
        key: randomKey(seed, artist.id),
      }))
      .sort((a, b) => a.seen - b.seen || a.key - b.key || a.artist.id.localeCompare(b.artist.id))
      .map(entry => entry.artist);
    if (percent === 100) return byChance;

    const result = [];
    const used = new Set();
    let tasteIndex = 0;
    let chanceIndex = 0;
    for (let index = 0; index < artists.length; index++) {
      let pick;
      if (chanceAt(index, percent)) {
        while (used.has(byChance[chanceIndex].id)) chanceIndex++;
        pick = byChance[chanceIndex++];
      } else {
        while (used.has(byTaste[tasteIndex].id)) tasteIndex++;
        pick = byTaste[tasteIndex++];
      }
      result.push(pick);
      used.add(pick.id);
    }
    return result;
  }

  globalThis.DiscoveryOrder = { order, makeSeed, chanceAt };
})();
