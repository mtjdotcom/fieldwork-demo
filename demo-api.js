// Serve the local app's data contract from a public fixture plus this browser's edits.
// Only same-origin Fieldwork API requests are handled. Source checks use bundled samples.
(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const assetBase = new URL('.', document.currentScript.src);
  const storageKey = 'fieldwork-public-workspace-v1';
  const legacyKey = 'fieldwork-public-demo-decisions-v1';
  const collections = ['artists', 'galleries', 'events', 'sources', 'reviews', 'assessments'];
  const sourceRuntime = ['status', 'message', 'pageTitle', 'excerpt', 'lastChecked', 'lastChanged',
    '_snapshot', 'artistScanMessage', 'newArtistCount', 'lastRosterUrl'];
  const now = () => new Date().toISOString();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const id = () => crypto.randomUUID();
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const requireValue = (value, message) => { if (!value) throw new Error(message); };
  const response = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: {'Content-Type':'application/json', 'Cache-Control':'no-store'}
  });
  let seedPromise;

  function seed() {
    if (!seedPromise) {
      seedPromise = nativeFetch(new URL('demo-state.json', assetBase), {cache:'no-cache'})
        .then(result => {
          if (!result.ok) throw new Error('The sample workspace could not be loaded. Refresh to retry.');
          return result.json();
        }).catch(error => { seedPromise = null; throw error; });
    }
    return seedPromise;
  }

  function restore(base) {
    const state = structuredClone(base);
    let saved, old;
    try {
      saved = localStorage.getItem(storageKey);
      if (!saved) old = localStorage.getItem(legacyKey);
    } catch { /* A read-only preview still works with browser storage disabled. */ }
    if (saved) {
      const patch = JSON.parse(saved);
      requireValue(patch.version === 1, 'This browser workspace uses an unsupported format.');
      for (const name of collections) {
        for (const edit of patch[name] || []) {
          let row = state[name].find(item => item.id === edit.id);
          if (!row) { row = {id:edit.id}; state[name].push(row); }
          for (const field of edit.removed || []) delete row[field];
          Object.assign(row, edit.values);
        }
      }
      Object.assign(state.settings, patch.settings);
    } else if (old) {
      let choices;
      try { choices = JSON.parse(old); } catch { choices = {}; }
      for (const artist of state.artists) {
        const choice = choices?.[artist.id];
        if (choice === 'following') Object.assign(artist, {status:'watching', tasteDecision:'follow'});
        if (choice === 'archive') Object.assign(artist, {status:'archived', tasteDecision:'archive'});
        if (choice === 'inbox') Object.assign(artist, {status:'discovered', tasteDecision:null});
      }
    }
    return state;
  }

  // Save only differences so later published fixture updates can reach returning visitors.
  function persist(base, state) {
    const patch = {version:1, settings:{}};
    for (const [key, value] of Object.entries(state.settings)) {
      if (!same(base.settings[key], value)) patch.settings[key] = value;
    }
    for (const name of collections) {
      const originals = new Map(base[name].map(row => [row.id,row]));
      patch[name] = [];
      for (const row of state[name]) {
        const original = originals.get(row.id) || {};
        const values = Object.fromEntries(Object.entries(row).filter(([key, value]) => !same(original[key],value)));
        const removed = Object.keys(original).filter(key => !Object.hasOwn(row,key));
        if (removed.length || Object.keys(values).length) patch[name].push({id:row.id, values, removed});
      }
    }
    try { localStorage.setItem(storageKey, JSON.stringify(patch)); }
    catch { throw new Error('Your browser could not save this change. Check site storage permissions or available space.'); }
  }

  function ref(state, collection, key) {
    const found = state[collection].find(row => row.id === key);
    requireValue(found, 'The selected record in ' + collection + ' could not be found.');
    return found;
  }

  function textField(value, key, max = 500) {
    requireValue(typeof value === 'string' && value.trim() && value.trim().length <= max,
      'Enter a valid ' + key + ' (up to ' + max + ' characters).');
    return value.trim();
  }

  function publicUrl(value) {
    const message = 'Enter an absolute public HTTP or HTTPS source URL.';
    requireValue(typeof value === 'string' && !/[\s\\]/.test(value) && value.length <= 4096, message);
    let url;
    try { url = new URL(value); } catch { throw new Error(message); }
    requireValue(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
      ['', '80', '443'].includes(url.port) && url.hostname.includes('.') &&
      !/(^|\.)(localhost|local|internal|home\.arpa)\.?$/i.test(url.hostname), message);
  }

  function nameKey(name) {
    return name.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  function validateWorkEvidence(edits) {
    for (const key of ['documentationOrigin','documentationCondition','secondLookNotes']) {
      requireValue(!Object.hasOwn(edits,key) || typeof edits[key] === 'string', key + ' must be text.');
    }
    if (Object.hasOwn(edits,'secondLookDate') && edits.secondLookDate !== '') {
      const date = edits.secondLookDate;
      const parsed = new Date(date + 'T00:00:00Z');
      requireValue(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        !date.startsWith('0000') && Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date),
        'Enter a valid second-look date (YYYY-MM-DD).');
    }
    if (Object.hasOwn(edits,'comparables')) {
      requireValue(Array.isArray(edits.comparables), 'Provide comparable sales as a list.');
      for (const sale of edits.comparables) {
        requireValue(isObject(sale) && (!Object.hasOwn(sale,'match') || ['','close','context'].includes(sale.match)),
          'Choose a valid match for each comparable sale.');
      }
    }
  }

  function impactReviewValues(event = {}) {
    return ['impactLevel','impactTrack','impactReason','coverageOfId','source'].map(key => event[key] || '')
      .concat(event.url || event.sourceUrl || '');
  }

  function validateEventReview(state, row) {
    const {impactLevel = '', impactTrack = '', impactReason = '', coverageOfId = ''} = row;
    requireValue(['','context','meaningful','major','career-defining','unclassified'].includes(impactLevel),
      'Choose a valid milestone impact level.');
    requireValue(['','institutional','gallery','critical','market','other'].includes(impactTrack),
      'Choose a valid milestone impact track.');
    requireValue(typeof impactReason === 'string', 'Enter an impact reason as text.');
    if (impactLevel) {
      requireValue(impactTrack, 'Choose a track for the reviewed impact.');
      row.impactReason = textField(impactReason,'impact reason');
      publicUrl(row.url || row.sourceUrl);
    } else {
      requireValue(!impactTrack && !impactReason, 'Choose an impact level to save a reviewed track or reason.');
    }
    requireValue(typeof coverageOfId === 'string', 'Choose a valid milestone for related coverage.');
    if (row.coverageOfId) {
      const original = ref(state,'events',row.coverageOfId);
      requireValue(original.id !== row.id && original.artistId === row.artistId && !original.coverageOfId,
        'Choose an original milestone for the same artist.');
      requireValue(!row.impactLevel || row.impactTrack === 'critical', 'Coverage belongs on the critical track.');
    }
    requireValue(!state.events.some(e => e.coverageOfId === row.id && (row.coverageOfId || row.artistId !== e.artistId)),
      'A milestone with linked coverage must remain an original event for the same artist.');
  }

  function upsert(state, collection, payload) {
    const existing = payload.id ? ref(state,collection,payload.id) : null;
    const edits = {...payload};
    if (collection === 'events' && Object.hasOwn(edits, 'expectedImpactReview')) {
      requireValue(existing && same(edits.expectedImpactReview,impactReviewValues(existing)),
        'This review changed. Reopen the milestone to review the latest version.');
      delete edits.expectedImpactReview;
    }
    if (collection === 'assessments') validateWorkEvidence(edits);
    if (collection === 'artists') {
      if (edits.expectedStatus != null) requireValue(existing?.status === edits.expectedStatus,
        'This artist’s status changed. Check their current status before choosing again.');
      for (const k of ['expectedStatus','tasteDecision','tasteMatch','workExamples','workPreviewStatus','discoverySeenAt']) delete edits[k];
    } else if (collection === 'galleries') {
      for (const k of ['tier','tierSource','tierAssessment','tierCohorts']) delete edits[k];
    }
    const row = {...existing, ...edits, id: existing?.id || id()};
    if (['artists','galleries','sources'].includes(collection)) row.name = textField(row.name,'name');
    if (collection === 'artists') {
      row.status ??= 'watching';
      requireValue(['watching','discovered','archived'].includes(row.status), 'Choose watching, discovered, or archived.');
      if (row.status !== existing?.status) row.tasteDecision = {watching:'follow',archived:'archive'}[row.status] || null;
      requireValue(!state.artists.some(a => a.id !== row.id && nameKey(a.name) === nameKey(row.name)),
        'An artist with this name already exists. Open their existing record.');
    }
    if (['events','assessments'].includes(collection)) {
      row.title = textField(row.title,'title');
      ref(state,'artists',row.artistId);
    } else if (row.artistId) ref(state,'artists',row.artistId);
    if (row.galleryId) ref(state,'galleries',row.galleryId);
    if (collection === 'events') {
      validateEventReview(state,row);
      const date = row.date || '';
      requireValue(/^\d{4}(-\d{2}(-\d{2})?)?$/.test(date), 'Use a year, year-month, or full date (YYYY-MM-DD).');
      const full = (date + '-01-01').slice(0,10);
      const parsed = new Date(full+'T00:00:00Z');
      requireValue(Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(full), 'The milestone date is invalid.');
    }
    if (row.sourceUrl) publicUrl(row.sourceUrl);
    if (row.url || collection === 'sources') publicUrl(row.url);
    if (collection === 'sources') {
      requireValue(row.enabled == null || typeof row.enabled === 'boolean', 'Choose whether to check this source.');
      requireValue(!state.sources.some(s => s.id !== row.id && s.url === row.url &&
        (s.artistId || '') === (row.artistId || '') && (s.galleryId || '') === (row.galleryId || '')),
        'This source is already saved for that artist or gallery.');
      for (const k of sourceRuntime) {
        if (existing?.url === row.url && Object.hasOwn(existing,k)) row[k] = existing[k];
        else delete row[k];
      }
      row.status ??= 'unchecked';
    }
    if (existing) state[collection][state[collection].indexOf(existing)] = row;
    else state[collection].push(row);
    if (collection === 'galleries' && edits.rosterUrl) {
      publicUrl(edits.rosterUrl);
      if (!state.sources.some(s => s.galleryId === row.id && s.url === edits.rosterUrl)) {
        upsert(state,'sources',{name:row.name+' · Artist roster',kind:'Gallery',galleryId:row.id,url:edits.rosterUrl});
      }
    }
    return row;
  }

  function updateSettings(state, payload) {
    const values = {...payload};
    delete values.refreshing;
    if (values.annualBudgets !== undefined) {
      requireValue(isObject(values.annualBudgets), 'Provide a budget amount for each calendar year.');
      for (const [year,amount] of Object.entries(values.annualBudgets)) {
        requireValue(/^\d{4}$/.test(year) && +year >= 1900 && +year <= 2200 && Number.isFinite(amount) && amount >= 0,
          'Choose a year from 1900 to 2200 and a finite nonnegative budget.');
      }
      values.annualBudgets = {...state.settings.annualBudgets, ...values.annualBudgets};
    }
    if ('autoRefresh' in values) requireValue(typeof values.autoRefresh === 'boolean','Automatic checking must be on or off.');
    if ('refreshHours' in values) requireValue(Number.isFinite(values.refreshHours) &&
      values.refreshHours >= 1 && values.refreshHours <= 720,'Choose a checking interval between 1 and 720 hours.');
    Object.assign(state.settings, values);
  }

  function applyReview(state, payload) {
    const row = ref(state,'reviews',payload.id);
    requireValue(['accept','dismiss'].includes(payload.action),'Choose accept or dismiss.');
    const status = payload.action === 'accept' ? 'accepted' : 'dismissed';
    if (row.status === status) return;
    requireValue(!row.status || row.status === 'pending', 'This change has already been reviewed.');
    if (status === 'accepted' && payload.date) {
      const source = ref(state,'sources',row.sourceId);
      const event = upsert(state,'events',{
        title:payload.title || row.title, artistId:payload.artistId || source.artistId,
        galleryId:payload.galleryId || source.galleryId, date:payload.date, type:payload.type || 'Observation',
        notes:payload.notes || '', detail:payload.notes || '', sourceUrl:row.url, url:row.url,
        source:source.name, reviewId:row.id
      });
      row.eventId = event.id;
    }
    Object.assign(row, {status,reviewedAt:now()});
  }

  function checkSources(state, base, sources) {
    const checked = now();
    for (const source of sources) {
      const sample = base.sources.find(s => s.id === source.id && s.url === source.url);
      source.status = sample ? 'ok' : 'blocked';
      source.message = sample ? 'Reviewed the bundled demo source record. Live monitoring runs in the local app.'
        : 'This URL has no sample record. Open the source directly or use the local app for live monitoring.';
      source.lastChecked = checked;
      source.newArtistCount = 0;
      delete source.artistScanMessage;
    }
  }

  function saveCohort(state, payload) {
    const gallery = ref(state,'galleries',payload.galleryId);
    const {year,cohort} = payload;
    requireValue(Number.isInteger(year) && cohort?.year === year, 'Choose a calendar year that matches the cohort.');
    const others = gallery.tierCohorts || [];
    const previous = others.find(c => c.year === year) || null;
    requireValue(same(previous,payload.expectedCohort),'This cohort changed in another session. Reopen it before saving your edits.');
    gallery.tierCohorts = window.FieldworkDemoProjection.validateCohorts([...others.filter(c => c.year !== year),cohort]);
  }

  function serve(base, route, method, payload) {
    const state = restore(base);
    if (method === 'GET' && route === 'state') {
      if (state.settings.autoRefresh) {
        const cutoff = Date.now() - (state.settings.refreshHours || 24) * 3600000;
        const due = state.sources.filter(s => s.enabled !== false &&
          (!s.lastChecked || Date.parse(s.lastChecked) <= cutoff));
        if (due.length) {
          checkSources(state,base,due);
          // Storage may be disabled. Reading the demo still works in that case.
          try { persist(base,state); } catch { /* No automatic checks can be saved. */ }
        }
      }
      return response(window.FieldworkDemoProjection.attach(state));
    }
    if (method !== 'POST') return response({error:'Unknown API route.'},404);
    if (route === 'discovery-views') {
      requireValue(Array.isArray(payload.ids) && payload.ids.length <= 100 &&
        payload.ids.every(k => typeof k === 'string' && !!k.trim()),'Send a list of up to 100 artist IDs.');
      const known = [...new Set(payload.ids)].filter(k => state.artists.some(a => a.id === k));
      const unseen = state.artists.filter(a => known.includes(a.id) && !a.discoverySeenAt);
      if (unseen.length) {
        const observed = now();
        for (const artist of unseen) artist.discoverySeenAt = observed;
        persist(base,state);
      }
      return response({seenIds:known});
    }
    if (route === 'settings') updateSettings(state,payload);
    else if (route === 'gallery-cohorts') saveCohort(state,payload);
    else if (route === 'reviews') applyReview(state,payload);
    else if (route === 'refresh') {
      const sources = payload.sourceId ? [ref(state,'sources',payload.sourceId)] : state.sources.filter(s => s.enabled !== false);
      checkSources(state,base,sources);
    } else if (collections.includes(route)) upsert(state,route,payload);
    else return response({error:'Unknown API route.'},404);
    persist(base,state);
    return response(window.FieldworkDemoProjection.attach(state));
  }

  window.fetch = async (input, options = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url || input, document.baseURI);
    let path = url.pathname;
    if (path.startsWith(assetBase.pathname)) path = '/' + path.slice(assetBase.pathname.length);
    if (url.origin !== assetBase.origin || !path.startsWith('/api/')) return nativeFetch(input, options);
    try {
      const base = await seed();
      const method = (options.method || request?.method || 'GET').toUpperCase();
      const raw = options.body ?? (request && method === 'POST' ? await request.clone().text() : null);
      const payload = raw ? JSON.parse(raw) : {};
      requireValue(isObject(payload), 'Expected a JSON object.');
      const run = () => serve(base,path.slice(5),method,payload);
      // Serialize read/modify/write across open demo tabs to preserve simultaneous edits.
      return navigator.locks ? await navigator.locks.request(storageKey,run) : run();
    } catch (error) {
      return response({error:error.message || 'The demo change could not be completed.'},400);
    }
  };
})();
