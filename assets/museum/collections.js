/* Museum photo collections use web previews and collection-level download links. */
(() => {
  'use strict';
  const root = document.documentElement.dataset.assetRoot;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const dialog = $('#contemporary-dialog');
  if (!dialog) return;
  const comparison = $('#photo-comparison');
  const cropWindows = dialog.dataset.cropWindows
    ? fetch(dialog.dataset.cropWindows).then(r => { if (!r.ok) throw new Error('Display windows unavailable'); return r.json(); }).then(d => d.crops)
    : Promise.resolve({});
  let active = null;
  let photoMode = 'compare';
  const crop = it => it.displayCrop || [0, 0, 1, 1];
  function cropStyle(it) {
    const [l, t, r, b] = crop(it);
    return `left:${-l/(r-l)*100}%;top:${-t/(b-t)*100}%;width:${100/(r-l)}%;height:${100/(b-t)}%;`;
  }
  function cropRatio(it) {
    const [l, t, r, b] = crop(it), photo = it.images.photo;
    return photo.width/photo.height*(r-l)/(b-t);
  }
  function setPhotoMode(mode) {
    if (!comparison) return;
    photoMode = mode;
    comparison.hidden = mode !== 'compare';
    $('#contemporary-images').hidden = mode !== 'pair';
    $$('[data-photo-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.photoMode === mode)));
  }
  function updateComparison(value) {
    const p = Math.max(0, Math.min(100, value));
    $('#photo-compare-overlay').style.clipPath = `inset(0 ${100-p}% 0 0)`;
    const divider = $('#photo-compare-divider');
    divider.style.left = p+'%';
    divider.setAttribute('aria-valuenow', String(Math.round(p)));
    divider.setAttribute('aria-valuetext', `${Math.round(p)}% photograph, ${100-Math.round(p)}% edge map`);
  }
  function selectCollection(key) {
    $$('.collection-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.collection === key)));
    ['contemporary', 'historical', 'synthetic'].forEach(k => { $('#dataset-' + k).hidden = k !== key; });
  }
  $$('.collection-switch button').forEach(button => button.addEventListener('click', () => {
    selectCollection(button.dataset.collection);
    const url = new URL(location.href);
    url.searchParams.set('collection', button.dataset.collection);
    history.replaceState(null, '', url);
  }));
  const requested = new URLSearchParams(location.search).get('collection');
  if (['contemporary', 'synthetic', 'historical'].includes(requested)) selectCollection(requested);

  function render(state) {
    state.browser.innerHTML = state.items.slice(0, state.shown).map((it, i) => {
      const im = it.images[state.layer];
      const imageStyle = it.displayCrop ? ` style="${cropStyle(it)}"` : '';
      const images = `<img src="${root + im.thumbnail}" alt="${state.layer === 'photo' ? state.title + ' of Yungang Grottoes' : 'Extracted edge map of a Yungang carving'}" width="${im.width}" height="${im.height}" loading="lazy"${imageStyle}>${state.layer === 'photo' ? `<img class="edge-reveal" src="${root + it.images.edge.thumbnail}" alt="" loading="lazy"${imageStyle}>` : ''}`;
      return `<button class="contemporary-piece" data-photo="${i}" aria-label="View ${state.key} photograph and edge map">${it.displayCrop ? `<span class="photo-crop" style="--photo-ratio:${cropRatio(it)}">${images}</span>` : images}</button>`;
    }).join('');
    state.browser.querySelectorAll('button').forEach(b => b.addEventListener('click', () => open(state, +b.dataset.photo)));
    state.count.textContent = `Showing ${Math.min(state.shown, state.items.length)} of ${state.items.length} photograph / edge-map pairs`;
    state.more.hidden = state.shown >= state.items.length;
  }
  function open(state, i) {
    if (!state.items.length) return;
    active = state;
    state.index = (i + state.items.length) % state.items.length;
    const it = state.items[state.index];
    $('#contemporary-title').textContent = state.title;
    dialog.querySelector('header p').textContent = state.key === 'historical'
      ? 'GUO-246 · Japanese Yun-Kang report, Cave 7'
      : 'GUO-246 · Yungang Grottoes';
    $('#contemporary-images').innerHTML = ['photo', 'edge'].map(key => {
      const im = it.images[key];
      const image = `<img src="${root + im.preview}" alt="${key === 'photo' ? state.title : 'Observed edge map'}" width="${im.width}" height="${im.height}"${comparison ? ` style="${cropStyle(it)}"` : ''}>`;
      return `<figure>${comparison ? `<div class="photo-crop" style="--photo-ratio:${cropRatio(it)}">${image}</div>` : image}<figcaption><span>${key === 'photo' ? 'Photograph' : 'Edge map'}</span></figcaption></figure>`;
    }).join('');
    if (comparison) {
      $('#photo-compare-frame').style.setProperty('--photo-ratio', cropRatio(it));
      for (const key of ['photo', 'edge']) {
        const image = $('#photo-compare-' + key);
        image.src = root + it.images[key].preview;
        image.style.cssText = cropStyle(it);
      }
      updateComparison(50);
      setPhotoMode(photoMode);
    }
    $('#photo-dataset-download').dataset.datasetDownload = state.key;
    window.EchoDownloads?.update(dialog);
    $('#contemporary-position').textContent = `${state.index + 1} / ${state.items.length}`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  for (const [key, title] of [['contemporary', 'Contemporary photograph'], ['historical', 'Historical photograph']]) {
    const panel = $('#dataset-' + key), browser = $('#' + key + '-browser');
    if (!browser) continue;
    const state = { key, title, browser, items: [], shown: 24, layer: 'photo', index: 0,
      more: $('#' + key + '-more'), count: $('#' + key + '-count') };
    panel.querySelectorAll('.contemporary-layers button').forEach(button => button.addEventListener('click', () => {
      state.layer = button.dataset.photoLayer;
      panel.querySelectorAll('.contemporary-layers button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      render(state);
    }));
    state.more.addEventListener('click', () => { state.shown += 24; render(state); });
    const data = fetch(root + 'data/' + key + '.json').then(r => {
      if (!r.ok) throw new Error('Collection unavailable');
      return r.json();
    });
    Promise.all([data, cropWindows]).then(([data, windows]) => {
      state.items = data.items.map(it => windows[it.id] ? { ...it, displayCrop: windows[it.id] } : it);
      render(state);
    }).catch(() => {
      browser.textContent = `The ${key} collection could not be loaded. Please refresh to try again.`;
      state.count.textContent = 'Collection unavailable'; state.more.hidden = true;
    });
  }
  if (comparison) {
    $$('[data-photo-mode]').forEach(b => b.addEventListener('click', () => setPhotoMode(b.dataset.photoMode)));
    const divider = $('#photo-compare-divider');
    function drag(e) {
      const r = $('#photo-compare-frame').getBoundingClientRect();
      updateComparison((e.clientX-r.left)/r.width*100);
    }
    divider.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      e.preventDefault(); divider.focus({ preventScroll: true }); divider.setPointerCapture(e.pointerId); drag(e);
    });
    divider.addEventListener('pointermove', e => { if (divider.hasPointerCapture(e.pointerId)) drag(e); });
    for (const type of ['pointerup', 'pointercancel']) divider.addEventListener(type, e => {
      if (divider.hasPointerCapture(e.pointerId)) divider.releasePointerCapture(e.pointerId);
    });
    divider.addEventListener('keydown', e => {
      const value = Number(divider.getAttribute('aria-valuenow'));
      const keys = { ArrowLeft: value-1, ArrowRight: value+1, ArrowDown: value-1, ArrowUp: value+1,
        PageDown: value-10, PageUp: value+10, Home: 0, End: 100 };
      if (!(e.key in keys)) return;
      e.preventDefault(); e.stopPropagation(); updateComparison(keys[e.key]);
    });
  }
  $('#contemporary-close').addEventListener('click', () => dialog.close());
  $('#contemporary-prev').addEventListener('click', () => { if (active) open(active, active.index - 1); });
  $('#contemporary-next').addEventListener('click', () => { if (active) open(active, active.index + 1); });
  dialog.addEventListener('keydown', e => {
    if (!active || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation(); open(active, active.index + (e.key === 'ArrowRight' ? 1 : -1));
  });
  dialog.addEventListener('click', e => {
    const r = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
  });
})();
