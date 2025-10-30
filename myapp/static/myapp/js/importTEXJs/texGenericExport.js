// texGenericExport.js
(function () {
  // --- tiny fallback for title -> filename only (does NOT scrape controls)
  function inferBaseTitle() {
    const label = document.getElementById('selected-tex-label')?.textContent?.trim();
    const h1    = document.querySelector('h1')?.textContent?.trim();
    const raw   = (label && label.toLowerCase() !== 'no tex file selected') ? label : (h1 || 'Imported_TEX');
    return String(raw).replace(/\.[Tt][Ee][Xx]$/, '');
  }

  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function exportGenericJSON() {
    if (typeof window.getGenericSnapshot !== 'function') {
      console.warn('getGenericSnapshot() is not available. Ensure texGenericCore.js (or equivalent) defines it on window.');
      return;
    }

    // single source of truth
    const snap = window.getGenericSnapshot(); // expected: { texName, title, controls, ... }

    // keep payload identical to snapshot, just add a timestamp (non-breaking)
    const payload = {
      ...snap,
      scrapedAtISO: new Date().toISOString()
    };

    // filename from snapshot.title (or fallback)
    const baseTitle = String(snap?.title || inferBaseTitle()).trim().replace(/\s+/g, '_') || 'Imported_TEX';
    downloadJSON(`${baseTitle}_generic.json`, payload);
  }

  // --- Button (unchanged styling)
  const mount = document.getElementById('export-buttons-mount');
  if (!mount) return;

  const btn3 = document.createElement('button');
  btn3.type = 'button';
  btn3.title = 'Export Generic JSON format (intermediate representation)';
  btn3.style.marginLeft = '5px';
  btn3.style.padding = '6px 10px';
  btn3.style.fontSize = '12px';
  btn3.style.border = '1px solid #888';
  btn3.style.borderRadius = '4px';
  btn3.style.background = '#f5f5f5';
  btn3.style.cursor = 'pointer';
  btn3.style.transition = 'background 0.2s, box-shadow 0.2s';

  btn3.addEventListener('mouseenter', () => {
    btn3.style.background = '#eaeaea';
    btn3.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
  });
  btn3.addEventListener('mouseleave', () => {
    btn3.style.background = '#f5f5f5';
    btn3.style.boxShadow = 'none';
  });
  btn3.addEventListener('mousedown', () => { btn3.style.background = '#ddd'; });
  btn3.addEventListener('mouseup',   () => { btn3.style.background = '#eaeaea'; });

  btn3.textContent = '→ Generic JSON';
  btn3.addEventListener('click', exportGenericJSON);
  mount.appendChild(btn3);
})();
