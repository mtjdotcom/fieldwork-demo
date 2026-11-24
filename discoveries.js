(() => {
  "use strict";

  const pageSize = 15;
  const orderKey = "fieldwork.discoveryOrder";
  const chanceKey = "fieldwork.discoveryChance";
  const seedKey = "fieldwork.discoverySeed";
  const historyKey = "fieldwork.discoveryHistoryFilter";
  const pilotId = "gallery-programmes-01";
  const localWorkImage = /^work-images\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$/;

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
  const worksOf = (artist) => (artist.workExamples || []).filter(work => localWorkImage.test(work.image));
  let lastDecision = null;
  let pendingDecision = false;
  let drawSeen = null;
  let matchingIds = [];
  const returnKey = "fieldwork.discoveryReturn";
  const arrivalView = location.hash.slice(1);
  let arrivalArtist = new URLSearchParams(location.search).get("artist");

  function restoreDiscovery(view) {
    if (view !== arrivalView || !arrivalArtist) return null;
    const id = arrivalArtist;
    arrivalArtist = null;
    let saved = history.state?.discoveryReturn;
    if (saved?.artist !== id || saved?.view !== view) {
      try {
        saved = JSON.parse(sessionStorage.getItem(returnKey));
      } catch {
        saved = null;
      }
    }
    if (view === "discoveries" && saved?.artist === id && saved.view === view) {
      for (const key of Object.keys(filters)) {
        if (typeof saved.filters?.[key] === typeof filters[key]) filters[key] = saved.filters[key];
      }
      if (typeof saved.seed === "string") seed = saved.seed;
      if (Array.isArray(saved.seen)) drawSeen = new Set(saved.seen);
    }
    // The app inserts the new page markup immediately after this render.
    queueMicrotask(() => {
      const attr = view === "discoveries" ? "data-discovery-id" : "data-pilot-artist";
      const card = document.querySelector(`[${attr}="${CSS.escape(id)}"]`);
      card?.querySelector("h2 button")?.focus({preventScroll: true});
      card?.scrollIntoView({block: "start"});
    });
    return id;
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-inbox-presenter]");
    if (!link) return;
    const view = location.hash.slice(1);
    const card = link.closest(".dc-card");
    const artist = card?.dataset.pilotArtist || card?.dataset.discoveryId;
    if (!artist) return;
    const saved = {artist, view, filters: {...filters}, seed, seen: [...(drawSeen || [])]};
    try {
      sessionStorage.setItem(returnKey, JSON.stringify(saved));
    } catch {
      // Browser Back can still use the outgoing entry's state.
    }
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const url = new URL(location.href);
      url.searchParams.set("artist", artist);
      history.replaceState({...history.state, discoveryReturn: saved}, "", url);
    }
  });

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

  function galleryLabel(artist, gallery = galleryOf(artist), noteLinks = []) {
    if (!gallery)
      return '<span class="dc-gallery">Independent discovery</span>';
    const linkedInNote = noteLinks.some(person => person.kind === "gallery" &&
      (person.id === gallery.id || person.name === gallery.name));
    const name = linkedInNote ? esc(gallery.name) : `<button data-gallery="${esc(gallery.id)}">${esc(gallery.name)}</button>`;
    return `<div class="dc-gallery">${icon("gallery", 15)}<span class="dc-via">via</span>${name}${gallery.city ? `<span>· ${esc(gallery.city)}</span>` : ""}</div>`;
  }

  function discoveryNote(artist, gallery) {
    if (artist.discoveryNote?.text) return artist.discoveryNote;
    // Sample workspaces and older local data can supply the original discovery fields.
    const pilot = artist.discoveryPilot;
    const presenters = gallery ? [{id: gallery.id, name: gallery.name, kind: "gallery"}] : [];
    if (pilot?.whyNow) {
      const sources = [{url: pilot.showUrl, label: pilot.showTitle}, {url: pilot.earlierUrl, label: pilot.earlierTitle}];
      return {text: pilot.whyNow, asOf: pilot.observedThrough, presenters, sources};
    }
    const discovery = artist.discoveries?.find(d => d.galleryId === gallery?.id);
    const text = gallery && discovery ? `${gallery.name} lists ${artist.name} on its website.`
      : gallery ? `The workspace links ${artist.name} to ${gallery.name}.`
      : "A dated exhibition or gallery selection has yet to be documented here.";
    const url = discovery?.url || artist.url;
    return {text, presenters, sources: url ? [{url, label: "Artist listing"}] : []};
  }

  function whyNote(note, artistId, origin) {
    const people = (note.presenters || []).filter(person => person.id && person.name);
    const byName = new Map(people.map(person => [person.name.toLowerCase(), person]));
    const names = Array.from(byName.keys()).sort((a, b) => b.length - a.length)
      .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const linked = new Set();
    const anchor = (person, label) => {
      const href = Network.presenterHref(person.id, {origin, artist: artistId, kind: person.kind});
      return `<a href="${esc(href)}" data-inbox-presenter>${esc(label)}</a>`;
    };
    let body = "", offset = 0;
    if (names.length) {
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`, "giu");
      for (const match of note.text.matchAll(pattern)) {
        const person = byName.get(match[0].toLowerCase());
        if (!person || linked.has(person.id)) continue;
        body += esc(note.text.slice(offset, match.index)) + anchor(person, match[0]);
        linked.add(person.id);
        offset = match.index + match[0].length;
      }
    }
    body += esc(note.text.slice(offset));
    const extra = people.filter(person => !linked.has(person.id)).map(person => anchor(person, person.name));
    const sources = (note.sources || []).map(s => fw().link(s.url, s.label || "Source")).filter(Boolean);
    return `<section class="dc-why"><h3>Why follow now?</h3><p>${body}</p>
      ${extra.length ? `<p class="dc-presenter-links"><span>People &amp; places</span> ${extra.join(" · ")}</p>` : ""}
      ${sources.length ? `<details><summary>Evidence${note.asOf ? " · " + esc(fw().dateLabel(note.asOf)) : ""}</summary>
        <ul>${sources.map(s => `<li>${s}</li>`).join("")}</ul>${note.creditNote ? `<p>${esc(note.creditNote)}</p>` : ""}</details>` : ""}</section>`;
  }

  function actions(artist, compact = false) {
    return `<div class="${compact ? "dc-compact-actions" : "dc-actions"}">
      <button class="${compact ? "icon-btn" : "btn"}" data-dc-action="archive" data-id="${esc(artist.id)}" aria-label="Archive ${esc(artist.name)}" title="Archive ${esc(artist.name)}">${icon("archive", 15)}${compact ? "" : " Archive"}</button>
      <button class="${compact ? "icon-btn" : "btn primary"}" data-dc-action="follow" data-id="${esc(artist.id)}" aria-label="Follow ${esc(artist.name)}" title="Follow ${esc(artist.name)}">${icon("plus", 15)}${compact ? "" : " Follow"}</button>
    </div>`;
  }

  function imageButton(artist, work, index, compact = false, action = "enlarge") {
    const label = `Enlarge work ${index + 1} by ${artist.name}`;
    return `<button type="button" class="dc-tile${compact ? " dc-thumb" : ""}" data-dc-action="${action}" data-id="${esc(artist.id)}" data-index="${index}" aria-label="${esc(label)}" title="${esc(work.caption)}">
      <img loading="lazy" decoding="async" src="${esc(work.image)}" alt="${esc(work.caption)}"></button>`;
  }

  function card(artist, position) {
    const works = worksOf(artist);
    const gallery = galleryOf(artist);
    const note = discoveryNote(artist, gallery);
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
      <div class="dc-details"><h2><button data-artist="${esc(artist.id)}">${esc(artist.name)}</button></h2>${galleryLabel(artist, gallery, note.presenters)}
        ${reason ? `<p class="dc-match-note">${esc(reason)}</p>` : ""}
        ${whyNote(note, artist.id, "discoveries")}</div>
      ${actions(artist)}
    </article>`;
  }

  function compactRow(artist) {
    const work = worksOf(artist)[0];
    return `<div class="candidate-row dc-compact" data-discovery-id="${esc(artist.id)}">${work ? imageButton(artist, work, 0, true) : `<span class="artist-initial">${icon("image", 16)}</span>`}
      <div class="copy"><button data-artist="${esc(artist.id)}"><strong>${esc(artist.name)}</strong></button>${galleryLabel(artist)}</div>${actions(artist, true)}</div>`;
  }

  function pilotArtists() {
    return state().artists.filter(artist => artist.discoveryPilot?.id === pilotId);
  }

  function pilotWork(artist) {
    const p = artist.discoveryPilot;
    return {image: p.imageUrl, caption: p.workTitle, credit: p.imageCredit, sourceUrl: p.workUrl};
  }

  function pilotChoice(artist) {
    if (artist.status === "watching") return "follow";
    if (artist.status === "archived") return "archive";
    return artist.discoveryPilotRevisit ? "revisit" : "";
  }

  function pilotActions(artist) {
    const selected = pilotChoice(artist);
    const options = [["follow", "Follow", "Following"], ["revisit", "Revisit", "Saved to revisit"], ["archive", "Archive", "Archived"]];
    return `<div class="dc-actions dc-pilot-actions" role="group" aria-label="Decision for ${esc(artist.name)}">${options.map(([key, label, active]) =>
      `<button class="btn${selected === key ? " primary" : ""}" data-dc-action="pilot-${key}" data-id="${esc(artist.id)}" aria-pressed="${selected === key}" aria-label="${esc(label + " " + artist.name)}">${selected === key ? active : label}</button>`).join("")}</div>`;
  }

  function pilotCard(artist) {
    const p = artist.discoveryPilot;
    const work = pilotWork(artist);
    const gallery = state().galleries.find(g => g.id === p.galleryId) || galleryOf(artist);
    const note = p.note || discoveryNote(artist, gallery);
    const earlier = fw().link(p.earlierUrl, p.earlierTitle) || esc(p.earlierTitle || "");
    const choice = pilotChoice(artist);
    return `<article class="dc-card dc-pilot-card" data-pilot-artist="${esc(artist.id)}"${artist.status === "discovered" ? ` data-discovery-id="${esc(artist.id)}"` : ""}>
      ${localWorkImage.test(work.image)
        ? `<div class="dc-works dc-count-1">${imageButton(artist, work, 0, false, "pilot-work")}</div>`
        : `<div class="dc-unavailable">${icon("image", 25)}${fw().link(work.sourceUrl, "See the work") || "Artwork preview unavailable"}</div>`}
      <div class="dc-details"><h2><button data-artist="${esc(artist.id)}">${esc(artist.name)}</button></h2>
        ${galleryLabel(artist, gallery, note.presenters)}
        <p class="dc-pilot-caption">${fw().link(work.sourceUrl, work.caption) || esc(work.caption || "")}${work.credit ? `<small>${esc(work.credit)}</small>` : ""}</p>
        <p class="dc-pilot-show">${fw().link(p.showUrl, p.showTitle) || esc(p.showTitle)} <span>${esc(p.showDate)}</span></p>
        ${whyNote(note, artist.id, "gallery-pilot")}
        ${earlier ? `<h3>Earlier evidence</h3><p>${earlier}</p>` : ""}
        ${p.earlierArtfactsUrl ? `<p>${fw().link(p.earlierArtfactsUrl, "Artfacts record")}</p>` : ""}
        ${p.pricingNote ? `<h3>Market evidence</h3><p>${esc(p.pricingNote)}</p>` : ""}
      </div>
      ${pilotActions(artist)}
      ${choice ? `<button class="text-btn dc-clear-choice" data-dc-action="pilot-clear" data-id="${esc(artist.id)}" aria-label="Clear choice for ${esc(artist.name)}">Clear choice</button>` : ""}
    </article>`;
  }

  function pilotPage() {
    restoreDiscovery("gallery-pilot");
    const artists = pilotArtists().sort((a, b) => (a.discoveryPilot.position || 0) - (b.discoveryPilot.position || 0));
    const remaining = artists.filter(a => !pilotChoice(a)).length;
    return `<div class="toolbar"><button class="btn" data-view="discoveries">All discoveries</button>
      ${artists.length && ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)
        ? '<button class="btn" data-view="why-comparison">Compare notes</button>' : ""}
      <span class="result-count" aria-live="polite">${artists.length} artists · ${remaining} awaiting a choice</span></div>
      ${artists.length ? `<div class="dc-grid dc-pilot-grid">${artists.map(pilotCard).join("")}</div>` : '<p class="panel empty">There are no gallery pilot records in this workspace.</p>'}`;
  }

  const comparisonParams = new URLSearchParams(location.search);
  const roundNumber = comparisonParams.get("round") || "1";
  let returnToCard = comparisonParams.get("card");
  function comparisonEndpoint(roundId) {
    const query = new URLSearchParams({round: roundNumber});
    if (roundId) query.set("id", roundId);
    return "/api/why-comparison" + (roundId ? "/key?" : "?") + query;
  }
  const comparisonChoices = {a: "Prefer A", b: "Prefer B", tie: "Equally helpful", neither: "Neither helps"};
  let comparison = null;
  let writingMethods = null;
  let comparisonPending = false;
  let comparisonError = "";
  let comparisonVisit = 0;
  let lastVoteRequest = null;

  function leaveComparison() {
    comparisonVisit++;
    comparison = writingMethods = null;
    comparisonPending = false;
    comparisonError = "";
  }

  async function comparisonJson(url, payload) {
    const options = {cache: "no-store"};
    if (payload) {
      options.method = "POST";
      options.headers = {"Content-Type": "application/json"};
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(url, options);
    if (response.status === 404) throw Error("There is no prepared comparison in this workspace yet.");
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "The local server could not complete this request.");
    return body;
  }

  async function updateComparison(action, artistId, choice) {
    if (comparisonPending || location.hash !== "#why-comparison") return;
    const visit = comparisonVisit;
    const set = comparison;
    comparisonPending = true;
    comparisonError = "";
    writingMethods = null;
    if (action !== "load") fw().refresh();
    try {
      let result;
      if (action === "reveal") {
        result = await comparisonJson(comparisonEndpoint(set.id));
        if (visit !== comparisonVisit) return;
        if (result.id !== set.id || !result.key) throw Error("The comparison has changed. Reload its notes.");
        writingMethods = result.key;
      } else {
        if (action === "vote") {
          lastVoteRequest = comparisonJson(comparisonEndpoint(), {id: set.id, artistId, choice});
          result = await lastVoteRequest;
        } else {
          // A collector can leave and return while their last choice is still saving.
          if (lastVoteRequest) await lastVoteRequest.catch(() => {});
          if (visit !== comparisonVisit) return;
          result = await comparisonJson(comparisonEndpoint());
        }
        if (visit !== comparisonVisit) return;
        if (!result.id || !Array.isArray(result.cards) || !result.votes) {
          throw Error("The local server returned an incomplete comparison.");
        }
        comparison = result;
      }
    } catch (error) {
      if (visit !== comparisonVisit) return;
      comparison = null;
      comparisonError = error.message || "Could not reach the local comparison.";
    } finally {
      if (visit === comparisonVisit) {
        comparisonPending = false;
        if (location.hash === "#why-comparison") {
          fw().refresh();
          if (action === "load" && comparison && returnToCard) {
            const card = document.querySelector(`[data-comparison-card="${CSS.escape(returnToCard)}"]`);
            returnToCard = null;
            card?.querySelector("h2")?.focus({preventScroll: true});
            card?.scrollIntoView({block: "start"});
          } else if (action === "vote" && comparison) {
            const card = document.querySelector(`[data-comparison-card="${CSS.escape(artistId)}"]`);
            card?.querySelector(`[data-vote="${choice || "a"}"]`)?.focus({preventScroll: true});
          }
        }
      }
    }
  }

  function presenterLinks(card) {
    if (!card.presenters?.length) return "";
    const links = card.presenters.map(person => {
      const href = Network.presenterHref(person.id, {round: comparison.round, card: card.id});
      return `<a href="${esc(href)}" data-presenter-link>${esc(person.name)}</a>`;
    });
    return `<p class="dc-presenter-links"><span>People &amp; places</span>
      ${links.join(' <span aria-hidden="true">·</span> ')}</p>`;
  }

  function comparisonCard(card) {
    const choice = comparison.votes[card.id];
    const methodLabels = {template: "Template", gemma: "Gemma 3 4B"};
    const texts = ["a", "b"].map(side => {
      const method = methodLabels[writingMethods?.[card.id]?.[side]];
      return `<section class="dc-alternative"><h3>Note ${side.toUpperCase()}${method ? ` · ${method}` : ""}</h3>
        <p>${esc(card[side])}</p></section>`;
    }).join("");
    const buttons = Object.entries(comparisonChoices).map(([value, label]) =>
      `<button class="btn${choice === value ? " primary" : ""}" data-vote="${value}" aria-pressed="${choice === value}" ${comparisonPending ? "disabled" : ""}>${label}</button>`,
    ).join("");
    const sources = card.sources.map(source => fw().link(source.url, source.label)).filter(Boolean);
    return `<article class="panel dc-comparison-card" data-comparison-card="${esc(card.id)}">
      <header><h2 tabindex="-1">${esc(card.artistName)}</h2><span class="small muted">As of ${esc(fw().dateLabel(card.asOf))}</span></header>
      ${presenterLinks(card)}
      <div class="dc-alternatives">${texts}</div>
      <div class="dc-votes" role="group" aria-label="Preferred note for ${esc(card.artistName)}">${buttons}
        ${choice ? `<button class="text-btn" data-vote="clear" ${comparisonPending ? "disabled" : ""}>Clear choice</button>` : ""}</div>
      ${sources.length ? `<details><summary>Source evidence (${sources.length})</summary><ul>${sources.map(source => `<li>${source}</li>`).join("")}</ul></details>` : ""}
      </article>`;
  }

  function comparisonPage() {
    const back = roundNumber === "1" ? '<button class="btn" data-view="gallery-pilot">Back to original cards</button>'
      : '<button class="btn" data-view="discoveries">Discovery inbox</button>';
    if (!["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)) {
      return `<div class="toolbar">${back}</div><p class="panel empty">Open the local app to compare notes.</p>`;
    }
    if (!comparison && !comparisonPending && !comparisonError) updateComparison("load");
    if (!comparison) {
      return `<div class="toolbar">${back}</div><div class="panel empty" role="status">${comparisonError ?
        `${esc(comparisonError)} <button class="text-btn" data-comparison-action="retry">Retry</button>` : "Loading comparison…"}</div>`;
    }
    const reviewed = comparison.cards.filter(card => comparison.votes[card.id]).length;
    const complete = comparison.cards.length > 0 && reviewed === comparison.cards.length;
    const rounds = (comparison.rounds || []).map(number => {
      const active = number === comparison.round;
      return `<a class="btn${active ? " primary" : ""}" ${active ? 'aria-current="page"' : ""}
        href="?round=${encodeURIComponent(number)}#why-comparison">Round ${esc(number)}</a>`;
    }).join(" ");
    return `<div class="toolbar">${back}<nav aria-label="Comparison rounds">${rounds}</nav>
      <span class="result-count" aria-live="polite">${reviewed} of ${comparison.cards.length} choices saved</span></div>
      <div class="dc-comparison-list">${comparison.cards.map(comparisonCard).join("")}</div>
      <div class="dc-reveal"><button class="btn" data-comparison-action="${writingMethods ? "hide" : "reveal"}" ${!complete || comparisonPending ? "disabled" : ""}>
        ${writingMethods ? "Hide writing methods" : "Reveal writing methods"}</button></div>`;
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-presenter-link]");
    if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      // Also restore the originating card when the collector uses the browser Back button.
      const origin = new URL(location.href);
      origin.searchParams.set("card", link.closest("[data-comparison-card]").dataset.comparisonCard);
      history.replaceState(history.state, "", origin);
      if (comparisonPending && lastVoteRequest) {
        event.preventDefault();
        lastVoteRequest.then(() => {
          if (location.href === origin.href) location.assign(link.href);
        }).catch(() => {});
      }
      return;
    }
    const button = event.target.closest("[data-comparison-action], [data-vote]");
    if (!button || location.hash !== "#why-comparison" || comparisonPending) return;
    const action = button.dataset.comparisonAction;
    if (action === "retry") {
      comparisonError = "";
      fw().refresh();
    } else if (action === "hide") {
      writingMethods = null;
      fw().refresh();
    } else if (action === "reveal" && comparison?.cards.every(card => comparison.votes[card.id])) {
      updateComparison("reveal");
    } else if (button.dataset.vote && comparison) {
      const artistId = button.closest("[data-comparison-card]")?.dataset.comparisonCard;
      const choice = button.dataset.vote === "clear" ? null : button.dataset.vote;
      if (artistId && (comparison.votes[artistId] ?? null) !== choice) updateComparison("vote", artistId, choice);
    }
  });

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
    const returning = restoreDiscovery("discoveries");
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
    const returnIndex = returning ? matchingIds.indexOf(returning) : -1;
    if (returnIndex >= 0) filters.page = Math.floor(returnIndex / pageSize);
    filters.page = Math.min(
      filters.page,
      Math.max(0, Math.ceil(results.length / pageSize) - 1),
    );
    const start = filters.page * pageSize;
    const range = results.length > pageSize
      ? `${start + 1}–${Math.min(start + pageSize, results.length)} of ${results.length}`
      : results.length;
    return `<div class="toolbar dc-toolbar">
      ${pilotArtists().length ? '<button class="btn" data-view="gallery-pilot">Gallery pilot</button>' : ""}
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

  function enlarge(artist, requestedIndex, pilot = false) {
    const works = pilot ? [pilotWork(artist)] : worksOf(artist);
    if (!works.length) return;
    const index = Math.max(0, Math.min(requestedIndex, works.length - 1));
    const work = works[index];
    if (artist.status === "discovered") window.DiscoveryViews.mark(artist.id);
    fw().openDialog(
      artist.name,
      `<section class="dc-viewer">
      <figure><img src="${esc(work.image)}" alt="${esc(work.caption)}"><figcaption>${esc(work.caption)}</figcaption></figure>
      ${work.credit ? `<p class="small muted">${esc(work.credit)}</p>` : ""}
      <div class="dc-evidence">${galleryLabel(artist, pilot ? state().galleries.find(g => g.id === artist.discoveryPilot.galleryId) : undefined)}${fw().link(work.sourceUrl, "Gallery source")}</div>
      ${works.length > 1 ? `<div class="dc-strip" aria-label="Select another example">${works.map((w, i) => `<button aria-label="Show example ${i + 1}" aria-pressed="${i === index}" data-dc-action="enlarge" data-id="${esc(artist.id)}" data-index="${i}"><img src="${esc(w.image)}" alt=""></button>`).join("")}<span>Example ${index + 1} of ${works.length}</span></div>` : ""}
      ${pilot ? pilotActions(artist) : artist.status === "discovered" ? actions(artist) : ""}
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

  async function choosePilot(artist, choice) {
    if (pendingDecision || !artist || artist.discoveryPilot?.id !== pilotId || choice === pilotChoice(artist)) return;
    const status = {follow: "watching", archive: "archived", revisit: "discovered", clear: "discovered"}[choice];
    if (!status) return;
    pendingDecision = true;
    try {
      const payload = {id: artist.id, expectedStatus: artist.status, status};
      if (status === "discovered") payload.discoveryPilotRevisit = choice === "revisit";
      await fw().post("artists", payload);
      if (document.querySelector("dialog").open) fw().closeDialog();
      fw().refresh();
      const card = document.querySelector(`[data-pilot-artist="${CSS.escape(artist.id)}"]`);
      card?.querySelector(`[data-dc-action="pilot-${choice === "clear" ? "follow" : choice}"]`)?.focus({preventScroll: true});
      const saved = {follow: "Following", archive: "Archived", revisit: "Saved to revisit", clear: "Choice cleared"};
      fw().toast(`${saved[choice]} · ${artist.name}`);
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
    if (action === "pilot-work" && artist?.discoveryPilot?.id === pilotId) {
      enlarge(artist, 0, true);
    } else if (action.startsWith("pilot-")) {
      await choosePilot(artist, action.slice(6));
    }
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
  window.Discoveries = { page, pilotPage, comparisonPage, leaveComparison, compactRow, ordered, newDraw };
})();
