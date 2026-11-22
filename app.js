"use strict";

const app = document.querySelector("#app");
const dialog = document.querySelector("#dialog");
let state = null,
  credits = {},
  current = "overview",
  focusIndex = 0,
  chartRange = "all";
let chartIds = ["oscar-murillo", "issy-wood", "nnena-kalu"],
  hiddenSeries = new Set();
let chartCategory = "All milestones";
const chartCategories = [
  "All milestones",
  "Institution",
  "Exhibition",
  "Representation",
  "Award",
  "Market",
  "Press",
  "Residency",
];
let tableFilters = { search: "", city: "", type: "" };
const views = {
  overview: [
    "Overview",
    "Collection overview",
    "Gallery discoveries and career milestones across your watchlist.",
  ],
  artists: [
    "Artist watchlist",
    "Artist watchlist",
    "The artists you follow and the evidence behind their trajectories.",
  ],
  discoveries: [
    "Discoveries",
    "Discovery inbox",
    "Compare work from gallery programmes. Open an image for its caption and source.",
  ],
  archive: [
    "Archive",
    "Artist archive",
    "Artists you’ve set aside. Their research stays here if your taste changes.",
  ],
  galleries: [
    "Gallery network",
    "Gallery network",
    "Follow the galleries showing artists early, in London and beyond.",
  ],
  sources: [
    "Source monitor",
    "Source monitor",
    "Check sample gallery, marketplace and auction records for new evidence.",
  ],
  desk: [
    "Acquisition desk",
    "Acquisition desk",
    "Compare works against your taste, your annual plan and five-year break-even.",
  ],
  framework: [
    "Collecting framework",
    "Collecting framework",
    "Review a career through its evidence and a work through its own market.",
  ],
  milestones: [
    "Career milestones",
    "Career milestones",
    "Dated gallery, institutional and market events for artists you follow.",
  ],
};
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  artists:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/>',
  discover:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  archive:
    '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9m-10 4h6"/>',
  gallery: '<path d="m3 9 9-6 9 6H3zm2 2v7m5-7v7m4-7v7m5-7v7M3 21h18"/>',
  sources:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  desk: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 12h18m-11 0v2h4v-2"/>',
  book: '<path d="M12 5.5c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1v-14c-4-1-7-1-10 1zm0 .5v13"/>',
  timeline: '<path d="M3 18h4v-5h5v-3h5V5h4"/><circle cx="17" cy="5" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  settings:
    '<path d="M4 7h7m5 0h4M4 17h2m5 0h9"/><circle cx="14" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  link: '<path d="M14 4h6v6m0-6L10 14m0-9H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  award: '<circle cx="12" cy="9" r="5"/><path d="m8 13-2 8 6-3 6 3-2-8"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="1.5"/><circle cx="9" cy="9" r="1.7"/><path d="m4 18 5-5 4 3 3-5 5 7"/>',
  representation:
    '<path d="m9 15-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 0 2-2a3 3 0 1 1 4 4l-4 4a3 3 0 0 1-4 0m-3 0 8-8"/>',
  market: '<path d="m9 4 6 6-3 3-6-6zM13 12l7 7m-17 1h10"/>',
  refresh:
    '<path d="M20 10a8 8 0 0 0-14-4L3 9m0-6v6h6m-5 5a8 8 0 0 0 14 4l3-3m0 6v-6h-6"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  focus:
    '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="m4 16 12-12 4 4L8 20H4z"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M7 2v6m10-6v6M3 11h18"/>',
};
const aliases = {
  building: "gallery",
  globe: "sources",
  external: "link",
  chart: "timeline",
  users: "artists",
  compass: "discover",
  museum: "gallery",
  activity: "timeline",
  sliders: "settings",
  palette: "image",
  plusCircle: "plus",
};
function icon(name, size = 18) {
  return `<svg class="ui-icon" width="${Number(size) || 18}" height="${Number(size) || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons[aliases[name]] || icons.book}</svg>`;
}
function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}
function link(url, label = "View source") {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return "";
    return `<a class="link" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon("link", 13)}</a>`;
  } catch {
    return "";
  }
}
const artistName = (id) =>
  state.artists.find((a) => a.id === id)?.name || "Unknown artist";
const galleryName = (id) =>
  state.galleries.find((g) => g.id === id)?.name || "Independent research";
const photo = (a) => {
  const artist = typeof a === "string" ? state.artists.find(row => row.id === a) : a;
  return credits[artist?.id]?.image || artist?.workExamples?.[0]?.image || "";
};
const following = () =>
  state.artists.filter((a) => (a.status || "watching") === "watching");
const discovered = () => state.artists.filter((a) => a.status === "discovered");
const eventsFor = (id) =>
  state.events
    .filter((e) => e.artistId === id)
    .sort((a, b) => b.date.localeCompare(a.date));
const followedEvents = () => {
  const ids = new Set(following().map((a) => a.id));
  return state.events
    .filter((e) => ids.has(e.artistId))
    .sort((a, b) => b.date.localeCompare(a.date));
};
const typeIcon = {
  Institution: "gallery",
  Award: "award",
  Exhibition: "image",
  Representation: "representation",
  Market: "market",
  Press: "book",
  Residency: "pin",
};
function dateLabel(date) {
  if (!date) return "Date unknown";
  if (/^\d{4}$/.test(date)) return date;
  const s = String(date);
  const d = new Date(
    s.length === 7
      ? s + "-01T12:00:00Z"
      : s.length === 10
        ? s + "T12:00:00Z"
        : s,
  );
  if (!Number.isFinite(d.valueOf())) return s;
  return d.toLocaleDateString("en-GB", {
    day: s.length === 7 ? undefined : "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.textContent = ""), 4800);
}
async function post(path, payload = {}) {
  let res;
  try {
    res = await fetch("/api/" + path.replace(/^\/?api\//, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    toast(
      "Browser storage is unavailable. Your unsaved edits are still open.",
    );
    throw Error("Local server unavailable");
  }
  const body = await res.json();
  if (!res.ok) {
    toast(body.error || "Could not save this change.");
    throw Error(body.error || "Could not save");
  }
  state = body;
  return body;
}
async function reload() {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (!res.ok) throw Error("Could not read the local workspace");
  state = await res.json();
  render();
  return state;
}
function openDialog(title, body) {
  dialog.querySelector("h2").textContent = title;
  dialog.querySelector("#dialog-body").innerHTML = body;
  dialog.setAttribute("aria-label", title);
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
  dialog.scrollTop = 0;
}
function closeDialog() {
  if (dialog.open) dialog.close();
}
dialog.querySelector("#dialog-close").onclick = closeDialog;
dialog.addEventListener("close", () =>
  document.body.classList.remove("modal-open"),
);
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
function go(view) {
  if (!views[view]) return;
  closeDialog();
  document.body.classList.remove("navopen");
  if (current !== view) {
    tableFilters = { search: "", city: "", type: "" };
    Discoveries.newDraw();
  }
  current = view;
  if (location.hash !== "#" + view) location.hash = view;
  render();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => {
  const v = location.hash.slice(1) || "overview";
  if (state && v !== current && views[v]) go(v);
});
const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
function avatar(a) {
  return photo(a)
    ? `<img class="thumb" src="${esc(photo(a))}" alt="">`
    : `<span class="artist-initial" aria-hidden="true">${esc(initials(a.name))}</span>`;
}
function showArtist(id) {
  window.Profile.show(id);
}
function showGallery(id) {
  window.Network.showGallery(id);
}
const fw = (window.FW = {
  getState: () => state,
  esc,
  icon,
  link,
  artistName,
  galleryName,
  dateLabel,
  photo,
  eventsFor,
  post,
  reload,
  refresh: () => render(),
  openDialog,
  closeDialog,
  toast,
  go,
  showArtist,
  showGallery,
  addEvent,
});
const navItems = [
  [
    "Workspace",
    [
      ["overview", "grid"],
      ["artists", "artists"],
      ["discoveries", "discover"],
      ["archive", "archive"],
    ],
  ],
  [
    "Research",
    [
      ["galleries", "gallery"],
      ["sources", "sources"],
      ["desk", "desk"],
      ["framework", "book"],
    ],
  ],
];
function annualBudget() {
  const year = new Date().getFullYear();
  const plans = state.settings.annualBudgets || {};
  return (
    plans[year] ??
    (Object.keys(plans).length ? null : (state.settings.annualBudget ?? null))
  );
}
function sidebar() {
  return `<aside class="sidebar"><a class="brand" href="#overview" data-view="overview" aria-label="Fieldwork overview"><svg class="brand-art" viewBox="0 0 35 38" fill="none" aria-hidden="true"><path d="M1 28 12 4h7L8 28Z" fill="currentColor"/><path d="m10 32 11-24h6L16 32Z" fill="#cf7451"/><path d="m18 35 11-24h6L24 35Z" fill="#df9973"/></svg><b>Fieldwork</b></a><nav aria-label="Main navigation">${navItems.map(([group, rows]) => `<div class="navset"><p class="nav-head">${group}</p>${rows.map(([v, i]) => `<button class="navitem ${current === v ? "active" : ""}" data-view="${v}" ${current === v ? 'aria-current="page"' : ""}>${icon(i, 17)} ${views[v][0]}${v === "discoveries" && discovered().length ? `<span class="count">${discovered().length}</span>` : ""}</button>`).join("")}</div>`).join("")}</nav><div class="side-bottom"><button class="planbtn" data-act="budget"><small>${new Date().getFullYear()} buying plan</small><strong>${annualBudget() == null ? "Set annual budget" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(annualBudget())}</strong>${icon("settings", 16)}</button><div class="local"><i class="dot"></i> Demo workspace <a href="https://github.com/mtjdotcom/fieldwork-demo/issues/new" target="_blank" rel="noopener noreferrer">Feedback</a></div></div></aside><button class="scrim" data-act="menu" aria-label="Close navigation"></button>`;
}
function topbar() {
  return `<header class="topbar"><div class="crumb"><button class="mobile-menu icon-btn" data-act="menu" aria-label="Open navigation">${icon("menu")}</button><span>Workspace</span><span class="slash">/</span><b>${views[current][0]}</b></div><button class="search-trigger" data-act="search" aria-label="Search workspace">${icon("search", 15)} <span>Search workspace</span><kbd>⌘ K</kbd></button></header>`;
}
const headActions = {
  overview: ["addArtist", "Track artist"],
  artists: ["addArtist", "Track artist"],
  milestones: ["addEvent", "Add milestone"],
  galleries: ["addGallery", "Add gallery"],
  sources: ["addSource", "Add source"],
};
function heading() {
  const act = headActions[current],
    t = views[current];
  return `<header class="pagehead"><div>${current === "overview" ? `<div class="overline">${esc(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</div>` : ""}<h1>${t[1]}</h1><p>${t[2]}</p></div>${act ? `<button class="btn primary" data-act="${act[0]}">${icon("plus", 16)} ${act[1]}</button>` : ""}</header>`;
}
function stats() {
  const data = [
    ["artists", "artists", "sage", following().length, "Artists tracked"],
    [
      "galleries",
      "gallery",
      "clay",
      state.galleries.length,
      "Galleries followed",
    ],
    [
      "milestones",
      "timeline",
      "lilac",
      followedEvents().length,
      "Career milestones",
    ],
    ["discoveries", "discover", "sand", discovered().length, "Awaiting review"],
  ];
  return `<section class="stats" aria-label="Workspace totals">${data.map(([v, i, c, n, l]) => `<button class="metric" data-view="${v}"><span class="stat-symbol ${c}">${icon(i, 19)}</span><span><b>${n}</b><small>${l}</small></span></button>`).join("")}</section>`;
}
function activeFocus() {
  const ids = [
    "nnena-kalu",
    "oscar-murillo",
    "issy-wood",
    "nat-faulkner",
    "jesse-darling",
  ];
  const pool = following()
    .filter((a) => credits[a.id])
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return pool.length
    ? pool[((focusIndex % pool.length) + pool.length) % pool.length]
    : null;
}
function focusCard() {
  const a = activeFocus();
  if (!a)
    return `<section class="panel prose"><h2>Artist in focus</h2><p>Follow an artist from the discovery inbox to start their career record.</p><button class="text-btn" data-view="discoveries">Open discoveries</button></section>`;
  return `<section class="focus-card" aria-label="Artist in focus"><img src="${esc(photo(a))}" alt="${esc(credits[a.id].caption)}"><span class="focus-label">${icon("focus", 13)} Artist in focus</span><div class="focus-controls"><button data-act="focusPrev" aria-label="Previous featured artist">${icon("left", 14)}</button><button data-act="focusNext" aria-label="Next featured artist">${icon("right", 14)}</button></div><button class="focus-body" data-artist="${esc(a.id)}"><strong>${esc(a.name)}</strong><span>${esc(galleryName(a.galleryId))} · ${esc(a.medium)}</span></button><button class="focus-info" data-act="credit" aria-label="Photograph credit">${icon("info", 15)}</button></section>`;
}
const palette = [
  "#ad5238",
  "#4c7769",
  "#716692",
  "#98782c",
  "#547493",
  "#93615c",
];
function dateNum(date) {
  const [year, month = "1", day = "1"] = date.split("-").map(String);
  return +year + (+month - 1 + (+day - 1) / 31) / 12;
}
function chartPanel(width = 600) {
  const options = following().filter((a) => eventsFor(a.id).length);
  chartIds = chartIds.filter((id) => options.some((a) => a.id === id));
  if (!chartIds.length) chartIds = options.slice(0, 3).map((a) => a.id);
  const series = chartIds.map((id, i) => ({
    id,
    name: artistName(id),
    color: palette[i % palette.length],
    events: eventsFor(id)
      .filter(
        (e) => chartCategory === "All milestones" || e.type === chartCategory,
      )
      .reverse(),
  }));
  if (!series.length)
    return `<section class="panel prose"><h2>Career trajectories</h2><p>Add a dated milestone to a followed artist to plot a career.</p></section>`;
  const end = new Date().getFullYear(),
    earliest = Math.min(
      ...series.flatMap((s) => s.events.map((e) => +e.date.slice(0, 4))),
    ),
    start = chartRange === "five" ? end - 4 : Math.min(earliest, end - 1);
  const endX = end + 1,
    yMax = Math.max(
      2,
      ...series.map(
        (s) => s.events.filter((e) => dateNum(e.date) < endX).length,
      ),
    );
  const x = (t) => 31 + ((t - start) / (endX - start)) * (width - 50),
    y = (n) => 140 - (n / yMax) * 126;
  const ticks = [0, Math.round(yMax / 2), yMax],
    years =
      chartRange === "five"
        ? [start, start + 1, start + 2, start + 3, end]
        : [
            start,
            Math.round(start + (end - start) / 3),
            Math.round(start + ((end - start) * 2) / 3),
            end,
          ];
  const svg = series
    .map((s) => {
      if (hiddenSeries.has(s.id)) return "";
      let count = s.events.filter((e) => dateNum(e.date) < start).length;
      let line = `M${x(start)} ${y(count)}`,
        marks = "";
      for (const e of s.events) {
        const d = dateNum(e.date);
        if (d < start || d >= endX) continue;
        count++;
        line += ` H${x(d)} V${y(count)}`;
        const tip = `${s.name} · ${dateLabel(e.date)} · ${e.title}`;
        marks += `<circle tabindex="0" role="button" aria-label="${esc(tip)}" class="chart-point" data-event="${esc(e.id)}" data-tip="${esc(tip)}" cx="${x(d)}" cy="${y(count)}" r="4" fill="${s.color}" stroke="var(--panel)" stroke-width="1.4"><title>${esc(tip)}</title></circle>`;
      }
      return `<path d="${line} H${x(endX)}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${marks}`;
    })
    .join("");
  return `<section class="panel chart-panel"><div class="panel-heading"><div><h2>Career trajectories</h2><p>${chartCategory === "All milestones" ? "Cumulative documented milestones" : esc(chartCategory) + " · cumulative recorded events"}</p></div><div class="segment" aria-label="Time range"><button data-range="five" class="${chartRange === "five" ? "active" : ""}" aria-pressed="${chartRange === "five"}">5Y</button><button data-range="all" class="${chartRange === "all" ? "active" : ""}" aria-pressed="${chartRange === "all"}">All</button></div></div><div class="chart-box"><svg viewBox="0 0 ${width} 165" preserveAspectRatio="none" aria-label="Cumulative recorded events by year. Select a point to inspect its source." role="group">${ticks.map((n) => `<line x1="31" x2="${width - 19}" y1="${y(n)}" y2="${y(n)}" stroke="#e1e4da" stroke-dasharray="3 4"/><text x="15" y="${y(n) + 3}" text-anchor="middle" fill="#64705f" font-size="11">${n}</text>`).join("")}${[...new Set(years)].map((t) => `<text x="${x(t)}" y="158" font-size="11" text-anchor="middle" fill="#64705f">${t}</text>`).join("")}${svg}</svg><div class="chart-tip" hidden></div></div><div class="chart-legend">${series.map((s) => `<button class="legend-btn ${hiddenSeries.has(s.id) ? "off" : ""}" data-toggle-series="${esc(s.id)}" aria-pressed="${!hiddenSeries.has(s.id)}" style="--series:${s.color}"><i></i>${esc(s.name)}</button>`).join("")}<button class="chart-manage" data-act="chartSelect" aria-label="Choose artists to compare">${icon("settings", 15)}</button></div></section>`;
}
function eventRow(e) {
  const name = artistName(e.artistId);
  return `<button class="event-row" data-event="${esc(e.id)}"><span class="event-symbol tone-${esc(String(e.type || "Exhibition").toLowerCase())}">${icon(typeIcon[e.type] || "timeline", 17)}</span><span class="copy"><strong>${esc(e.title)}</strong><small>${esc(name)} · ${esc(e.type)}</small></span><span class="date-meta">${esc(dateLabel(e.date))}</span></button>`;
}
function cardTitle(title, view) {
  return `<header class="spread"><h2>${title}</h2><button class="text-btn" data-view="${view}">View all</button></header>`;
}
function overview() {
  return `${stats()}<div class="hero-grid">${chartPanel()}${focusCard()}</div><div class="overview-lower"><section class="panel section-card">${cardTitle("Recent milestones", "milestones")}${followedEvents().slice(0, 5).map(eventRow).join("") || '<p class="empty">Your followed artists have no dated milestones yet.</p>'}</section><section class="panel section-card">${cardTitle("Discovery inbox", "discoveries")}${Discoveries.ordered(discovered()).slice(0, 4).map(Discoveries.compactRow).join("") || '<p class="empty">You’re up to date. Check gallery sources for more artists.</p>'}</section></div>`;
}
function areaOf(a) {
  return state.galleries.find((g) => g.id === a.galleryId)?.city || "";
}
function artistRows(list, status) {
  return list
    .map((a) => {
      const latest = eventsFor(a.id)[0];
      return `<tr><td><div class="arow">${avatar(a)}<div><button class="name-btn" data-artist="${esc(a.id)}">${esc(a.name)}</button><span class="cell-sub">${esc(a.medium || "Medium to review")}</span></div></div></td><td>${a.galleryId ? `<button class="text-btn" data-gallery="${esc(a.galleryId)}">${esc(galleryName(a.galleryId))}</button>` : "Independent research"}<span class="cell-sub">${esc(areaOf(a))}</span></td><td>${latest ? `<button class="name-btn" data-event="${esc(latest.id)}">${esc(latest.title)}</button><span class="cell-sub">${esc(dateLabel(latest.date))}</span>` : "Awaiting a dated source"}</td><td><div class="row">${status !== "watching" ? `<button class="btn sm" data-status="watching" data-record="${esc(a.id)}">Restore</button>` : ""}${status !== "archived" ? `<button class="icon-btn" data-status="archived" data-record="${esc(a.id)}" aria-label="Archive ${esc(a.name)}" title="Archive artist">${icon("archive", 15)}</button>` : ""}</div></td></tr>`;
    })
    .join("");
}
function listContent(status) {
  const all = state.artists.filter((a) => (a.status || "watching") === status);
  const cities = [...new Set(all.map(areaOf).filter(Boolean))].sort();
  const term = tableFilters.search.toLowerCase();
  const list = all
    .filter(
      (a) =>
        (!term ||
          [a.name, a.medium, galleryName(a.galleryId)].some((x) =>
            String(x || "")
              .toLowerCase()
              .includes(term),
          )) &&
        (!tableFilters.city || areaOf(a) === tableFilters.city),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="toolbar"><label class="searchbox">${icon("search", 16)}<input id="artist-search" aria-label="Filter artists" value="${esc(tableFilters.search)}" placeholder="Filter artists…"></label><select id="city-filter" aria-label="Filter by gallery city"><option value="">All locations</option>${cities.map((c) => `<option ${c === tableFilters.city ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><span class="result-count">${list.length} artist${list.length === 1 ? "" : "s"}</span></div><div class="panel table-wrap"><table class="data-table"><thead><tr><th>Artist</th><th>Gallery</th><th>Latest milestone</th><th><span class="small">Actions</span></th></tr></thead><tbody>${artistRows(list, status)}</tbody></table>${list.length ? "" : `<p class="empty">${term || tableFilters.city ? "No artists match these filters." : status === "archived" ? "Artists you archive will appear here." : "Follow an artist from Discoveries or track one yourself."}</p>`}</div>`;
}
function milestones() {
  const all = followedEvents(),
    types = [...new Set(all.map((e) => e.type))].sort();
  const list = all.filter(
    (e) =>
      (!tableFilters.type || e.type === tableFilters.type) &&
      (!tableFilters.search ||
        [e.title, e.detail, artistName(e.artistId), e.source].some((x) =>
          String(x || "")
            .toLowerCase()
            .includes(tableFilters.search.toLowerCase()),
        )),
  );
  return `<div class="toolbar"><label class="searchbox">${icon("search", 16)}<input id="artist-search" aria-label="Search milestones" placeholder="Search milestones…" value="${esc(tableFilters.search)}"></label><select id="type-filter" aria-label="Filter milestone type"><option value="">All milestone types</option>${types.map((t) => `<option ${t === tableFilters.type ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><span class="result-count">${list.length} milestones</span></div><section class="panel">${list.map(eventRow).join("") || '<p class="empty">No matching milestones.</p>'}</section>`;
}
function render() {
  if (!state) return;
  DiscoveryViews.remember(state.artists);
  const page = {
    overview,
    artists: () => listContent("watching"),
    discoveries: () => Discoveries.page(),
    archive: () => listContent("archived"),
    milestones,
    galleries: () => Network.galleries(),
    sources: () => Network.sources(),
    desk: () => Worksheet.page(),
    framework: () => Profile.framework(),
  };
  document.title = views[current][0] + " · Fieldwork";
  app.innerHTML = `${sidebar()}<div class="shell">${topbar()}<main class="page" id="main">${heading()}<div id="page-body">${page[current]()}</div></main></div>`;
  DiscoveryViews.observeCards();
  if (current === "overview") fitOverviewChart();
}
function fitOverviewChart() {
  const plot = document.querySelector(".chart-box");
  if (!plot) return;
  const width = Math.round(plot.clientWidth);
  if (
    width > 0 &&
    Math.abs(plot.querySelector("svg").viewBox.baseVal.width - width) > 1
  ) {
    plot.closest(".chart-panel").outerHTML = chartPanel(width);
  }
}
const dashboardResize = new ResizeObserver(fitOverviewChart);
dashboardResize.observe(app);

function eventDialog(id) {
  const e = state.events.find((v) => v.id === id);
  if (!e) return;
  openDialog(
    e.title,
    `<div class="row wrap"><span class="pill">${esc(e.subtype || e.type)}</span><span class="small muted">${esc(dateLabel(e.date))}</span></div><p style="margin:13px 0">${esc(e.detail || e.notes || "No additional notes.")}</p>${link(e.url || e.sourceUrl, e.source || "Open evidence")}<div class="actions"><button class="btn" data-artist="${esc(e.artistId)}">View ${esc(artistName(e.artistId))}</button></div>`,
  );
}
const fld = (name, title, control, full = false) =>
  `<label class="field ${full ? "span-full" : ""}"><span>${title}</span>${control}</label>`;
function addArtist() {
  openDialog(
    "Track an artist",
    `<form id="add-artist" class="form-grid">${fld("name", "Artist name", '<input name="name" required maxlength="200" autofocus>', true)}${fld("medium", "Medium", '<input name="medium" placeholder="e.g. Painting">')}${fld("galleryId", "Gallery", `<select name="galleryId"><option value="">Independent research</option>${state.galleries.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select>`)}${fld("url", "Artist or source page", '<input name="url" type="url" placeholder="https://…">', true)}${fld("summary", "Why follow this artist?", '<textarea name="summary" placeholder="Record what first caught your eye."></textarea>', true)}<div class="span-full"><button class="btn primary" type="submit">Add to watchlist</button></div></form>`,
  );
  const f = dialog.querySelector("form");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const obj = Object.fromEntries(new FormData(f));
    const match = state.artists.find(
      (a) =>
        a.name.trim().toLocaleLowerCase() ===
        obj.name.trim().toLocaleLowerCase(),
    );
    if (match) {
      showArtist(match.id);
      toast("This artist already has a record.");
      return;
    }
    const submit = f.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      await post("artists", { ...obj, status: "watching" });
      closeDialog();
      render();
      toast("Artist added to your watchlist.");
    } catch {
      submit.disabled = false;
    }
  };
}
function addEvent(artistId) {
  const artists = state.artists.filter(
    (a) => a.status !== "archived" || a.id === artistId,
  );
  if (!artists.length) {
    toast("Track an artist before adding a milestone.");
    return;
  }
  openDialog(
    "Add a career milestone",
    `<form id="add-event" class="form-grid">${fld("artist", "Artist", `<select name="artistId">${artists.map((a) => `<option value="${esc(a.id)}" ${a.id === artistId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`)}${fld("type", "Milestone type", `<select name="type">${[...Object.keys(typeIcon)].map((t) => `<option>${t}</option>`).join("")}</select>`)}${fld("galleryId", "Gallery involved", `<select name="galleryId"><option value="">None recorded</option>${state.galleries.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select>`)}<label class="field" id="institution-field" hidden>Institutional evidence<select name="subtype"><option value="">Unspecified</option>${["Museum solo exhibition", "Museum group show", "Public collection acquisition", "Private foundation holding", "Art centre exhibition", "Biennial presentation", "Public commission", "Retrospective"].map((t) => `<option>${t}</option>`).join("")}</select></label>${fld("title", "Milestone", '<input name="title" required placeholder="e.g. First museum solo" maxlength="250">', true)}${fld("date", "Event date", '<input name="date" required pattern="[0-9]{4}(-[0-9]{2}){0,2}" placeholder="YYYY, YYYY-MM or YYYY-MM-DD">')}${fld("source", "Source name", '<input name="source" required placeholder="Museum, gallery or publication">')}${fld("url", "Evidence URL", '<input name="url" type="url" required placeholder="https://…">', true)}${fld("detail", "What does the source establish?", '<textarea name="detail"></textarea>', true)}<label class="field" id="origin-field" hidden>Earlier gallery<select name="originGalleryId"><option value="">Select if documented</option>${state.galleries.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select></label><label class="field" id="dest-field" hidden>Representing gallery<select name="destinationGallery"><option value="">Other / unspecified</option>${["Gagosian", "David Zwirner", "Hauser & Wirth", "Pace"].map((g) => `<option>${g}</option>`).join("")}</select></label><div class="span-full"><button class="btn primary">Save milestone</button></div></form>`,
  );
  const f = dialog.querySelector("form");
  const toggle = () => {
    f.querySelector("#institution-field").hidden =
      f.elements.type.value !== "Institution";
    for (const id of ["origin-field", "dest-field"])
      f.querySelector("#" + id).hidden =
        f.elements.type.value !== "Representation";
  };
  toggle();
  f.elements.type.onchange = toggle;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (d.type !== "Institution") delete d.subtype;
    if (d.type !== "Representation") {
      delete d.originGalleryId;
      delete d.destinationGallery;
    }
    const submit = f.querySelector("button[type=submit],button.primary");
    submit.disabled = true;
    try {
      await post("events", {
        ...d,
        sourceUrl: d.url,
        megaGallery: !!d.destinationGallery,
      });
      closeDialog();
      render();
      toast("Milestone saved with its source.");
    } catch {
      submit.disabled = false;
    }
  };
}
function chartSelect() {
  const opts = following().filter((a) => eventsFor(a.id).length);
  openDialog(
    "Compare artist trajectories",
    `<form id="chart-choose"><p class="muted small">Choose up to six artists. Each step marks a recorded event. Coverage varies by artist.</p><label class="field" style="margin-top:12px">Milestones to plot<select name="category">${chartCategories.map((c) => `<option ${c === chartCategory ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label><div class="detail-section" style="margin-top:14px">${opts.map((a) => `<label class="checkline"><input type="checkbox" name="id" value="${esc(a.id)}" ${chartIds.includes(a.id) ? "checked" : ""}> ${esc(a.name)}</label>`).join("")}</div><button class="btn primary">Apply selection</button></form>`,
  );
  dialog.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const ids = new FormData(e.target).getAll("id");
    if (!ids.length || ids.length > 6) {
      toast("Choose between one and six artists.");
      return;
    }
    chartIds = ids;
    chartCategory = e.target.elements.category.value;
    hiddenSeries = new Set();
    closeDialog();
    render();
  };
}
function searchWorkspace() {
  openDialog(
    "Search workspace",
    `<input type="search" id="workspace-query" class="dialog-search" placeholder="Search artists, galleries, milestones and works…" aria-label="Search workspace" autofocus><div class="search-results" id="workspace-results"></div>`,
  );
  const input = dialog.querySelector("input"),
    out = dialog.querySelector("#workspace-results");
  const update = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      out.innerHTML =
        '<p class="small muted">Type an artist, gallery, work or exhibition title.</p>';
      return;
    }
    const entries = [
      ...state.artists.map((a) => [a.name, "artist", a.id, a.status]),
      ...state.galleries.map((g) => [g.name, "gallery", g.id, g.city]),
      ...state.events.map((e) => [
        e.title,
        "event",
        e.id,
        artistName(e.artistId),
      ]),
      ...state.assessments.map((a) => [
        a.title,
        "work",
        a.id,
        artistName(a.artistId),
      ]),
    ];
    out.innerHTML =
      entries
        .filter(([n, , , extra]) =>
          [n, extra].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(q),
          ),
        )
        .slice(0, 32)
        .map(
          ([n, t, id, d]) =>
            `<button class="search-hit" data-${t}="${esc(id)}"><b>${esc(n)}</b><small>${esc(t)} · ${esc(d)}</small></button>`,
        )
        .join("") || '<p class="small muted">No matching records.</p>';
  };
  input.oninput = update;
  update();
  input.focus();
}
const acts = {
  addArtist,
  addEvent: () => addEvent(),
  addGallery: () => Network.addGallery(),
  addSource: () => Network.addSource(),
  addWork: () => Worksheet.add(),
  budget: () => Worksheet.budget(),
  chartSelect,
  search: searchWorkspace,
  menu: () => document.body.classList.toggle("navopen"),
  focusPrev: () => {
    focusIndex--;
    render();
  },
  focusNext: () => {
    focusIndex++;
    render();
  },
  credit: () => {
    const a = activeFocus(),
      c = credits[a.id];
    openDialog(
      "Installation photograph",
      `<img src="${esc(c.image)}" alt="${esc(c.caption)}" style="width:100%;border-radius:6px"><p style="margin:12px 0 6px">${esc(c.caption)}</p><p class="muted small">${esc(c.credit)}</p><div class="actions">${link(c.source, "Exhibition source")}</div>`,
    );
  },
};
document.addEventListener("click", async (e) => {
  const el = e.target.closest(
    "[data-view],[data-act],[data-artist],[data-gallery],[data-event],[data-range],[data-status],[data-toggle-series],[data-work]",
  );
  if (!el) return;
  const d = el.dataset;
  if (d.view) {
    e.preventDefault();
    go(d.view);
  } else if (d.act) {
    acts[d.act]?.();
  } else if (d.status) {
    await post("artists", { id: d.record, status: d.status });
    render();
    toast(
      d.status === "archived"
        ? "Artist moved to the archive."
        : "Artist added to your watchlist.",
    );
  } else if (d.artist) {
    showArtist(d.artist);
  } else if (d.gallery) {
    showGallery(d.gallery);
  } else if (d.event) {
    eventDialog(d.event);
  } else if (d.work) {
    Worksheet.add(d.work);
  } else if (d.range) {
    chartRange = d.range;
    render();
  } else if (d.toggleSeries) {
    if (hiddenSeries.has(d.toggleSeries)) hiddenSeries.delete(d.toggleSeries);
    else if (chartIds.filter((id) => !hiddenSeries.has(id)).length > 1)
      hiddenSeries.add(d.toggleSeries);
    else {
      toast("Keep at least one artist visible.");
      return;
    }
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "artist-search") {
    tableFilters.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = document.querySelector("#artist-search");
    input.focus();
    input.setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "city-filter") {
    tableFilters.city = e.target.value;
    render();
  }
  if (e.target.id === "type-filter") {
    tableFilters.type = e.target.value;
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && state) {
    e.preventDefault();
    searchWorkspace();
  }
  if (e.key === "Escape") document.body.classList.remove("navopen");
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.classList.contains("chart-point")
  ) {
    e.preventDefault();
    eventDialog(e.target.dataset.event);
  }
});
function chartTip(e) {
  const point = e.target.closest?.(".chart-point");
  const box = document.querySelector(".chart-box"),
    tip = box?.querySelector(".chart-tip");
  if (!tip) return;
  if (!point) {
    tip.hidden = true;
    return;
  }
  const a = point.getBoundingClientRect(),
    b = box.getBoundingClientRect();
  tip.textContent = point.dataset.tip;
  tip.hidden = false;
  tip.style.left =
    Math.max(0, Math.min(a.left - b.left, b.width - tip.offsetWidth)) + "px";
  tip.style.top = Math.max(0, a.top - b.top - tip.offsetHeight - 6) + "px";
}
document.addEventListener("pointerover", chartTip);
document.addEventListener("focusin", chartTip);
async function start() {
  try {
    const [s, c] = await Promise.all([
      fetch("/api/state", { cache: "no-store" }),
      fetch("./images/credits.json"),
    ]);
    if (!s.ok) throw Error("Local server returned " + s.status);
    state = await s.json();
    credits = c.ok ? await c.json() : {};
    current = views[location.hash.slice(1)]
      ? location.hash.slice(1)
      : "overview";
    render();
  } catch (err) {
    app.innerHTML = `<main class="loading"><h1>Workspace unavailable</h1><p class="small">${esc(err.message)}</p><button class="btn" id="retry">Retry connection</button></main>`;
    document.querySelector("#retry").onclick = start;
  }
}
start();

function workspaceContent(workspace) {
  // First-view timestamps are merged separately so a sighting never remounts the inbox.
  return JSON.stringify(workspace, (key, value) => key === "discoverySeenAt" ? undefined : value);
}

async function updateVisibleWorkspace() {
  if (
    !state ||
    document.hidden ||
    dialog.open ||
    document.activeElement?.matches("input, textarea, select") ||
    (current === "sources" && state.settings.refreshing)
  )
    return;
  const initial = state;
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const next = await res.json();
    if (initial === state) DiscoveryViews.mergeSavedViews(state.artists, next.artists);
    if (
      initial === state &&
      !dialog.open &&
      (workspaceContent(next) !== workspaceContent(state) ||
        document.querySelector(".local")?.textContent ===
          "Local server offline")
    ) {
      state = next;
      render();
    }
  } catch {
    const indicator = document.querySelector(".local");
    if (indicator) indicator.textContent = "Local server offline";
  }
}
window.setInterval(updateVisibleWorkspace, 20000);
document.addEventListener("visibilitychange", updateVisibleWorkspace);
