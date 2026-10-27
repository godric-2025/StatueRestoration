/* Fill one shared URL or three collection URLs in data/museum-downloads.json. */
(() => {
  'use strict';
  const links = { all: '', contemporary: '', historical: '', synthetic: '' };
  function webURL(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim());
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }
  function update(scope = document) {
    scope.querySelectorAll('[data-dataset-download]').forEach(link => {
      const key = link.dataset.datasetDownload;
      const url = links[key] || links.all;
      const label = link.dataset.downloadLabel || 'Dataset';
      link.classList.toggle('off', !url);
      link.setAttribute('aria-disabled', String(!url));
      link.textContent = url ? `${label} ↓` : `${label} · To be done`;
      if (url) {
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.removeAttribute('href');
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    });
    const all = document.querySelector('.dataset-downloads');
    if (all) all.hidden = !links.all && ['contemporary', 'historical', 'synthetic'].some(key => links[key]);
  }
  window.EchoDownloads = { update };
  update();
  fetch(document.documentElement.dataset.assetRoot + 'data/museum-downloads.json')
    .then(response => { if (!response.ok) throw new Error('Download links unavailable'); return response.json(); })
    .then(config => {
      Object.keys(links).forEach(key => { links[key] = webURL(config[key]); });
      update();
    })
    .catch(() => update());
})();
