// Browser implementation of Fieldwork's gallery_tiers.py and taste_ranking.py.
// The published sample contains public artwork only. Nothing is sent to a server.
(() => {
  'use strict';

  const today = () => new Date().toISOString().slice(0, 10);
  const rubric = {
    version: '1.0', intakeYears: 3, followupYears: 5, maxCareerYears: 5, minEntrants: 10,
    minCoverage: 0.8, confidence: 0.95,
    proven: {minEntrants:15, minLower:0.20, minInstitutional:3, minSuccessYears:2},
    promising: {minLower:0.10,minSuccesses:2},
    benchmark: ['Gagosian','David Zwirner','Hauser & Wirth','Pace Gallery'],
    methods: [
      {title:'NIST · Wilson proportion interval',url:'https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm'},
      {title:'ICOM · Museum definition',url:'https://icom.museum/en/resources/standards-guidelines/museum-definition/'},
    ],
  };

  function benchmark(name) {
    const lower = String(name ?? '').trim().toLowerCase();
    const aliases = {'gagosian gallery':'Gagosian', zwirner:'David Zwirner', 'hauser and wirth':'Hauser & Wirth', pace:'Pace Gallery'};
    return rubric.benchmark.find(org => org.toLowerCase() === lower) || aliases[lower];
  }

  function requireValue(condition, message) {
    if (!condition) throw new Error(message);
  }
  function day(value) {
    const parsed = new Date(value);
    requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value, 'Provide a valid date in YYYY-MM-DD format.');
    return value;
  }
  function yearOf(date) { return Number(date.slice(0,4)); }
  function integer(value, low, high, label) {
    requireValue(Number.isInteger(value) && value >= low && value <= high, 'Enter a whole number from '+low+' to '+high+' for '+label+'.');
    return value;
  }
  function text(value, label) {
    requireValue(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 2000, 'Provide a valid '+label+'.');
    return value.trim();
  }
  function url(value) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('Enter an absolute public HTTP or HTTPS source URL.'); }
    requireValue(/^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password && !/[\s\\]/.test(value) &&
      (!parsed.port || ['80','443'].includes(parsed.port)) && parsed.hostname.includes('.') &&
      !/(^localhost$|\.(?:local|internal|localhost|home\.arpa)$)/i.test(parsed.hostname) &&
      !/^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname),
      'Enter an absolute public HTTP or HTTPS source URL.');
    return value;
  }

  function validateCohorts(raw, asOf=today()) {
    requireValue(Array.isArray(raw),'Provide a list of annual audits.');
    const years = new Set(), identities = new Set();
    return raw.map(cohort => {
      const year = integer(cohort.year,1,yearOf(asOf),'intake year');
      requireValue(!years.has(year), 'The gallery already has an audit for '+year+'.');
      years.add(year);
      const complete = cohort.complete ?? false;
      requireValue(typeof complete === 'boolean','Choose whether the annual programme audit is complete.');
      requireValue(!complete || year+'-12-31' <= asOf,'The full calendar intake year must finish before certification.');
      const eligibleCount = cohort.eligibleCount == null ? null : integer(cohort.eligibleCount,0,1000000,'independently counted eligible entrants');
      const artists = (cohort.artists ?? []).map(row => {
        const firstDate = day(row.firstDate);
        requireValue(yearOf(firstDate) === year && firstDate <= asOf,'The gallery debut must be in the audit year and on or before today.');
        const firstPublicYear = integer(row.firstPublicYear,year-rubric.maxCareerYears,year,'the artist’s first professional public exhibition year');
        requireValue(row.baselineConfirmed === true,'Confirm the artist’s eligibility at their gallery debut using the cited CV.');
        const artistUrl = url(row.artistUrl);
        const parsed = new URL(artistUrl);
        const identity = parsed.host + parsed.pathname.replace(/\/+$/,'') + parsed.search + parsed.hash;
        requireValue(!identities.has(identity),'Each artist enters this gallery’s discovery cohort once. Check the repeated CV URL.');
        identities.add(identity);
        const reviewedThrough = row.reviewedThrough || '', reviewSourceUrl = row.reviewSourceUrl || '';
        requireValue(Boolean(reviewedThrough) === Boolean(reviewSourceUrl),'A follow-up review needs both its through-date and a source.');
        if (reviewedThrough) {
          requireValue(day(reviewedThrough) >= firstDate && reviewedThrough <= asOf, 'The review date must fall between the gallery debut and today.');
          url(reviewSourceUrl);
        }
        const outcomes = (row.outcomes ?? []).map(event => {
          const kind = event.kind, date = day(event.date);
          requireValue(['museum_show','museum_acquisition','representation'].includes(kind),'Choose a museum exhibition, permanent acquisition or benchmark representation.');
          requireValue(date > firstDate && date <= asOf,'A subsequent outcome must postdate the gallery debut and be documented by today.');
          let organization = text(event.organization,'outcome institution or gallery');
          if (kind === 'representation') {
            organization = benchmark(organization);
            requireValue(typeof organization === 'string','Representation must be by a gallery on the rubric’s published benchmark list.');
          }
          return {kind,date,organization,sourceUrl:url(event.sourceUrl)};
        });
        return {name:text(row.name,'artist name'), firstDate, sourceUrl:url(row.sourceUrl), artistUrl, firstPublicYear,
          baselineConfirmed:true, reviewedThrough, reviewSourceUrl, outcomes};
      });
      requireValue(!complete || eligibleCount === artists.length, 'A complete audit needs an independent eligible count matching every named entrant.');
      return {year, complete, eligibleCount, sourceUrl:url(cohort.sourceUrl), artists};
    });
  }

  function wilson(successes, entrants) {
    const z=1.959963984540054, p=successes/entrants, z2=z*z;
    const denominator=1+z2/entrants, center=p+z2/(2*entrants);
    const radius=z*Math.sqrt(p*(1-p)/entrants+z2/(4*entrants*entrants));
    return [Math.max(0,(center-radius)/denominator), Math.min(1,(center+radius)/denominator)];
  }

  function assessGallery(gallery, asOf=today()) {
    const last = yearOf(asOf)-rubric.followupYears-(asOf.slice(5) < '12-31' ? 1 : 0);
    const years=[last-2,last-1,last], cohorts=gallery.tierCohorts || [];
    const completeYears=cohorts.filter(c=>c.complete && years.includes(c.year)).map(c=>c.year).sort();
    const origin=benchmark(gallery.name);
    const rowResults=cohorts.flatMap(c=>c.artists.map(a=>{
      let windowEnd = (yearOf(a.firstDate)+rubric.followupYears)+a.firstDate.slice(4);
      if (windowEnd.endsWith('02-29') && new Date(windowEnd).getUTCMonth() !== 1) windowEnd=windowEnd.slice(0,-2)+'28';
      const inWindow=a.outcomes.filter(o=>a.firstDate<o.date && o.date<=windowEnd && o.date<=asOf);
      const institutional=inWindow.some(o=>o.kind==='museum_show' || o.kind==='museum_acquisition');
      const graduation=inWindow.some(o=>o.kind==='representation' && o.organization!==origin);
      let status='unresolved';
      if (!years.includes(c.year)) status='outside_window';
      else if (!c.complete) status='incomplete';
      else if (institutional || graduation) status='success';
      else if (a.reviewSourceUrl && a.reviewedThrough>=windowEnd && a.reviewedThrough<=asOf) status='reviewed';
      return {year:c.year, name:a.name, firstDate:a.firstDate, artistUrl:a.artistUrl, windowEnd, status, institutional, graduation};
    }));
    const eligible=rowResults.filter(row=>['success','reviewed','unresolved'].includes(row.status));
    const success=eligible.filter(row=>row.status==='success'), successes=success.length, entrants=eligible.length;
    const successYears=[...new Set(success.map(row=>row.year))].sort();
    const institutional=eligible.filter(row=>row.institutional).length, graduations=eligible.filter(row=>row.graduation).length;
    const unresolved=eligible.filter(row=>row.status==='unresolved').length, resolved=entrants-unresolved;
    const coverage=entrants ? resolved/entrants : null;
    let rate=null,lower=null,upper=null,tier='Unrated',reason;
    if (completeYears.length===years.length && entrants) {
      rate=successes/entrants; lower=wilson(successes,entrants)[0]; upper=wilson(successes+unresolved,entrants)[1];
    }
    if (completeYears.length!==years.length) reason='Complete programme audits needed for '+years.filter(y=>!completeYears.includes(y)).join(', ')+'.';
    else if (entrants<rubric.minEntrants) reason=entrants+' eligible entrants across the three years. At least '+rubric.minEntrants+' are required.';
    else if (coverage<rubric.minCoverage) reason='Outcomes resolved for '+resolved+' of '+entrants+' entrants. At least 80% coverage is required.';
    else if (entrants>=rubric.proven.minEntrants && lower>=rubric.proven.minLower && institutional>=rubric.proven.minInstitutional && successYears.length>=rubric.proven.minSuccessYears) {
      tier='Proven'; reason='Clears the lower-bound, sample-size, institutional and repeat-cohort thresholds.';
    } else if (lower>=rubric.promising.minLower && successes>=rubric.promising.minSuccesses) {
      tier='Promising'; reason='Clears the 10% lower-bound threshold with at least two distinct successes.';
    } else { tier='Measured'; reason='Evidence is sufficient to rate. The observed outcomes fall below the Promising threshold.'; }
    return {version:rubric.version, asOf, years, completeYears, tier, reason, entrants, successes, resolved, unresolved,
      coverage,rate,lower,upper,institutional,graduations,successYears,rowResults};
  }

  // Pairwise similarities from the same public thumbnails and extractor used locally.
  const visual = /* public-image-index */ {"names":["08ed8e8a62a42d6d1980893eb373677db258d120ec3df22519dc0b2b6df9c81e.jpg","0ebf1bb38db9f817f495156e547e565221358e4e60fc9dc1f2eaa9362d27b889.jpg","19851906ead7001feac252d3be65d80a43af83b47d345eb7a4627a2e0a95b0f7.jpg","29f17d30059f6231d425abaaa23f16ab541f0c3a800815162474d9489dcb9548.jpg","34a3c9b5f5030fd2239cbfb7a09a619c2090d66eeab7b5da9707441670eefe5c.jpg","35d0abfa9bf90d4063f89843bc84e69e7c05bd70fadec9cd1953ca307b1f2a8f.jpg","39b576cea04a3e7a9421efad292a390312d659e2bc858ca6297a4b450072df11.jpg","3c3925ceeeb8a5601910aa497fa43ba15bce49747dc605a99ab6e4aaca09d3ae.jpg","3dfd4a635051362f1ab53c6948664561f2cc13bd715b05ff2c7b2a41ff750305.jpg","3fbec111b069fd3d888e3254dcc21c87ad67090b6e551b4d9c3cc7655cc9d7cc.jpg","4c92012073efd3921381246037a5a4bf6b4657a4c029b460885ac899bdaf11c0.jpg","4d6c92fc20bca1cb17610a4d391895a6a6dd7de84ec9971dd86b9d6727cc6531.jpg","4fcef05303eaff06b1dfa53fe504888291ddfadd16329a66129a3565b1c54394.jpg","62015d4db8a38af5e7d68a291d86b8035495da96128637bded66ab577725ea53.jpg","7a1757f86115a9e275cf205a76f5d8bb8409c9d64824a7ae124c27239c616b2f.jpg","7f9394ae8f613950d69ba3494a2ba522f169db56a6af9fef3d24daea5616a55a.jpg","900ea61238ed2ecc3141340c2a66e2cf1a75fe8a73e97f7d734070cff2ce432c.jpg","98b945c28b094615a0e5643d857299addd07b081b8f2d894e10006dbc129fc32.jpg","9cb0cab860acd3e50b774473300a10c4b2dd0ee355bfdbaaf58a165d54895ba5.jpg","a6686eed0aae27c550a3689e7de0aa4fb9f6b325111c942d1ea52080723d0b90.jpg","a7267442f7413099a4f425d5f67d18dbbcc546b7b959c91b7b38898587f3e476.jpg","afac6b8eb7fa9961047f394e7a0103377b32f3bd6204d942c15b741472ef5c92.jpg","b91444e82cf5987ef88d1ae47023aaf707e7b99186c9cf2375ee0c3b86c8a311.jpg","c31a81b96d4e9cad6a5c3de4514a0a8e6ace8869832a72d5140c7337056de9fd.jpg","cf2248c97adf4b77a2698d3ccf2c7636d14dd23d43e7687f4a0ecf73c1fca05a.jpg","d34ce5a678e0ba55f08e0494ed95ba7497ae54132e6641d48d1f43eb0bc66a25.jpg","e6d488f41da26a9b4832f44855c1aab9aa9b4026c541cfbaabef2a0ef11cc263.jpg","ead217892da1f7a4459c7dd88bf8cd2e8b600b109d9547480e1ee566eb66cf5b.jpg","f4cf328fef921e3f67846458ceedbca64dcddbfc30e3d9c1574d5e4206f3f35a.jpg"],"kinds":["appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1","appearance-v1"],"rows":[[1.0],[0.7854802641,1.0],[0.7470665,0.7912627503,1.0],[0.7206812978,0.7464955164,0.6573800395,1.0],[0.6556822087,0.6997443477,0.6725244183,0.3706274385,1.0],[0.827756653,0.5851251512,0.642061906,0.5783793542,0.6330023423,1.0],[0.8824766202,0.8403318979,0.8074642597,0.8388089121,0.6186574983,0.7418706439,1.0],[0.8285843345,0.8456059707,0.7306847366,0.8593175289,0.4289112908,0.5492714279,0.84379336,1.0],[0.8075483104,0.8791048959,0.8013453043,0.8395347846,0.4876238145,0.5389362063,0.8475581202,0.9616032292,1.0],[0.7528721091,0.6377154053,0.6933439046,0.6689673421,0.7142568441,0.7614699668,0.8111869588,0.5614186286,0.5499552095,1.0],[0.5748711142,0.7788835737,0.7267569639,0.4268524782,0.8307568867,0.5338693298,0.6179620765,0.4707008012,0.5601024068,0.6366911424,1.0],[0.4124155493,0.5395482615,0.654496692,0.171343646,0.7991699938,0.4201397972,0.3946633162,0.2250946068,0.3793584175,0.5194602282,0.8106021806,1.0],[0.8399402084,0.9385976891,0.8580728256,0.7859756642,0.662871612,0.63957888,0.9105003263,0.8700494551,0.9179040213,0.6963528807,0.7438091964,0.5403167876,1.0],[0.5789011859,0.5067249534,0.7474288739,0.2884865849,0.8327148484,0.6188424793,0.5701222656,0.2991364,0.3663504394,0.6931903835,0.7001971561,0.7670698292,0.5598572978,1.0],[0.8912471494,0.8552006776,0.8436979123,0.8232011835,0.6201288589,0.7159890304,0.9114073801,0.8974974516,0.890098612,0.7729281915,0.6116921103,0.4129073979,0.9052708454,0.5591056445,1.0],[0.8484977297,0.8930954719,0.8481718903,0.8440983852,0.6747685322,0.7177363465,0.9341019067,0.8414154971,0.8580492042,0.7803765373,0.6982809407,0.4756031481,0.9294730459,0.6052483969,0.9253016688,1.0],[0.9276691503,0.7253998511,0.7269595779,0.7053554627,0.6504456312,0.8739852805,0.8656486822,0.7319349425,0.7188697838,0.7982390991,0.5930224302,0.4109571136,0.7933290978,0.5955807503,0.8546611129,0.8297399542,1.0],[0.7968431013,0.8166815905,0.7088856596,0.8886035975,0.4985368848,0.6444372643,0.9476406173,0.8490293161,0.8379676701,0.7698257809,0.5342745357,0.2748546008,0.8857150899,0.4320663384,0.8794309781,0.8969139624,0.7865144539,1.0],[0.9571236313,0.8362957603,0.8261299558,0.7769988254,0.6547244913,0.8108793242,0.9168740387,0.8670835998,0.8652863264,0.7633606378,0.6259276938,0.440888927,0.8963868059,0.5902735023,0.9169781693,0.8863776246,0.910676597,0.8478184696,1.0],[0.8819905028,0.7450510145,0.7460791211,0.756112079,0.6972127588,0.8067354205,0.8876555917,0.7297845446,0.7184023165,0.9214529867,0.6275468038,0.4820169004,0.8128846472,0.6561702244,0.8537018213,0.8379253075,0.8867708244,0.8463717417,0.8974106183,1.0],[0.9109874435,0.8092890725,0.6790394,0.6796854082,0.6791755121,0.767059176,0.8880997418,0.7405569649,0.7386828481,0.7275042184,0.6366044681,0.4059250589,0.8468427341,0.567300555,0.8105982342,0.8415040554,0.8820449225,0.8296363983,0.8818749631,0.829824468,1.0],[0.8721633981,0.8372241104,0.7867566313,0.7838961801,0.5864315264,0.6347951038,0.8439064853,0.9305407399,0.9008445336,0.6960580946,0.6131113959,0.3814897966,0.8632422909,0.463136896,0.9215857245,0.8711002428,0.7855209578,0.7994594061,0.8997777383,0.8065583376,0.7556669402,1.0],[0.8584658178,0.709736403,0.6824618774,0.7854259672,0.4958623013,0.8193795761,0.8817244155,0.7216145457,0.7227651235,0.7341311079,0.5370442206,0.3159105178,0.8044737529,0.4881513771,0.8104292356,0.8311500861,0.9059967084,0.8421205268,0.8513221208,0.8479745097,0.8553103242,0.715615007,1.0],[0.8319880872,0.7675875384,0.8577230999,0.5786958983,0.7772658942,0.6691129504,0.7653482287,0.72002578,0.752920904,0.7904968137,0.7149804698,0.6831505768,0.8029491006,0.7425117888,0.8515328732,0.8026643508,0.7622293633,0.6617347383,0.8553569692,0.8275820956,0.6996187739,0.8594211628,0.6105506665,1.0],[0.7637019799,0.9730815534,0.7827205748,0.6682205634,0.7876488744,0.6079995721,0.8222898414,0.7614340163,0.8120353733,0.6586960956,0.8447835024,0.626464345,0.9274360668,0.5941132449,0.8222096368,0.8729389663,0.7229115977,0.7856428373,0.8103221327,0.745486802,0.8172833617,0.7796406571,0.6958341367,0.7601522007,1.0],[0.8745110487,0.8373301418,0.7286951114,0.8550609715,0.4308547162,0.619739023,0.8613005181,0.9796731992,0.9417285002,0.5784359483,0.4855351636,0.2257371607,0.8765159971,0.3173291199,0.8972913559,0.8509290844,0.7986236056,0.8504730419,0.9008256295,0.7585223514,0.7920147744,0.9208690737,0.8035973413,0.7109911078,0.7620662164,1.0],[0.3014648384,0.5810313733,0.5717211866,0.200247657,0.7223088938,0.3103513149,0.3866676486,0.2217301147,0.3745523842,0.3747233737,0.8224663455,0.8814176417,0.5484176292,0.6331396453,0.3323591501,0.4719868012,0.3356208791,0.2941462756,0.3573132376,0.3609237357,0.4071083078,0.3023399146,0.3310301759,0.4919067788,0.6708840244,0.2324073081,1.0],[0.3936513454,0.2958586227,0.2142884645,0.3079111806,0.3298714269,0.4510201456,0.551213326,0.1752036665,0.1682130796,0.5289899886,0.2859131563,0.1818952992,0.3559066349,0.3395018916,0.3011576017,0.4233210645,0.4743685019,0.5424989608,0.3665388063,0.4471237505,0.6120616741,0.1827982321,0.5613929745,0.1805855132,0.3479456791,0.2423093838,0.2647863001,1.0],[0.5161909074,0.226051886,0.2179855886,0.341961193,0.3049603791,0.6381973291,0.4674962952,0.1718176742,0.1741142071,0.4771660357,0.237315398,0.1874089997,0.3038402706,0.3547532464,0.2746243639,0.3476981408,0.610169021,0.4071498117,0.4430336623,0.5360071206,0.601452989,0.1835302911,0.7211587108,0.1872388102,0.26039108,0.3048650407,0.2176326665,0.7187842399,1.0]]};
  const imageIndex = new Map(visual.names.map((name,i)=>[name,i]));
  const media = [
  [
    "oil painting",
    "\\boil(?: paint(?:ing)?)?\\s+(?:on|and)\\b"
  ],
  [
    "acrylic painting",
    "\\bacrylic(?: paint(?:ing)?)?\\s+on\\b"
  ],
  [
    "watercolour",
    "\\bwatercolou?rs?\\b"
  ],
  [
    "graphite",
    "\\bgraphite\\b"
  ],
  [
    "charcoal",
    "\\bcharcoal\\b"
  ],
  [
    "ceramics",
    "\\b(?:ceramics?|porcelain|stoneware|earthenware)\\b"
  ],
  [
    "bronze",
    "\\bbronze\\b"
  ],
  [
    "textiles",
    "\\b(?:textiles?|tapestr(?:y|ies)|embroider(?:y|ed)|woven|weaving)\\b"
  ],
  [
    "collage",
    "\\bcollages?\\b"
  ],
  [
    "printmaking",
    "\\b(?:printmaking|prints?|lithograph\\w*|etching\\w*|screen[ -]?print\\w*|monotype\\w*|woodcut\\w*)\\b"
  ],
  [
    "photography",
    "\\b(?:photography|photographic print|c[ -]?print|gelatin silver|chromogenic print)\\b"
  ],
  [
    "moving image",
    "\\b(?:video|moving image|single.channel film|digital film)\\b"
  ],
  [
    "painting",
    "\\b(?:paintings?|(?:oil|acrylic|gouache)\\s+on)\\b"
  ],
  [
    "sculpture",
    "\\bsculptures?\\b"
  ],
  [
    "drawing",
    "\\bdrawings?\\b"
  ]
].map(([name, expression]) => [name, new RegExp(expression, "i")]);
  function mediumTags(artist) {
    const parts=[artist.medium || ''];
    for (const example of artist.workExamples || []) {
      const caption=(example.caption || '').split(/\b(?:courtesy|photo(?:graph(?:y)?)?\s*(?:by\b|:))/i)[0];
      const year=caption.match(/\b(?:19|20)\d{2}\b/);
      if (year) parts.push(caption.slice(year.index+year[0].length));
    }
    const description=parts.join(' ');
    return media.filter(([,pattern])=>pattern.test(description)).map(([name])=>name);
  }

  function pairs(first,second) {
    const byKind = new Map();
    for (const a of first) for (const b of second) {
      const kind=visual.kinds[a];
      if (kind !== visual.kinds[b]) continue;
      if (!byKind.has(kind)) byKind.set(kind,{left:new Map(),right:new Map()});
      const group=byKind.get(kind), value=visual.rows[Math.max(a,b)][Math.min(a,b)];
      group.left.set(a,Math.max(value,group.left.get(a) || 0));
      group.right.set(b,Math.max(value,group.right.get(b) || 0));
    }
    if (!byKind.size) return null;
    const kind=[...byKind.keys()].sort().at(-1);
    const group=byKind.get(kind);
    const left=[...group.left.values()],right=[...group.right.values()];
    const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
    return {kind,score:(Math.max(...left)+Math.min(mean(left),mean(right)))/2};
  }

  function median(values) {
    const sorted=[...values].sort((a,b)=>a-b);
    const mid=Math.floor(sorted.length/2);
    return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
  }

  function strongest(evidence) {
    if (!evidence.length) return {strength:0,reason:''};
    evidence.sort((a,b)=>b.strength-a.strength || a.reason.localeCompare(b.reason));
    const first=evidence[0];
    const strength=first.strength+0.2*(1-first.strength)*(evidence[1]?.strength || 0);
    return {strength,reason:first.reason};
  }

  function attachTaste(state) {
    const targets=state.artists.filter(a=>a.status==='discovered');
    const refs=state.artists.filter(a=>a.status!=='discovered' && ['follow','archive'].includes(a.tasteDecision));
    const pool=[...targets,...refs];
    const allPaths=new Set(),indexedPaths=new Set(),workIds=new Map(),tags=new Map();
    for (const artist of state.artists) {
      delete artist.tasteMatch;
      const images=new Set();
      for (const work of artist.workExamples || []) {
        if (!work.image) continue;
        const key=work.image.split('/').pop();
        allPaths.add(key);
        const index=imageIndex.get(key);
        if (index!==undefined) { indexedPaths.add(key); images.add(index); }
      }
      workIds.set(artist.id,images);
      tags.set(artist.id,mediumTags(artist));
    }
    state.taste={followed:refs.filter(a=>a.tasteDecision==='follow').length, archived:refs.filter(a=>a.tasteDecision==='archive').length,
      indexedImages:indexedPaths.size,totalImages:allPaths.size};
    if (!refs.length) return;
    const evidence=new Map(targets.map(a=>[a.id,{follow:[],archive:[]}]));
    for (const ref of refs) {
      const similarities=new Map(), byKind=new Map();
      for (const other of pool) {
        if (other.id===ref.id) continue;
        const pair=pairs(workIds.get(ref.id),workIds.get(other.id));
        if (!pair) continue;
        similarities.set(other.id,pair);
        if (!byKind.has(pair.kind)) byKind.set(pair.kind,[]);
        byKind.get(pair.kind).push(pair.score);
      }
      const baseline=new Map();
      for (const [kind,values] of byKind) {
        const floor=kind.startsWith('appearance-') ? 0.85 : 0.55;
        baseline.set(kind,Math.min(0.985,Math.max(floor,values.length>=6 ? median(values) : floor)));
      }
      for (const candidate of targets) {
        const pair=similarities.get(candidate.id), first=tags.get(ref.id), second=tags.get(candidate.id);
        const common=first.filter(tag=>second.includes(tag));
        let weight=0;
        if (pair) {
          const base=baseline.get(pair.kind);
          weight=Math.max(0,pair.score-base)/Math.max(0.04,1-base);
          if (pair.kind.startsWith('appearance-')) weight*=0.8;
        }
        const material=common.length ? (pair ? 0.12:0.2)*common.length/Math.sqrt(first.length*second.length) : 0;
        const strength=weight+(1-weight)*material;
        if (!strength) continue;
        const label=ref.tasteDecision;
        let phrase='Shares '+common[0]+' with ';
        if (weight>=material) phrase=pair.kind.startsWith('appearance-') ? 'Similar colours and composition to work by ' : 'Visually similar to work by ';
        const reason=phrase+ref.name+(label==='follow' ? ', whom you follow.' : ', whom you archived.');
        evidence.get(candidate.id)[label].push({strength,reason});
      }
    }
    for (const artist of targets) {
      const sides=evidence.get(artist.id);
      const positive=strongest(sides.follow),negative=strongest(sides.archive);
      const score=positive.strength-negative.strength;
      artist.tasteMatch=Math.abs(score)<0.005 ? {score:0,reason:''} : {score,reason:score>0 ? positive.reason : negative.reason};
    }
  }
  function attach(state) {
    state.galleryTierFramework=rubric;
    for (const g of state.galleries) g.tierAssessment=assessGallery(g);
    attachTaste(state);
    return state;
  }
  window.FieldworkDemoProjection={attach,validateCohorts,assessGallery};
})();
