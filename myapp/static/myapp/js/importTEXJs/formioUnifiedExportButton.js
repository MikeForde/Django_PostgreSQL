(function(){
  // =========================================================
  // DOM helpers / basics
  // =========================================================
  const CANVAS = document.getElementById('canvas') || document;
  function q(sel, root=CANVAS){ return root.querySelector(sel); }
  function qa(sel, root=CANVAS){ return Array.from(root.querySelectorAll(sel)); }
  function txt(n){ return (n && (n.textContent || '').trim()) || ''; }

  // Slugify -> Form.io `key`
  function keyify(s){
    return (s || '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, '_$1')
      .slice(0, 80) || ('k_' + Math.random().toString(36).slice(2));
  }

  // unique key registry (will reset per export)
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

  function geomFrom(el){
    const s = getComputedStyle(el);
    function px(n){ return parseInt(n, 10) || 0; }
    return { x: px(s.left), y: px(s.top), w: px(s.width), h: px(s.height) };
  }

  function makeHtmlEl(content, tag='p'){
    return {
      type: 'htmlelement',
      tag,
      key: uniqueKey('content_' + String(content).slice(0,30)),
      input: false,
      content,
      hideLabel: true,
      attrs: [{attr:'', value:''}],
      className: '',
      properties: {}
    };
  }

  // =========================================================
  // Feature detection helpers
  // =========================================================
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

  // =========================================================
  // Readcode metadata + tooltip
  // =========================================================
  function decodeUnicodeEscapes(str){
    if (!str) return '';
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, g1) =>
      String.fromCharCode(parseInt(g1, 16))
    );
  }

  // returns array of {code,label,autoText,...} for any element living in .readcode-host
  function readcodeInfo(el){
    const host = el.closest('.readcode-host');
    if (!host) return [];

    let blob = host.getAttribute('data-readcodes') || '';
    blob = decodeUnicodeEscapes(blob);
    blob = blob.replace(/\\u000A/gi, '\n');

    const rawLines = blob.split(/\r?\n/).filter(Boolean);

    // shared Auto-Entered Text if present
    let autoText = '';
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) {
        autoText = line.replace(/^\s*Auto-Entered Text\s*:\s*/i,'').trim();
      }
    });

    const entries = [];
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) return;
      const m = line.split('—');
      const code  = (m[0] || '').trim();
      const label = (m.slice(1).join('—') || '').trim();
      if (code || label) {
        entries.push({
          code,
          label,
          autoText,
          desc: code ? `Readcode: ${code}` : undefined
        });
      }
    });

    return entries;
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
        // "CODE = Meaning"
        lines.push(c && l ? (c + ' = ' + l) : (c || l));
      }
      if (a) {
        lines.push('Auto: ' + a);
      }
    });

    if (!lines.length) return undefined;
    return lines.join('\n');
  }

  // =========================================================
  // MAPPERS
  // =========================================================

  function mapReadCode(ctrl){
    const out = [];

    const labelText = (ctrl.querySelector('.rc-prompt')?.textContent || '').trim() || 'Read code';

    // gather meta for tooltip
    const host = ctrl.closest('.readcode-host') || ctrl;
    let blob = host.getAttribute('data-readcodes') || '';
    blob = decodeUnicodeEscapes(blob);
    blob = blob.replace(/\\u000A/gi, '\n');
    const rawLines = blob.split(/\r?\n/).filter(Boolean);

    let rcAutoText = '';
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) {
        rcAutoText = line.replace(/^\s*Auto-Entered Text\s*:\s*/i,'').trim();
      }
    });

    const metaArray = [];
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) return;
      const m = line.split('—');
      const code  = (m[0] || '').trim();
      const label = (m.slice(1).join('—') || '').trim();
      if (code || label) {
        metaArray.push({
          code,
          label,
          autoText: rcAutoText,
          desc: code ? `Readcode: ${code}` : undefined
        });
      }
    });

    const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

    const keyFrom = (base, hint='') => {
      const raw = (base || '').replace(/\s+/g,' ').trim() || 'field';
      const baseKey = keyify(raw + (hint ? (' ' + hint) : ''));
      if (!takenKeys.has(baseKey)) { takenKeys.add(baseKey); return baseKey; }
      let i=2, k;
      do { k = baseKey + '_' + i++; } while (takenKeys.has(k));
      takenKeys.add(k);
      return k;
    };

    const yesInput = ctrl.querySelector('.rc-yes-label input.rc-yesno');
    const noInput  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
    const hasYesNo = !!(yesInput || noInput);

    const hasChk   = !!ctrl.querySelector('input.rc-chk');
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
        type: 'textfield',
        input: true,
        key: keyFrom(labelText),
        label: labelText,
        tableView: true,
        labelPosition: 'left-left',
        inputFormat: 'plain',
        validate: { required: textEl.hasAttribute('required') },
        tooltip: unifiedTooltip
      });
      if (hasDate){
        out.push({
          type: 'datetime',
          input: true,
          key: keyFrom(labelText, 'date'),
          label: `${labelText} (date)`,
          labelPosition: 'left-left',
          tableView: true,
          enableDate: true,
          enableTime: false,
          datePicker: { showWeeks: true },
          validate: { required: dateEl.hasAttribute('required') },
          tooltip: unifiedTooltip
        });
      }
      return out;
    }

    // DATE only
    if (hasDate && !hasYesNo && !hasVal){
      out.push({
        type: 'datetime',
        input: true,
        key: keyFrom(labelText),
        label: labelText,
        labelPosition: 'left-left',
        tableView: true,
        enableDate: true,
        enableTime: false,
        datePicker: { showWeeks: true },
        validate: { required: dateEl.hasAttribute('required') },
        tooltip: unifiedTooltip
      });
      return out;
    }

    // VALUE only
    if (hasVal && !hasYesNo && !hasText && !hasDate){
      out.push({
        type: 'number',
        input: true,
        key: keyFrom(labelText),
        label: labelText,
        tableView: true,
        labelPosition: 'left-left',
        suffix: unitText || undefined,
        validate: { required: valEl.hasAttribute('required'), step: 'any' },
        tooltip: unifiedTooltip
      });
      return out;
    }

    // VALUE + DATE combo
    if (hasVal && hasDate && !hasYesNo) {
      out.push({
        type: 'number',
        input: true,
        key: keyFrom(labelText, 'value'),
        label: labelText,
        tableView: true,
        labelPosition: 'left-left',
        suffix: unitText || undefined,
        validate: {
          required: valEl.hasAttribute('required'),
          step: 'any'
        },
        tooltip: unifiedTooltip
      });

      out.push({
        type: 'datetime',
        input: true,
        key: keyFrom(labelText, 'date'),
        label: `${labelText} (date)`,
        labelPosition: 'left-left',
        tableView: true,
        enableDate: true,
        enableTime: false,
        datePicker: { showWeeks: true },
        validate: {
          required: dateEl.hasAttribute('required')
        },
        tooltip: unifiedTooltip
      });

      return out;
    }

    // YES/NO radio
    if (hasYesNo){
      const yesVal = yesInput?.value || 'yes';
      const noVal  = noInput?.value  || 'no';
      const yesChecked = !!(yesInput && yesInput.checked);
      const noChecked  = !!(noInput  && noInput.checked);

      out.push({
        type: 'radio',
        input: true,
        key: keyFrom(labelText),
        label: labelText,
        tableView: true,
        inline: true,
        values: [
          { value: yesVal, label: 'Yes', shortcut: '' },
          { value: noVal,  label: 'No',  shortcut: '' }
        ],
        defaultValue: yesChecked ? yesVal : (noChecked ? noVal : ''),
        properties: { kind: 'QuestionReadCode', readcode: yesVal, negcode: noVal },
        tooltip: unifiedTooltip
      });

      if (hasText){
        out.push({
          type: 'textfield',
          input: true,
          key: keyFrom(labelText, 'text'),
          label: `${labelText} (text)`,
          tableView: true,
          labelPosition: 'left-left',
          inputFormat: 'plain',
          validate: { required: textEl.hasAttribute('required') },
          tooltip: unifiedTooltip
        });
      }
      if (hasVal){
        out.push({
          type: 'number',
          input: true,
          key: keyFrom(labelText, 'value'),
          label: `${labelText} (value)`,
          tableView: true,
          labelPosition: 'left-left',
          suffix: unitText || undefined,
          validate: { required: valEl.hasAttribute('required'), step: 'any' },
          tooltip: unifiedTooltip
        });
      }
      if (hasDate){
        out.push({
          type: 'datetime',
          input: true,
          key: keyFrom(labelText, 'date'),
          label: `${labelText} (date)`,
          labelPosition: 'left-left',
          tableView: true,
          enableDate: true,
          enableTime: false,
          datePicker: { showWeeks: true },
          validate: { required: dateEl.hasAttribute('required') },
          tooltip: unifiedTooltip
        });
      }
      return out;
    }

    // Simple checkbox
    if (hasChk){
      out.push({
        type: 'checkbox',
        input: true,
        key: keyFrom(labelText, 'chk'),
        label: labelText,
        labelPosition: 'left',
        tableView: true,
        tooltip: unifiedTooltip
      });

      if (hasText){
        out.push({
          type: 'textfield',
          input: true,
          key: keyFrom(labelText, 'text'),
          label: `${labelText} (text)`,
          tableView: true,
          labelPosition: 'left-left',
          inputFormat: 'plain',
          validate: { required: textEl.hasAttribute('required') },
          tooltip: unifiedTooltip
        });
      }
      if (hasVal){
        out.push({
          type: 'number',
          input: true,
          key: keyFrom(labelText, 'value'),
          label: `${labelText} (value)`,
          tableView: true,
          labelPosition: 'left-left',
          validate: { required: valEl.hasAttribute('required'), step: 'any' },
          tooltip: unifiedTooltip
        });
      }
      if (hasDate){
        out.push({
          type: 'datetime',
          input: true,
          key: keyFrom(labelText, 'date'),
          label: `${labelText} (date)`,
          labelPosition: 'left-left',
          tableView: true,
          enableDate: true,
          enableTime: false,
          datePicker: { showWeeks: true },
          validate: { required: dateEl.hasAttribute('required') },
          tooltip: unifiedTooltip
        });
      }
      return out;
    }

    // Fallback label
    out.push({
      type:'htmlelement',
      key: keyFrom(labelText, 'label'),
      tag:'p',
      content: labelText,
      hideLabel:true,
      input:false,
      tooltip: unifiedTooltip
    });
    return out;
  }

  function mapReadList(ctrl){
    const geom = geomFrom(ctrl);

    const metaArray = readcodeInfo(ctrl);
    const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

    // Caption fallback for legacy/simple lists
    const cap =
      txt(ctrl.querySelector('.rl-caption')) ||
      txt(ctrl.querySelector('label')) ||
      'List';

    // ---- NEW: detect multi-dropdown ".ms" widget (checkbox panel in a dropdown) ----
    const msWrap = ctrl.querySelector('.ms');
    if (msWrap) {
      // Label comes from .ms-label
      const msLabelText = txt(msWrap.querySelector('.ms-label')) || cap || 'List';

      // Options live in .ms-panel label > input[type="checkbox"]
      const checkLabels = Array.from(msWrap.querySelectorAll('.ms-panel label'));
      const values = [];
      const defaultVals = [];

      checkLabels.forEach(lab => {
        const inp = lab.querySelector('input[type="checkbox"]');
        if (!inp) return;
        const value = inp.value || '';
        const label = (txt(lab) || '').replace(value, '').trim() || value;
        // The above "replace(value)" is a light cleanup; if it's too aggressive you can drop it
        values.push({ value, label, shortcut: '' });
        if (inp.checked) {
          defaultVals.push(value);
        }
      });

      // Build a Form.io select with multiple=true
      return [{
        widget: "html5",
        type: 'select',
        key: uniqueKey('select_' + msLabelText),
        label: msLabelText,
        input: true,
        tableView: true,
        dataSrc: 'values',
        data: { values: values },
        multiple: true,
        // defaultValue should be an array for multi selects
        defaultValue: defaultVals,
        template: '<span>{{ item.label }}</span>',
        tooltip: unifiedTooltip,
        properties: {
          kind: 'ReadListMultiDropdown',
          ...geom
        }
      }];
    }

    // ---- Standard <select> branch (single or multi native <select>) ----
    const select = ctrl.querySelector('select');
    if (select) {
      // Collect all <option> tags with some value/label
      const rawOptions = Array.from(select.querySelectorAll('option'))
        .filter(o => (o.value || txt(o)));

      const builtOptions = rawOptions.map(o => ({
        value: o.value || txt(o),
        label: txt(o) || o.value || ''
      }));

      const multiple = !!select.multiple;

      // Heuristic to handle TEX pattern:
      // - first option is actually the field name, not a real choice
      // - only apply if NOT multiple, and our "cap" is generic like 'List'
      let finalLabel = cap;
      let finalOptions = builtOptions.slice();

      if (!multiple && builtOptions.length >= 2) {
        const capIsGeneric = !cap || cap.toLowerCase() === 'list';
        if (capIsGeneric) {
          const firstOpt = builtOptions[0];
          if (firstOpt && firstOpt.label && firstOpt.label.trim()) {
            finalLabel = firstOpt.label.trim();
            finalOptions = builtOptions.slice(1);
          }
        }
      }

      // defaultValue handling
      let defaultValue;
      if (multiple) {
        // Multiple-select default is an array
        defaultValue = Array.from(select.selectedOptions || []).map(o => o.value);
      } else {
        const currentVal = select.value || '';

        // If we dropped the first option (label masquerading as option),
        // and that dropped option was also the current value, suppress default
        const droppedFirst =
          (!multiple &&
          builtOptions.length >= 2 &&
          finalOptions.length === builtOptions.length - 1)
            ? builtOptions[0].value
            : null;

        if (droppedFirst && currentVal === droppedFirst) {
          defaultValue = '';
        } else {
          defaultValue = currentVal;
        }
      }

      return [{
        widget: "html5",
        type: 'select',
        key: uniqueKey('select_' + finalLabel),
        label: finalLabel,
        input: true,
        tableView: true,
        dataSrc: 'values',
        data: { values: finalOptions },
        multiple,
        defaultValue,
        template: '<span>{{ item.label }}</span>',
        tooltip: unifiedTooltip,
        properties: {
          kind: multiple ? 'ReadListMultiDropdownNative' : 'ReadList',
          ...geom
        }
      }];
    }

    // ---- Visible checkbox list (multi list) ----
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
        widget: "html5",
        type: 'selectboxes',
        key: uniqueKey('selectboxes_' + cap),
        label: cap,
        input: true,
        tableView: true,
        values,
        defaultValue: def,
        tooltip: unifiedTooltip,
        properties: {
          kind: 'ReadListMulti',
          ...geom
        }
      }];
    }

    // ---- Visible radio list (single list) ----
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
        tooltip: unifiedTooltip,
        properties: {
          kind: 'ReadListExclusive',
          ...geom
        }
      }];
    }

    // fallback non-input label block
    return [makeHtmlEl(cap)];
  }


  function mapLabelOrLink(ctrl){
    const a = ctrl.querySelector('a[href]');
    if (a) {
      return [{
        type: 'htmlelement',
        tag:'a',
        key: uniqueKey('link_' + txt(a)),
        input:false,
        content: txt(a) || a.href,
        hideLabel:true,
        attrs: [{ attr:'href', value:a.href }],
        className:'',
        properties:{ kind:'Url', href:a.href, ...geomFrom(ctrl) }
      }];
    }
    const labelEl = ctrl.querySelector('label');
    if (labelEl) return [ makeHtmlEl(labelEl.textContent || 'Label') ];
    return [];
  }

  function mapGenericControls(ctrl){
    const out = [];
    const geom = geomFrom(ctrl);

    function findLabelFor(el){
      // 1. for/id match
      if (el.id) {
        const m = ctrl.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (m) return txt(m);
      }

      // 2. wrapping label
      const wrap = el.closest('label');
      if (wrap) return txt(wrap);

      // 3. immediate previous sibling like <span><strong> etc.
      let p = el.previousElementSibling;
      if (p && /^(LABEL|SPAN|STRONG)$/i.test(p.tagName)) {
        const t = txt(p);
        if (t) return t;
      }

      // 4. fieldset legend
      const fs = el.closest('fieldset');
      const lg = fs?.querySelector('legend');
      if (lg) return txt(lg);

      // 5. NEW: try to infer "Last Entry for CODE" from readcodeInfo
      const metaArray = readcodeInfo(el); // array [{code,label,autoText},...]
      if (metaArray && metaArray.length) {
        const first = metaArray[0];
        if (first && first.code) {
          return `Last Entry for ${first.code}`;
        }
      }

      // 6. old fallback
      return el.name || el.placeholder || 'Field';
    }

    // group radio buttons by name
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
      const unifiedTooltip = buildTooltipFromReadcodeMeta(meta);
      out.push({
        type: 'radio',
        input: true,
        key: uniqueKey(label),
        label,
        tableView: true,
        inline: true,
        values,
        defaultValue: def,
        tooltip: unifiedTooltip,
        properties: { ...geom }
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
      const def = multiple
        ? Array.from(sel.selectedOptions || []).map(o => o.value || txt(o))
        : (sel.value || '');

      const meta = readcodeInfo(sel);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(meta);
      out.push({
        type: 'select',
        input: true,
        key: uniqueKey(label),
        label,
        tableView: true,
        dataSrc: 'values',
        data: { values: opts },
        multiple,
        defaultValue: def,
        template: '<span>{{ item.label }}</span>',
        tooltip: unifiedTooltip,
        properties: { ...geom }
      });
    });

    // checkboxes
    const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
    checks.forEach(ch => {
      const label = findLabelFor(ch);
      const meta = readcodeInfo(ch);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(meta);
      out.push({
        type: 'checkbox',
        input: true,
        key: uniqueKey(label),
        label,
        tableView: true,
        defaultValue: !!ch.checked,
        tooltip: unifiedTooltip,
        properties: { ...geom }
      });
    });

    // dates
    const dates = Array.from(ctrl.querySelectorAll('input[type="date"]'));
    dates.forEach(d => {
      const label = findLabelFor(d);
      const meta = readcodeInfo(d);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(meta);
      out.push({
        type: 'datetime',
        input: true,
        key: uniqueKey(label),
        label,
        labelPosition: 'left-left',
        tableView: true,
        enableDate: true,
        enableTime: false,
        datePicker: { showWeeks: true },
        validate: { required: d.hasAttribute('required') },
        tooltip: unifiedTooltip,
        properties: { ...geom }
      });
    });

    // textareas
    const areas = Array.from(ctrl.querySelectorAll('textarea'));
    areas.forEach(a => {
      const label = findLabelFor(a);
      const meta = readcodeInfo(a);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(meta);
      out.push({
        type: 'textarea',
        input: true,
        key: uniqueKey(label),
        label,
        tableView: true,
        rows: Math.max(1, parseInt(a.getAttribute('rows') || '3', 10)),
        defaultValue: a.value || '',
        tooltip: unifiedTooltip,
        properties: { ...geom }
      });
    });

    // text/number inputs (not readOnly)
    const texts = Array.from(ctrl.querySelectorAll('input[type="text"],input[type="number"]'))
      .filter(i => !i.readOnly);
    texts.forEach(ti => {
      const label = findLabelFor(ti);
      const meta = readcodeInfo(ti);
      const unifiedTooltip = buildTooltipFromReadcodeMeta(meta);

      if (ti.type === 'number') {
        out.push({
          type: 'number',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          validate: { step: 'any', required: ti.hasAttribute('required') },
          tooltip: unifiedTooltip,
          properties: { ...geom }
        });
      } else {
        out.push({
          type: 'textfield',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          inputFormat: 'plain',
          validate: { required: ti.hasAttribute('required') },
          defaultValue: ti.value || '',
          tooltip: unifiedTooltip,
          properties: { ...geom }
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

  // =========================================================
  // Shared "collect everything into atomicComponents"
  // =========================================================
  function collectAtomicComponents(){
    const controls = qa('.ctrl');
    const atomicComponents = [];

    controls.forEach(ctrl => {
      let added = [];
      if (isClassicReadCode(ctrl)) {
        added = mapReadCode(ctrl);
      } else if (
        ctrl.querySelector('.rl-wrap, select[name^="Readlist"], select[id^="Readlist"]')
      ) {
        added = mapReadList(ctrl);
      } else if (hasAnyFormInputs(ctrl)) {
        added = mapGenericControls(ctrl);
      } else {
        added = mapLabelOrLink(ctrl);
      }
      if (added && added.length) atomicComponents.push(...added);
    });

    return atomicComponents;
  }

  // =========================================================
  // Name / title helpers for both outputs
  // =========================================================
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

  function toLowerCamelCase(s){
    const parts = String(s || '')
      .replace(/\.[A-Za-z0-9]+$/, '')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean);
    if (!parts.length) return 'importedForm';
    const head = parts[0].toLowerCase();
    const tail = parts
      .slice(1)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1));
    let out = [head, ...tail].join('');
    if (!/^[A-Za-z]/.test(out)) out = 'f' + out;
    if (out.length > 128) out = out.slice(0, 128);
    return out;
  }

  // =========================================================
  // EXPORTERS (the only real difference)
  // =========================================================

  // old shape: flat form
  function exportFlatForm(){
    takenKeys.clear();

    const texNameRaw = getSelectedTexName();
    const baseTitle  = makeBaseTitleFromTexName(texNameRaw); // e.g. "PULHHEEMS_Widget"
    const lcKey      = toLowerCamelCase(baseTitle);          // "pulhheemsWidget"

    const atomicComponents = collectAtomicComponents();

    const form = {
      display: 'form',
      type: 'form',
      title: baseTitle,
      name: lcKey,
      path: lcKey,
      components: atomicComponents
    };

    const blob = new Blob([JSON.stringify(form, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseTitle}_formio.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // new shape: bundle/project wrapper
  function exportBundleProject(){
    takenKeys.clear();

    const texNameRaw = getSelectedTexName();
    const baseTitle  = makeBaseTitleFromTexName(texNameRaw);   // "PULHHEEMS_Widget"
    const lcKey      = toLowerCamelCase(baseTitle);            // "pulhheemsWidget"
    const formKey    = lcKey + 'FormIoImported';               // "pulhheemsWidgetFormIoImported"

    const atomicComponents = collectAtomicComponents();

    // wrap them into "columns" + submit in the bundle version
    const wrappedComponents = [
      {
        label: 'Columns',
        input: false,
        tableView: false,
        key: 'columns',
        type: 'columns',
        hideLabel: true,
        columns: [
          {
            components: atomicComponents,
            width: 12,
            offset: 0,
            push: 0,
            pull: 0,
            size: 'md',
            currentWidth: 12
          }
        ]
      },
      {
        input: true,
        label: 'Submit',
        tableView: false,
        key: 'submit',
        type: 'button'
      }
    ];

    const innerForm = {
      title: baseTitle + ' Form.io (Imported)',
      type: 'form',
      name: formKey,
      path: formKey.toLowerCase(),
      pdfComponents: [],
      display: 'form',
      tags: [],
      settings: {},
      components: wrappedComponents,
      properties: {},
      controller: '',
      submissionRevisions: '',
      revisions: '',
      esign: {}
    };

    const projectName = 'Project_with_' + baseTitle.replace(/[^A-Za-z0-9]+/g,'');
    const bundle = {
      title: 'TEX Conversions',
      version: '2.0.0',
      description: 'eForms parsed externally from DMICP TEX format into format compatible with Form.Io',
      name: projectName,
      roles: {},
      forms: {},
      actions: {},
      resources: {},
      revisions: {},
      reports: {},
      excludeAccess: true
    };

    bundle.forms[formKey] = innerForm;
    bundle.actions[`${formKey}:save`] = {
      title: 'Save Submission',
      name: 'save',
      form: formKey,
      priority: 10,
      method: ['create','update'],
      handler: ['before']
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseTitle}_bundle_formio.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // =========================================================
  // UI Buttons
  // =========================================================
  function addButtons(){
    const toolbar = document.querySelector('form[method="post"]') || document.body;
    if (!toolbar) return;

    // Button 1: flat form
    const btn1 = document.createElement('button');
    btn1.type = 'button';
    btn1.textContent = '-> Form.io JSON';
    btn1.style.marginLeft = '10px';
    btn1.style.padding = '6px 10px';
    btn1.style.fontSize = '12px';
    btn1.addEventListener('click', exportFlatForm);

    // Button 2: bundled project
    const btn2 = document.createElement('button');
    btn2.type = 'button';
    btn2.textContent = '-> Form.io Project';
    btn2.style.marginLeft = '10px';
    btn2.style.padding = '6px 10px';
    btn2.style.fontSize = '12px';
    btn2.addEventListener('click', exportBundleProject);

    const renderBtn = toolbar.querySelector('button[type="submit"]');
    if (renderBtn && renderBtn.parentNode) {
      renderBtn.parentNode.appendChild(btn1);
      renderBtn.parentNode.appendChild(btn2);
    } else {
      toolbar.appendChild(btn1);
      toolbar.appendChild(btn2);
    }
  }

  // =========================================================
  // init
  // =========================================================
  addButtons();
})();
