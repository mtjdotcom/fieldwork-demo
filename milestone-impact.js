(() => {
  'use strict';

  const levels = Object.freeze({
    context: 'Context',
    meaningful: 'Meaningful',
    major: 'Major',
    'career-defining': 'Career-defining',
    unclassified: 'Unclassified',
  });
  const tracks = Object.freeze({
    institutional: 'Institutional',
    gallery: 'Gallery',
    critical: 'Critical',
    market: 'Market',
    other: 'Other',
  });

  const eventTracks = new Map([
    ['Institution', 'institutional'], ['Exhibition', 'gallery'], ['Representation', 'gallery'],
    ['Market', 'market'], ['Press', 'critical'],
  ]);
  // These are the evidence categories available in the milestone form.
  const institutionalEvidence = new Map([
    ['Museum solo exhibition', ['major', 'The museum committed an exhibition to this artist’s work.']],
    ['Museum group show', ['meaningful', 'The artist was included in a museum group exhibition.']],
    ['Public collection acquisition', ['major', 'The source records an acquisition for a public collection.']],
    ['Private foundation holding', ['context', 'The source records ownership by a private foundation.']],
    ['Art centre exhibition', ['meaningful', 'An art centre presented the artist’s work in its exhibition programme.']],
    ['Biennial presentation', ['meaningful', 'The artist’s work was selected for a biennial presentation.']],
    ['Public commission', ['meaningful', 'The artist received a public commission. Review its scale and scope to assess a larger commitment.']],
    ['Retrospective', ['career-defining', 'The institution organised a retrospective examining the artist’s work across time.']],
  ]);

  function usableSource(event) {
    return [event.url, event.sourceUrl].some(value => {
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    });
  }

  function classify(event = {}) {
    const linked = Boolean(event.coverageOfId);
    let track = linked ? 'critical' : eventTracks.get(event.type) || 'other';
    if (!linked && event.type === 'Exhibition' && !event.galleryId && !/\bgaller(?:y|ies)\b/i.test(event.title + ' ' + event.detail)) {
      track = 'other';
    }
    const result = (level, reason) => ({level, track, reason});
    if (!usableSource(event)) {
      return result('unclassified', 'Add a source link documenting the event before assessing its impact.');
    }
    if (event.impactLevel || event.impactTrack || event.impactReason) {
      const reason = typeof event.impactReason === 'string' ? event.impactReason.trim() : '';
      if (Object.hasOwn(levels, event.impactLevel) && Object.hasOwn(tracks, event.impactTrack) &&
          (!linked || event.impactTrack === 'critical') && reason) {
        return {level: event.impactLevel, track: event.impactTrack, reason};
      }
      return result('unclassified', 'The saved impact review needs a valid level, track and explanation.');
    }
    if (linked) {
      return result('context', 'This report covers a milestone already on the timeline.');
    }

    const title = String(event.title || '').trim();
    const detail = String(event.detail || event.notes || '').trim();
    const text = title + '. ' + detail;
    const today = new Date().toISOString().slice(0, 10);
    if ((event.date && event.date > today) || /\b(?:planned|proposed|forthcoming|upcoming|scheduled|will open|due to open)\b/i.test(text)) {
      return result('context', 'The record describes a planned or future event. Review the outcome once it has taken place.');
    }
    if (/\b(?:not|never|unconfirmed|rumou?red|cancelled|canceled|in talks|might|possibly|hopes to)\b/i.test(text)) {
      return result('unclassified', 'Review the source to establish which commitment was confirmed.');
    }
    // Legacy records may lack a subtype. Consider direct descriptions only;
    // a retrospective mentioned in a biography or a review is a different event.
    const assertions = [title, detail.split(/[.!?]\s/)[0]].filter(sentence =>
      !/\b(?:previous|earlier|previously|prior|following|after|before|discussed|discusses|recalls|about|plans to|hopes for)\b/i.test(sentence)
    );
    const solo = /\bsolo (?:exhibition|show|presentation)\b/i;
    const soloRecord = assertions.find(sentence => solo.test(sentence));
    const firstSolo = soloRecord && /\bfirst(?: [\p{L}-]+){0,4} solo (?:exhibition|show|presentation)\b/iu.test(soloRecord);
    if (event.type === 'Institution') {
      const rule = institutionalEvidence.get(event.subtype);
      if (rule) return result(...rule);
      const firstMajor = assertions.find(sentence =>
        /\bfirst major(?: [\p{L}-]+){0,4} (?:institutional|museum) exhibition\b/iu.test(sentence)
      );
      if (firstMajor) return result('major', firstMajor);
      if (soloRecord) return result('major', firstSolo ? soloRecord : 'The source records an institutional solo presentation.');
      return result('unclassified', 'Review the institution’s role and the scope of the event.');
    }
    if (event.type === 'Representation') {
      const agreement = assertions.some(sentence =>
        /\b(?:announces? (?:the )?representation|signed (?:a |an )?representation agreement|(?:is|now) represented by|now represents|began representing)\b/i.test(sentence)
      );
      if (agreement || (event.destinationGallery && /^joins\s/i.test(title) && /\bits representation of\b/i.test(detail))) {
        if (assertions.some(sentence => /\b(?:opens?|opened|provides?|provided) access to a new market\b/i.test(sentence))) {
          return result('major', 'The agreement gives the artist documented access to a new market.');
        }
        return result('meaningful', 'The record confirms a formal gallery representation agreement.');
      }
      return result('unclassified', 'Check the source for a formal agreement and what access it provides.');
    }
    if (event.type === 'Exhibition') {
      if (soloRecord) return result('meaningful', firstSolo ? soloRecord : 'The source records a solo presentation by the artist.');
      return result('context', 'An exhibition appearance is recorded. Its scope can be reviewed separately.');
    }
    if (event.type === 'Residency' && assertions.some(sentence => /\b(?:juried|competitively awarded) residency\b/i.test(sentence))) {
      return result('meaningful', 'The source records selection for a competitive residency.');
    }
    if (event.type === 'Award' && assertions.some(sentence =>
      /\b(?:wins|shares|won|received|awarded)\b/i.test(sentence) && /\b(?:prize|award)\b/i.test(sentence)
    )) {
      return result('meaningful', 'The artist received an award through a selection process.');
    }
    if (event.type === 'Press') return result('context', 'The publication documents critical or editorial visibility.');
    if (event.type === 'Market') return result('context', 'This record documents market activity for a work.');
    return result('unclassified', 'Review what happened, who made the decision and what they committed.');
  }

  globalThis.MilestoneImpact = Object.freeze({levels, tracks, classify});
})();
