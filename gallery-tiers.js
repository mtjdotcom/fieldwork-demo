(() => {
  'use strict';

  const fw = () => window.FW;
  const state = () => fw().getState();
  const esc = value => fw().esc(String(value ?? ''));
  const levels = ['Proven', 'Promising', 'Measured', 'Unrated'];
  const outcomeLabels = {
    museum_show: 'Museum exhibition',
    museum_acquisition: 'Museum acquisition',
    representation: 'Benchmark representation',
  };
  const auditStatus = {
    success: 'Qualified outcome', reviewed: 'Reviewed · no qualifying outcome in five years',
    unresolved: 'Follow-up incomplete', incomplete: 'Intake audit incomplete',
    outside_window: 'Outside the scoring years',
  };
  const percentage = value => value == null ? '—' :
    value.toLocaleString('en-GB', {style: 'percent', maximumFractionDigits: 1});
  const source = (url, text) => url ? fw().link(url, text) : '';
  const galleryById = id => state().galleries.find(gallery => gallery.id === id);
  const button = (action, label, id = '', year = '', cls = 'btn') =>
    `<button type="button" class="${cls}" data-tier-action="${action}" data-tier-gallery="${esc(id)}" data-tier-year="${esc(year)}">${esc(label)}</button>`;
  let originalAudit = null;

  function pill(tier = 'Unrated') {
    const style = tier === 'Proven' ? ' sage' : tier === 'Promising' ? ' sand' : '';
    return `<span class="pill${style}">${esc(tier)}</span>`;
  }

  function cardSummary(score) {
    if (!score) return '';
    if (score.rate == null) {
      return `<p class="gt-card-stat">${score.completeYears.length} of ${score.years.length} annual entrant counts complete</p>`;
    }
    return `<p class="gt-card-stat">${score.successes} of ${score.entrants} artists advanced within five years · ${percentage(score.coverage)} resolved</p>`;
  }

  function methodology(id) {
    const r = state().galleryTierFramework;
    if (!r) return;
    const p = r.proven, m = r.promising;
    const years = galleryById(id)?.tierAssessment?.years || state().galleries[0]?.tierAssessment?.years;
    const examplePeriod = years?.length ? ` The current intake years are ${years.join(', ')}.` : '';
    fw().openDialog('Gallery tier framework', `<article class="gt-method">
      <p>What share of a gallery’s early-career artists reaches a museum or secures major representation within ${r.followupYears} years of their first show there?</p>
      <h3>Build the denominator</h3>
      <p>Audit the complete programmes for the latest ${r.intakeYears} consecutive calendar years whose artists have all had ${r.followupYears} years of follow-up.${examplePeriod} Include local-language programmes and artists who left the gallery. A documented year with zero eligible entrants counts as an audited year.</p>
      <p>Count each artist once at their first curated solo or named group exhibition at this gallery. Their first professional public show must be within ${r.maxCareerYears} calendar years of entry. Check the artist’s CV for earlier qualifying outcomes. An artist who already had one at entry is ineligible. Record the same artist independently at another gallery only if they meet the same conditions there.</p>
      <h3>Verify outcomes</h3>
      <p>Count an artist once if a qualifying outcome occurred after entry and by their fifth anniversary. An institution anywhere in the world qualifies through a documented solo or curator-selected group exhibition, or a permanent acquisition, at a public-serving nonprofit museum. Museum programmes and collection records provide the evidence.</p>
      <p>Commercial graduation requires a dated announcement of new representation by a different gallery on this list · ${r.benchmark.map(esc).join(', ')}. A resale listing, booth at a fair, prize, private holding or auction result earns no credit. Use programme archives and artist CVs to document five years of follow-up for each artist with no qualifying outcome.</p>
      <h3>Assign the tier</h3>
      <p>Divide artists with a verified outcome by all eligible entrants in completed scoring years. Unresolved cases stay in the denominator. Coverage is the share with a verified outcome or a documented review through the fifth anniversary.</p>
      <table class="gt-rule-table"><caption>Fieldwork tier rules · version ${esc(r.version)}</caption><thead><tr><th>Tier</th><th>Requirements</th></tr></thead><tbody>
        <tr><th>Unrated</th><td>Fewer than ${r.intakeYears} completed audits, fewer than ${r.minEntrants} entrants, or coverage below ${percentage(r.minCoverage)}.</td></tr>
        <tr><th>Measured</th><td>Meets the audit, sample and coverage requirements. The higher thresholds have yet to be reached.</td></tr>
        <tr><th>Promising</th><td>Meets those requirements, with at least ${m.minSuccesses} successful artists and a lower confidence bound of at least ${percentage(m.minLower)}.</td></tr>
        <tr><th>Proven</th><td>At least ${p.minEntrants} entrants, a lower bound of at least ${percentage(p.minLower)}, at least ${p.minInstitutional} artists with museum outcomes, and successes across at least ${p.minSuccessYears} intake years. The audit and coverage requirements apply.</td></tr>
      </tbody></table>
      <p>Tier thresholds use the unrounded lower end of a ${percentage(r.confidence)} Wilson interval. The uncertainty range combines sampling uncertainty with missing outcomes. Its lower end treats every unresolved artist as having no outcome, and its upper end treats each as having one.</p>
      <h3>Comparing galleries across countries</h3>
      <p>Version ${esc(r.version)} uses working thresholds chosen for this workspace. Once regional coverage permits, test them on later intake years held back from calibration and publish any revisions as a new version.</p>
      <p>Local museum access, language, archive coverage and artist networks affect the evidence. The four-gallery benchmark measures one route into international representation. Museums worldwide can supply institutional outcomes. Several galleries can support the same artist, so the tier describes an observed association with later progress.</p>
      <p class="source-foot">${r.methods.map(item => source(item.url,item.title)).join(' · ')}</p>
      ${id ? `<div class="actions">${button('back','Back to gallery',id)}</div>` : ''}
    </article>`);
  }

  function auditEntry(artist, result) {
    const status = auditStatus[result?.status] || 'Recorded';
    return `<li class="gt-entry"><strong>${esc(artist.name)}</strong><span class="small muted">${esc(status)}</span>
      <p class="small">First gallery show ${esc(artist.firstDate)} · First public show ${esc(artist.firstPublicYear)}${result ? ' · Window ends '+esc(result.windowEnd) : ''}</p>
      <div class="gt-links">${source(artist.sourceUrl,'Gallery show')} ${source(artist.artistUrl,'Artist CV or profile')}</div>
      ${artist.outcomes.length ? `<ul class="gt-events">${artist.outcomes.map(event => `<li>${esc(event.date)} · ${esc(outcomeLabels[event.kind])} · ${esc(event.organization)}${result && event.date > result.windowEnd ? ' · After five years' : ''} ${source(event.sourceUrl,'Outcome evidence')}</li>`).join('')}</ul>` : ''}
      ${artist.reviewedThrough ? `<p class="small">Reviewed through ${esc(artist.reviewedThrough)} · ${source(artist.reviewSourceUrl,'Follow-up evidence')}</p>` : ''}
    </li>`;
  }

  function cohortEvidence(gallery, year) {
    const cohort = gallery.tierCohorts?.find(item => item.year === year);
    if (!cohort) return `<div class="gt-missing"><span>${year} · Awaiting programme audit</span>${button('audit','Audit '+year,gallery.id,year,'text-btn')}</div>`;
    const label = cohort.complete ? 'Entrant count complete' : 'Entrant count incomplete';
    const resultByArtist = new Map((gallery.tierAssessment?.rowResults || [])
      .filter(row => row.year === year).map(row => [row.artistUrl,row]));
    return `<details class="gt-year"><summary>${year} · ${esc(label)} · ${cohort.artists.length} recorded</summary>
      <div class="gt-audit-line"><span class="small">Eligible artists in the programme · ${esc(cohort.eligibleCount ?? 'Census pending')}</span>
      ${source(cohort.sourceUrl,'Programme archive')}</div>
      ${gallery.programmeAudit && year >= 2018 && year <= 2020 ? `<p class="small"><a href="./gallery-programmes-2018-2020.html#${encodeURIComponent(gallery.id)}-${year}">Read the ${year} findings and sources</a></p>` : ''}
      ${cohort.artists.length ? `<ul class="gt-entries">${cohort.artists.map(a => auditEntry(a,resultByArtist.get(a.artistUrl))).join('')}</ul>` : ''}
      ${button('audit','Edit '+year+' intake',gallery.id,year,'text-btn')}</details>`;
  }

  function panel(gallery) {
    const s = gallery.tierAssessment;
    if (!s) return '';
    const years = [...new Set([...s.years,...(gallery.tierCohorts || []).map(c=>c.year)])].sort((a,b)=>b-a);
    return `<section class="detail-section gt-panel">
      <div class="section-head wrap"><h3>Five-year outcomes</h3>${button('method','How tiers work',gallery.id,'','text-btn')}</div>
      <p class="small muted">${s.years[0]}–${s.years[s.years.length-1]} intake · Assessed ${esc(s.asOf)}</p>
      <dl class="gt-metrics">
        <div><dt>Documented advancement</dt><dd>${percentage(s.rate)}</dd><small>${s.rate == null ? 'No three-year rate available' : s.successes+' of '+s.entrants+' artists'}</small></div>
        <div><dt>Five-year coverage</dt><dd>${percentage(s.coverage)}</dd><small>${s.resolved} resolved · ${s.unresolved} open</small></div>
        <div><dt>Complete intake years</dt><dd>${s.completeYears.length} / ${s.years.length}</dd><small>${s.completeYears.length ? s.completeYears.join(', ') : 'Programme census needed'}</small></div>
      </dl>
      <p>${esc(s.reason)}</p>
      ${gallery.programmeAudit?.summary ? `<p class="small">${esc(gallery.programmeAudit.summary)}</p><p class="small"><a href="./gallery-programmes-2018-2020.html#${encodeURIComponent(gallery.id)}">2018–2020 findings and sources</a></p>` : ''}
      ${s.lower != null ? `<p class="small">Uncertainty range · ${percentage(s.lower)} to ${percentage(s.upper)}. The tier uses the lower bound.</p>` : ''}
      ${s.entrants ? `<p class="small">Museum outcomes · ${s.institutional} / ${s.entrants} artists. Benchmark representation · ${s.graduations} / ${s.entrants}. Only complete scoring years contribute. An artist can qualify in both categories and counts once overall.</p>` : ''}
      ${s.successYears.length ? `<p class="small">Intake years with a qualifying outcome · ${s.successYears.join(', ')}.</p>` : ''}
      <div class="section-head wrap gt-evidence-heading"><h4>Intake evidence</h4>${button('audit','Add intake year',gallery.id,'','text-btn')}</div>
      ${years.map(year=>cohortEvidence(gallery,year)).join('')}
    </section>`;
  }

  function field(label, name, value = '', type = 'text', extra = '', full = false) {
    return `<label class="field${full ? ' span-full' : ''}"><span>${esc(label)}</span>
      <input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  }

  function organizationField(event) {
    if (event.kind === 'representation') {
      return `<label class="field"><span>Representing gallery</span><select name="organization" required>
        <option value="">Choose the gallery</option>${state().galleryTierFramework.benchmark.map(name =>
          `<option value="${esc(name)}"${name === event.organization ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
    }
    return field('Museum name','organization',event.organization,'text','required maxlength="250"');
  }

  function outcomeEditor(event = {}) {
    return `<fieldset class="gt-outcome" data-gt-outcome><legend>Documented outcome</legend>
      <div class="form-grid">
      <label class="field"><span>Outcome type</span><select name="kind">${Object.entries(outcomeLabels).map(([key,label]) =>
        `<option value="${key}"${key === event.kind ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      ${field('Outcome date','date',event.date,'date','required')}
      <div class="gt-organization span-full">${organizationField(event)}</div>
      ${field('Outcome source URL','sourceUrl',event.sourceUrl,'url','required',true)}</div>
      ${button('remove-outcome','Remove outcome','','','text-btn')}</fieldset>`;
  }

  function artistEditor(artist = {}, open = false) {
    return `<details class="gt-edit-artist" data-gt-artist ${open ? 'open' : ''}><summary>${esc(artist.name || 'New artist')}</summary>
      <div class="form-grid">
        ${field('Artist name','name',artist.name,'text','required maxlength="250"')}
        ${field('Year of first professional public show','firstPublicYear',artist.firstPublicYear,'number','required step="1"')}
        ${field('First show at this gallery','firstDate',artist.firstDate,'date','required')}
        ${field('Artist CV or identity URL','artistUrl',artist.artistUrl,'url','required')}
        ${field('First gallery show evidence URL','sourceUrl',artist.sourceUrl,'url','required',true)}
        <label class="checkline span-full"><input type="checkbox" name="baselineConfirmed" required ${artist.baselineConfirmed ? 'checked' : ''}>I checked the artist’s CV and found no qualifying museum outcome or benchmark representation before the gallery debut.</label>
        ${field('Follow-up reviewed through','reviewedThrough',artist.reviewedThrough,'date')}
        ${field('Follow-up review source URL','reviewSourceUrl',artist.reviewSourceUrl,'url')}
      </div>
      <div data-gt-outcomes>${(artist.outcomes || []).map(outcomeEditor).join('')}</div>
      <div class="gt-edit-actions">${button('add-outcome','Add outcome','','','btn sm')}${button('remove-artist','Remove artist from this intake','','','text-btn')}</div>
    </details>`;
  }

  function editAudit(id, requestedYear) {
    const gallery = galleryById(id);
    if (!gallery) return;
    const s = gallery.tierAssessment;
    const saved = gallery.tierCohorts || [];
    const year = requestedYear || s.years.find(y=>!saved.some(cohort=>cohort.year===y)) || '';
    originalAudit = requestedYear ? saved.find(c=>c.year===requestedYear) || null : null;
    const c = originalAudit || {};
    fw().openDialog((originalAudit ? 'Edit gallery intake' : 'Add gallery intake') + ' · ' + gallery.name,
      `<form data-tier-audit data-tier-gallery="${esc(id)}">
      <p class="small gt-editor-intro">Audit one complete calendar year. Reference the full exhibition programme, count all eligible artists independently, then enter each artist and their sources. Save a draft while the census or follow-up is in progress.</p>
      <div class="form-grid">
        ${field('Intake year','year',year,'number',`required step="1" ${originalAudit ? 'readonly' : ''}`)}
        ${field('Eligible artists in the programme','eligibleCount',c.eligibleCount,'number','min="0" step="1"')}
        ${field('Full programme archive URL','sourceUrl',c.sourceUrl,'url','required',true)}
        <label class="checkline span-full"><input name="complete" type="checkbox" ${c.complete ? 'checked' : ''}>I verified the full year’s programme and recorded every eligible artist.</label>
      </div>
      <h3 class="gt-evidence-heading">Artist evidence</h3>
      <div data-gt-artists>${(c.artists || []).map(a => artistEditor(a)).join('')}</div>
      ${button('add-artist','Add artist','','','btn')}
      <p class="error small" role="alert" data-tier-error hidden></p>
      <div class="actions">${button('back','Cancel',id)}<button class="btn primary" type="submit">Save intake</button></div></form>`);
  }

  function readArtist(row) {
    const value = name => row.querySelector(`[name="${name}"]`).value.trim();
    return {
      name:value('name'), firstPublicYear:Number(value('firstPublicYear')), firstDate:value('firstDate'),
      artistUrl:value('artistUrl'), sourceUrl:value('sourceUrl'), reviewedThrough:value('reviewedThrough'),
      reviewSourceUrl:value('reviewSourceUrl'), baselineConfirmed:row.querySelector('[name="baselineConfirmed"]').checked,
      outcomes:[...row.querySelectorAll('[data-gt-outcome]')].map(outcome => {
        const fields = [...outcome.querySelectorAll('input,select')];
        return Object.fromEntries(fields.map(input => [input.name,input.value.trim()]));
      }),
    };
  }

  document.addEventListener('click',event => {
    const target = event.target.closest('[data-tier-action]');
    if (!target) return;
    const id = target.dataset.tierGallery;
    switch (target.dataset.tierAction) {
      case 'method': methodology(id); break;
      case 'back': fw().showGallery(id); break;
      case 'audit': editAudit(id,Number(target.dataset.tierYear) || null); break;
      case 'add-artist': {
        const list = target.closest('form').querySelector('[data-gt-artists]');
        list.insertAdjacentHTML('beforeend',artistEditor({},true));
        list.lastElementChild.querySelector('[name="name"]').focus();
        break;
      }
      case 'remove-artist': target.closest('[data-gt-artist]').remove(); break;
      case 'add-outcome': {
        const list = target.closest('[data-gt-artist]').querySelector('[data-gt-outcomes]');
        list.insertAdjacentHTML('beforeend',outcomeEditor());
        list.lastElementChild.querySelector('[name="kind"]').focus();
        break;
      }
      case 'remove-outcome': target.closest('[data-gt-outcome]').remove(); break;
    }
  });

  document.addEventListener('change',event => {
    if (event.target.matches('[data-gt-outcome] [name="kind"]')) {
      event.target.closest('[data-gt-outcome]').querySelector('.gt-organization').innerHTML =
        organizationField({kind:event.target.value});
    }
    if (event.target.matches('[data-gt-artist] [name="name"]')) {
      event.target.closest('details').querySelector('summary').textContent = event.target.value.trim() || 'New artist';
    }
  });
  document.addEventListener('invalid',event => {
    const row = event.target.closest('[data-gt-artist]');
    if (row) row.open = true;
  },true);

  document.addEventListener('submit',async event => {
    const form = event.target.closest('[data-tier-audit]');
    if (!form) return;
    event.preventDefault();
    const galleryId = form.dataset.tierGallery;
    const year = Number(form.elements.year.value);
    const header = form.querySelector('.form-grid');
    const census = header.querySelector('[name="eligibleCount"]').value;
    const cohort = {
      year, eligibleCount:census === '' ? null : Number(census), complete:form.elements.complete.checked,
      sourceUrl:header.querySelector('[name="sourceUrl"]').value.trim(),
      artists:[...form.querySelectorAll('[data-gt-artist]')].map(readArtist),
    };
    const error = form.querySelector('[data-tier-error]');
    const submit = form.querySelector('[type="submit"]');
    error.hidden = true;
    submit.disabled = true;
    try {
      await fw().post('gallery-cohorts',{galleryId,year,cohort,expectedCohort:originalAudit});
      fw().refresh();
      fw().showGallery(galleryId);
      fw().toast('Gallery intake saved.');
    } catch (err) {
      error.textContent = err.message || 'Unable to save this intake.';
      error.hidden = false;
      if (err.message?.includes('another session')) {
        // Refresh the backing record while preserving the unsaved form for comparison.
        await fw().reload().catch(() => {});
      }
    } finally {
      submit.disabled = false;
    }
  });
  window.GalleryTiers = {levels,pill,cardSummary,panel};
})();
