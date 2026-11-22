(() => {
  'use strict';

  const fw = () => window.FW;
  const state = () => fw().getState();
  const esc = value => fw().esc(String(value ?? ''));
  const icon = (key, size = 16) => fw().icon(key, size);
  const action = (code, label, id = '', cls = 'btn', attrs = '') =>
    `<button type="button" class="${cls}" data-network-action="${code}" data-id="${esc(id)}" ${attrs}>${label}</button>`;
  const choices = (rows, active) => rows.map(([value, name]) =>
    `<option value="${esc(value)}"${value === active ? ' selected' : ''}>${esc(name)}</option>`).join('');
  const empty = message => `<div class="empty">${esc(message)}</div>`;
  const sum = (n, singular, plural = singular + 's') => `${n} ${n === 1 ? singular : plural}`;
  const filters = {city: '', tier: '', visit: false, gallerySearch: '', sourceKind: '', sourceStatus: '', sourceSearch: ''};
  const statusNames = {unchecked: 'Unchecked', checking: 'Checking', ok: 'Checked', changed: 'Changed', blocked: 'Restricted', error: 'Error'};
  let timer;
  let polling = false;

  function timeLabel(raw) {
    if (!raw) return 'Never checked';
    const date = new Date(raw);
    return Number.isNaN(+date) ? String(raw) : date.toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
  }

  function sourceLink(url, text) {
    try {
      if (['http:', 'https:'].includes(new URL(url).protocol)) return fw().link(url, text);
    } catch {}
    return '';
  }

  function galleryArtists(id) {
    const artistIds = new Set(state().events.filter(e => e.galleryId === id || e.originGalleryId === id).map(e => e.artistId));
    return state().artists.filter(a => artistIds.has(a.id) || a.galleryId === id || a.discoveries?.some(d => d.galleryId === id));
  }

  function selectFilter(key, label, values) {
    return `<select data-network-filter="${key}" aria-label="${label}">${choices([['', label], ...values.map(s => [s,s])],filters[key])}</select>`;
  }

  function searchFilter(key, placeholder) {
    return `<label class="searchbox">${icon('search',16)}<input aria-label="${placeholder}" placeholder="${placeholder}" type="search" data-network-filter="${key}" value="${esc(filters[key])}"></label>`;
  }

  function graduationEvents(id) {
    return state().events.filter(e => e.originGalleryId === id && e.megaGallery && e.type === 'Representation');
  }

  function galleryResults() {
    const rows = state().galleries.filter(g =>
      (!filters.visit || (g.visitable && g.city === 'London')) &&
      (!filters.city || g.city === filters.city) && (!filters.tier || (g.tierAssessment?.tier || 'Unrated') === filters.tier) &&
      [g.name,g.city,g.area,g.country].join(' ').toLowerCase().includes(filters.gallerySearch.toLowerCase()));
    return `<p class="result-count">${sum(rows.length,'gallery','galleries')}</p>
      <div class="grid-cards">${rows.map(g => {
        const tracked = galleryArtists(g.id).filter(a => a.status === 'watching');
        const transitions = graduationEvents(g.id).length;
        return `<article class="panel gallery-card"><div class="spread wrap"><span class="loc">${icon('pin',14)}${esc([g.area,g.city].filter(Boolean).join(' · ') || g.country || 'Location unrecorded')}</span>
          ${GalleryTiers.pill(g.tierAssessment?.tier)}</div>
          <h3>${action('gallery',esc(g.name),g.id,'name-btn')}</h3>
          ${GalleryTiers.cardSummary(g.tierAssessment)}
          ${g.note ? `<p class="muted">${esc(g.note)}</p>` : ''}
          <footer><span>${sum(tracked.length,'watched artist')}${transitions ? ' · '+sum(transitions,'transition') : ''}</span>
            ${action('gallery','View gallery',g.id,'text-btn')}</footer></article>`;
      }).join('')}</div>${rows.length ? '' : empty('No galleries match these filters.')}`;
  }

  function galleries() {
    const unique = key => [...new Set(state().galleries.map(g => g[key]).filter(Boolean))].sort();
    return `<div class="toolbar">${searchFilter('gallerySearch','Search galleries')}${selectFilter('city','All cities',unique('city'))}
      ${selectFilter('tier','All tiers',GalleryTiers.levels)}<label class="checkline"><input data-network-filter="visit" type="checkbox" ${filters.visit ? 'checked' : ''}> London visits</label>
      <button type="button" class="text-btn" data-tier-action="method">How tiers work</button>
      <a class="text-btn" href="./gallery-programmes-2018-2020.html">2018–2020 programme audit</a></div>
      <div id="network-gallery-results">${galleryResults()}</div>`;
  }

  function showGallery(id) {
    const gallery = state().galleries.find(g => g.id === id);
    if (!gallery) return;
    const artists = galleryArtists(id);
    const transitions = graduationEvents(id);
    const sources = state().sources.filter(s => s.galleryId === id);
    fw().openDialog(gallery.name, `<div class="row wrap"><span class="loc">${icon('pin',15)} ${esc([gallery.area,gallery.city,gallery.country].filter(Boolean).join(' · '))}</span>
      ${GalleryTiers.pill(gallery.tierAssessment?.tier)}</div>
      ${gallery.tier ? `<p class="small muted">Original shortlist label · ${esc(gallery.tier)}${gallery.tier === 'Niche' ? ' (programme focus)' : ''}${gallery.tierSource ? ' · '+esc(gallery.tierSource) : ''}</p>` : ''}
      ${gallery.note ? `<p class="section-space">${esc(gallery.note)}</p>` : ''}<p class="source-foot">${sourceLink(gallery.url,'Gallery website')}</p>
      ${GalleryTiers.panel(gallery)}
      <section class="detail-section"><h3>Linked artists</h3>${artists.length ? artists.map(a =>
        `<div class="source-row"><div class="source-copy">${action('artist',esc(a.name),a.id,'name-btn')}<span class="small">${esc(a.status === 'discovered' ? 'Discovered' : a.status === 'archived' ? 'Archived' : 'Watchlist')}</span></div>
          ${sourceLink(a.discoveries?.find(d => d.galleryId === id)?.url,'Profile evidence')}</div>`).join('') : empty('Artist links appear when you add a milestone or check a roster.')}</section>
      <section class="detail-section"><h3>Documented gallery transitions</h3>
        ${transitions.length ? transitions.map(e => `<div class="source-row"><div class="source-copy"><strong>${esc(fw().artistName(e.artistId))} · ${esc(e.destinationGallery || e.title)}</strong>
          <span class="small">${esc(e.date)} · Representation</span></div>${sourceLink(e.url || e.sourceUrl,'Evidence')}</div>`).join('') : '<p class="small muted">No documented transition to a major gallery in this record.</p>'}
      </section>
      <section class="detail-section"><div class="section-head"><h3>Monitored sources</h3>${action('add-source','Add source',id,'text-btn')}</div>
        ${sources.length ? sources.map(s => sourceRow(s,true)).join('') : empty('Add a gallery roster or exhibition programme to monitor.')}</section>`);
  }

  function field(label, control, full = false) {
    return `<label class="field${full ? ' span-full' : ''}"><span>${label}</span>${control}</label>`;
  }
  function input(name, type = 'text', extra = '') {
    return `<input name="${name}" type="${type}" ${extra}>`;
  }
  function form(kind, fields, button, id = '') {
    return `<form data-network-form="${kind}" data-id="${esc(id)}"><div class="form-grid">${fields}</div>
      <p class="error small" role="alert" data-network-error hidden></p><div class="actions">
      ${action('cancel','Cancel')}<button class="btn primary" type="submit">${button}</button></div></form>`;
  }
  function optionRows(rows, prop = 'name') {
    return rows.map(r => [r.id,r[prop]]).sort((a,b) => a[1].localeCompare(b[1]));
  }
  function picker(label, name, opts, current = '', required = false) {
    return field(label,`<select name="${name}" aria-label="${esc(label)}" ${required ? 'required' : ''}>${choices(opts,current)}</select>`);
  }

  function addGallery() {
    const fields = field('Gallery name',input('name','text','required maxlength="160"'),true)
      + field('City',input('city','text','required')) + field('Country',input('country'))
      + field('Neighbourhood',input('area'))
      + field('Gallery website',input('url','url','placeholder="https://…"'),true)
      + field('Artist roster URL to monitor',input('rosterUrl','url','placeholder="Optional · https://…"'),true)
      + field('Why follow this gallery?','<textarea name="note" rows="3"></textarea>',true)
      + '<label class="checkline span-full"><input type="checkbox" name="visitable"> Include in London visits</label>';
    fw().openDialog('Add gallery',form('gallery',fields,'Save gallery'));
  }

  function addSource(galleryId = '') {
    const fields = field('Source name',input('name','text','required maxlength="180" placeholder="e.g. Gallery artist roster"'),true)
      + field('Public page URL',input('url','url','required placeholder="https://…"'),true)
      + picker('Source type','kind',['Gallery','Institution','Artsy','Heritage','Other'].map(v => [v,v]),'Gallery')
      + picker('Linked gallery','galleryId',[['','Choose a gallery'],...optionRows(state().galleries)],galleryId)
      + picker('Linked artist','artistId',[['','Choose an artist'],...optionRows(state().artists)]);
    fw().openDialog('Add source',form('source',fields + '<p class="small muted span-full">Link a gallery roster to discover artists. Listing and auction pages are monitored for changes to their visible text.</p>','Save source'));
  }

  function sourceRow(s, compact = false) {
    const status = s.status || 'unchecked';
    const pending = state().reviews.filter(r => r.sourceId === s.id && r.status === 'pending').length;
    const info = [s.kind, s.lastChecked ? 'Checked '+timeLabel(s.lastChecked) : 'Never checked', pending ? sum(pending,'change')+' to review' : ''].filter(Boolean).join(' · ');
    return `<div class="source-row"><div class="source-copy"><strong>${esc(s.name)}</strong><span class="small">${esc(info)}</span>
      ${!compact && (s.message || s.artistScanMessage) ? `<span class="small">${esc([s.message,s.artistScanMessage].filter(Boolean).join(' '))}</span>` : ''}
      ${sourceLink(s.url,'Open source')}</div><div class="row wrap"><span class="pill ${esc(status)}">${esc(statusNames[status] || status)}</span>
        ${action('check','Check',s.id,'btn',state().settings.refreshing ? 'disabled' : '')}</div></div>`;
  }

  function sourceResults() {
    const rows = state().sources.filter(s => (!filters.sourceKind || s.kind === filters.sourceKind)
      && (!filters.sourceStatus || (s.status || 'unchecked') === filters.sourceStatus)
      && [s.name,s.url].join(' ').toLowerCase().includes(filters.sourceSearch.toLowerCase()));
    return `<p class="result-count">${sum(rows.length,'source')}</p><div class="panel source-list">${rows.map(s => sourceRow(s)).join('') || empty('No sources match these filters.')}</div>`;
  }

  function mentions(review) {
    const ids = review.artistIds || [];
    if (!ids.length) return '';
    const links = ids.map(id => action('artist',esc(fw().artistName(id)),id,'text-btn')).join('');
    return ids.length > 4
      ? `<details><summary class="small">${sum(ids.length,'artist')} mentioned in changed text</summary><div class="row wrap">${links}</div></details>`
      : `<div class="row wrap"><span class="small muted">Mentioned in changed text</span>${links}</div>`;
  }

  function reviewItem(review) {
    const source = state().sources.find(s => s.id === review.sourceId);
    return `<article class="review-item"><div class="spread wrap"><strong>${esc(source?.name || review.title)}</strong><span class="small muted">${esc(timeLabel(review.detectedAt))}</span></div>
      <p>${esc(review.excerpt)}</p>${mentions(review)}<div class="row wrap">${sourceLink(review.url,'Inspect source')}
        ${action('confirm','Record milestone',review.id,'btn')}${action('acknowledge','Mark reviewed',review.id,'text-btn')}
        ${action('dismiss','Dismiss',review.id,'text-btn')}</div></article>`;
  }

  function sources() {
    const reviews = state().reviews.filter(r => r.status === 'pending').slice().reverse();
    const kinds = [...new Set(state().sources.map(s => s.kind).filter(Boolean))].sort();
    if (state().settings.refreshing) startPolling();
    return `<div class="section-head wrap"><div class="row wrap"><span class="pill ${state().settings.autoRefresh ? 'sage' : ''}">${state().settings.autoRefresh ? 'Automatic checks on' : 'Manual checks'}</span>
      ${state().settings.autoRefresh ? `<span class="small muted">Every ${esc(state().settings.refreshHours)} hours while running</span>` : ''}</div>
      <div class="row wrap">${action('settings','Check settings','','btn')}${action('check',state().settings.refreshing ? 'Checking sources…' : 'Check all sources','','btn',state().settings.refreshing ? 'disabled' : '')}</div></div>
      ${reviews.length ? `<section class="panel section-space"><div class="panel-heading"><h2>Changes to review</h2><p>${sum(reviews.length,'source change')}</p></div>${reviews.map(reviewItem).join('')}</section>` : ''}
      <div class="toolbar section-space">${searchFilter('sourceSearch','Search sources')}${selectFilter('sourceKind','All types',kinds)}
        <select data-network-filter="sourceStatus" aria-label="Source status">${choices([['','All statuses'],...Object.entries(statusNames)],filters.sourceStatus)}</select></div>
      <div id="network-source-results">${sourceResults()}</div>`;
  }

  function settings() {
    const s = state().settings;
    const fields = `<label class="checkline span-full"><input name="autoRefresh" type="checkbox" ${s.autoRefresh ? 'checked' : ''}> Check sources automatically</label>`
      + field('Hours between checks',input('refreshHours','number',`min="1" max="720" step="1" value="${esc(s.refreshHours || 24)}" required`))
      + '<p class="small muted span-full">This demo replays sample source records. Your settings and reviewed changes stay in this browser.</p>';
    fw().openDialog('Source check settings',form('settings',fields,'Save settings'));
  }

  function confirmReview(id) {
    const r = state().reviews.find(item => item.id === id);
    if (!r) return;
    const s = state().sources.find(item => item.id === r.sourceId);
    const types = ['Exhibition','Representation','Institution','Award','Market','Other'];
    const matched = r.artistIds || [];
    const artists = optionRows(state().artists);
    const suggestions = artists.filter(([id]) => matched.includes(id)).map(([id,name]) => [id,name+' · Detected in change']);
    const selected = matched.length === 1 ? matched[0] : r.artistId || s?.artistId || '';
    const fields = `<div class="hintbox span-full"><p>${esc(r.excerpt)}</p>${sourceLink(r.url,'Inspect source')}</div>`
      + picker('Artist','artistId',[['','Choose an artist'],...suggestions,...artists.filter(([id]) => !matched.includes(id))],selected,true)
      + picker('Milestone type','type',types.map(t => [t,t]),'Exhibition')
      + field('Milestone title',input('title','text','required maxlength="300"'),true)
      + field('Date the event occurred',input('date','text','required placeholder="YYYY, YYYY-MM or YYYY-MM-DD"'))
      + field('Evidence notes','<textarea name="notes" rows="3"></textarea>',true);
    fw().openDialog('Record a verified milestone',form('review',fields,'Record milestone',id));
  }

  function startPolling() {
    if (timer || polling) return;
    timer = setTimeout(async () => {
      timer = undefined; polling = true;
      try { await fw().reload(); }
      catch (e) { fw().toast(e.message || 'Source check status unavailable.'); return; }
      finally { polling = false; }
      if (state().settings.refreshing) startPolling();
    }, 1350);
  }



  async function check(id = '') {
    await fw().post('/api/refresh',id ? {sourceId:id} : {});
    if (document.getElementById('dialog')?.open) fw().closeDialog();
    fw().refresh();
    if (state().settings.refreshing) startPolling();
    fw().toast('Source check requested.');
  }

  document.addEventListener('click',async event => {
    const target = event.target.closest('[data-network-action]');
    if (!target) return;
    const id = target.dataset.id || '';
    try {
      switch (target.dataset.networkAction) {
        case 'gallery': showGallery(id); break;
        case 'artist': fw().showArtist(id); break;
        case 'add-source': addSource(id); break;
        case 'settings': settings(); break;
        case 'cancel': fw().closeDialog(); break;
        case 'check': await check(id); break;
        case 'confirm': confirmReview(id); break;
        case 'acknowledge': case 'dismiss':
          await fw().post('/api/reviews',{id,action:target.dataset.networkAction === 'dismiss' ? 'dismiss' : 'accept'});
          fw().refresh(); fw().toast('Source change reviewed.'); break;
      }
    } catch (e) { fw().toast(e.message || 'The action could not be completed.'); }
  });

  function filterChange(target) {
    const key = target.dataset.networkFilter;
    if (!(key in filters)) return;
    filters[key] = target.type === 'checkbox' ? target.checked : target.value;
    if (key === 'visit' && filters.visit && filters.city && filters.city !== 'London') {
      filters.city = ''; document.querySelector('[data-network-filter="city"]').value = '';
    }
    if (key === 'city' && filters.city && filters.city !== 'London' && filters.visit) {
      filters.visit = false; document.querySelector('[data-network-filter="visit"]').checked = false;
    }
    const root = document.querySelector(key.startsWith('source') ? '#network-source-results' : '#network-gallery-results');
    if (root) root.innerHTML = key.startsWith('source') ? sourceResults() : galleryResults();
  }

  document.addEventListener('input',event => { if (event.target.matches('input[type="search"][data-network-filter]')) filterChange(event.target); });
  document.addEventListener('change',event => {
    if (event.target.matches('select[data-network-filter],input[type="checkbox"][data-network-filter]')) {
      filterChange(event.target);
    }
  });
  document.addEventListener('submit',async event => {
    const formEl = event.target.closest('[data-network-form]');
    if (!formEl) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(formEl));
    const kind = formEl.dataset.networkForm;
    const submit = formEl.querySelector('button[type="submit"]');
    const errorBox = formEl.querySelector('[data-network-error]');
    submit.disabled = true;
    errorBox.hidden = true;
    try {
      let path;
      if (kind === 'gallery') {
        path = '/api/galleries'; data.visitable = Boolean(data.visitable);
      } else if (kind === 'source') {
        path = '/api/sources';
      } else if (kind === 'settings') {
        path = '/api/settings'; data.autoRefresh = Boolean(data.autoRefresh); data.refreshHours = Number(data.refreshHours);
      } else if (kind === 'review') {
        path = '/api/reviews'; data.action = 'accept'; data.id = formEl.dataset.id;
      } else { return; }
      await fw().post(path,data);
      fw().closeDialog(); fw().refresh();
      fw().toast(({gallery:'Gallery saved.',source:'Source saved.',review:'Milestone recorded.',settings:'Check settings saved.'})[kind]);
    } catch (e) { errorBox.textContent = e.message || 'Unable to save.'; errorBox.hidden = false; }
    finally { submit.disabled = false; }
  });

  window.Network = {galleries,sources,showGallery,addGallery,addSource,settings,check};
})();
