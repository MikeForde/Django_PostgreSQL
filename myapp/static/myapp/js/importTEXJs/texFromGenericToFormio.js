(function(){
  // ---------- helpers ----------
  function keyify(s){
    return (s || '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, '_$1')
      .slice(0, 80) || ('k_' + Math.random().toString(36).slice(2));
  }

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

  function toLowerCamelCase(s){
    const parts = String(s || '')
      .replace(/\.[A-Za-z0-9]+$/, '')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean);
    if (!parts.length) return 'importedForm';
    const head = parts[0].toLowerCase();
    const tail = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1));
    let out = [head, ...tail].join('');
    if (!/^[A-Za-z]/.test(out)) out = 'f' + out;
    if (out.length > 128) out = out.slice(0, 128);
    return out;
  }

  // ---------- generic control -> Form.io components ----------
  function genericControlToFormio(ctrl){
    const label   = ctrl.label || 'Field';
    const tooltip = ctrl.tooltip;
    const req     = !!ctrl.flags?.required;
    const kind    = ctrl.kind;

    // tiny sub-builders for compound parts
    function buildYesNoPart(part){
      return {
        type: 'radio',
        input: true,
        key: uniqueKey(part.label || label),
        label: part.label || label,
        tableView: true,
        inline: true,
        values: (part.options || []).map(o => ({
          value: o.value,
          label: o.label,
          shortcut: ''
        })),
        defaultValue: part.defaultValue || '',
        tooltip
      };
    }
    function buildNumberPart(part){
      return {
        type: 'number',
        input: true,
        key: uniqueKey(part.label || label),
        label: part.label || label,
        tableView: true,
        validate: { required: !!part.required, step: 'any' },
        suffix: part.unit || undefined,
        tooltip
      };
    }
    function buildDatePart(part){
      return {
        type: 'datetime',
        input: true,
        key: uniqueKey(part.label || label),
        label: part.label || label,
        tableView: true,
        labelPosition: 'left-left',
        enableDate: true,
        enableTime: false,
        datePicker: { showWeeks: true },
        validate: { required: !!part.required },
        tooltip
      };
    }
    function buildTextPart(part){
      return {
        type: 'textfield',
        input: true,
        key: uniqueKey(part.label || label),
        label: part.label || label,
        tableView: true,
        labelPosition: 'left-left',
        inputFormat: 'plain',
        validate: { required: !!part.required },
        tooltip
      };
    }

    switch(kind){

      case 'text':
        return [{
          type: 'textfield',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          inputFormat: 'plain',
          validate: { required: req },
          tooltip
        }];

      case 'number':
        return [{
          type: 'number',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          validate: { required: req, step: 'any' },
          suffix: ctrl.data?.unit || undefined,
          tooltip
        }];

      case 'date':
        return [{
          type: 'datetime',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          labelPosition: 'left-left',
          enableDate: true,
          enableTime: false,
          datePicker: { showWeeks: true },
          validate: { required: req },
          tooltip
        }];

      case 'checkbox':
        return [{
          type: 'checkbox',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          tooltip
        }];

      case 'radio':
        return [{
          type: 'radio',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          inline: true,
          values: (ctrl.data?.options || []).map(o => ({
            value: o.value,
            label: o.label,
            shortcut: ''
          })),
          defaultValue: ctrl.data?.defaultValue || '',
          tooltip
        }];

      case 'select-single':
        return [{
          type: 'select',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          dataSrc: 'values',
          data: {
            values: (ctrl.data?.options || []).map(o => ({
              value: o.value,
              label: o.label,
              shortcut: ''
            }))
          },
          multiple: false,
          defaultValue: ctrl.data?.defaultValue || '',
          template: '<span>{{ item.label }}</span>',
          tooltip
        }];

      case 'select-multi':
        return [{
          type: 'select',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          dataSrc: 'values',
          data: {
            values: (ctrl.data?.options || []).map(o => ({
              value: o.value,
              label: o.label,
              shortcut: ''
            }))
          },
          multiple: true,
          defaultValue: ctrl.data?.defaultValues || [],
          template: '<span>{{ item.label }}</span>',
          tooltip
        }];

      case 'textarea':
        return [{
          type: 'textarea',
          input: true,
          key: uniqueKey(label),
          label,
          tableView: true,
          rows: ctrl.data?.rows || 3,
          tooltip
        }];

      case 'link':
        return [{
          type: 'htmlelement',
          key: uniqueKey('link_' + label),
          tag: 'a',
          input: false,
          hideLabel: true,
          content: label,
          attrs: [{ attr: 'href', value: ctrl.data?.href || '#' }],
          className: '',
          tooltip
        }];

      case 'label':
        return [{
          type: 'htmlelement',
          key: uniqueKey('lbl_' + label),
          tag: 'p',
          input: false,
          hideLabel: true,
          content: label,
          tooltip
        }];

      case 'compound': {
        const parts = ctrl.data?.parts || [];
        const exploded = [];
        parts.forEach(p => {
          switch(p.subKind){
            case 'yesno':  exploded.push(buildYesNoPart(p));  break;
            case 'number': exploded.push(buildNumberPart(p)); break;
            case 'date':   exploded.push(buildDatePart(p));   break;
            case 'text':   exploded.push(buildTextPart(p));   break;
            default:
              break;
          }
        });
        return exploded;
      }

      default:
        // Safe fallback so we never silently drop a control
        return [{
          type: 'htmlelement',
          key: uniqueKey('fallback_' + label),
          tag: 'p',
          input: false,
          hideLabel: true,
          content: label,
          tooltip
        }];
    }
  }

  function genericToFormioComponents(genericControls){
    takenKeys.clear();
    const out = [];
    genericControls.forEach(gc => {
      const comps = genericControlToFormio(gc);
      comps.forEach(c => out.push(c));
    });
    return out;
  }

  // ---------- build Form.io flat format----------
  function makeFormioJSONFromComponents(baseTitle, atomicComponents){
    const lcKey   = toLowerCamelCase(baseTitle);

    const form = {
      display: 'form',
      type: 'form',
      title: baseTitle,
      name: lcKey,
      path: lcKey,
      components: atomicComponents
    };

    return form;
  }

  function exportFlatFromGeneric(){
    if (!window.getGenericSnapshot) {
      console.warn('getGenericSnapshot() is not available');
      return;
    }

    const snap = window.getGenericSnapshot(); // { title, controls, ...}
    const baseTitle = snap.title || 'Imported_TEX';

    const atomicComponents = genericToFormioComponents(snap.controls);
    const form = makeFormioJSONFromComponents(baseTitle, atomicComponents);

    const blob = new Blob([JSON.stringify(form, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseTitle}_formio_GENERIC.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // ---------- wrap in bundle project ----------
  function makeFormioBundleFromComponents(baseTitle, atomicComponents){
    const lcKey   = toLowerCamelCase(baseTitle);
    const formKey = lcKey + 'FormIoImported';

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

    return bundle;
  }

  // ---------- export fotmio project bundle using the generic snapshot ----------
  function exportBundleFromGeneric(){
    if (!window.getGenericSnapshot) {
      console.warn('getGenericSnapshot() is not available');
      return;
    }

    const snap = window.getGenericSnapshot(); // { title, controls, ...}
    const baseTitle = snap.title || 'Imported_TEX';

    const atomicComponents = genericToFormioComponents(snap.controls);
    const bundle = makeFormioBundleFromComponents(baseTitle, atomicComponents);

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseTitle}_bundle_formio_GENERIC.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // ---------- UI button ----------
  function addGenericFormioJSONButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to Public/GitHub Form.io JSON format';
    styleBtn(btn);
    btn.addEventListener('click', exportFlatFromGeneric);
    mount.appendChild(btn);

    function styleBtn(b){
      b.style.marginLeft = '5px';
      b.style.padding = '6px 10px';
      b.style.fontSize = '12px';
      b.style.border = '1px solid #888';
      b.style.borderRadius = '4px';
      b.style.background = '#f5f5f5';
      b.style.cursor = 'pointer';
      b.style.transition = 'background 0.2s, box-shadow 0.2s';

      b.addEventListener('mouseenter', () => {
        b.style.background = '#eaeaea';
        b.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
      });
      b.addEventListener('mouseleave', () => {
        b.style.background = '#f5f5f5';
        b.style.boxShadow = 'none';
      });
      b.addEventListener('mousedown', () => {
        b.style.background = '#ddd';
      });
      b.addEventListener('mouseup', () => {
        b.style.background = '#eaeaea';
      });

      // Add the logo image
      const img = document.createElement('img');
      img.src = '/static/myapp/images/formio-logo.png'; // static path
      img.alt = 'Export to Form.io JSON';
      img.style.height = '14px';
      img.style.width = 'auto';
      img.style.display = 'block';
      img.style.pointerEvents = 'none'; // let the button handle clicks
      b.appendChild(img);
    }
  }

  function addGenericFormioProjectButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to Enterprise Form.io Project Template Import Format';
    styleBtn(btn);
    btn.addEventListener('click', exportBundleFromGeneric);
    mount.appendChild(btn);

    function styleBtn(b){
      b.style.marginLeft = '5px';
      b.style.padding = '6px 10px';
      b.style.fontSize = '12px';
      b.style.border = '1px solid #888';
      b.style.borderRadius = '4px';
      b.style.background = '#f5f5f5';
      b.style.cursor = 'pointer';
      b.style.transition = 'background 0.2s, box-shadow 0.2s';

      b.addEventListener('mouseenter', () => {
        b.style.background = '#eaeaea';
        b.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
      });
      b.addEventListener('mouseleave', () => {
        b.style.background = '#f5f5f5';
        b.style.boxShadow = 'none';
      });
      b.addEventListener('mousedown', () => {
        b.style.background = '#ddd';
      });
      b.addEventListener('mouseup', () => {
        b.style.background = '#eaeaea';
      });

      // Add the logo image
      const img = document.createElement('img');
      img.src = '/static/myapp/images/formio-logo-bg.png'; // static path
      img.alt = 'Export to Form.io Project';
      img.style.height = '14px';
      img.style.width = 'auto';
      img.style.display = 'block';
      img.style.pointerEvents = 'none'; // let the button handle clicks
      b.appendChild(img);
    }
  }

  // init
  addGenericFormioJSONButton();
  addGenericFormioProjectButton();
})();
