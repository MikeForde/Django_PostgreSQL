
(function () {
  // ==========================
  // Button
  // ==========================
  function addOpenTextUIExportButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to OpenText Developer Workbench JSON format';
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
    img1.src = '/static/myapp/images/OpenText-logo.png';
    img1.alt = 'Export to OpenText Developer Workbench JSON format';
    img1.style.height = '14px';
    img1.style.width = 'auto';
    img1.style.display = 'block';
    img1.style.pointerEvents = 'none';
    btn.appendChild(img1);

    btn.addEventListener('click', exportToOpenTextUIFromGeneric);
    mount.appendChild(btn);
  }

  // ==========================
  // Helpers (no scraping)
  // ==========================
  function uuidv4(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
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
    let i = 2; while (takenPropKeys.has(k + '_' + i)) i++;
    k = k + '_' + i; takenPropKeys.add(k); return k;
  }
  function titlePartsFromSnapshot(snap){
    const raw = (snap?.title || snap?.texName || 'Generated_Template').trim();
    const display = raw.replace(/\.[Tt][Ee][Xx]$/,'').replace(/_/g,' ').replace(/\s+/g,' ').trim();
    const name = keyify(display).toLowerCase();
    return { displayName: display, name };
  }

  // ==========================
  // OpenText schema property builders
  // ==========================
  function propBoolean(title){
    return { type:'boolean', otFormat:{ repeating:false }, title: title || 'Checkbox' };
  }
  function propToggle(title){
    return { type:'boolean', otFormat:{ presentationType:'toggle' }, title: (title ? (title + ' - Yes/No') : 'Yes/No') };
  }
  function propDate(title){
    return { type:'string', otFormat:{ dataType:'date', repeating:false }, format:'date', title: title || 'Date', maxLength:64 };
  }
  function propNumber(title){
    return { type:'number', otFormat:{ repeating:false }, title: title || 'Number' };
  }
  function propText(title){
    return { type:'string', otFormat:{ repeating:false }, title: title || 'Text', maxLength:64 };
  }
  function propTextarea(title){
    return { type:'string', otFormat:{ presentationType:'textarea', repeating:false }, title: title || 'Text', maxLength:4096 };
  }
  function propSelectbox(title, values, def){
    const out = {
      type:'string',
      otFormat:{ presentationType:'selectbox', repeating:false },
      title: title || 'Selectbox',
      maxLength:64,
      enum: (values||[]).map(String)
    };
    if (def != null && def !== '') out.default = String(def);
    return out;
  }
  function propMultiselect(title, values, defArr){
    const out = {
      type:'array',
      items:{ type:'string', enum:(values||[]).map(String) },
      otFormat:{ presentationType:'multiselect', repeating:false },
      title: title || 'Multi Select',
      maxLength:64
    };
    if (Array.isArray(defArr) && defArr.length) out.default = defArr.map(String);
    return out;
  }

  function looksYesNoOptions(opts){
    if (!Array.isArray(opts) || opts.length !== 2) return false;
    const L = opts.map(o => (o.label || o.value || '').toLowerCase().trim());
    return (L.includes('yes') && L.includes('no')) ||
           (L.includes('true') && L.includes('false')) ||
           (L.includes('y') && L.includes('n'));
  }

  // ==========================
  // Schema from generic controls
  // ==========================
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
          if (def != null) {
            const yesVal = (opts.find(o => /yes/i.test(o.label || o.value))?.value || '').toLowerCase();
            properties[key].default =
              /^(yes|true|1)$/i.test(String(def)) || String(def).toLowerCase() === yesVal;
          }
          if (ctrl.flags?.required) requiredArr.push(key);
        } else {
          const key = k();
          // enum uses labels (user-facing), as per your example
          properties[key] = propSelectbox(
            label,
            opts.map(o => o.label || o.value || ''),
            ctrl.data?.defaultValue ?? ''
          );
          if (ctrl.flags?.required) requiredArr.push(key);
        }
        break;
      }
      case 'select-multi': {
        const opts = Array.isArray(ctrl.data?.options) ? ctrl.data.options : [];
        const key = k();
        properties[key] = propMultiselect(
          label,
          opts.map(o => o.label || o.value || ''),
          ctrl.data?.defaultValues || []
        );
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
      default: {
        const key = k();
        properties[key] = propText(label);
        if (ctrl.flags?.required) requiredArr.push(key);
      }
    }
  }

  // ==========================
  // Design layer from generic controls
  // ==========================
  function controlId() {
    // 'c' + 30-hex (OT-like)
    return 'c' + Array.from({length:15}, () => Math.floor(Math.random()*256)
      .toString(16).padStart(2,'0')).join('');
  }

  function makeCanvas(id){
    return {
      id,
      data:{
        designer:{
          allowHeightToBeResized:true, isContainer:true,
          grid:{ inheritParentColumnCount:true, numberOfColumns:4, numberOfRows:0 }
        },
        id,
        runtime:{
          backgroundColor:"",
          controls:[],
          displayName:"Canvas",
          height:{ unit:"px", value:"52" },
          parentId:"",
          placeholder:"",
          propertyPath:"",
          readOnly:false, repeating:false, required:false, schemaId:"", sort:"", tooltip:"",
          type:"canvas",
          user:{ showGroups:false, showUsers:false },
          width:{ unit:"%", value:100 },
          themes:{},
          rearrangeControlsForSmallScreens:true
        }
      },
      schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls"
    };
  }
  function makeFormContainer(id, parentId){
    return {
      id,
      data:{
        designer:{
          allowHeightToBeResized:true, isContainer:true,
          grid:{ inheritParentColumnCount:true, numberOfColumns:4, numberOfRows:0 }
        },
        id,
        runtime:{
          backgroundColor:"",
          controls:[],
          displayName:"Form control",
          height:{ unit:"px", value:"52" },
          parentId,
          placeholder:"",
          propertyPath:"",
          readOnly:false, repeating:false, required:false, schemaId:"", sort:"", tooltip:"",
          type:"form-container",
          user:{ showGroups:false, showUsers:false },
          width:{ unit:"%", value:100 },
          themes:{},
          rearrangeControlsForSmallScreens:true
        }
      },
      schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls"
    };
  }
  function makeGrid(id, parentId){
    return {
      id,
      data:{
        designer:{ allowHeightToBeResized:true, isContainer:true },
        id,
        runtime:{
          backgroundColor:"",
          controls:[],
          displayName:"Grid container",
          height:{ unit:"px", value:512 },
          parentId,
          placeholder:"",
          propertyPath:"",
          readOnly:false, repeating:false, required:false, schemaId:"", sort:"", tooltip:"",
          type:"responsive-form-grid",
          user:{ showGroups:false, showUsers:false },
          width:{ unit:"%", value:800 },
          themes:{},
          border:{ borderRadius:"", color:"", onBottom:true, onLeft:true, onRight:true, onTop:true, style:"",
            width:{ value:"", unit:"px" } },
          grid:{ gap:16, numberOfColumns:4, padding:16 }
        }
      },
      schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls"
    };
  }
  function makeButton(text, parentGridId, row){
    const id = controlId();
    return {
      data:{
        designer:{ allowHeightToBeResized:true, isContainer:false },
        id,
        runtime:{
          backgroundColor:"",
          controls:[],
          displayName:"Button",
          height:{ unit:"px", value:32 },
          parentId: parentGridId,
          placeholder:"",
          propertyPath:"",
          readOnly:false, repeating:false, required:false, schemaId:"", sort:"", tooltip:"",
          type:"button",
          user:{ showGroups:false, showUsers:false },
          width:{ unit:"%", value:200 },
          themes:{},
          label:{
            alignment:"start",
            font:{ alignment:"", color:"", decoration:"", family:"", size:"", style:"", weight:"" },
            position:"column",
            show:true,
            text: text || "Button",
            width:""
          },
          border:{ borderRadius:"", color:"", onBottom:true, onLeft:true, onRight:true, onTop:true, style:"",
            width:{ value:"", unit:"px" } },
          disabled:false,
          gridChild:{ gridColumnEnd:1, gridColumnStart:1, gridRowEnd:1, gridRowStart: row }
        }
      },
      schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls",
      id
    };
  }

  function buildDesignLayerFromGeneric(snap){
    const canvasId = controlId();
    const formId   = controlId();
    const gridId   = controlId();

    const controls = [];
    const canvas = makeCanvas(canvasId); controls.push(canvas);
    const form   = makeFormContainer(formId, canvasId); controls.push(form);
    const grid   = makeGrid(gridId, formId); controls.push(grid);

    const childIds = [];

    // For each select control in the generic snapshot, make a “dropdown-like” button in order
    let row = 1;
    const genericControls = Array.isArray(snap?.controls) ? snap.controls : [];
    genericControls.forEach(c => {
      if (c.kind === 'select-single' || c.kind === 'select-multi') {
        const label = (c.label || 'Select').trim();
        const text = (c.kind === 'select-multi') ? (label + '▾') : (label + '▾');
        const btn = makeButton(text, gridId, row++);
        controls.push(btn);
        childIds.push(btn.id);
      }
    });

    // Add standard action buttons (OK / Cancel / Prev Data), like your example
    ['OK','Cancel','Prev Data'].forEach(txt => {
      const btn = makeButton(txt, gridId, row++);
      controls.push(btn);
      childIds.push(btn.id);
    });

    // attach child IDs to grid
    const gridEntry = controls.find(c => c.id === gridId);
    if (gridEntry) gridEntry.data.runtime.controls = childIds.slice();

    return controls;
  }

  // ==========================
  // Exporter (generic → OpenText UI JSON)
  // ==========================
  function exportToOpenTextUIFromGeneric(){
    if (!window.getGenericSnapshot) {
      console.warn('getGenericSnapshot() not available');
      return;
    }

    takenPropKeys.clear();

    const snap = window.getGenericSnapshot(); // { texName, title, controls: [...] }
    const { displayName, name } = titlePartsFromSnapshot(snap);

    // --- Schema
    const schema = {
      required: [],
      properties: {},
      $id: `https://www.opentext.com/ocp/devx/ui/${(document.location.host || 'local')}/1.0/` + uuidv4(),
      type: 'object'
    };

    const controls = Array.isArray(snap?.controls) ? snap.controls : [];
    controls.forEach(ctrl => emitFromGenericControl(ctrl, schema.properties, schema.required));
    if (!schema.required.length) delete schema.required;

    // --- Design
    const designControls = buildDesignLayerFromGeneric(snap);

    // --- Top-level UI payload
    const compId = uuidv4();
    const payload = {
      id: compId,
      schemaId: "https://www.opentext.com/ocp/devx/ui/1.0.0/UIComponent",
      data: {
        namespace: "ttmickp",
        name,
        displayName,
        description: "",
        versionLabels: [""],
        defaultLocale: "en",
        content: {
          schema,
          design: { controls: designControls },
          localizations: {},
          formSchema: { required: [] },
          designSchemaId: "https://www.opentext.com/ocp/devx/ui/2.0.0/Design"
        },
        localizations: {}
      },
      serviceName: "ui"
    };

    // --- Download
    const baseName = displayName.replace(/\s+/g,'_') || 'TT_Template';
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}_opentext_ui.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // expose + auto-init
  window.addOpenTextUIExportButton = addOpenTextUIExportButton;
  document.addEventListener('DOMContentLoaded', () => {
    try { addOpenTextUIExportButton(); } catch (e) { console.debug('OpenText UI export init skipped.', e); }
  });
})();

