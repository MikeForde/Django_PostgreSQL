
(function () {
  // ==========================
  // Button (same look/feel)
  // ==========================
  function addOpenTextExportButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to OpenText Schema JSON format';
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

    const img1 = document.createElement('img');
    img1.src = '/static/myapp/images/OpenText-logo-SO4.png';
    img1.alt = 'Export to OpenText Schema JSON format';
    img1.style.height = '14px';
    img1.style.width = 'auto';
    img1.style.display = 'block';
    img1.style.pointerEvents = 'none';
    btn.appendChild(img1);

    btn.addEventListener('click', exportToOpenTextFromGeneric);
    mount.appendChild(btn);
    }

  // ==========================
  // Helpers (no DOM scraping)
  // ==========================
  function uuidv4(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }
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
  function getBaseName(){
    const label = document.getElementById('selected-tex-label')?.textContent?.trim();
    const h1    = document.querySelector('h1')?.textContent?.trim();
    const base  = (label && label.toLowerCase() !== 'no tex file selected' ? label : h1) || 'OpenText_Schema';
    return base.replace(/\s+/g,'_');
  }

  // ==========================
  // OpenText property builders
  // ==========================
  function propBoolean(title){
    return { type: 'boolean', otFormat: { repeating: false }, title: title || 'Checkbox' };
  }
  function propToggle(title){
    return { type: 'boolean', otFormat: { presentationType: 'toggle' }, title: (title ? (title + ' - Yes/No') : 'Yes/No') };
  }
  function propDate(title){
    return { type: 'string', otFormat: { dataType: 'date', repeating: false }, format: 'date', title: title || 'Date', maxLength: 64 };
  }
  function propNumber(title){
    return { type: 'number', otFormat: { repeating: false }, title: title || 'Number' };
  }
  function propText(title){
    return { type: 'string', otFormat: { repeating: false }, title: title || 'Text', maxLength: 64 };
  }
  function propTextarea(title){
    return { type: 'string', otFormat: { presentationType: 'textarea', repeating: false }, title: title || 'Text', maxLength: 4096 };
  }
  function propSelectbox(title, values, def){
    const enums = (values || []).map(v => String(v));
    const out = {
      type: 'string',
      otFormat: { presentationType: 'selectbox', repeating: false },
      title: title || 'Selectbox',
      maxLength: 128,
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
    };
    if (Array.isArray(defArr) && defArr.length) out.default = defArr.map(v => String(v));
    return out;
  }

  // ==========================
  // Mapping from generic controls
  // ==========================
  function looksYesNoOptions(opts){
    if (!Array.isArray(opts) || opts.length !== 2) return false;
    const L = opts.map(o => (o.label || o.value || '').toLowerCase().trim());
    return (L.includes('yes') && L.includes('no')) ||
           (L.includes('true') && L.includes('false')) ||
           (L.includes('y') && L.includes('n'));
  }

  function emitFromGenericControl(ctrl, properties, requiredArr){
    const label = ctrl.label || 'Field';
    const k = () => uniquePropKey(label);

    switch (ctrl.kind) {
      case 'checkbox': {
        const key = k();
        properties[key] = propBoolean(label);
        if (ctrl.data && typeof ctrl.data.checked === 'boolean') properties[key].default = ctrl.data.checked;
        if (ctrl.flags?.required) requiredArr.push(key);
        break;
      }
      case 'radio':
      case 'select-single': {
        const opts = Array.isArray(ctrl.data?.options) ? ctrl.data.options : [];
        if (looksYesNoOptions(opts)) {
          const key = k();
          properties[key] = propToggle(label);
          const def = ctrl.data?.defaultValue;
          if (def != null) properties[key].default =
            /^(yes|true|1)$/i.test(String(def)) ||
            String(def).toLowerCase() === String(opts.find(o => /yes/i.test(o.label || o.value))?.value || '').toLowerCase();
          if (ctrl.flags?.required) requiredArr.push(key);
        } else {
          const key = k();
          properties[key] = propSelectbox(label, opts.map(o => o.value ?? o.label), ctrl.data?.defaultValue ?? '');
          if (ctrl.flags?.required) requiredArr.push(key);
        }
        break;
      }
      case 'select-multi': {
        const opts = Array.isArray(ctrl.data?.options) ? ctrl.data.options : [];
        const key = k();
        properties[key] = propMultiselect(label, opts.map(o => o.value ?? o.label), ctrl.data?.defaultValues || []);
        if (ctrl.flags?.required) requiredArr.push(key);
        break;
      }
      case 'date': {
        const key = k();
        properties[key] = propDate(label);
        if (ctrl.data?.defaultDate) properties[key].default = ctrl.data.defaultDate;
        if (ctrl.flags?.required) requiredArr.push(key);
        break;
      }
      case 'number': {
        const key = k();
        properties[key] = propNumber(label);
        if (typeof ctrl.data?.defaultNumber === 'number') properties[key].default = ctrl.data.defaultNumber;
        if (ctrl.flags?.required) requiredArr.push(key);
        break;
      }
      case 'textarea': {
        const key = k();
        properties[key] = propTextarea(label);
        if (ctrl.data?.defaultText) properties[key].default = ctrl.data.defaultText;
        if (ctrl.flags?.required) requiredArr.push(key);
        break;
      }
      case 'text': {
        const key = k();
        properties[key] = propText(label);
        if (ctrl.data?.defaultText) properties[key].default = ctrl.data.defaultText;
        if (ctrl.flags?.required) requiredArr.push(key);
        break;
      }
      case 'link':
      case 'label': {
        // Non-inputs: still emit string so downstream has a place to store text if needed.
        const key = k();
        properties[key] = propText(label);
        if (ctrl.flags?.required) requiredArr.push(key);
        break;
      }
      case 'compound': {
        // explode parts
        const parts = Array.isArray(ctrl.data?.parts) ? ctrl.data.parts : [];
        parts.forEach((p, idx) => {
          const pLabel = p.label || `${label} part ${idx+1}`;
          const key = uniquePropKey(pLabel);
          switch (p.subKind) {
            case 'yesno':
              properties[key] = propToggle(pLabel);
              if (typeof p.default === 'boolean') properties[key].default = p.default;
              break;
            case 'text':
              properties[key] = propText(pLabel);
              if (p.defaultText) properties[key].default = p.defaultText;
              break;
            case 'number':
              properties[key] = propNumber(pLabel);
              if (typeof p.defaultNumber === 'number') properties[key].default = p.defaultNumber;
              break;
            case 'date':
              properties[key] = propDate(pLabel);
              if (p.defaultDate) properties[key].default = p.defaultDate;
              break;
            default:
              properties[key] = propText(pLabel);
          }
          if (p.required || ctrl.flags?.required) requiredArr.push(key);
        });
        break;
      }
      default: {
        // fallback → text
        const key = k();
        properties[key] = propText(label);
        if (ctrl.flags?.required) requiredArr.push(key);
      }
    }
  }

  // ==========================
  // Exporter (from generic snapshot)
  // ==========================
  function exportToOpenTextFromGeneric(){
    if (!window.getGenericSnapshot) {
      console.warn('getGenericSnapshot() not available');
      return;
    }

    takenPropKeys.clear();

    const snap = window.getGenericSnapshot(); // { title, controls: [...] }
    const controls = Array.isArray(snap?.controls) ? snap.controls : [];

    const schema = {
      $id: `https://www.opentext.com/ocp/devx/ui/${(document.location.host || 'local')}/1.0/` + uuidv4(),
      type: 'object',
      properties: {},
      required: []
    };

    controls.forEach(ctrl => emitFromGenericControl(ctrl, schema.properties, schema.required));
    if (!schema.required.length) delete schema.required;

    const fileName = `${getBaseName()}_opentext.json`;
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // Expose + auto-init
  window.addOpenTextExportButton = addOpenTextExportButton;
  document.addEventListener('DOMContentLoaded', () => {
    try { addOpenTextExportButton(); } catch (e) { console.debug('OpenText export init skipped.', e); }
  });
})();
