// --- moved from import_tex.html ---
(function () {
  function addOpenTextExportButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    // Button 1: flat Form.io JSON export (image styled as normal button)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to OpenText Schema JSON format';
    btn.style.marginLeft = '10px';
    btn.style.padding = '6px 10px';
    btn.style.fontSize = '12px';
    btn.style.border = '1px solid #888';
    btn.style.borderRadius = '4px';
    btn.style.background = '#f5f5f5';
    btn.style.cursor = 'pointer';
    // btn.style.display = 'flex';
    // btn.style.alignItems = 'center';
    // btn.style.justifyContent = 'center';
    btn.style.transition = 'background 0.2s, box-shadow 0.2s';

    // Hover / click effects
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#eaeaea';
      btn.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#f5f5f5';
      btn.style.boxShadow = 'none';
    });
    btn.addEventListener('mousedown', () => {
      btn.style.background = '#ddd';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.background = '#eaeaea';
    });

    // Add the logo image
    const img1 = document.createElement('img');
    img1.src = '/static/myapp/images/OpenText-logo-SO4.png'; // path for formio-logo.png
    img1.alt = 'Export to OpenText Schema JSON format';
    img1.style.height = '14px';
    img1.style.width = 'auto';
    img1.style.display = 'block';
    img1.style.pointerEvents = 'none';
    btn.appendChild(img1);
    btn.addEventListener('click', exportToOpenText);
    mount.appendChild(btn);
  }

  // ---------- Helpers (shareable with your Form.io exporter) --------------------
  const CANVAS = document.getElementById('canvas') || document;
  function q(sel, root=CANVAS){ return root.querySelector(sel); }
  function qa(sel, root=CANVAS){ return Array.from(root.querySelectorAll(sel)); }
  function txt(n){ return (n && (n.textContent || '').trim()) || ''; }

  function keyify(s){
    return (s || '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, '_$1')
      .slice(0, 80) || ('k_' + Math.random().toString(36).slice(2));
  }
  const takenPropKeys = new Set();
  function uniquePropKey(base, fallbackPrefix='field'){
    let k = keyify(base) || (fallbackPrefix + '_' + Math.random().toString(36).slice(2));
    if (!takenPropKeys.has(k)) { takenPropKeys.add(k); return k; }
    let i = 2;
    while (takenPropKeys.has(k + '_' + i)) i++;
    k = k + '_' + i;
    takenPropKeys.add(k);
    return k;
  }

  // Find a human label near an element
  function findLabelFor(el, scope){
    const root = scope || el.closest('.ctrl') || CANVAS;

    // 1) <label for="id">
    if (el.id) {
      const m = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (m) { const t = txt(m); if (t) return t; }
    }
    // 2) wrapping <label>
    const wrap = el.closest('label');
    if (wrap){ const t = txt(wrap); if (t) return t; }

    // 3) nearby caption in classic lists
    const rlCaption = el.closest('.rl-wrap')?.querySelector('.rl-caption');
    if (rlCaption){ const t = txt(rlCaption); if (t) return t; }

    // 4) previous sibling label/span/strong
    let p = el.previousElementSibling;
    if (p && /^(LABEL|SPAN|STRONG|DIV)$/i.test(p.tagName)) {
      const t = txt(p);
      if (t) return t;
    }

    // 5) fieldset legend
    const fs = el.closest('fieldset');
    const lg = fs?.querySelector('legend');
    if (lg){ const t = txt(lg); if (t) return t; }

    // 6) fallback
    return el.name || el.placeholder || 'Field';
  }

  // Readcode meta nearest host (first non-empty line => code — label)
  function readcodeInfo(el){
    const host = el.closest('.readcode-host');
    if (!host) return {};
    const blob = host.getAttribute('data-readcodes') || '';
    const line = (blob.replace(/\\u000A/gi, '\n').split(/\r?\n/).find(l => /\S/.test(l)) || '').trim();
    if (!line) return {};
    const parts = line.split('—');
    const code = (parts[0] || '').trim();
    const label = (parts.slice(1).join('—') || '').trim();
    return { code, label };
  }

  // Identify classic readcode “question”: yes/no pair
  function isClassicYesNo(ctrl){
    const yes = ctrl.querySelector('.rc-yes-label input.rc-yesno');
    const no  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
    return !!(yes || no);
  }

  // Identify classic readlists
  function isClassicReadList(ctrl){
    return !!(ctrl.querySelector('.rl-wrap') ||
              ctrl.querySelector('select[name^="Readlist"]') ||
              ctrl.querySelector('select[id^="Readlist"]'));
  }

  // UUID v4 (light)
  function uuidv4(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }

  // ---------- Mappers -> OpenText properties -----------------------------------
  function propBoolean(title){
    return {
      type: 'boolean',
      otFormat: { repeating: false },
      title: title || 'Checkbox'
    };
  }
  function propToggle(title){
    return {
      type: 'boolean',
      otFormat: { presentationType: 'toggle' },
      title: (title ? (title + ' - Yes/No') : 'Text - Yes/No')
    };
  }
  function propDate(title){
    return {
      type: 'string',
      otFormat: { dataType: 'date', repeating: false },
      format: 'date',
      title: title || 'Date',
      maxLength: 64
    };
  }
  function propNumber(title){
    return {
      type: 'number',
      otFormat: { repeating: false },
      title: title || 'Number'
    };
  }
  function propText(title){
    return {
      type: 'string',
      otFormat: { repeating: false },
      title: title || 'Text',
      maxLength: 64
    };
  }
  function propSelectbox(title, values, def){
    const enums = (values || []).map(v => String(v));
    const out = {
      type: 'string',
      otFormat: { presentationType: 'selectbox', repeating: false },
      title: title || 'Selectbox',
      maxLength: 64,
      enum: enums
    };
    if (def != null && def !== '') out.default = String(def);
    return out;
  }
  function propMultiselect(title, values, defArr){
    const enums = (values || []).map(v => String(v));
    const out = {
      type: 'array',
      items: { type: 'string', enum: enums },
      otFormat: { presentationType: 'multiselect', repeating: false },
      title: title || 'Multi Select',
      maxLength: 64
    };
    if (Array.isArray(defArr) && defArr.length) out.default = defArr.map(v => String(v));
    return out;
  }

  // ---------- Control harvesters -----------------------------------------------
  function mapClassicReadCode(ctrl, properties, required){
    // Yes/No question → toggle
    if (isClassicYesNo(ctrl)){
      const label = txt(ctrl.querySelector('.rc-prompt')) || 'Question';
      const key = uniquePropKey(label, 'toggle');
      properties[key] = propToggle(label);

      // if initial state visible in DOM, prefer default
      const yes = ctrl.querySelector('.rc-yes-label input.rc-yesno');
      const no  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
      if (yes?.checked || no?.checked){
        properties[key].default = !!(yes && yes.checked); // yes=true, no=false
      }
      return;
    }

    // Otherwise treat companions if present
    const textEl = ctrl.querySelector('input[type="text"][name$="_text"]');
    const valEl  = ctrl.querySelector('input[type="text"][name$="_val"], input[type="number"][name$="_val"], input.rc-val');
    const dateEl = ctrl.querySelector('input[type="date"]');
    const chk    = ctrl.querySelector('input.rc-chk');

    // If it’s pure text prompt, export text
    if (textEl && !valEl && !dateEl){
      const label = txt(ctrl.querySelector('.rc-prompt')) || readcodeInfo(textEl).label || 'Text';
      const key = uniquePropKey(label, 'text');
      properties[key] = propText(label);
      if (textEl.value) properties[key].default = textEl.value;
      return;
    }

    // Pure date
    if (dateEl && !valEl && !textEl){
      const label = txt(ctrl.querySelector('.rc-prompt')) || readcodeInfo(dateEl).label || 'Date';
      const key = uniquePropKey(label, 'date');
      properties[key] = propDate(label);
      if (dateEl.value) properties[key].default = dateEl.value;
      return;
    }

    // Pure value → number
    if (valEl && !textEl && !dateEl){
      const label = txt(ctrl.querySelector('.rc-prompt')) || 'Number';
      const key = uniquePropKey(label, 'number');
      properties[key] = propNumber(label);
      const n = parseFloat(valEl.value);
      if (!isNaN(n)) properties[key].default = n;
      return;
    }

    // Simple checkbox control (non-question)
    if (chk){
      const label = txt(ctrl.querySelector('.rc-prompt')) || 'Checkbox';
      const key = uniquePropKey(label, 'checkbox');
      properties[key] = propBoolean(label);
      properties[key].default = !!chk.checked;
      // Companions (optional): export as separate fields
      if (textEl){
        const k2 = uniquePropKey(label + '_text', 'text');
        properties[k2] = propText(label + ' (text)');
        if (textEl.value) properties[k2].default = textEl.value;
      }
      if (valEl){
        const k3 = uniquePropKey(label + '_value', 'number');
        properties[k3] = propNumber(label + ' (value)');
        const n = parseFloat(valEl.value);
        if (!isNaN(n)) properties[k3].default = n;
      }
      if (dateEl){
        const k4 = uniquePropKey(label + '_date', 'date');
        properties[k4] = propDate(label + ' (date)');
        if (dateEl.value) properties[k4].default = dateEl.value;
      }
      return;
    }
  }

  function mapClassicReadList(ctrl, properties){
    // Prefer the caption we injected (.rl-caption), else nearby <label>
    const select = ctrl.querySelector('select');
    if (!select) return;
    const label = findLabelFor(select, ctrl);
    const opts = Array.from(select.querySelectorAll('option'))
      .map(o => ({ value: o.value || txt(o), label: txt(o) || o.value || '' }))
      .filter(o => o.value || o.label);

    const values = opts.map(o => o.value || o.label);
    const multiple = !!select.multiple;
    const key = uniquePropKey(label, multiple ? 'multi_select' : 'selectbox');

    if (multiple){
      const def = Array.from(select.selectedOptions || []).map(o => o.value || txt(o));
      properties[key] = propMultiselect(label, values, def);
    } else {
      const def = select.value || '';
      properties[key] = propSelectbox(label, values, def);
    }
  }

  function mapGeneric(ctrl, properties){
    // Radios: group by name
    const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
    if (radios.length){
      const byName = new Map();
      radios.forEach(r => {
        const nm = r.name || '_r_' + Math.random().toString(36).slice(2);
        if (!byName.has(nm)) byName.set(nm, []);
        byName.get(nm).push(r);
      });

      byName.forEach(group => {
        const label = findLabelFor(group[0], ctrl);
        const options = [];
        const seen = new Set();
        group.forEach(r => {
          let l = '';
          const wrap = r.closest('label');
          if (wrap) l = txt(wrap);
          if (!l && r.nextSibling && r.nextSibling.nodeType === 3) l = (r.nextSibling.nodeValue || '').trim();
          if (!l) l = r.value || 'Option';
          const v = r.value || keyify(l);
          if (seen.has(v)) return;
          seen.add(v);
          options.push({ v, l });
        });

        // If it looks like Yes/No, export as toggle
        const labelsLower = options.map(o => o.l.toLowerCase());
        const looksYesNo = (options.length === 2 &&
                            labelsLower.includes('yes') &&
                            labelsLower.includes('no'));

        if (looksYesNo){
          const key = uniquePropKey(label, 'toggle');
          properties[key] = propToggle(label);
          const def = (group.find(r => r.checked) || {}).value || '';
          if (def){
            properties[key].default =
              /^(yes|true|1)$/i.test(def) ||
              def.toLowerCase() === (options.find(o => /yes/i.test(o.l))?.v || '').toLowerCase();
          }
        } else {
          // Otherwise single-select
          const key = uniquePropKey(label, 'selectbox');
          properties[key] = propSelectbox(label, options.map(o => o.v),
                             (group.find(r => r.checked) || {}).value || '');
        }
      });
    }

    // Selects
    const selects = Array.from(ctrl.querySelectorAll('select'));
    selects.forEach(sel => {
      const label = findLabelFor(sel, ctrl);
      const opts = Array.from(sel.querySelectorAll('option'))
        .map(o => ({ value: o.value || txt(o), label: txt(o) || o.value || '' }))
        .filter(o => o.value || o.label);
      const values = opts.map(o => o.value || o.label);
      const multiple = !!sel.multiple;
      const key = uniquePropKey(label, multiple ? 'multi_select' : 'selectbox');

      if (multiple){
        const def = Array.from(sel.selectedOptions || []).map(o => o.value || txt(o));
        properties[key] = propMultiselect(label, values, def);
      } else {
        const def = sel.value || '';
        properties[key] = propSelectbox(label, values, def);
      }
    });

    // Standalone checkboxes (not part of radio groups)
    const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
    checks.forEach(ch => {
      const label = findLabelFor(ch, ctrl);
      const key = uniquePropKey(label, 'checkbox');
      properties[key] = propBoolean(label);
      properties[key].default = !!ch.checked;
    });

    // Dates
    const dates = Array.from(ctrl.querySelectorAll('input[type="date"]'));
    dates.forEach(d => {
      const label = findLabelFor(d, ctrl);
      const key = uniquePropKey(label, 'date');
      properties[key] = propDate(label);
      if (d.value) properties[key].default = d.value;
    });

    // Textareas
    const areas = Array.from(ctrl.querySelectorAll('textarea'));
    areas.forEach(a => {
      const label = findLabelFor(a, ctrl);
      const key = uniquePropKey(label, 'text');
      properties[key] = propText(label);
      if (a.value) properties[key].default = a.value;
    });

    // Text / Number inputs (non-readonly)
    const inputs = Array.from(ctrl.querySelectorAll('input[type="text"],input[type="number"]'))
      .filter(i => !i.readOnly);
    inputs.forEach(i => {
      const label = findLabelFor(i, ctrl);
      const isNumeric = (i.type === 'number') || i.classList.contains('rc-val') || i.getAttribute('inputmode') === 'decimal';
      const key = uniquePropKey(label, isNumeric ? 'number' : 'text');
      if (isNumeric){
        properties[key] = propNumber(label);
        const n = parseFloat(i.value);
        if (!isNaN(n)) properties[key].default = n;
      } else {
        properties[key] = propText(label);
        if (i.value) properties[key].default = i.value;
      }
    });
  }

  // ---------- Export core -------------------------------------------------------
  function exportToOpenText(){
    takenPropKeys.clear();

    // Build schema
    const schema = {
      required: [],
      properties: {},
      $id: `https://www.opentext.com/ocp/devx/ui/${(document.location.host || 'local')}/1.0/` + uuidv4(),
      type: 'object'
    };

    // Walk each positioned control wrapper
    const controls = qa('.ctrl');
    controls.forEach(ctrl => {
      if (isClassicYesNo(ctrl) || ctrl.querySelector('.rc-wrap')) {
        // classic readcode family
        mapClassicReadCode(ctrl, schema.properties, schema.required);
      } else if (isClassicReadList(ctrl)) {
        mapClassicReadList(ctrl, schema.properties);
      } else {
        // everything else (incl. hand-crafted)
        mapGeneric(ctrl, schema.properties);
      }
    });

    // Download
    const titleEl = document.getElementById('selected-tex-label');
    const baseName = (titleEl?.textContent || document.querySelector('h1')?.textContent || 'OpenText_Schema').trim().replace(/\s+/g,'_');
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}_opentext.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // Expose globally so other scripts (or inline calls) can use it.
  window.addOpenTextExportButton = addOpenTextExportButton;

  // OPTIONAL auto-init: inline block also *called* the function
  // with no args, can auto-run it on DOM ready. If function needs args,
  // delete this listener and keep the call inline in the HTML as shown below.
  document.addEventListener('DOMContentLoaded', () => {
    try {
      addOpenTextExportButton();
    } catch (e) {
      // Safe no-op if you remove auto-init or need params.
      console.debug('addOpenTextExportButton init skipped or needs params.', e);
    }
  });
})();
