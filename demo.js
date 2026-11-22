const cards = [...document.querySelectorAll('.sample')];
const key = 'fieldwork-public-demo-decisions-v1';
const titles = {inbox:'Discovery inbox', following:'Following', archive:'Archive'};
const descriptions = {inbox:'Explore sample artworks and the galleries that surfaced their artists.', following:'Artists you chose to follow.', archive:'Artists you set aside. Return any artist to your inbox for another look.'};
let view = 'inbox';
function read() {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
let choices = read();
function render() {
  const counts = {inbox:0,following:0,archive:0};
  for (const card of cards) {
    const status = choices[card.dataset.id] || 'inbox';
    counts[status]++;
    card.hidden = status !== view;
    const actions = card.querySelector('.choices');
    actions.replaceChildren();
    for (const [next,label] of [['following','Follow'],['archive','Archive'],['inbox','Return to inbox']]) {
      if (next === status) continue;
      const button = document.createElement('button');
      button.className = next === 'following' ? 'btn primary' : 'btn';
      button.textContent = label;
      button.onclick = () => {
        choices[card.dataset.id] = next;
        let message = card.querySelector('h2').textContent + ' moved to ' + titles[next] + '.';
        try { localStorage.setItem(key, JSON.stringify(choices)); } catch { message += ' Saved for this visit only.'; }
        render();
        document.querySelector('#notice').textContent = message;
        (document.querySelector('.sample:not([hidden]) .choices button') || document.querySelector('[aria-current="page"]')).focus();
      };
      actions.append(button);
    }
  }
  document.querySelector('h1').textContent = titles[view];
  document.querySelector('#intro').textContent = descriptions[view];
  const empty = document.querySelector('#empty');
  empty.hidden = counts[view] > 0;
  empty.textContent = {inbox:'You’ve reviewed every sample. Revisit artists in Following or Archive.',following:'Follow an artist in the discovery inbox to see them here.',archive:'Artists you archive in the discovery inbox appear here.'}[view];
  for (const b of document.querySelectorAll('[data-view]')) {
    b.textContent = titles[b.dataset.view] + ' · ' + counts[b.dataset.view];
    if (b.dataset.view === view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    b.onclick = () => { view = b.dataset.view; document.querySelector('#notice').textContent = ''; render(); };
  }
}
window.addEventListener('storage', event => { if (event.key === key || event.key === null) { choices = read(); render(); } });
render();
