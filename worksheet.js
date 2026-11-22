(() => {
  'use strict';

  const fw = () => window.FW;
  const state = () => fw().getState();
  const escape = value => fw().esc(String(value ?? ''));
  const nowYear = new Date().getFullYear();
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2, trailingZeroDisplay: 'stripIfInteger'
  });
  const usd = amount => amount == null ? '—' : money.format(amount);
  const number = value => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const evidence = value => value ? escape(value) : '<span class="ws-unknown">Unrecorded</span>';
  const action = (key, label, id = '', extra = '') =>
    `<button type="button" class="btn ${extra}" data-ws="${key}" data-id="${escape(id)}">${label}</button>`;
  const options = (values, selected) => values.map(value => {
    const [id, label] = Array.isArray(value) ? value : [value, value];
    return `<option value="${escape(id)}"${String(id) === String(selected) ? ' selected' : ''}>${escape(label)}</option>`;
  }).join('');
  let planYear = nowYear;
  let selectedLeft = '';
  let selectedRight = '';

  function planAmount(year) {
    const plans = state().settings?.annualBudgets || {};
    if (Object.hasOwn(plans, year)) return number(plans[year]);
    return Number(year) === nowYear && !Object.keys(plans).length ? (state().settings?.annualBudget ?? null) : null;
  }

  function yearOptions() {
    return [...new Set([nowYear, nowYear + 1, planYear, ...Object.keys(state().settings?.annualBudgets || {}).map(Number),
      ...state().assessments.map(row => Number(row.planYear)).filter(Boolean)])].sort((a,b) => a-b);
  }

  function economics(row) {
    const paid = row.decision === 'Bought';
    const price = paid ? number(row.purchasePrice) : (number(row.offerPrice) ?? number(row.ask));
    const fees = number(row.buyCosts);
    const netCost = price != null && fees != null ? price + fees : null;
    const holding = number(row.annualHolding);
    const sellFee = number(row.sellFee);
    const sellCosts = number(row.sellCosts);
    const breakEven = netCost != null && holding != null && sellCosts != null && sellFee != null && sellFee < 100
      ? (netCost + 5 * holding + sellCosts) / (1 - sellFee / 100) : null;
    return {price, netCost, holding, sellFee, sellCosts, breakEven};
  }

  function plans() {
    const rows = state().assessments.filter(row => Number(row.planYear || nowYear) === planYear);
    const purchases = rows.filter(row => row.decision === 'Bought');
    const candidates = rows.filter(row => (row.decision || 'Considering') === 'Considering');
    const knownSpend = purchases.reduce((sum,row) => sum + (number(row.purchasePrice) || 0) + (number(row.buyCosts) || 0),0);
    const incomplete = purchases.some(row => economics(row).netCost == null);
    const limit = planAmount(planYear);
    const left = limit == null ? null : limit-knownSpend;
    return `<section class="panel ws-budget" aria-label="Annual buying plan">
      <div class="ws-heading"><div><div class="eyebrow">Acquisition budget · USD</div><h2>Annual plan</h2></div>
        <div class="ws-tools"><select id="ws-plan-year" aria-label="Budget year">${options(yearOptions(),planYear)}</select>
        ${action('budget','Edit plan')}</div></div>
      <div class="ws-stats">
        <div><span>Annual budget</span><strong>${usd(limit)}</strong></div>
        <div><span>Recorded spend</span><strong>${usd(knownSpend)}</strong></div>
        <div><span>${left != null && left < 0 ? 'Over budget' : 'Remaining'}</span><strong>${usd(left == null ? null : Math.abs(left))}</strong></div>
      </div>
      <div class="ws-meter" aria-hidden="true"><i style="width:${limit > 0 ? Math.min(100,100*knownSpend/limit) : knownSpend ? 100 : 0}%"></i></div>
      <div class="ws-caption">${purchases.length} bought · ${candidates.length} considering${incomplete ? ' · Some purchase costs are missing. Remaining budget is provisional.' : ''}</div>
    </section>`;
  }

  function artwork(row) {
    if (!/^images\/[a-z0-9][a-z0-9-]+\.jpg$/.test(row.image || '')) return '';
    return `<figure class="ws-art"><img src="${escape(row.image)}" alt="${escape(row.title)} by ${escape(fw().artistName(row.artistId))}" loading="lazy">
      <figcaption>${sourceLink(row.imageSource,row.imageCredit || 'Image source')}</figcaption></figure>`;
  }

  function workCard(row) {
    const e = economics(row);
    const artist = fw().artistName(row.artistId);
    return `<article class="ws-work">
      ${artwork(row)}<div class="ws-work-head"><span class="eyebrow">${escape(artist)}</span><span class="pill">${escape(row.decision || 'Considering')}</span></div>
      <h3>${escape(row.title)}</h3><p class="ws-edition">${evidence(row.edition)}</p>
      <dl class="ws-row"><div><dt>${row.decision === 'Bought' ? 'Paid price' : 'Listing ask'}</dt><dd>${usd(number(row.decision === 'Bought' ? row.purchasePrice : row.ask))}</dd></div>
      <div><dt>Personal ceiling</dt><dd>${usd(number(row.ceiling))}</dd></div>
      <div><dt>Yr 5 break-even</dt><dd>${usd(e.breakEven)}</dd></div></dl>
      <div class="ws-card-footer">${sourceLink(row.sourceUrl,'Listing source') || '<span class="ws-unknown">No listing source</span>'}${action('edit','Open worksheet',row.id)}</div>
    </article>`;
  }

  function page() {
    const rows = state().assessments;
    return `<div class="ws-page">${plans()}
      <section class="panel ws-records"><div class="ws-heading"><div><div class="eyebrow">Work-level research</div><h2>Acquisition shortlist</h2></div>
        <div class="ws-tools">${rows.length >= 2 ? action('compare','Compare works') : ''}${action('add','Add work')}</div></div>
        ${rows.length ? `<div class="ws-card-grid">${rows.map(workCard).join('')}</div>` : '<p class="empty">Add a work to record its edition, comparable sales and collecting criteria.</p>'}
      </section></div>`;
  }

  function field(name, label, value, type='text', attrs='') {
    return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${escape(value)}" ${attrs}></label>`;
  }
  function dollars(name,label,value) { return field(name,label,value,'number','min="0" step="0.01"'); }
  function select(name,label,values,current) {
    return `<label class="field"><span>${label}</span><select name="${name}">${options(values,current)}</select></label>`;
  }
  function area(name,label,value) {
    return `<label class="field"><span>${label}</span><textarea name="${name}" rows="2">${escape(value)}</textarea></label>`;
  }
  function group(summary,body,open=false) {
    return `<details class="ws-group" ${open ? 'open' : ''}><summary>${summary}</summary><div class="ws-fields">${body}</div></details>`;
  }
  function errorEl() { return '<p class="ws-error" role="alert" hidden></p>'; }
  function formButtons(label) {
    return `<div class="ws-form-footer">${action('close','Cancel')}<button type="submit" class="btn primary">${label}</button></div>`;
  }
  function budget() {
    const limit = planAmount(planYear);
    fw().openDialog('Edit annual plan', `<form id="ws-budget-form" class="ws-form">
      <div class="ws-fields">${field('year','Calendar year',planYear,'number','min="1900" max="2200" required')}
      ${field('amount','Annual budget (USD)',limit,'number','min="0" step="0.01" required placeholder="e.g. 3000"')}</div>
      <p class="ws-caption">Set a budget for each year. Only recorded purchases count towards spend.</p>
      ${errorEl()}${formButtons('Save plan')}</form>`);
  }

  function sourceLink(url,label) {
    try {
      if (['http:','https:'].includes(new URL(url).protocol)) return fw().link(url,label);
    } catch {}
    return '';
  }

  function compFields(comp = {}) {
    return `<div class="ws-comp">
      <div class="ws-comp-top"><strong>Comparable sale</strong>${action('remove-comp','Remove')}</div>
      <div class="ws-fields">${field('comparableDate','Sale date or year',comp.date,'text','placeholder="YYYY-MM-DD or YYYY" required')}
        ${field('comparablePrice','Sale price (USD)', comp.price,'number','min="0" step="0.01" required')}
        ${select('comparableBasis','Price basis',['Reported sold price','Hammer price','Price including buyer’s premium','Seller proceeds'],comp.basis)}
        ${field('comparableEdition','Edition / variant match',comp.edition,'text','required')}
        ${field('comparableCondition','Condition',comp.condition)}${field('comparableSource','Sale record URL',comp.sourceUrl,'url','placeholder="https://…"')}
      </div></div>`;
  }

  function comparisonSales(row) {
    const comps = Array.isArray(row.comparables) ? row.comparables : [];
    if (!comps.length) return '<span class="ws-unknown">No sales recorded</span>';
    return comps.map(comp => `<div class="ws-cmp-sale"><b>${usd(number(comp.price))}</b> · ${escape(comp.date)}
      <small>${escape(comp.basis)} · ${escape(comp.edition)}${comp.condition ? ' · ' + escape(comp.condition) : ''}</small>
      ${sourceLink(comp.sourceUrl,'Sale record')}</div>`).join('');
  }

  function comparisonTable(left,right) {
    const artist = row => state().artists.find(artist => artist.id === row.artistId) || {};
    const artistMilestones = (row,cat) => {
      const matches = state().events.filter(e => e.artistId === row.artistId && cat.test(e.type || ''));
      return matches.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,3).map(e=>
        `<div>${escape(e.date)} · ${escape(e.title)} ${sourceLink(e.url || e.sourceUrl,'Source')}</div>`).join('');
    };
    const entries = [
      ['Artwork',artwork],
      ['Edition',r=>evidence(r.edition)],
      ['Generation',r=>{const a=artist(r); if (!a.birthYear) return evidence(a.generation);
        const age=2025-Number(a.birthYear);
        const cohort=age>=28 && age<=38 ? ' · within Naimi’s 28–38 cohort' : '';
        return `Born ${escape(a.birthYear)}<small>Turned ${age} in the interview year (2025)${cohort}.</small>`;
      }],
      ['Institutional interest',r=>r.institutionEvidence ? evidence(r.institutionEvidence) + ' ' + sourceLink(r.careerSource,'Source') : artistMilestones(r,/institut|museum|collection|award|prize/i)||evidence('')],
      ['Gallery programme',r=>r.galleryEvidence ? evidence(r.galleryEvidence) + ' ' + sourceLink(r.careerSource,'Source') : artistMilestones(r,/gallery|exhibition|representation/i) || evidence('')],
      ['Definitive image · your view',r=>evidence(r.definitive) + ' ' + sourceLink(r.definitiveSource,'Work reference')],
      ['Market depth',r=>evidence(r.marketDepth)],
      ['Comparable sales',comparisonSales],
      ['Ask and condition',r=>`${usd(number(r.ask))} · ${evidence(r.marketType)} ${r.askDate ? '· '+escape(r.askDate) : ''}<small>${evidence(r.condition)}</small>${sourceLink(r.sourceUrl,'Listing source')}`],
      ['Personal ceiling',r=>usd(number(r.ceiling))],
      ['Would I hang it?',r=>evidence(r.hang)],
      ['Collector verdict',r=>evidence(r.verdict)],
      ['Year 5 break-even',r=>economics(r).breakEven != null ? usd(economics(r).breakEven) : '<span class="ws-unknown">Enter cost assumptions</span>']
    ];
    return `<div class="table-wrap ws-compare-wrap"><table class="ws-compare-table"><thead><tr><th>Research criterion</th>
      ${[left,right].map(r=>`<th>${escape(r.title)}<small>${escape(fw().artistName(r.artistId))}</small></th>`).join('')}
      </tr></thead><tbody>${entries.map(([label,render])=>`<tr><th scope="row">${label}</th><td>${render(left)}</td><td>${render(right)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function compare() {
    const rows = state().assessments;
    if (rows.length < 2) return;
    let left = rows.find(r=>r.id === selectedLeft) || rows[0];
    let right = rows.find(r=>r.id === selectedRight && r.id !== left.id) || rows.find(r=>r.id !== left.id);
    selectedLeft = left.id;
    selectedRight = right.id;
    fw().openDialog('Compare works', `<div class="ws-comparison"><div class="ws-fields">
      ${select('wsLeft','First work',rows.map(r=>[r.id,r.title]),left.id)}
      ${select('wsRight','Second work',rows.map(r=>[r.id,r.title]),right.id)}</div>
      ${comparisonTable(left,right)}</div>`);
  }

  function model(row) {
    const e = economics(row);
    const complete = e.breakEven != null;
    const scenarios = [0.75, 1, 1.25];
    const delta = gross => gross * (1 - e.sellFee/100) - e.sellCosts - e.netCost - 5*e.holding;
    return `<div class="ws-model"><div class="ws-model-header"><div class="eyebrow">Five-year exit · nominal USD</div>
      <strong>${complete ? usd(e.breakEven) : 'Costs needed'}</strong><span>Gross resale price to break even</span></div>
      <p>${complete ? 'Gross resale less selling fees and costs must cover your acquisition and five years of holding costs.' :
        'Enter an acquisition price and each cost assumption. Enter 0 for a cost you expect to be zero.'}</p>
      ${complete ? `<div class="ws-scenarios">${scenarios.map(factor=>{
        const gross = e.price * factor;
        const diff = delta(gross);
        return `<div><span>${factor===1 ? 'Flat resale' : factor<1 ? 'Resale −25%' : 'Resale +25%'}</span><b>${usd(gross)}</b>
          <small>${usd(Math.abs(diff))} ${Math.abs(diff) < 0.005 ? 'difference' : diff < 0 ? 'loss' : 'gain'}</small></div>`;
      }).join('')}</div><p>Illustrative changes from the acquisition price. Figures exclude inflation and investment returns.</p>` : ''}
      </div>`;
  }

  function add(id) {
    const row = state().assessments.find(r => r.id === id) || {};
    const artists = state().artists;
    if (!artists.length) {
      fw().openDialog('Add a work','<p class="empty">Add an artist to your watchlist first.</p>'); return;
    }
    const title = row.id ? 'Work assessment' : 'Add a work';
    const date = row.askDate || '';
    const costInputs =
      dollars('offerPrice','Planned offer (USD)',row.offerPrice) +
      dollars('purchasePrice','Price actually paid (USD)',row.purchasePrice) +
      dollars('buyCosts','Total buy-side costs (USD)',row.buyCosts) +
      dollars('annualHolding','Annual holding costs (USD)',row.annualHolding) +
      field('sellFee','Resale commission (%)',row.sellFee,'number','min="0" max="99.99" step="0.01"') +
      dollars('sellCosts','Fixed selling costs (USD)',row.sellCosts);
    const markup = `<form id="ws-work-form" class="ws-form" data-id="${escape(row.id)}">
      <div class="ws-fields">
        ${field('title','Artwork title',row.title,'text','maxlength="500" required')}
        ${select('artistId','Artist',artists.map(a=>[a.id,a.name]),row.artistId || artists[0].id)}
        ${select('decision','Decision',['Considering','Bought','Passed'],row.decision || 'Considering')}
        ${field('planYear','Acquisition year',row.planYear || planYear,'number','min="1900" max="2200" required')}
      </div>
      ${group('Edition and asking price',
        area('edition','Medium, edition and publisher',row.edition) + area('condition','Condition and framing',row.condition) +
        field('marketType','Market / seller type',row.marketType,'text','placeholder="Publisher retail, gallery listing, auction…"') +
        field('sourceUrl','Listing URL',row.sourceUrl,'url','placeholder="https://…"') +
        dollars('ask','Listing ask (USD)',row.ask) + field('askDate','Ask observed on',date,'date') +
        dollars('ceiling','Personal price ceiling (USD)',row.ceiling),true)}
      ${group('Collecting rubric',
        area('institutionEvidence','Institutional interest',row.institutionEvidence) + area('galleryEvidence','Gallery programme',row.galleryEvidence) +
        area('definitive','What makes this a definitive image?',row.definitive) + area('marketDepth','Market depth and evidence limits',row.marketDepth) +
        select('hang','Would I hang it?',[['','Unrecorded'],'Yes','Maybe','No'],row.hang || '') + area('verdict','Collector verdict',row.verdict) +
        area('notes','Research notes',row.notes))}
      ${group(`Comparable sales (${row.comparables?.length || 0})`, `<div class="ws-wide"><div id="ws-comps">${(row.comparables || []).map(compFields).join('')}</div>
        ${action('new-comp','Add comparable sale')}</div>`)}
      ${group('Purchase costs and five-year resale', `<p class="ws-wide ws-caption">Use USD throughout. Include buyer’s premium, shipping, tax, framing and other purchase expenses in buy-side costs. For a prospect, the model uses your planned offer or the listing ask. A purchase uses its recorded paid price.</p>${costInputs}
        <div id="ws-scenarios" class="ws-wide" aria-live="polite">${model(row)}</div>`, true)}
      ${errorEl()}${formButtons('Save assessment')}</form>`;
    fw().openDialog(title,markup);
  }

  function reportError(form,error) {
    const node=form.querySelector('.ws-error');
    node.textContent=error.message || String(error);
    node.hidden=false;
    node.scrollIntoView({block:'nearest'});
  }

  function collectWork(form) {
    const data = new FormData(form);
    const row = {};
    for (const [key,value] of data.entries()) {
      if (!key.startsWith('comparable')) row[key] = value.trim();
    }
    for (const name of ['planYear','ask','ceiling','offerPrice','purchasePrice','buyCosts','annualHolding','sellFee','sellCosts']) row[name] = number(row[name]);
    row.currency = 'USD';
    if (form.dataset.id) row.id = form.dataset.id;
    row.comparables = [...form.querySelectorAll('.ws-comp')].map(section=>{
      const value = name=>section.querySelector(`[name="comparable${name}"]`).value.trim();
      return {date:value('Date'),price:number(value('Price')),basis:value('Basis'),edition:value('Edition'),condition:value('Condition'),sourceUrl:value('Source')};
    });
    return row;
  }

  document.addEventListener('click', event=>{
    const btn=event.target.closest('[data-ws]');
    if (!btn) return;
    const key=btn.dataset.ws;
    if (key==='edit') add(btn.dataset.id);
    else if (key==='add') add();
    else if (key==='budget') budget();
    else if (key==='compare') compare();
    else if (key==='close') fw().closeDialog();
    else if (key==='new-comp') {
      const comps=document.getElementById('ws-comps');
      comps.insertAdjacentHTML('beforeend', compFields());
      comps.lastElementChild.querySelector('input').focus();
    }
    else if (key==='remove-comp') btn.closest('.ws-comp').remove();
  });

  document.addEventListener('change', event=>{
    const el=event.target;
    if (el.id==='ws-plan-year') {
      planYear=Number(el.value);
      fw().refresh();
    } else if (el.name==='wsLeft' || el.name==='wsRight') {
      if (el.name==='wsLeft') {
        if (el.value===selectedRight) selectedRight=selectedLeft;
        selectedLeft=el.value;
      } else {
        if (el.value===selectedLeft) selectedLeft=selectedRight;
        selectedRight=el.value;
      }
      compare();
    } else if (el.name==='year' && el.form?.id==='ws-budget-form') {
      el.form.elements.amount.value=planAmount(Number(el.value)) ?? '';
    }
  });

  document.addEventListener('input', event=>{
    const form=event.target.form;
    if (form?.id==='ws-work-form') {
      document.getElementById('ws-scenarios').innerHTML=model(collectWork(form));
    }
  });

  document.addEventListener('invalid', event=>{
    if (event.target.form?.id==='ws-work-form') {
      const group = event.target.closest('details');
      if (group) group.open = true;
    }
  },true);

  document.addEventListener('submit', async event=>{
    const form=event.target;
    if (!['ws-work-form','ws-budget-form'].includes(form.id)) return;
    event.preventDefault();
    const submit=form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled=true;
    const isBudget=form.id==='ws-budget-form';
    try {
      if (isBudget) {
        const year=Number(form.elements.year.value);
        const amount=Number(form.elements.amount.value);
        const annualBudgets={[year]:amount};
        await fw().post('settings',{annualBudgets});
        planYear=year;
      } else {
        const row=collectWork(form);
        if (row.decision==='Bought' && row.purchasePrice==null) {
          const costField=form.elements.purchasePrice;
          costField.closest('details').open=true;
          costField.focus();
          throw new Error('Record the price actually paid before marking this work as bought.');
        }
        await fw().post('assessments',row);
      }
      fw().closeDialog();
      fw().refresh();
      fw().toast(isBudget ? 'Annual plan saved' : 'Work assessment saved');
    } catch (error) {
      reportError(form,error);
    } finally {
      submit.disabled=false;
    }
  });

  window.Worksheet={page,add,budget,compare};
})();
