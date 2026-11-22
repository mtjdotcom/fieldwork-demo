(() => {
  "use strict";

  const pageSize = 15;
  const orderKey = "fieldwork.discoveryOrder";
  const chanceKey = "fieldwork.discoveryChance";
  const seedKey = "fieldwork.discoverySeed";
  const historyKey = "fieldwork.discoveryHistoryFilter";

  function readPreference(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function savePreference(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Browsers with restricted storage can still use the mix in this tab.
    }
  }
  const savedChance = readPreference(chanceKey);
  const initialChance = savedChance !== null && /^(?:100|\d{1,2})$/.test(savedChance)
    && Number(savedChance) % 5 === 0 ? Number(savedChance) : 25;
  let seed = readPreference(seedKey);
  function reshuffle() {
    seed = window.DiscoveryOrder.makeSeed();
    savePreference(seedKey, seed);
  }
  if (!seed) reshuffle();
  const filters = {
    search: "",
    city: "",
    gallery: "",
    history: readPreference(historyKey) === "seen" ? "seen" : "all",
    page: 0,
    order: readPreference(orderKey) === "name" ? "name" : "taste",
    chance: initialChance,
  };
  const fw = () => window.FW;
  const state = () => fw().getState();
  const esc = (value) => fw().esc(value);
  const icon = (name, size) => fw().icon(name, size);
  const artistById = (id) => state().artists.find((artist) => artist.id === id);
  const sourceProfile = (artist) =>
    artist.discoveries?.find((d) => d.sourceId === artist.discoverySourceId)
      ?.url || artist.url;
  const worksOf = (artist) =>
    (artist.workExamples || []).filter((work) =>
      /^work-images\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$/.test(work.image),
    );
  let lastDecision = null;
  let pendingDecision = false;
  let drawSeen = null;
  let matchingIds = [];

  function newDraw() {
    drawSeen = null;
  }

  function unseenCount() {
    return matchingIds.reduce((count, id) => count + (window.DiscoveryViews.has(id) ? 0 : 1), 0);
  }

  document.addEventListener("discoveryviewschange", () => {
    if (filters.history === "seen" && document.querySelector('[data-dc-filter="history"]')) {
      // The second-look list can gain a member from a profile or another open tab.
      if (matched(state().artists.filter(a => a.status === "discovered")).length !== matchingIds.length) {
        fw().refresh();
      }
      return;
    }
    const label = document.querySelector("#dc-unseen-count");
    if (label) label.textContent = unseenCount() + " unseen";
  });

  function galleryOf(artist) {
    const source = state().sources.find(
      (s) => s.id === artist.discoverySourceId,
    );
    const id =
      source?.galleryId ||
      artist.discoveries?.[0]?.galleryId ||
      artist.galleryId;
    return state().galleries.find((gallery) => gallery.id === id);
  }

  function galleryLabel(artist) {
    const gallery = galleryOf(artist);
    if (!gallery)
      return '<span class="dc-gallery">Independent discovery</span>';
    return `<div class="dc-gallery">${icon("gallery", 15)}<span class="dc-via">via</span><button data-gallery="${esc(gallery.id)}">${esc(gallery.name)}</button>${gallery.city ? `<span>· ${esc(gallery.city)}</span>` : ""}</div>`;
  }

  function actions(artist, compact = false) {
    return `<div class="${compact ? "dc-compact-actions" : "dc-actions"}">
      <button class="${compact ? "icon-btn" : "btn"}" data-dc-action="archive" data-id="${esc(artist.id)}" aria-label="Archive ${esc(artist.name)}" title="Archive ${esc(artist.name)}">${icon("archive", 15)}${compact ? "" : " Archive"}</button>
      <button class="${compact ? "icon-btn" : "btn primary"}" data-dc-action="follow" data-id="${esc(artist.id)}" aria-label="Follow ${esc(artist.name)}" title="Follow ${esc(artist.name)}">${icon("plus", 15)}${compact ? "" : " Follow"}</button>
    </div>`;
  }

  function imageButton(artist, work, index, compact = false) {
    const label = `Enlarge work ${index + 1} by ${artist.name}`;
    return `<button type="button" class="dc-tile${compact ? " dc-thumb" : ""}" data-dc-action="enlarge" data-id="${esc(artist.id)}" data-index="${index}" aria-label="${esc(label)}" title="${esc(work.caption)}">
      <img loading="lazy" decoding="async" src="${esc(work.image)}" alt="${esc(work.caption)}"></button>`;
  }

  function card(artist, position) {
    const works = worksOf(artist);
    let reason = "";
    if (filters.order === "taste" && filters.chance < 100) {
      reason = window.DiscoveryOrder.chanceAt(position, filters.chance)
        ? "Picked at random" : artist.tasteMatch?.reason;
    }
    const status =
      artist.workPreviewStatus === "unavailable"
        ? "Gallery preview unavailable"
        : "Looking for gallery images…";
    return `<article class="dc-card" data-discovery-id="${esc(artist.id)}">
      ${
        works.length
          ? `<div class="dc-works dc-count-${works.length}">${works
              .slice(0, 3)
              .map((work, index) => imageButton(artist, work, index))
              .join("")}</div>`
          : `<div class="dc-unavailable">${icon("image", 25)}<span>${status}</span>${fw().link(sourceProfile(artist), "See gallery page")}</div>`
      }
      <div class="dc-details"><h2><button data-artist="${esc(artist.id)}">${esc(artist.name)}</button></h2>${galleryLabel(artist)}
        ${reason ? `<p class="dc-match-note">${esc(reason)}</p>` : ""}</div>
      ${actions(artist)}
    </article>`;
  }

  function compactRow(artist) {
    const work = worksOf(artist)[0];
    return `<div class="candidate-row dc-compact" data-discovery-id="${esc(artist.id)}">${work ? imageButton(artist, work, 0, true) : `<span class="artist-initial">${icon("image", 16)}</span>`}
      <div class="copy"><button data-artist="${esc(artist.id)}"><strong>${esc(artist.name)}</strong></button>${galleryLabel(artist)}</div>${actions(artist, true)}</div>`;
  }

  function ordered(artists) {
    // Hold the seen set fixed for the whole draw, including its subsequent pages.
    if (!drawSeen) drawSeen = window.DiscoveryViews.snapshot();
    return window.DiscoveryOrder.order(artists, {mode: filters.order, chance: filters.chance, seed, seenIds: drawSeen});
  }

  function matched(artists) {
    const query = filters.search.trim().toLocaleLowerCase();
    const matching = artists.filter((artist) => {
      const gallery = galleryOf(artist);
      return (
        (filters.history !== "seen" || window.DiscoveryViews.has(artist.id)) &&
        (!filters.city || gallery?.city === filters.city) &&
        (!filters.gallery || gallery?.id === filters.gallery) &&
        (!query ||
          [artist.name, artist.medium, gallery?.name, gallery?.city].some(
            (v) => (v || "").toLocaleLowerCase().includes(query),
          ))
      );
    });
    return ordered(matching);
  }

  function option(value, label, active) {
    return `<option value="${esc(value)}"${value === active ? " selected" : ""}>${esc(label)}</option>`;
  }

  function tasteSummary(artists) {
    if (filters.chance === 100) return filters.history === "seen"
      ? "Reshuffle to revisit these artists in a different order."
      : "Each draw puts unseen artists first, then shuffles artists you’ve seen.";
    const tastePicks = filters.chance === 0 ? "Artists" : "The remaining picks";
    const { followed = 0, archived = 0 } = state().taste || {};
    if (!followed && !archived) {
      return `${tastePicks} appear A–Z until you follow or archive an artist.`;
    }
    const choices = [
      followed ? `${followed} ${followed === 1 ? "follow" : "follows"}` : "",
      archived ? `${archived} ${archived === 1 ? "archive" : "archives"}` : "",
    ]
      .filter(Boolean)
      .join(" and ");
    if (!artists.some((artist) => Number.isFinite(artist.tasteMatch?.score) && artist.tasteMatch.score !== 0)) {
      return `You’ve recorded ${choices}. ${tastePicks} appear A–Z until a match appears.`;
    }
    return `${tastePicks} are ordered by your ${choices}.`;
  }

  function mixControls(results) {
    return `<div class="dc-mix">
      <div class="dc-mix-control">
        <label for="dc-chance">Random picks</label>
        <input type="range" id="dc-chance" min="0" max="100" step="5" value="${filters.chance}"
          aria-valuetext="${filters.chance}% random" aria-describedby="dc-mix-summary">
        <output for="dc-chance" aria-hidden="true">${filters.chance}%</output>
      </div>
      <p class="dc-learning" id="dc-mix-summary">${filters.history !== "seen" && filters.chance > 0 && filters.chance < 100 ? "Random picks favour unseen artists. " : ""}${esc(tasteSummary(results))}</p>
      <button type="button" class="btn dc-reshuffle" data-dc-action="reshuffle"
        ${filters.chance === 0 || results.length < 2 ? "disabled" : ""}>Reshuffle</button>
    </div>`;
  }

  function page() {
    const all = state().artists.filter((a) => a.status === "discovered");
    const galleries = [
      ...new Map(
        all
          .map((a) => galleryOf(a))
          .filter(Boolean)
          .map((g) => [g.id, g]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const cities = [
      ...new Set(galleries.map((g) => g.city).filter(Boolean)),
    ].sort();
    if (filters.gallery && !galleries.some(g => g.id === filters.gallery)) filters.gallery = "";
    if (filters.city && !cities.includes(filters.city)) filters.city = "";
    const results = matched(all);
    matchingIds = results.map(artist => artist.id);
    filters.page = Math.min(
      filters.page,
      Math.max(0, Math.ceil(results.length / pageSize) - 1),
    );
    const start = filters.page * pageSize;
    const range = results.length > pageSize
      ? `${start + 1}–${Math.min(start + pageSize, results.length)} of ${results.length}`
      : results.length;
    return `<div class="toolbar dc-toolbar">
      <label class="searchbox">${icon("search", 16)}<input type="search" data-dc-filter="search" value="${esc(filters.search)}" placeholder="Find artist or gallery…" aria-label="Filter discoveries"></label>
      <label class="dc-order">Viewing history <select data-dc-filter="history" aria-label="Filter by viewing history">${option("all", "All discoveries", filters.history)}${option("seen", "Seen · undecided", filters.history)}</select></label>
      <select data-dc-filter="gallery" aria-label="Filter by discovering gallery">${option("", "All galleries", filters.gallery)}${galleries
        .filter((g) => !filters.city || g.city === filters.city)
        .map((g) => option(g.id, g.name, filters.gallery))
        .join("")}</select>
      <select data-dc-filter="city" aria-label="Filter by gallery location">${option("", "All locations", filters.city)}${cities.map((c) => option(c, c, filters.city)).join("")}</select>
      <label class="dc-order">Sort by <select data-dc-filter="order" aria-label="Sort discoveries">${option("taste", "Discovery mix", filters.order)}${option("name", "Artist name A–Z", filters.order)}</select></label>
      <span class="result-count"><span aria-live="polite">${range} ${results.length===1?"artist":"artists"}</span>${results.length && filters.history !== "seen" ? ` · <span id="dc-unseen-count" title="An artist counts as seen when half their card is visible for a second or you open their work or profile.">${unseenCount()} unseen</span>` : ""}</span></div>
      ${filters.order === "taste" && results.length ? mixControls(results) : ""}
      ${
        results.length
          ? `<div class="dc-grid">${results
              .slice(start, start + pageSize)
              .map((artist, index) => card(artist, start + index))
              .join("")}</div>`
          : `<div class="panel empty">${filters.history === "seen"
              ? (filters.search || filters.city || filters.gallery ? "No seen, undecided artists match these filters." : "Artists you’ve seen appear here until you follow or archive them.")
              : all.length ? "No artists match these filters." : "You’ve reviewed every discovery. New artists appear when a gallery roster changes."}</div>`
      }
      ${results.length > pageSize ? `<nav class="dc-pager" aria-label="Discovery pages"><button class="btn" data-dc-action="previous" ${start === 0 ? "disabled" : ""}>Previous</button><span>Page ${filters.page + 1} of ${Math.ceil(results.length / pageSize)}</span><button class="btn" data-dc-action="next" ${start + pageSize >= results.length ? "disabled" : ""}>Next</button></nav>` : ""}`;
  }

  function enlarge(artist, requestedIndex) {
    const works = worksOf(artist);
    if (!works.length) return;
    const index = Math.max(0, Math.min(requestedIndex, works.length - 1));
    const work = works[index];
    if (artist.status === "discovered") window.DiscoveryViews.mark(artist.id);
    fw().openDialog(
      artist.name,
      `<section class="dc-viewer">
      <figure><img src="${esc(work.image)}" alt="${esc(work.caption)}"><figcaption>${esc(work.caption)}</figcaption></figure>
      ${work.credit ? `<p class="small muted">${esc(work.credit)}</p>` : ""}
      <div class="dc-evidence">${galleryLabel(artist)}${fw().link(work.sourceUrl, "Gallery source")}</div>
      ${works.length > 1 ? `<div class="dc-strip" aria-label="Select another example">${works.map((w, i) => `<button aria-label="Show example ${i + 1}" aria-pressed="${i === index}" data-dc-action="enlarge" data-id="${esc(artist.id)}" data-index="${i}"><img src="${esc(w.image)}" alt=""></button>`).join("")}<span>Example ${index + 1} of ${works.length}</span></div>` : ""}
      ${artist.status === "discovered" ? actions(artist) : ""}
    </section>`,
    );
  }

  function announceDecision(artist, status) {
    fw().toast(
      status === "watching"
        ? `Following ${artist.name}.`
        : `${artist.name} archived.`,
    );
    const undo = document.createElement("button");
    undo.textContent = "Undo";
    undo.dataset.dcAction = "undo";
    document.querySelector("#toast").append(undo);
  }

  async function decide(artist, status) {
    if (pendingDecision || !artist || artist.status !== "discovered") return;
    pendingDecision = true;
    try {
      const focusFrom = document.activeElement?.closest("[data-discovery-id]");
      const next =
        focusFrom?.nextElementSibling?.dataset.discoveryId ||
        focusFrom?.previousElementSibling?.dataset.discoveryId;
      await fw().post("artists", {
        id: artist.id,
        expectedStatus: "discovered",
        status,
      });
      lastDecision = { id: artist.id, status };
      if (document.querySelector("dialog").open) fw().closeDialog();
      fw().refresh();
      if (focusFrom) {
        const adjacent = next && document.querySelector(
          `[data-discovery-id="${CSS.escape(next)}"] [data-artist]`,
        );
        const target = adjacent || document.querySelector(".dc-grid [data-artist]");
        target?.focus({ preventScroll: true });
      }
      announceDecision(artist, status);
    } catch (error) {
      await fw().reload().catch(() => {});
      fw().toast(error.message);
    } finally {
      pendingDecision = false;
    }
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-dc-action]");
    if (!button) return;
    const action = button.dataset.dcAction;
    const artist = artistById(button.dataset.id);
    if (action === "reshuffle" && filters.order === "taste" && filters.chance > 0) {
      reshuffle();
      newDraw();
      filters.page = 0;
      fw().refresh();
      document.querySelector(".dc-reshuffle")?.focus({ preventScroll: true });
    }
    if (action === "enlarge" && artist)
      enlarge(artist, Number(button.dataset.index) || 0);
    if (action === "archive" || action === "follow")
      await decide(artist, action === "archive" ? "archived" : "watching");
    if (action === "previous" || action === "next") {
      filters.page = Math.max(0, filters.page + (action === "next" ? 1 : -1));
      fw().refresh();
      document.querySelector(".dc-toolbar")?.scrollIntoView({ block: "start" });
      document
        .querySelector(".dc-grid [data-artist]")
        ?.focus({ preventScroll: true });
    }
    if (action === "undo" && lastDecision && !pendingDecision) {
      const { id, status } = lastDecision;
      if (artistById(id)?.status !== status) return;
      pendingDecision = true;
      try {
        await fw().post("artists", {
          id,
          expectedStatus: status,
          status: "discovered",
        });
        lastDecision = null;
        fw().refresh();
        fw().toast("Artist returned to Discoveries.");
      } catch (error) {
        await fw().reload().catch(() => {});
        fw().toast(error.message);
      } finally {
        pendingDecision = false;
      }
    }
  });

  function filter(target) {
    const key = target.dataset.dcFilter;
    filters[key] = target.value;
    newDraw();
    if (key === "city") filters.gallery = "";
    if (key === "order") {
      savePreference(orderKey, filters.order);
    }
    if (key === "history") savePreference(historyKey, filters.history);
    filters.page = 0;
    const caret = key === "search" ? target.selectionStart : null;
    fw().refresh();
    const input = document.querySelector(`[data-dc-filter="${key}"]`);
    input?.focus({ preventScroll: true });
    if (caret !== null && input) input.setSelectionRange(caret, caret);
  }
  document.addEventListener("input", (event) => {
    if (event.target.id === "dc-chance") {
      const value = event.target.value;
      document.querySelector('.dc-mix-control output').value = value + "%";
      event.target.setAttribute("aria-valuetext", value + "% random");
    }
    if (event.target.matches('[data-dc-filter="search"]')) filter(event.target);
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "dc-chance") {
      filters.chance = event.target.valueAsNumber;
      newDraw();
      savePreference(chanceKey, filters.chance);
      filters.page = 0;
      fw().refresh();
      document.querySelector("#dc-chance")?.focus({ preventScroll: true });
    }
    if (event.target.matches("select[data-dc-filter]")) filter(event.target);
  });
  window.Discoveries = { page, compactRow, ordered, newDraw };
})();
