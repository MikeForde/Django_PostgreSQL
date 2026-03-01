// readCodePanelTsvExport.js
(function () {
  function inferBaseTitle() {
    const label = document.getElementById('selected-tex-label')?.textContent?.trim();
    const h1    = document.querySelector('h1')?.textContent?.trim();
    const raw   = (label && label.toLowerCase() !== 'no tex file selected') ? label : (h1 || 'Imported_TEX');
    return String(raw).replace(/\.[Tt][Ee][Xx]$/, '').replace(/\s+/g, '_') || 'Imported_TEX';
  }

  function tsvEscape(v) {
    // TSV: tabs/newlines break rows, so normalise them.
    // Keep it simple: replace \t and \r\n with spaces.
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/\r?\n/g, ' ')
      .replace(/\t/g, ' ')
      .trim();
  }

  function nextUlAfterHeadingText(headingText) {
    // Find h3/h4 whose text matches, then return the first <ul> after it (skipping p etc.)
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5'));
    const h = headings.find(x => (x.textContent || '').trim() === headingText);
    if (!h) return null;

    let n = h.nextElementSibling;
    while (n) {
        if (n.tagName === 'UL') return n;
        // sometimes the UL is inside a wrapper div etc.
        const innerUl = n.querySelector?.('ul');
        if (innerUl) return innerUl;
        n = n.nextElementSibling;
    }
    return null;
    }

    function scrapeUl(ul, listTypeLabel) {
    if (!ul) return [];

    const rows = Array.from(ul.querySelectorAll('li.rc-row'));
    return rows.map(li => {
        const readCodeRaw =
        li.getAttribute('data-read-code') ||
        li.querySelector('.rc-code')?.textContent ||
        '';

        // If this is "Last Entry for XYZ", extract XYZ into readCodeBase
        let readCodeBase = '';
        const mLE = String(readCodeRaw).match(/^\s*Last\s*Entry\s*for\s*(.+)\s*$/i);
        if (mLE) readCodeBase = (mLE[1] || '').trim();

        let label = li.querySelector('.rc-label')?.textContent || '';
        label = label.replace(/^\s*—\s*/, '').trim();

        const decisionEl = li.querySelector('.rc-decision');
        const decisionText = decisionEl?.textContent?.trim() || '';
        const decisionTip = decisionEl?.getAttribute('data-tip') || '';

        // raw badge class (note: some of your examples omit the "badge" class, but keep badge--ok/miss/etc)
        const decisionClassRaw =
        Array.from(decisionEl?.classList || [])
            .filter(c => c.startsWith('badge--'))
            .join(' ') || '';

        // Human meaning (your existing function)
        const decisionClass = decisionMeaning(decisionText, decisionClassRaw);

        let snomedConcept = li.getAttribute('data-snomed-concept') || '';
        let snomedSource  = li.getAttribute('data-snomed-source') || '';

        // If ManualMap/APIMap and no data-snomed-concept, extract from data-tip
        if (!snomedConcept && looksLikeManualOrApiMap(decisionText, decisionTip)) {
        snomedConcept = extractConceptIdFromTip(decisionTip) || '';
        if (!snomedSource) snomedSource = (decisionText || '').trim() || 'MANUAL/API';
        }

        return {
        listType: listTypeLabel,
        readCode: String(readCodeRaw).trim(),
        readCodeBase,           // <-- NEW (blank unless "Last Entry for ...")
        label,
        decision: decisionText,
        decisionClass,          // human readable
        snomedConcept,
        snomedSource,
        tip: decisionTip
        };
    });
    }

  function extractConceptIdFromTip(tip) {
    const s = String(tip || '');

    // SNOMED CT concept ids are integers (often 6–18 digits). Grab the first such token.
    const m = s.match(/\b\d{6,18}\b/);
    return m ? m[0] : '';
    }

    function looksLikeManualOrApiMap(decisionText, tip) {
    const d = String(decisionText || '').trim().toLowerCase();
    const t = String(tip || '').toLowerCase();
    return d === 'manualmap' || d === 'apimap' || t.includes('manualmap') || t.includes('apimap');
    }

  function decisionMeaning(decisionText, decisionClass) {
    const d = (decisionText || '').trim();
    const cls = (decisionClass || '').trim();

    // Normalise a couple of common glyph variants people paste in
    const isSwap = (d === '↔' || d === '↔︎' || d === '⇄');
    const isCheck = (d === '✔' || d === '✓');
    const isCross = (d === '✗' || d === '✕' || d === '×');

    // --- exact mappings you requested ---
    if (d === 'NHS' && cls.includes('badge--ok')) return 'NHS Digital Mapping';
    if (d === 'NHS' && cls.includes('badge--loose')) return 'No valid active SNOMED map';
    if (d === 'NHS' && cls.includes('badge--nhs-replaced')) return 'NHS Digital Mapping updated using NHS SNOMED browser';

    if (isSwap && cls.includes('badge--ok')) return 'Automatically mapped to SNOMED (concept with same term)';
    if (isSwap && (cls.includes('badge--warn') || cls.includes('badge--loose'))) return 'Manually mapped to SNOMED concept (best guess)';

    if (isCheck) return 'Needs local code or DMS SNOMED extension';
    if (isCross) return 'Needs converting to text or Inactive concept in DMS SNOMED extension';

    // --- extra combos / sensible fallbacks (so TSV stays informative) ---
    if (d === 'NHS' && (cls.includes('badge--warn') || cls.includes('badge--miss'))) {
        return 'NHS mapping present but flagged for review';
    }

    if (isSwap && cls.includes('badge--miss')) return 'Automatic mapping failed (needs review)';
    if (isSwap) return 'SNOMED mapping indicator (needs review)';

    if (d) return `Unrecognised decision (${d}${cls ? ', ' + cls : ''})`;
    if (cls) return `Unrecognised decision class (${cls})`;
    return 'Unknown';
    }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/tab-separated-values;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function scrapeList(listId, listTypeLabel) {
    const ul = document.getElementById(listId);
    if (!ul) return [];

    const rows = Array.from(ul.querySelectorAll('li.rc-row'));
    return rows.map(li => {
      const readCode =
        li.getAttribute('data-read-code') ||
        li.querySelector('.rc-code')?.textContent ||
        '';

      // label might have a leading " — " in some malformed entries; trim it.
      let label = li.querySelector('.rc-label')?.textContent || '';
      label = label.replace(/^\s*—\s*/, '').trim();

      const decisionEl = li.querySelector('.rc-decision');
        const decisionText = decisionEl?.textContent?.trim() || '';
        const decisionTip = decisionEl?.getAttribute('data-tip') || '';

        let snomedConcept = li.getAttribute('data-snomed-concept') || '';
        let snomedSource  = li.getAttribute('data-snomed-source') || '';

        // If this row is ManualMap or APIMap and the li doesn't already carry data-snomed-concept,
        // extract ConceptId from the hover tip.
        if (!snomedConcept && looksLikeManualOrApiMap(decisionText, decisionTip)) {
        snomedConcept = extractConceptIdFromTip(decisionTip) || '';
        if (!snomedSource) {
            // Keep provenance useful even if the li didn't include a source
            snomedSource = (decisionText || '').trim() || 'MANUAL/API';
        }
    }

      // Useful for debugging / provenance (optional but handy)
      const decisionClassRaw =
        Array.from(decisionEl?.classList || [])
            .filter(c => c.startsWith('badge--'))
            .join(' ') || '';

        const decisionClass = decisionMeaning(decisionText, decisionClassRaw);

      return {
        listType: listTypeLabel,
        readCode: readCode.trim(),
        label,
        decision: decisionText,
        decisionClass,
        snomedConcept,
        snomedSource,
        tip: decisionTip
      };
    });
  }

  function exportReadCodePanelTSV() {
    // scrape both lists
    const dataEntryUl = nextUlAfterHeadingText('Data Entry Read codes in form');
    const diaryUl     = nextUlAfterHeadingText('Diary entry codes');

    const a = scrapeUl(dataEntryUl, 'DataEntry');
    const b = scrapeUl(diaryUl, 'Diary');

    const all = [...a, ...b];

    if (!all.length) {
      console.warn('No rc-row items found in #readcode-list or #diarycode-list.');
      // still export headers so user can see file shape
    }

    const headers = [
      'listType',
      'readCode',
      'readCodeBase', 
      'label',
      'decision',
      'decisionClass',
      'snomedConcept',
      'snomedSource',
      'tip'
    ];

    const lines = [];
    lines.push(headers.join('\t'));
    all.forEach(r => {
      lines.push(headers.map(h => tsvEscape(r[h])).join('\t'));
    });

    const base = inferBaseTitle();
    downloadText(`${base}_readcodes_in_form.tsv`, lines.join('\n'));
  }

  // ---- Button: mount alongside the others ----
  const mount = document.getElementById('export-buttons-mount');
  if (!mount) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Export TSV from the right panel: "Data Entry Read codes in form"';
  btn.style.marginLeft = '5px';
  btn.style.padding = '6px 10px';
  btn.style.fontSize = '12px';
  btn.style.border = '1px solid #888';
  btn.style.borderRadius = '4px';
  btn.style.background = '#f5f5f5';
  btn.style.cursor = 'pointer';
  btn.style.transition = 'background 0.2s, box-shadow 0.2s';

  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#eaeaea';
    btn.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#f5f5f5';
    btn.style.boxShadow = 'none';
  });
  btn.addEventListener('mousedown', () => { btn.style.background = '#ddd'; });
  btn.addEventListener('mouseup',   () => { btn.style.background = '#eaeaea'; });

  btn.textContent = '→ Data Entry Codes (TSV)';
  btn.addEventListener('click', exportReadCodePanelTSV);
  mount.appendChild(btn);
})();