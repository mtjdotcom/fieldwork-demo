(() => {
  'use strict';

  const fw = () => window.FW;
  const esc = value => fw().esc(String(value ?? ''));
  const state = () => fw().getState();
  const stageOptions = ['Unassessed', 'Emerging', 'Emerging to mid-career', 'Mid-career', 'Established'];
  const markers = [
    {key:'years', name:'Years showing', prompt:'Date the earliest exhibition you can document. Check whether the artist was exhibiting before it.',
      stages:['Usually under 5 years of exhibiting.', 'Usually 10–20 years of exhibiting.', 'Typically 20 or more years.']},
    {key:'galleries', name:'Gallery representation', prompt:'Which galleries formally represent the artist? Record the cities and distinguish representation from an invitation to show.',
      stages:['Project spaces and early gallery shows.', 'Steady representation in two or three cities.', 'Representation by a leading international gallery.']},
    {key:'institutions', name:'Institutional recognition', prompt:'Name the institution, the event and its date. Distinguish public acquisitions, museum group shows, solo exhibitions and private foundation holdings.',
      stages:['Prizes and residencies.', 'Museum group exhibitions or public collections.', 'Museum solo exhibitions or retrospectives.']},
    {key:'auction', name:'Auction depth', prompt:'Record offered and sold lots, the date range, auction houses and price basis. Compare similar media and editions.',
      stages:['Few public auction results.', 'Steady sales with prices holding or rising.', 'A deep, recurring secondary market.']},
    {key:'press', name:'Critical coverage', prompt:'Look for substantive criticism, catalogues and monographs. Record the outlet or publisher, author and date.',
      stages:['Local writing and independent blogs.', 'Substantive coverage in major art magazines.', 'Monographs and scholarly attention.']}
  ];
  const topics = [
    ['Taste and distinctiveness','Would you hang this piece? Record what makes it recognisable and which work you would choose from the same series.'],
    ['Gallery track record','Trace early shows to later representation at Gagosian, Hauser & Wirth, David Zwirner or Pace.'],
    ['Depth of demand','Compare lots sold, unsold lots and the number of active years. Consider which collectors might still want this kind of work when you sell.'],
    ['Quality of the individual work','Compare the offered piece with definitive examples in the artist’s body of work. Note the series, condition, scale and edition.'],
    ['Gallery relationships','Keep a record of visits and conversations. A new piece offered between exhibitions can be a chance to see a stronger example.'],
    ['Cost of selling','Record the actual fees for your route to resale and compare what you would receive with the full cost of buying and holding the work.']
  ];

  function framework() {
    return `<section class="panel pf-rubric">
        <header><h2>Career stages</h2><p>Use the five markers together. Give institutional recognition the most weight in your judgment.</p></header>
        <div class="table-wrap"><table class="data-table framework-table"><thead><tr><th>Marker</th><th>Emerging</th><th>Mid-career</th><th>Established</th></tr></thead>
        <tbody>${markers.map(m=>`<tr><th scope="row">${esc(m.name)}</th>${m.stages.map(s=>`<td>${esc(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="panel-note">Five to nine years can be a transitional period. The two longer ranges meet at 20 years. The strength of the other evidence guides borderline cases.</p>
      </section>
      <section class="pf-reading"><header class="section-head"><h2>Collecting criteria</h2></header>
      <div class="framework-grid">${topics.map(([title,body])=>`<article class="panel prose"><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`).join('')}</div></section>
      <section class="panel prose pf-reading"><h2>Five-year break-even</h2><p>Compare your all-in purchase cost, holding costs and selling fees in USD. For an edition, use realised prices for the same version and colourway wherever possible.</p><div class="actions"><button class="btn" type="button" data-view="desk">Open acquisition desk</button></div></section>`;
  }

  const byId = id => state().artists.find(a=>a.id === id);
  const eventsOf = id => state().events.filter(e=>e.artistId === id).sort((a,b)=>a.date.localeCompare(b.date));
  const button = (action,id,label,cls='btn sm') =>
    `<button type="button" class="${cls}" data-profile-action="${action}" data-profile-id="${esc(id)}">${esc(label)}</button>`;
  const showLink = (url, label) => url ? fw().link(url,label) : '';
  const profileName = {watching:'Watching',archived:'Archived',discovered:'Discovered'};
  const reviewOf = artist => artist.careerReview || {};
  const activeTab = new Map();

  function intro(artist) {
    const image = fw().photo(artist);
    const example = artist.workExamples?.find(w => w.image === image);
    const illustration = image ? `<img src="${esc(image)}" alt="${esc(example?.caption || "Installation view of work by "+artist.name)}">` : '';
    const preview = example ? `<button class="pf-open-work" data-dc-action="enlarge" data-id="${esc(artist.id)}" aria-label="View artwork by ${esc(artist.name)}">${illustration}</button>` : illustration;
    const gallery = state().galleries.find(g=>g.id===artist.galleryId);
    const discovery = state().sources.find(source=>source.id===artist.discoverySourceId);
    const relationship = gallery ? button('gallery',gallery.id,gallery.name,'text-btn') : '';
    const summary = artist.summary ? `<p>${esc(artist.summary)}</p>` : '';
    const statusButtons = artist.status==='watching'
      ? button('archive',artist.id,'Archive') : button('follow',artist.id,artist.status==='archived'?'Restore to watchlist':'Follow artist','btn sm primary') + (artist.status==='discovered'?button('archive',artist.id,'Archive'):'');
    const urls = [showLink(artist.url,'Artist source')];
    if (discovery) urls.push(showLink(discovery.url,artist.discoveryMethod?'Curated roster source':'Discovery source'));
    return `<div class="pf-intro">${preview}
      <div><div class="pf-kicker">${esc(artist.medium || 'Artist')}${artist.birthYear?' · b. '+esc(artist.birthYear):''}</div>
      ${summary}<div class="pf-links">${relationship}${urls.filter(Boolean).join('')}</div></div></div>
      <div class="pf-status"><span class="pill">${esc(profileName[artist.status]||'Watching')}</span>${statusButtons}${artist.status !== 'discovered' ? button('inbox',artist.id,'Return to inbox') : ''}</div>`;
  }

  function timeline(artist, events) {
    const sources = state().sources.filter(s=>s.artistId===artist.id);
    const discoveries = (artist.discoveries || []).filter(d=>d.url);
    return `<section class="pf-pane"><div class="section-head"><h3>Career timeline</h3>${button('milestone',artist.id,'Add milestone')}</div>
      ${events.length?`<ol class="pf-timeline">${events.map(e=>`<li><div class="pf-meta"><time>${esc(fw().dateLabel(e.date))}</time><span>${esc(e.type)}</span></div>
        <h4>${esc(e.title)}</h4>${e.detail||e.notes?`<p>${esc(e.detail || e.notes)}</p>`:''}${showLink(e.url || e.sourceUrl,e.source || 'Open source')}</li>`).join('')}</ol>`:'<p class="quiet-text">Add a dated exhibition, representation announcement, institutional event or auction result to start this timeline.</p>'}
      ${sources.length || discoveries.length ? `<div class="pf-foot"><h4>Source pages</h4><div class="pf-links">${sources.map(s=>showLink(s.url,s.name)).join('')}${discoveries.map(d=>showLink(d.url,fw().galleryName(d.galleryId)+' artist page')).join('')}</div></div>`:''}</section>`;
  }

  function evidenceHint(artist, key, events) {
    let event, text;
    if (key==='years' && events.length) {
      event=events.find(e=>['Exhibition','Institution'].includes(e.type));
      if (event) text='Earliest exhibition in this timeline: '+fw().dateLabel(event.date)+'. The artist may have shown earlier.';
    } else if (key==='galleries') {
      event=events.filter(e=>e.type==='Representation').at(-1);
      if (event) text=event.title+' · '+fw().dateLabel(event.date)+'.';
    } else if (key==='institutions') {
      event=events.filter(e=>e.type==='Institution'||e.type==='Award').at(-1);
      if (event) text=event.title+' · '+fw().dateLabel(event.date)+'.';
    } else if (key==='auction') {
      event=events.filter(e=>e.type==='Market'&&e.priceBasis).at(-1);
      if (event) text='Latest auction result recorded here: '+event.title+' · '+fw().dateLabel(event.date)+'.';
    }
    return text ? {text,url:event.url || event.sourceUrl,attribution:event.source || 'Timeline record'} : {};
  }

  function stageReview(artist, events) {
    const r=reviewOf(artist);
    return `<section class="pf-pane"><div class="section-head"><h3>Career-stage review</h3>${button('edit-review',artist.id,'Edit review')}</div>
      <div class="pf-verdict"><small>Collector’s working view</small><strong>${esc(r.stage || 'Unassessed')}</strong>${r.reason?`<p>${esc(r.reason)}</p>`:''}${r.reviewedOn?`<small>Reviewed ${esc(fw().dateLabel(r.reviewedOn))}</small>`:''}</div>
      <dl class="pf-markers">${markers.map(m=>{
        const entry=r.markers?.[m.key] || {};
        const hint=evidenceHint(artist,m.key,events);
        return `<div><dt>${esc(m.name)}</dt><dd>${entry.text?`<p>${esc(entry.text)}</p>${showLink(entry.url,'Evidence source')}`:hint.text?`<p>${esc(hint.text)}</p>${showLink(hint.url,hint.attribution)}`:'<p class="quiet-text">Evidence to collect</p>'}</dd></div>`;
      }).join('')}</dl>
      <div class="pf-foot"><h4>What to watch next</h4><p class="pf-lines">${esc(r.watchCriteria || 'Use Edit review to record the next event that would change your view.')}</p></div>
    </section>`;
  }

  function notes(artist) {
    const works=state().assessments.filter(w=>w.artistId===artist.id);
    return `<section class="pf-pane"><div class="section-head"><h3>Collector notes</h3>${button('edit-notes',artist.id,'Edit notes')}</div>
      <div class="pf-foot"><h4>Would I hang the work?</h4><p class="pf-lines">${esc(artist.tasteNotes || 'Personal taste has yet to be recorded.')}</p></div>
      <div class="pf-foot"><h4>Research notes</h4><p class="pf-lines">${esc(artist.notes || 'Add gallery conversations, useful comparisons and questions for your next visit.')}</p></div>
      ${works.length?`<div class="pf-foot"><h4>Works under review</h4><div class="pf-links">${works.map(w=>button('work',w.id,w.title,'text-btn')).join('')}</div></div>`:''}
    </section>`;
  }

  function show(id, section) {
    const artist=byId(id);
    if (!artist) return;
    if (artist.status==='discovered') window.DiscoveryViews.mark(id);
    const tab=section || activeTab.get(id) || 'timeline';
    activeTab.set(id,tab);
    const events=eventsOf(id);
    const tabs=[['timeline','Timeline'],['stage','Stage review'],['notes','My notes']];
    fw().openDialog(artist.name,`${intro(artist)}<nav aria-label="Artist profile sections" class="pf-tabs">${tabs.map(([value,label])=>
      `<button type="button" class="${tab===value?'active':''}" aria-pressed="${tab===value}" data-profile-tab="${value}" data-profile-id="${esc(id)}">${label}</button>`).join('')}</nav>
      ${tab==='timeline'?timeline(artist,events):tab==='stage'?stageReview(artist,events):notes(artist)}`);
  }

  const input = (name,label,value,placeholder='') =>
    `<label class="field">${esc(label)}<textarea name="${esc(name)}" placeholder="${esc(placeholder)}" rows="3">${esc(value)}</textarea></label>`;
  function editReview(artist) {
    const r=reviewOf(artist);
    fw().openDialog('Review '+artist.name,`<form class="pf-form" data-profile-form="review" data-profile-id="${esc(artist.id)}">
      <label class="field">Career stage<select name="stage">${stageOptions.map(s=>`<option${s===(r.stage || 'Unassessed')?' selected':''}>${esc(s)}</option>`).join('')}</select></label>
      ${input('reason','Why this stage?',r.reason,'Which evidence carries the most weight?')}
      ${input('watchCriteria','What to watch next',r.watchCriteria,'Name a specific exhibition, representation change or auction outcome.')}
      <h3>Evidence by marker</h3>${markers.map(m=>{
        const e=r.markers?.[m.key] || {};
        return `<details class="pf-editor"><summary>${esc(m.name)}</summary><p>${esc(m.prompt)}</p>
          ${input('e-'+m.key,'Evidence and attribution',e.text)}
          <label class="field">Supporting URL<input type="url" name="u-${m.key}" value="${esc(e.url)}" placeholder="https://"></label></details>`;
      }).join('')}
      <p class="pf-error" role="alert"></p><div class="actions"><button type="submit" class="btn primary">Save review</button>${button('back-stage',artist.id,'Cancel','btn')}</div></form>`);
  }

  function editNotes(artist) {
    fw().openDialog('Notes on '+artist.name,`<form data-profile-form="notes" data-profile-id="${esc(artist.id)}" class="pf-form">
      ${input('tasteNotes','Would I hang the work?',artist.tasteNotes,'What draws you to it? Where would it live?')}
      ${input('notes','Research notes',artist.notes,'Record firsthand observations and details to verify.')}
      <p class="pf-error" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Save notes</button>${button('back-notes',artist.id,'Cancel','btn')}</div></form>`);
  }

  document.addEventListener('click',async event=>{
    const el=event.target.closest('[data-profile-action], [data-profile-tab]');
    if (!el) return;
    const id=el.dataset.profileId;
    if (el.dataset.profileTab) {show(id,el.dataset.profileTab); return;}
    const action=el.dataset.profileAction;
    if (action==='gallery') {fw().showGallery(id); return;}
    if (action==='work') {window.Worksheet.add(id); return;}
    const artist=byId(id);
    if (!artist) return;
    if (action==='milestone') fw().addEvent(id);
    else if (action==='edit-review') editReview(artist);
    else if (action==='edit-notes') editNotes(artist);
    else if (action==='back-stage') show(id,'stage');
    else if (action==='back-notes') show(id,'notes');
    else if (action==='archive' || action==='follow' || action==='inbox') {
      el.disabled=true;
      try {
        await fw().post('artists',{id,expectedStatus:artist.status,status:{archive:'archived',follow:'watching',inbox:'discovered'}[action]});
        await fw().refresh();
        show(id);
        fw().toast({archive:'Artist archived',follow:'Added to watchlist',inbox:'Returned to discovery inbox'}[action]);
      } catch (err) {
        el.disabled=false;
        fw().toast(err.message);
      }
    }
  });

  document.addEventListener('invalid',event=>{
    if (event.target.form?.dataset.profileForm) {
      const group=event.target.closest('details');
      if (group) group.open=true;
    }
  },true);
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if (!form.dataset.profileForm) return;
    event.preventDefault();
    const submit=form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    const id=form.dataset.profileId;
    const values=new FormData(form);
    const value=name=>String(values.get(name)||'').trim();
    const review=form.dataset.profileForm==='review';
    let update;
    if (review) {
      const evidence={};
      for (const {key} of markers) {
        const url=value('u-'+key);
        if (url && !/^https?:\/\//i.test(url)) {
          form.querySelector('.pf-error').textContent='Use an HTTP or HTTPS evidence link.';
          const input=form.elements['u-'+key];
          input.closest('details').open=true;
          input.focus();
          return;
        }
        evidence[key]={text:value('e-'+key),url};
      }
      const today=new Date();
      const day=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
      update={careerReview:{stage:value('stage'),reason:value('reason'),watchCriteria:value('watchCriteria'),markers:evidence,reviewedOn:day}};
    } else update={tasteNotes:value('tasteNotes'),notes:value('notes')};
    submit.disabled=true;
    try {
      await fw().post('artists',{id,...update});
      await fw().refresh();
      show(id,review?'stage':'notes');
      fw().toast(review?'Career review saved':'Collector notes saved');
    } catch (err) {
      form.querySelector('.pf-error').textContent=err.message;
      submit.disabled=false;
    }
  });

  window.Profile={show,framework};
})();
