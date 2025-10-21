(function(){
  // ------ small helper UI button ------------------------------------------------
  function addExportButton(){
    const toolbar = document.querySelector('form[method="post"]') || document.body;
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Export to Form.io JSON';
    btn.style.marginLeft = '10px';
    btn.style.padding = '6px 10px';
    btn.style.fontSize = '12px';
    btn.addEventListener('click', exportToFormio);
    // put it near the existing Render button if possible
    const renderBtn = toolbar.querySelector('button[type="submit"]');
    if (renderBtn && renderBtn.parentNode) {
      renderBtn.parentNode.appendChild(btn);
    } else {
      toolbar.appendChild(btn);
    }
  }

  // ------ DOM helpers -----------------------------------------------------------
  const CANVAS = document.getElementById('canvas') || document; // outer eForm canvas
  function q(sel, root=CANVAS){ return root.querySelector(sel); }
  function qa(sel, root=CANVAS){ return Array.from(root.querySelectorAll(sel)); }
  function txt(n){ return (n && (n.textContent || '').trim()) || ''; }
  function val(n){ return (n && (n.value || '').trim()) || ''; }

  // Slugify -> Form.io `key` (must be unique)
  function keyify(s){
    return (s || '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, '_$1')
      .slice(0, 80) || ('k_' + Math.random().toString(36).slice(2));
  }

  // Unique key generator
  const takenKeys = new Set();
  function uniqueKey(base){
    let k = keyify(base);
    if (!takenKeys.has(k)) { takenKeys.add(k); return k; }
    let i = 2;
    while (takenKeys.has(k + '_' + i)) i++;
    k = k + '_' + i;
    takenKeys.add(k);
    return k;
  }

  // Try to read original geometry from the wrapper .ctrl if present
  function geomFrom(el){
    const s = getComputedStyle(el);
    function px(n){ return parseInt(n, 10) || 0; }
    return { x: px(s.left), y: px(s.top), w: px(s.width), h: px(s.height) };
  }

  // Extract useful metadata from readcode host
  function readcodeMeta(host){
    const blob = host.getAttribute('data-readcodes') || '';
    const lines = blob.replace(/\\u000A/gi, '\n').split(/\r?\n/).filter(Boolean);
    let code = '', label = '';
    for (const line of lines){
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) continue;
      const m = line.split('—');
      code  = (m[0] || '').trim();
      label = (m.slice(1).join('—') || '').trim();
      break;
    }
    const autoLine = lines.find(l => /^\s*Auto-Entered Text\s*:/i.test(l));
    let autoText = '';
    if (autoLine) autoText = autoLine.replace(/^\s*Auto-Entered Text\s*:\s*/i,'').trim();
    return { code, label, autoText };
  }

  // Make a basic htmlelement
  function makeHtmlEl(content, tag='p'){
    return {
      type: 'htmlelement',
      tag,
      key: uniqueKey('content_' + content.slice(0,30)),
      input: false,
      content,
      hideLabel: true,
      attrs: [{attr:'', value:''}],
      className: '',
      properties: {}
    };
  }

  // --------- MAPPERS ------------------------------------------------------------
  function mapReadCode(ctrl){
    const out = [];
    const labelText = (ctrl.querySelector('.rc-prompt')?.textContent || '').trim() || 'Read code';
    const readcode  = (ctrl.querySelector('input[type="hidden"][name$="_readcode"]')?.value || '').trim();

    const keyFrom = (base, hint='') => {
      const raw = (base || '').replace(/\s+/g,' ').trim() || 'field';
      const key = keyify(raw + (hint ? (' ' + hint) : ''));
      if (!takenKeys.has(key)) { takenKeys.add(key); return key; }
      let i = 2, k; do { k = key + i++; } while (takenKeys.has(k));
      takenKeys.add(k); return k;
    };

    const yesInput = ctrl.querySelector('.rc-yes-label input.rc-yesno');
    const noInput  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
    const hasYesNo = !!(yesInput || noInput);

    const hasChk   = !!ctrl.querySelector('input.rc-chk'); // simple checkbox (non-question)
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

    // TEXT (+ optional DATE)
    if (hasText && !hasYesNo && !hasVal){
      out.push({
        type: 'textfield', input: true, key: keyFrom(labelText), label: labelText,
        tableView: true, labelPosition: 'left-left', inputFormat: 'plain',
        validate: { required: textEl.hasAttribute('required') },
        description: readcode ? `Readcode: ${readcode}` : undefined,
        tooltip: textEl.title || undefined
      });
      if (hasDate){
        out.push({
          type: 'datetime', input: true, key: keyFrom(labelText, 'date'),
          label: `${labelText} (date)`, labelPosition: 'left-left', tableView: true,
          enableDate: true, enableTime: false, datePicker: { showWeeks: true },
          validate: { required: dateEl.hasAttribute('required') },
          description: readcode ? `Readcode: ${readcode}` : undefined,
          tooltip: dateEl.title || undefined
        });
      }
      return out;
    }

    // DATE only
    if (hasDate && !hasYesNo && !hasVal){
      out.push({
        type: 'datetime', input: true, key: keyFrom(labelText), label: labelText,
        labelPosition: 'left-left', tableView: true, enableDate: true, enableTime: false,
        datePicker: { showWeeks: true }, validate: { required: dateEl.hasAttribute('required') },
        description: readcode ? `Readcode: ${readcode}` : undefined, tooltip: dateEl.title || undefined
      });
      return out;
    }

    // VALUE only
    if (hasVal && !hasYesNo && !hasText && !hasDate){
      out.push({
        type: 'number', input: true, key: keyFrom(labelText), label: labelText, tableView: true,
        labelPosition: 'left-left', suffix: unitText || undefined,
        validate: { required: valEl.hasAttribute('required'), step: 'any' },
        description: readcode ? `Readcode: ${readcode}` : undefined, tooltip: valEl.title || undefined
      });
      return out;
    }

    // YES/NO question -> radio
    if (hasYesNo){
      const yesVal = yesInput?.value || 'yes';
      const noVal  = noInput?.value  || 'no';
      const yesChecked = !!(yesInput && yesInput.checked);
      const noChecked  = !!(noInput  && noInput.checked);

      out.push({
        type: 'radio', input: true, key: keyFrom(labelText), label: labelText, tableView: true, inline: true,
        values: [ { value: yesVal, label: 'Yes', shortcut: '' }, { value: noVal, label: 'No', shortcut: '' } ],
        defaultValue: yesChecked ? yesVal : (noChecked ? noVal : ''),
        properties: { kind: 'QuestionReadCode', readcode: yesVal, negcode: noVal },
        description: readcode ? `Readcode: ${readcode}` : undefined
      });

      if (hasText){
        out.push({
          type: 'textfield', input: true, key: keyFrom(labelText, 'text'),
          label: `${labelText} (text)`, tableView: true, labelPosition: 'left-left', inputFormat: 'plain',
          validate: { required: textEl.hasAttribute('required') },
          description: readcode ? `Readcode: ${readcode}` : undefined
        });
      }
      if (hasVal){
        out.push({
          type: 'number', input: true, key: keyFrom(labelText, 'value'),
          label: `${labelText} (value)`, tableView: true, labelPosition: 'left-left', suffix: unitText || undefined,
          validate: { required: valEl.hasAttribute('required'), step: 'any' },
          description: readcode ? `Readcode: ${readcode}` : undefined
        });
      }
      if (hasDate){
        out.push({
          type: 'datetime', input: true, key: keyFrom(labelText, 'date'),
          label: `${labelText} (date)`, labelPosition: 'left-left', tableView: true, enableDate: true, enableTime: false,
          datePicker: { showWeeks: true }, validate: { required: dateEl.hasAttribute('required') },
          description: readcode ? `Readcode: ${readcode}` : undefined
        });
      }
      return out;
    }

    // Simple checkbox
    if (hasChk){
      out.push({
        type: 'checkbox', input: true, key: keyFrom(labelText, 'chk'),
        label: labelText, labelPosition: 'left', tableView: true,
        tooltip: readcode ? `Readcode: ${readcode}` : undefined
      });

      if (hasText){
        out.push({
          type: 'textfield', input: true, key: keyFrom(labelText, 'text'),
          label: `${labelText} (text)`, tableView: true, labelPosition: 'left-left', inputFormat: 'plain',
          validate: { required: textEl.hasAttribute('required') },
          description: readcode ? `Readcode: ${readcode}` : undefined
        });
      }
      if (hasVal){
        out.push({
          type: 'number', input: true, key: keyFrom(labelText, 'value'),
          label: `${labelText} (value)`, tableView: true, labelPosition: 'left-left', suffix: unitText || undefined,
          validate: { required: valEl.hasAttribute('required'), step: 'any' },
          description: readcode ? `Readcode: ${readcode}` : undefined
        });
      }
      if (hasDate){
        out.push({
          type: 'datetime', input: true, key: keyFrom(labelText, 'date'),
          label: `${labelText} (date)`, labelPosition: 'left-left', tableView: true, enableDate: true, enableTime: false,
          datePicker: { showWeeks: true }, validate: { required: dateEl.hasAttribute('required') },
          description: readcode ? `Readcode: ${readcode}` : undefined
        });
      }
      return out;
    }

    // Fallback
    out.push({ type:'htmlelement', key: keyFrom(labelText, 'label'), tag:'p', content: labelText, hideLabel:true, input:false });
    return out;
  }

  function mapReadList(ctrl){
    const geom = geomFrom(ctrl);
    const cap =
      txt(ctrl.querySelector('.rl-caption')) ||
      txt(ctrl.querySelector('label')) ||
      'List';

    const select = ctrl.querySelector('select');
    if (select) {
      const opts = Array.from(select.querySelectorAll('option'))
        .filter(o => o.value || txt(o))
        .map(o => ({ value: o.value || txt(o), label: txt(o) || o.value }));

      const multiple = !!select.multiple;
      return [{
        type: 'select',
        key: uniqueKey('select_' + cap),
        label: cap,
        input: true,
        tableView: true,
        dataSrc: 'values',
        data: { values: opts },
        multiple,
        defaultValue: multiple
          ? (Array.from(select.selectedOptions || []).map(o => o.value))
          : (select.value || ''),
        template: '<span>{{ item.label }}</span>',
        properties: { kind: 'ReadList', x: geom.x, y: geom.y, w: geom.w, h: geom.h }
      }];
    }

    const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
    if (checks.length) {
      const values = checks.map(ch => {
        const lbl = txt(ch.closest('label')) || ch.value || 'Option';
        const value = keyify(lbl) || ('opt_' + Math.random().toString(36).slice(2));
        return { label: lbl, value, shortcut: '' };
      });
      const def = {};
      checks.forEach(ch => {
        const lbl = txt(ch.closest('label')) || ch.value || 'Option';
        const value = keyify(lbl);
        if (value) def[value] = !!ch.checked;
      });
      return [{
        type: 'selectboxes',
        key: uniqueKey('selectboxes_' + cap),
        label: cap,
        input: true,
        tableView: true,
        values,
        defaultValue: def,
        properties: { kind: 'ReadListMulti', x: geom.x, y: geom.y, w: geom.w, h: geom.h }
      }];
    }

    const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
    if (radios.length) {
      const seen = new Map();
      const values = [];
      radios.forEach(r => {
        const lbl = txt(r.closest('label')) || r.value || 'Option';
        const v = r.value || keyify(lbl);
        if (!seen.has(v)) {
          seen.set(v, true);
          values.push({ value: v, label: lbl, shortcut: '' });
        }
      });
      const def = (radios.find(r => r.checked) || {}).value || '';
      return [{
        type: 'radio',
        key: uniqueKey('radio_' + cap),
        label: cap,
        input: true,
        tableView: true,
        inline: true,
        values,
        defaultValue: def,
        properties: { kind: 'ReadListExclusive', x: geom.x, y: geom.y, w: geom.w, h: geom.h }
      }];
    }

    return [makeHtmlEl(cap)];
  }

  function mapLabelOrLink(ctrl){
    const a = ctrl.querySelector('a[href]');
    if (a) {
      return [ {
        type: 'htmlelement', tag:'a', key: uniqueKey('link_' + txt(a)), input:false,
        content: txt(a) || a.href, hideLabel:true,
        attrs: [{ attr:'href', value:a.href }],
        className:'', properties:{ kind:'Url', href:a.href, ...geomFrom(ctrl) }
      } ];
    }
    const labelEl = ctrl.querySelector('label');
    if (labelEl) return [ makeHtmlEl(labelEl.textContent || 'Label') ];
    return [];
  }

  function exportToFormio(){
    takenKeys.clear();

    function getSelectedTexName(){
      const label = document.getElementById('selected-tex-label')?.textContent?.trim();
      if (label && label.toLowerCase() !== 'no tex file selected') return label;
      const libSel = document.querySelector('#lib-pane-list select');
      if (libSel && libSel.value) return libSel.value;
      const h1 = document.querySelector('h1')?.textContent?.trim();
      return h1 || 'Imported_TEX';
    }

    function makeTitleFromTexName(name){
      let base = String(name || '').trim();
      base = base.replace(/\.[Tt][Ee][Xx]$/, '');
      base = base.replace(/\s+/g, '_');
      base = base || 'Imported_TEX';
      return base;
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
      return !!root.querySelector('select,textarea,input[type="text"],input[type="date"],input[type="number"],input[type="checkbox"],input[type="radio"]');
    }

    function mapGenericControls(ctrl){
      const out = [];
      const geom = geomFrom(ctrl);

      function findLabelFor(el){
        if (el.id) {
          const m = ctrl.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (m) return txt(m);
        }
        const wrap = el.closest('label');
        if (wrap) return txt(wrap);
        let p = el.previousElementSibling;
        if (p && /^(LABEL|SPAN|STRONG)$/i.test(p.tagName)) {
          const t = txt(p); if (t) return t;
        }
        const fs = el.closest('fieldset');
        const lg = fs?.querySelector('legend');
        if (lg) return txt(lg);
        return el.name || el.placeholder || 'Field';
      }

      function readcodeInfo(el){
        const host = el.closest('.readcode-host');
        if (!host) return {};
        const blob = host.getAttribute('data-readcodes') || '';
        const line = (blob.replace(/\\u000A/gi, '\n').split(/\r?\n/).find(l => /\S/.test(l)) || '').trim();
        if (!line) return {};
        const parts = line.split('—');
        const code = (parts[0] || '').trim();
        const label = (parts.slice(1).join('—') || '').trim();
        return { code, label, desc: code ? `Readcode: ${code}` : undefined };
      }

      const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
      const radioGroups = new Map();
      radios.forEach(r => {
        const name = r.name || '_radio_' + Math.random().toString(36).slice(2);
        if (!radioGroups.has(name)) radioGroups.set(name, []);
        radioGroups.get(name).push(r);
      });

      radioGroups.forEach(group => {
        const label = findLabelFor(group[0]);
        const values = [];
        const seen = new Set();

        group.forEach(r => {
          let optLabel = '';
          const lab = r.closest('label');
          if (lab) optLabel = txt(lab);
          if (!optLabel) {
            const sib = r.nextSibling;
            if (sib && sib.nodeType === 3) optLabel = (sib.nodeValue || '').trim();
          }
          if (!optLabel) optLabel = r.value || 'Option';

          const optVal = r.value || keyify(optLabel);
          if (seen.has(optVal)) return;
          seen.add(optVal);
          values.push({ value: optVal, label: optLabel, shortcut: '' });
        });

        const def = (group.find(r => r.checked) || {}).value || '';
        const meta = readcodeInfo(group[0]);

        out.push({
          type: 'radio', input: true, key: uniqueKey(label), label, tableView: true, inline: true,
          values, defaultValue: def, description: meta.desc,
          properties: { x: geom.x, y: geom.y, w: geom.w, h: geom.h }
        });
      });

      const selects = Array.from(ctrl.querySelectorAll('select'));
      selects.forEach(sel => {
        const label = findLabelFor(sel);
        const opts = Array.from(sel.querySelectorAll('option')).map(o => ({
          value: o.value || txt(o), label: txt(o) || o.value || ''
        })).filter(o => o.value || o.label);

        const multiple = !!sel.multiple;
        const def = multiple
          ? Array.from(sel.selectedOptions || []).map(o => o.value || txt(o))
          : (sel.value || '');

        const meta = readcodeInfo(sel);

        out.push({
          type: 'select', input: true, key: uniqueKey(label), label, tableView: true,
          dataSrc: 'values', data: { values: opts }, multiple, defaultValue: def,
          template: '<span>{{ item.label }}</span>',
          description: meta.desc,
          properties: { x: geom.x, y: geom.y, w: geom.w, h: geom.h }
        });
      });

      const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
      checks.forEach(ch => {
        const label = findLabelFor(ch);
        const meta = readcodeInfo(ch);
        out.push({
          type: 'checkbox', input: true, key: uniqueKey(label), label, tableView: true,
          defaultValue: !!ch.checked, tooltip: meta.desc,
          properties: { x: geom.x, y: geom.y, w: geom.w, h: geom.h }
        });
      });

      const dates = Array.from(ctrl.querySelectorAll('input[type="date"]'));
      dates.forEach(d => {
        const label = findLabelFor(d);
        const meta = readcodeInfo(d);
        out.push({
          type: 'datetime', input: true, key: uniqueKey(label), label, labelPosition: 'left-left',
          tableView: true, enableDate: true, enableTime: false, datePicker: { showWeeks: true },
          validate: { required: d.hasAttribute('required') },
          description: meta.desc,
          properties: { x: geom.x, y: geom.y, w: geom.w, h: geom.h }
        });
      });

      const areas = Array.from(ctrl.querySelectorAll('textarea'));
      areas.forEach(a => {
        const label = findLabelFor(a);
        const meta = readcodeInfo(a);
        out.push({
          type: 'textarea', input: true, key: uniqueKey(label), label, tableView: true,
          rows: Math.max(1, parseInt(a.getAttribute('rows') || '3', 10)),
          defaultValue: a.value || '', description: meta.desc,
          properties: { x: geom.x, y: geom.y, w: geom.w, h: geom.h }
        });
      });

      const texts = Array.from(ctrl.querySelectorAll('input[type="text"],input[type="number"]'))
        .filter(i => !i.readOnly);
      texts.forEach(ti => {
        const label = findLabelFor(ti);
        const meta = readcodeInfo(ti);
        if (ti.type === 'number') {
          out.push({
            type: 'number', input: true, key: uniqueKey(label), label, tableView: true,
            validate: { step: 'any', required: ti.hasAttribute('required') },
            description: meta.desc,
            properties: { x: geom.x, y: geom.y, w: geom.w, h: geom.h }
          });
        } else {
          out.push({
            type: 'textfield', input: true, key: uniqueKey(label), label, tableView: true,
            inputFormat: 'plain', validate: { required: ti.hasAttribute('required') },
            defaultValue: ti.value || '', description: meta.desc,
            properties: { x: geom.x, y: geom.y, w: geom.w, h: geom.h }
          });
        }
      });

      if (!out.length) {
        const legend = ctrl.querySelector('legend');
        if (legend) return [ makeHtmlEl(txt(legend)) ];
        const anyLabel = ctrl.querySelector('label');
        if (anyLabel) return [ makeHtmlEl(txt(anyLabel)) ];
      }
      return out;
    }

    function toLowerCamelCase(s){
      const parts = String(s || '').replace(/\.[A-Za-z0-9]+$/, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
      if (!parts.length) return 'importedForm';
      const head = parts[0].toLowerCase();
      const tail = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1));
      let out = [head, ...tail].join('');
      if (!/^[A-Za-z]/.test(out)) out = 'f' + out;
      if (out.length > 128) out = out.slice(0, 128);
      return out;
    }

    const texName = (function(){
      const label = document.getElementById('selected-tex-label')?.textContent?.trim();
      if (label && label.toLowerCase() !== 'no tex file selected') return label;
      const libSel = document.querySelector('#lib-pane-list select');
      if (libSel && libSel.value) return libSel.value;
      const h1 = document.querySelector('h1')?.textContent?.trim();
      return h1 || 'Imported_TEX';
    })();

    const title   = (function(name){
      let base = String(name || '').trim();
      base = base.replace(/\.[Tt][Ee][Xx]$/, '');
      base = base.replace(/\s+/g, '_');
      base = base || 'Imported_TEX';
      return base;
    })(texName);

    const key     = toLowerCamelCase(title);

    const controls = qa('.ctrl');
    const outComponents = [];

    controls.forEach(ctrl => {
      let added = [];
      if (isClassicReadCode(ctrl)) {
        added = mapReadCode(ctrl);
      }
      else if (ctrl.querySelector('.rl-wrap, select[name^="Readlist"], select[id^="Readlist"]')) {
        added = mapReadList(ctrl);
      }
      else if (hasAnyFormInputs(ctrl)) {
        added = mapGenericControls(ctrl);
      }
      else {
        added = mapLabelOrLink(ctrl);
      }
      if (added && added.length) outComponents.push(...added);
    });

    const form = {
      display: 'form',
      type: 'form',
      title,
      name: key,
      path: key,
      components: outComponents
    };

    const blob = new Blob([JSON.stringify(form, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title}_formio.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // Kick it off (unchanged)
  addExportButton();
})();
