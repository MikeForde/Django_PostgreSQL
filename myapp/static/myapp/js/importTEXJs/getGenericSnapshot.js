(function(){
  // ===== Shared DOM helpers =====
  const CANVAS = document.getElementById('canvas') || document;
  function qa(sel, root=CANVAS){ return Array.from(root.querySelectorAll(sel)); }
  function txt(n){ return (n && (n.textContent || '').trim()) || ''; }

  function geomFrom(el){
    const s = getComputedStyle(el);
    function px(n){ return parseInt(n,10) || 0; }
    return { x: px(s.left), y: px(s.top), w: px(s.width), h: px(s.height) };
  }

  function decodeUnicodeEscapes(str){
    if (!str) return '';
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, g1) =>
      String.fromCharCode(parseInt(g1, 16))
    );
  }

  function readcodeInfo(el){
    const host = el.closest('.readcode-host');
    if (!host) return [];

    let blob = host.getAttribute('data-readcodes') || '';
    blob = decodeUnicodeEscapes(blob);
    blob = blob.replace(/\\u000A/gi, '\n');

    const rawLines = blob.split(/\r?\n/).filter(Boolean);

    // look for 'Auto-Entered Text:'
    let autoText = '';
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) {
        autoText = line.replace(/^\s*Auto-Entered Text\s*:\s*/i,'').trim();
      }
    });

    const out = [];
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) return;
      const m = line.split('—');
      const code  = (m[0] || '').trim();
      const label = (m.slice(1).join('—') || '').trim();
      if (code || label) {
        out.push({
          code,
          label,
          autoText,
          desc: code ? `Readcode: ${code}` : undefined
        });
      }
    });
    return out;
  }

  function buildTooltipFromReadcodeMeta(metaArray){
    if (!metaArray || !metaArray.length) return undefined;
    const lines = [];
    metaArray.forEach(m => {
      if (!m) return;
      const c = (m.code || '').trim();
      const l = (m.label || '').trim();
      const a = (m.autoText || '').trim();
      if (c || l) {
        lines.push(c && l ? (c + ' = ' + l) : (c || l));
      }
      if (a) {
        lines.push('Auto: ' + a);
      }
    });
    if (!lines.length) return undefined;
    return lines.join('\n');
  }

  // ===== helpers for generic model =====
  function uniqueIdFromLabel(labelBase, hint=''){
    const raw = (labelBase || '').trim() || 'field';
    const base = raw + (hint ? ('_' + hint) : '');
    return base
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) + '_' +
      Math.random().toString(36).slice(2,8);
  }

  function isClassicReadCode(ctrl){
    return !!(
      ctrl.querySelector('.rc-wrap') ||
      ctrl.querySelector('.rc-yesno') ||
      ctrl.querySelector('.rc-chk')   ||
      ctrl.querySelector('.rc-prompt')
    );
  }

  function hasAnyFormInputs(root){
    return !!root.querySelector(
      'select,textarea,input[type="text"],input[type="date"],input[type="number"],input[type="checkbox"],input[type="radio"]'
    );
  }

  // ----- findLabelFor with the 2 fixes (next-sibling, and gated Last Entry) -----
  function makeFindLabelFor(ctrl){
    return function findLabelFor(el){
      // for=?
      if (el.id) {
        const m = ctrl.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (m) return txt(m);
      }

      // wrapped label
      const wrap = el.closest('label');
      if (wrap) return txt(wrap);

      // previous sibling label-ish
      let p = el.previousElementSibling;
      if (p && /^(LABEL|SPAN|STRONG)$/i.test(p.tagName)) {
        const tPrev = txt(p);
        if (tPrev) return tPrev;
      }

      // NEXT sibling label-ish (for "checkbox then label on right")
      let n = el.nextElementSibling;
      if (n && /^(LABEL|SPAN|STRONG)$/i.test(n.tagName)) {
        const tNext = txt(n);
        if (tNext) return tNext;
      }

      // fieldset legend
      const fs = el.closest('fieldset');
      const lg = fs?.querySelector('legend');
      if (lg) return txt(lg);

      // special audit "last entry" fallback ONLY if tpl-lastentry is involved
      const isAuditStyle = el.classList.contains('tpl-lastentry') ||
                           el.closest('.tpl-lastentry');
      if (isAuditStyle) {
        const metaArray = readcodeInfo(el);
        if (metaArray && metaArray.length) {
          const first = metaArray[0];
          if (first && first.code) {
            return `Last Entry for ${first.code}`;
          }
        }
        const host = el.closest('.readcode-host');
        const rcBlob = host?.getAttribute('data-readcodes') || '';
        const m = rcBlob.match(/Last\s*Entry\s*for\s*(.+?)\s*$/i);
        if (m) {
          return `Last Entry for ${m[1].trim()}`;
        }
      }

      // fallback
      return el.name || el.placeholder || 'Field';
    };
  }

  // ----- mapper: ReadCode -> generic compound/text/number/date/radio -----
  function toGenericFromReadCode(ctrl){
    const geom = geomFrom(ctrl);

    const labelText = (ctrl.querySelector('.rc-prompt')?.textContent || '').trim() || 'Read code';

    const metaArray = readcodeInfo(ctrl);
    const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

    const yesInput = ctrl.querySelector('.rc-yes-label input.rc-yesno');
    const noInput  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
    const hasYesNo = !!(yesInput || noInput);

    const textEl   = ctrl.querySelector('input[type="text"][name$="_text"]');
    const valEl    = ctrl.querySelector('input[type="text"][name$="_val"]');
    const dateEl   = ctrl.querySelector('input[type="date"]');

    const hasText  = !!textEl;
    const hasVal   = !!valEl;
    const hasDate  = !!dateEl;

    const unitText = (() => {
      const span = valEl?.nextElementSibling;
      const t = span && span.tagName === 'SPAN' ? span.textContent.trim() : '';
      return t || '';
    })();

    const parts = [];

    if (hasYesNo){
      const yesVal = yesInput?.value || 'yes';
      const noVal  = noInput?.value  || 'no';
      const defVal =
        (yesInput?.checked ? yesVal :
         (noInput?.checked ? noVal : ''));

      parts.push({
        subKind: 'yesno',
        label: labelText,
        options: [
          { value: yesVal, label: 'Yes' },
          { value: noVal,  label: 'No'  }
        ],
        defaultValue: defVal
      });
    }

    if (hasText){
      parts.push({
        subKind: 'text',
        label: hasYesNo ? (labelText + ' (text)') : labelText,
        defaultText: textEl?.value || '',
        required: textEl?.hasAttribute('required') || false
      });
    }

    if (hasVal){
      parts.push({
        subKind: 'number',
        label: hasYesNo ? (labelText + ' (value)') : labelText,
        defaultNumber: valEl?.value ? Number(valEl.value) : null,
        unit: unitText || '',
        required: valEl?.hasAttribute('required') || false
      });
    }

    if (hasDate){
      parts.push({
        subKind: 'date',
        label: hasYesNo ? (labelText + ' (date)') : (labelText + ' (date)'),
        defaultDate: dateEl?.value || '',
        required: dateEl?.hasAttribute('required') || false
      });
    }

    // collapse simple single-part cases
    if (parts.length === 1) {
      const p = parts[0];
      if (p.subKind === 'text') {
        return [{
          id: uniqueIdFromLabel(labelText),
          kind: 'text',
          label: p.label,
          tooltip: unifiedTooltip,
          ui: { ...geom },
          data: { defaultText: p.defaultText || '' },
          flags: {
            required: !!p.required,
            readcodeDerived: true
          }
        }];
      }

      if (p.subKind === 'number') {
        return [{
          id: uniqueIdFromLabel(labelText),
          kind: 'number',
          label: p.label,
          tooltip: unifiedTooltip,
          ui: { ...geom },
          data: {
            defaultNumber: p.defaultNumber,
            unit: p.unit || ''
          },
          flags: {
            required: !!p.required,
            readcodeDerived: true
          }
        }];
      }

      if (p.subKind === 'date') {
        return [{
          id: uniqueIdFromLabel(labelText),
          kind: 'date',
          label: p.label,
          tooltip: unifiedTooltip,
          ui: { ...geom },
          data: {
            defaultDate: p.defaultDate || ''
          },
          flags: {
            required: !!p.required,
            readcodeDerived: true
          }
        }];
      }

      if (p.subKind === 'yesno') {
        return [{
          id: uniqueIdFromLabel(labelText),
          kind: 'radio',
          label: p.label,
          tooltip: unifiedTooltip,
          ui: { ...geom },
          data: {
            options: p.options,
            defaultValue: p.defaultValue
          },
          flags: {
            required: false,
            readcodeDerived: true
          }
        }];
      }
    }

    // otherwise it's compound
    return [{
      id: uniqueIdFromLabel(labelText),
      kind: 'compound',
      label: labelText,
      tooltip: unifiedTooltip,
      ui: { ...geom },
      data: {
        parts,
        entries: metaArray
      },
      flags: {
        readcodeDerived: true
      }
    }];
  }

  // ----- mapper: ReadList -> generic select-multi/select-single/radio/etc -----
  function toGenericFromReadList(ctrl){
    const geom = geomFrom(ctrl);
    const metaArray = readcodeInfo(ctrl);
    const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

    const msWrap = ctrl.querySelector('.ms');
    if (msWrap) {
      const msLabelText = txt(msWrap.querySelector('.ms-label')) || 'List';
      const checkLabels = Array.from(msWrap.querySelectorAll('.ms-panel label'));
      const options = [];
      const defaults = [];
      checkLabels.forEach(lab => {
        const inp = lab.querySelector('input[type="checkbox"]');
        if (!inp) return;
        const value = inp.value || '';
        let lbl = (lab.textContent || '').trim();
        if (value && lbl.startsWith(value)) {
          lbl = lbl.replace(value,'').trim();
        }
        options.push({ value, label: lbl || value });
        if (inp.checked) defaults.push(value);
      });
      return [{
        id: uniqueIdFromLabel(msLabelText),
        kind: 'select-multi',
        label: msLabelText,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: { options, defaultValues: defaults },
        flags: { multiSelect: true }
      }];
    }

    const select = ctrl.querySelector('select');
    if (select) {
      const capGuess =
        (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
        (ctrl.querySelector('label')?.textContent || '').trim() ||
        'List';

      const rawOptions = Array.from(select.querySelectorAll('option'))
        .filter(o => (o.value || (o.textContent||'').trim()));
      const builtOptions = rawOptions.map(o => ({
        value: o.value || (o.textContent||'').trim(),
        label: (o.textContent||'').trim() || o.value || ''
      }));

      const multiple = !!select.multiple;

      let labelFinal = capGuess;
      let finalOptions = builtOptions.slice();

      if (!multiple && builtOptions.length >= 2) {
        const capIsGeneric = !capGuess || capGuess.toLowerCase() === 'list';
        if (capIsGeneric) {
          const firstOpt = builtOptions[0];
          if (firstOpt && firstOpt.label) {
            labelFinal = firstOpt.label;
            finalOptions = builtOptions.slice(1);
          }
        }
      }

      let defaultValues = [];
      let defaultValue = '';
      if (multiple) {
        defaultValues = Array.from(select.selectedOptions || []).map(o => o.value);
      } else {
        defaultValue = select.value || '';
      }

      return [{
        id: uniqueIdFromLabel(labelFinal),
        kind: multiple ? 'select-multi' : 'select-single',
        label: labelFinal,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: multiple ? {
          options: finalOptions,
          defaultValues
        } : {
          options: finalOptions,
          defaultValue
        },
        flags: { multiSelect: multiple }
      }];
    }

    const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
    if (checks.length) {
      const cap =
        (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
        (ctrl.querySelector('label')?.textContent || '').trim() ||
        'List';

      const options = [];
      const defaults = [];
      checks.forEach(ch => {
        const lbl = (ch.closest('label')?.textContent || ch.value || 'Option').trim();
        const value = (lbl || '').replace(/\s+/g,'_');
        options.push({ value, label: lbl });
        if (ch.checked) defaults.push(value);
      });

      return [{
        id: uniqueIdFromLabel(cap),
        kind: 'select-multi',
        label: cap,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: {
          options,
          defaultValues: defaults
        },
        flags: { multiSelect: true }
      }];
    }

    const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
    if (radios.length) {
      const cap =
        (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
        (ctrl.querySelector('label')?.textContent || '').trim() ||
        'List';

      const seen = new Set();
      const options = [];
      radios.forEach(r => {
        let lbl = (r.closest('label')?.textContent || r.value || 'Option').trim();
        const val = r.value || lbl.replace(/\s+/g,'_');
        if (!seen.has(val)) {
          seen.add(val);
          options.push({ value: val, label: lbl });
        }
      });
      const def = (radios.find(r => r.checked)?.value) || '';

      return [{
        id: uniqueIdFromLabel(cap),
        kind: 'radio',
        label: cap,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: {
          options,
          defaultValue: def
        },
        flags: {}
      }];
    }

    const cap2 =
      (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
      (ctrl.querySelector('label')?.textContent || '').trim() ||
      'List';

    return [{
      id: uniqueIdFromLabel(cap2),
      kind: 'label',
      label: cap2,
      tooltip: unifiedTooltip,
      ui: { ...geom },
      data: {},
      flags: {}
    }];
  }

  // ----- mapper: generic ctrl (checkboxes, textfields, etc.) -----
  function toGenericFromGenericControls(ctrl){
    const geom = geomFrom(ctrl);
    const out = [];
    const findLabelFor = makeFindLabelFor(ctrl);

    // radios grouped
    const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
    const groupMap = new Map();
    radios.forEach(r => {
      const name = r.name || '_radio_' + Math.random().toString(36).slice(2);
      if (!groupMap.has(name)) groupMap.set(name, []);
      groupMap.get(name).push(r);
    });
    groupMap.forEach(group => {
      const label = findLabelFor(group[0]);
      const opts = [];
      const seenVals = new Set();
      group.forEach(r => {
        let lbl = (r.closest('label')?.textContent || '').trim();
        if (!lbl) {
          const sib = r.nextSibling;
          if (sib && sib.nodeType === 3) {
            lbl = (sib.nodeValue || '').trim();
          }
        }
        if (!lbl) lbl = r.value || 'Option';

        const val = r.value || lbl.replace(/\s+/g,'_');
        if (!seenVals.has(val)){
          seenVals.add(val);
          opts.push({ value: val, label: lbl });
        }
      });
      const defVal = (group.find(r => r.checked)?.value) || '';
      const metaArray = readcodeInfo(group[0]);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
      out.push({
        id: uniqueIdFromLabel(label),
        kind: 'radio',
        label,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: {
          options: opts,
          defaultValue: defVal
        },
        flags: {}
      });
    });

    // selects
    const selects = Array.from(ctrl.querySelectorAll('select'));
    selects.forEach(sel => {
      const label = findLabelFor(sel);
      const opts = Array.from(sel.querySelectorAll('option')).map(o => ({
        value: o.value || txt(o),
        label: txt(o) || o.value || ''
      })).filter(o => o.value || o.label);

      const multiple = !!sel.multiple;
      const defVals = multiple
        ? Array.from(sel.selectedOptions || []).map(o => o.value || txt(o))
        : [];
      const defVal = multiple ? '' : (sel.value || '');

      const metaArray = readcodeInfo(sel);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
      out.push({
        id: uniqueIdFromLabel(label),
        kind: multiple ? 'select-multi' : 'select-single',
        label,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: multiple ? {
          options: opts,
          defaultValues: defVals
        } : {
          options: opts,
          defaultValue: defVal
        },
        flags: { multiSelect: multiple }
      });
    });

    // checkboxes
    const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
    checks.forEach(ch => {
      const label = findLabelFor(ch);
      const metaArray = readcodeInfo(ch);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
      out.push({
        id: uniqueIdFromLabel(label),
        kind: 'checkbox',
        label,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: {
          checked: !!ch.checked
        },
        flags: {
          required: ch.hasAttribute('required')
        }
      });
    });

    // dates
    const dates = Array.from(ctrl.querySelectorAll('input[type="date"]'));
    dates.forEach(d => {
      const label = findLabelFor(d);
      const metaArray = readcodeInfo(d);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
      out.push({
        id: uniqueIdFromLabel(label),
        kind: 'date',
        label,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: {
          defaultDate: d.value || ''
        },
        flags: {
          required: d.hasAttribute('required')
        }
      });
    });

    // textareas
    const areas = Array.from(ctrl.querySelectorAll('textarea'));
    areas.forEach(a => {
      const label = findLabelFor(a);
      const metaArray = readcodeInfo(a);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
      out.push({
        id: uniqueIdFromLabel(label),
        kind: 'textarea',
        label,
        tooltip: unifiedTooltip,
        ui: { ...geom },
        data: {
          rows: Math.max(1, parseInt(a.getAttribute('rows') || '3', 10)),
          defaultText: a.value || ''
        },
        flags: {
          required: a.hasAttribute('required')
        }
      });
    });

    // text/number
    const texts = Array.from(ctrl.querySelectorAll('input[type="text"],input[type="number"]'))
      .filter(i => !i.readOnly);
    texts.forEach(ti => {
      const label = findLabelFor(ti);
      const metaArray = readcodeInfo(ti);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

      if (ti.type === 'number') {
        out.push({
          id: uniqueIdFromLabel(label),
          kind: 'number',
          label,
          tooltip: unifiedTooltip,
          ui: { ...geom },
          data: {
            defaultNumber: ti.value ? Number(ti.value) : null
          },
          flags: {
            required: ti.hasAttribute('required')
          }
        });
      } else {
        out.push({
          id: uniqueIdFromLabel(label),
          kind: 'text',
          label,
          tooltip: unifiedTooltip,
          ui: { ...geom },
          data: {
            defaultText: ti.value || ''
          },
          flags: {
            required: ti.hasAttribute('required')
          }
        });
      }
    });

    // if nothing else, emit label block
    if (!out.length) {
      const leg = ctrl.querySelector('legend');
      if (leg) {
        out.push({
          id: uniqueIdFromLabel(txt(leg)),
          kind: 'label',
          label: txt(leg),
          tooltip: undefined,
          ui: { ...geom },
          data: {},
          flags: {}
        });
      } else {
        const anyLabel = ctrl.querySelector('label');
        if (anyLabel) {
          out.push({
            id: uniqueIdFromLabel(txt(anyLabel)),
            kind: 'label',
            label: txt(anyLabel),
            tooltip: undefined,
            ui: { ...geom },
            data: {},
            flags: {}
          });
        }
      }
    }

    return out;
  }

  function toGenericFromLabelOrLink(ctrl){
    const geom = geomFrom(ctrl);
    const a = ctrl.querySelector('a[href]');
    if (a) {
      return [{
        id: uniqueIdFromLabel(txt(a) || a.href),
        kind: 'link',
        label: txt(a) || a.href,
        tooltip: undefined,
        ui: { ...geom },
        data: { href: a.href },
        flags: {}
      }];
    }
    const labelEl = ctrl.querySelector('label');
    if (labelEl) {
      return [{
        id: uniqueIdFromLabel(txt(labelEl)),
        kind: 'label',
        label: txt(labelEl),
        tooltip: undefined,
        ui: { ...geom },
        data: {},
        flags: {}
      }];
    }
    return [];
  }

  // walk all .ctrl
  function collectGenericControls(){
    const controls = qa('.ctrl');
    const generic = [];
    controls.forEach(ctrl => {
      let added = [];
      if (isClassicReadCode(ctrl)) {
        added = toGenericFromReadCode(ctrl);
      } else if (
        ctrl.querySelector('.rl-wrap, select[name^="Readlist"], select[id^="Readlist"]')
      ) {
        added = toGenericFromReadList(ctrl);
      } else if (hasAnyFormInputs(ctrl)) {
        added = toGenericFromGenericControls(ctrl);
      } else {
        added = toGenericFromLabelOrLink(ctrl);
      }
      if (added && added.length) generic.push(...added);
    });
    return generic;
  }

  function getSelectedTexName(){
    const label = document.getElementById('selected-tex-label')?.textContent?.trim();
    if (label && label.toLowerCase() !== 'no tex file selected') return label;
    const libSel = document.querySelector('#lib-pane-list select');
    if (libSel && libSel.value) return libSel.value;
    const h1 = document.querySelector('h1')?.textContent?.trim();
    return h1 || 'Imported_TEX';
  }

  function makeBaseTitleFromTexName(name){
    let base = String(name || '').trim();
    base = base.replace(/\.[Tt][Ee][Xx]$/, '');
    base = base.replace(/\s+/g, '_');
    base = base || 'Imported_TEX';
    return base;
  }

  // PUBLIC: return neutral snapshot
  function getGenericSnapshot(){
    const texNameRaw = getSelectedTexName();
    const baseTitle  = makeBaseTitleFromTexName(texNameRaw);
    const genericControls = collectGenericControls();
    return {
      texName: texNameRaw,
      title: baseTitle,
      scrapedAtISO: new Date().toISOString(),
      controls: genericControls
    };
  }

  // expose for other scripts
  window.getGenericSnapshot = getGenericSnapshot;
})();
