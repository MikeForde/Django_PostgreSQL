// --- moved from import_tex.html ---
(function () {
  function addOpenTextUIExportButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    // Button 1: flat Form.io JSON export (image styled as normal button)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to OpenText Developer Workbench JSON format';
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
    img1.src = '/static/myapp/images/OpenText-logo.png'; // path for formio-logo.png
    img1.alt = 'Export to OpenText Developer Workbench JSON format';
    img1.style.height = '14px';
    img1.style.width = 'auto';
    img1.style.display = 'block';
    img1.style.pointerEvents = 'none';
    btn.appendChild(img1);

    // Click handler
    btn.addEventListener('click', exportToOpenTextUI);
    mount.appendChild(btn);
  }

  // ===== Helpers (shared with prior exporters) ================================
  const CANVAS = document.getElementById('canvas') || document;
  function q(sel, root=CANVAS){ return root.querySelector(sel); }
  function qa(sel, root=CANVAS){ return Array.from(root.querySelectorAll(sel)); }
  function txt(n){ return (n && (n.textContent || '').trim()) || ''; }

  function keyify(s){
    return (s || '')
      .replace(/[^A-Za-z0-9_]+/g,'_')
      .replace(/^_+|_+$/g,'')
      .replace(/^(\d)/,'_$1')
      .slice(0, 80) || ('k_' + Math.random().toString(36).slice(2));
  }

  const takenPropKeys = new Set();
  function uniquePropKey(base, fallbackPrefix='field'){
    let k = keyify(base) || (fallbackPrefix + '_' + Math.random().toString(36).slice(2));
    if (!takenPropKeys.has(k)) { takenPropKeys.add(k); return k; }
    let i = 2; while (takenPropKeys.has(k + '_' + i)) i++;
    k = k + '_' + i; takenPropKeys.add(k); return k;
  }

  function uuidv4(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  }

  function getDisplayTitle(){
    const explicit = document.getElementById('selected-tex-label')?.textContent?.trim();
    if (explicit && explicit.toLowerCase() !== 'no tex file selected') return explicit;
    const libSel = document.querySelector('#lib-pane-list select');
    if (libSel && libSel.value) return libSel.value;
    return (document.querySelector('h1')?.textContent || 'Generated_Template').trim();
  }

  // Prefer classic readlist caption we inject
  function findLabelFor(el, scope){
    const root = scope || el.closest('.ctrl') || CANVAS;
    if (el.id){
      const m = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (m){ const t = txt(m); if (t) return t; }
    }
    const wrap = el.closest('label');
    if (wrap){ const t = txt(wrap); if (t) return t; }

    // Classic ReadList helpers
    const rl = el.closest('.rl-wrap');
    if (rl){
      const capEl = rl.querySelector('.rl-caption');
      if (capEl){ const t = txt(capEl); if (t) return t; }
      const capAttr = rl.getAttribute('data-caption');
      if (capAttr && capAttr.trim()) return capAttr.trim();
    }

  // aria-label as last-ditch caption (classic select has it)
  const aria = el.getAttribute && el.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();

  let p = el.previousElementSibling;
  if (p && /^(LABEL|SPAN|STRONG|DIV)$/i.test(p.tagName)){ const t = txt(p); if (t) return t; }
  const fs = el.closest('fieldset'); const lg = fs?.querySelector('legend');
  if (lg){ const t = txt(lg); if (t) return t; }
  return el.name || el.placeholder || 'Field';
}


  // Readcode meta (first non-empty line): code — label
  function readcodeInfo(el){
    const host = el.closest('.readcode-host');
    if (!host) return {};
    const blob = host.getAttribute('data-readcodes') || '';
    const line = (blob.replace(/\\u000A/gi,'\n').split(/\r?\n/).find(l => /\S/.test(l)) || '').trim();
    if (!line) return {};
    const parts = line.split('—');
    const code = (parts[0] || '').trim();
    const label = (parts.slice(1).join('—') || '').trim();
    return { code, label };
  }

  function isClassicYesNo(ctrl){
    const yes = ctrl.querySelector('.rc-yes-label input.rc-yesno');
    const no  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
    return !!(yes || no);
  }
  function isClassicReadList(ctrl){
    return !!(ctrl.querySelector('.rl-wrap') ||
              ctrl.querySelector('select[name^="Readlist"]') ||
              ctrl.querySelector('select[id^="Readlist"]'));
  }

  // ===== OpenText property builders ==========================================
  function propBoolean(title){
    return { type:'boolean', otFormat:{ repeating:false }, title: title || 'Checkbox' };
  }
  function propToggle(title){
    return { type:'boolean', otFormat:{ presentationType:'toggle' }, title: (title ? title + ' - Yes/No' : 'Text - Yes/No') };
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

  // ===== Schema mappers (same behavior as previous exporter) ==================
  function mapClassicReadCode(ctrl, properties){
    if (isClassicYesNo(ctrl)){
      const label = txt(ctrl.querySelector('.rc-prompt')) || 'Question';
      const key = uniquePropKey(label, 'toggle');
      properties[key] = propToggle(label);
      const yes = ctrl.querySelector('.rc-yes-label input.rc-yesno');
      const no  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
      if (yes?.checked || no?.checked) properties[key].default = !!(yes && yes.checked);
      return;
    }
    const textEl = ctrl.querySelector('input[type="text"][name$="_text"]');
    const valEl  = ctrl.querySelector('input[type="text"][name$="_val"], input[type="number"][name$="_val"], input.rc-val');
    const dateEl = ctrl.querySelector('input[type="date"]');
    const chk    = ctrl.querySelector('input.rc-chk');

    if (textEl && !valEl && !dateEl){
      const label = txt(ctrl.querySelector('.rc-prompt')) || readcodeInfo(textEl).label || 'Text';
      const key = uniquePropKey(label, 'text');
      properties[key] = propText(label);
      if (textEl.value) properties[key].default = textEl.value;
      return;
    }
    if (dateEl && !valEl && !textEl){
      const label = txt(ctrl.querySelector('.rc-prompt')) || readcodeInfo(dateEl).label || 'Date';
      const key = uniquePropKey(label, 'date');
      properties[key] = propDate(label);
      if (dateEl.value) properties[key].default = dateEl.value;
      return;
    }
    if (valEl && !textEl && !dateEl){
      const label = txt(ctrl.querySelector('.rc-prompt')) || 'Number';
      const key = uniquePropKey(label, 'number');
      properties[key] = propNumber(label);
      const n = parseFloat(valEl.value); if (!isNaN(n)) properties[key].default = n;
      return;
    }
    if (chk){
      const label = txt(ctrl.querySelector('.rc-prompt')) || 'Checkbox';
      const key = uniquePropKey(label, 'checkbox');
      properties[key] = propBoolean(label);
      properties[key].default = !!chk.checked;
      if (textEl){
        const k2 = uniquePropKey(label + '_text', 'text');
        properties[k2] = propText(label + ' (text)');
        if (textEl.value) properties[k2].default = textEl.value;
      }
      if (valEl){
        const k3 = uniquePropKey(label + '_value', 'number');
        properties[k3] = propNumber(label + ' (value)');
        const n = parseFloat(valEl.value); if (!isNaN(n)) properties[k3].default = n;
      }
      if (dateEl){
        const k4 = uniquePropKey(label + '_date', 'date');
        properties[k4] = propDate(label + ' (date)');
        if (dateEl.value) properties[k4].default = dateEl.value;
      }
    }
  }

  function mapClassicReadList(ctrl, properties){
    const select = ctrl.querySelector('select');
    if (!select) return;

    const label = findLabelFor(select, ctrl);

    // Build options; ignore the placeholder (usually value="" and disabled/hidden/selected)
    const opts = Array.from(select.querySelectorAll('option')).map(o => ({
      value: (o.value || '').trim(),
      label: txt(o),
      isPlaceholder:
        (!o.value || o.value === '') &&
        (o.disabled || o.hidden || o.hasAttribute('disabled') || o.hasAttribute('hidden') || o.hasAttribute('selected'))
    })).filter(o => o.label && !o.isPlaceholder);

    // Enum must be the user-facing labels (not Read codes)
    const enumLabels = opts.map(o => o.label);

    const multiple = !!select.multiple;
    const key = uniquePropKey(label, multiple ? 'multi_select' : 'selectbox');

    if (multiple){
      const defLabels = Array.from(select.selectedOptions || [])
        .map(o => txt(o))
        .filter(Boolean);
      properties[key] = propMultiselect(label, enumLabels, defLabels);
    } else {
      const selected = select.selectedOptions && select.selectedOptions[0];
      const defLabel = selected ? txt(selected) : '';
      properties[key] = propSelectbox(label, enumLabels, defLabel || undefined);
    }
  }

  function mapGeneric(ctrl, properties){
    // radios group
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
          let l = ''; const wrap = r.closest('label'); if (wrap) l = txt(wrap);
          if (!l && r.nextSibling && r.nextSibling.nodeType===3) l = (r.nextSibling.nodeValue||'').trim();
          if (!l) l = r.value || 'Option';
          const v = r.value || keyify(l);
          if (seen.has(v)) return; seen.add(v);
          options.push({v,l});
        });
        const labelsLower = options.map(o => o.l.toLowerCase());
        const looksYesNo = (options.length===2 && labelsLower.includes('yes') && labelsLower.includes('no'));
        if (looksYesNo){
          const key = uniquePropKey(label, 'toggle');
          properties[key] = propToggle(label);
          const def = (group.find(r => r.checked) || {}).value || '';
          if (def){
            const yesV = (options.find(o => /yes/i.test(o.l))?.v || '').toLowerCase();
            properties[key].default = def.toLowerCase() === yesV;
          }
        } else {
          const key = uniquePropKey(label, 'selectbox');
          properties[key] = propSelectbox(label, options.map(o=>o.v), (group.find(r=>r.checked)||{}).value || '');
        }
      });
    }

    const selects = Array.from(ctrl.querySelectorAll('select'));
    selects.forEach(sel => {
      const label = findLabelFor(sel, ctrl);

      const opts = Array.from(sel.querySelectorAll('option')).map(o => ({
        value: (o.value || '').trim(),
        label: txt(o),
        isPlaceholder:
          (!o.value || o.value === '') &&
          (o.disabled || o.hidden || o.hasAttribute('disabled') || o.hasAttribute('hidden') || o.hasAttribute('selected'))
      })).filter(o => o.label && !o.isPlaceholder);

      const enumLabels = opts.map(o => o.label);
      const multiple = !!sel.multiple;
      const key = uniquePropKey(label, multiple ? 'multi_select' : 'selectbox');

      if (multiple){
        const defLabels = Array.from(sel.selectedOptions || [])
          .map(o => txt(o))
          .filter(Boolean);
        properties[key] = propMultiselect(label, enumLabels, defLabels);
      } else {
        const selected = sel.selectedOptions && sel.selectedOptions[0];
        const defLabel = selected ? txt(selected) : '';
        properties[key] = propSelectbox(label, enumLabels, defLabel || undefined);
      }
    });

    // checkboxes
    const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
    checks.forEach(ch => {
      const label = findLabelFor(ch, ctrl);
      const key = uniquePropKey(label, 'checkbox');
      properties[key] = propBoolean(label);
      properties[key].default = !!ch.checked;
    });

    // dates
    const dates = Array.from(ctrl.querySelectorAll('input[type="date"]'));
    dates.forEach(d => {
      const label = findLabelFor(d, ctrl);
      const key = uniquePropKey(label, 'date');
      properties[key] = propDate(label);
      if (d.value) properties[key].default = d.value;
    });

    // textareas
    const areas = Array.from(ctrl.querySelectorAll('textarea'));
    areas.forEach(a => {
      const label = findLabelFor(a, ctrl);
      const key = uniquePropKey(label, 'text');
      properties[key] = propText(label);
      if (a.value) properties[key].default = a.value;
    });

    // text/number
    const inputs = Array.from(ctrl.querySelectorAll('input[type="text"],input[type="number"]')).filter(i=>!i.readOnly);
    inputs.forEach(i => {
      const label = findLabelFor(i, ctrl);
      const isNumeric = (i.type==='number') || i.classList.contains('rc-val') || i.getAttribute('inputmode')==='decimal';
      const key = uniquePropKey(label, isNumeric ? 'number' : 'text');
      if (isNumeric){
        properties[key] = propNumber(label);
        const n = parseFloat(i.value); if (!isNaN(n)) properties[key].default = n;
      } else {
        properties[key] = propText(label);
        if (i.value) properties[key].default = i.value;
      }
    });
  }

  // ======== DESIGN LAYER (buttons, labels, links) =============================
  // We lay out simple design controls into a responsive grid. We don’t try to
  // preserve XY — we put them in rows: Label(s), Link(s), Button(s).
  function buildDesignLayer(){
    const idCanvas = controlId();
    const idForm   = controlId();
    const idGrid   = controlId();

    // Collect UI elements
    const labels = qa('.ctrl label').filter(l => {
      // ignore labels that are direct for inputs (they’ll be data fields)
      return !l.htmlFor && !l.querySelector('input,select,textarea') && txt(l);
    });
    const links  = qa('.ctrl a[href]');
    const buttons= qa('.ctrl button');

    function controlId() {
      // always start with lowercase 'c' followed by 31 hex chars
      return 'c' + crypto.getRandomValues(new Uint8Array(15))
        .reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
    }

    const OT_FONT_SIZES = [8, 10, 12, 14, 16, 20, 24, 32, 48, 64];

    function snapOTFontSize(px){
      const n = Math.round(parseFloat(px));
      if (!isFinite(n)) return "";            // leave empty if we can't parse
      let best = OT_FONT_SIZES[0], diff = Math.abs(n - best);
      for (const s of OT_FONT_SIZES){
        const d = Math.abs(n - s);
        if (d < diff){ best = s; diff = d; }
      }
      return `${best}px`;
    }

    // Convert CSS color to {r,g,b} or null
    function parseRGB(color){
      if (!color) return null;

      // #rgb / #rrggbb
      const hex = color.trim().toLowerCase();
      let m = hex.match(/^#([0-9a-f]{3})$/i);
      if (m){
        const h = m[1];
        return {
          r: parseInt(h[0]+h[0], 16),
          g: parseInt(h[1]+h[1], 16),
          b: parseInt(h[2]+h[2], 16),
        };
      }
      m = hex.match(/^#([0-9a-f]{6})$/i);
      if (m){
        const h = m[1];
        return {
          r: parseInt(h.slice(0,2),16),
          g: parseInt(h.slice(2,4),16),
          b: parseInt(h.slice(4,6),16),
        };
      }

      // rgb()/rgba()
      m = color.match(/^rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      if (m){
        return { r: +m[1], g: +m[2], b: +m[3] };
      }

      // basic names (just a couple for safety)
      const names = { red: {r:255,g:0,b:0}, blue:{r:0,g:0,b:255}, black:{r:0,g:0,b:0} };
      const named = names[hex];
      return named || null;
    }

    // Map to the OT-approved palette:
    // - black/anything-else → #000000
    // - red-ish → #e00051
    // - blue-ish → #0084ce
    function normalizeOTColor(color){
      const rgb = parseRGB(color);
      if (!rgb) return "#000000";

      const { r, g, b } = rgb;
      // quick dominance checks (tuned to be forgiving)
      const isRed  = (r - Math.max(g,b)) >= 40;
      const isBlue = (b - Math.max(r,g)) >= 40;

      if (isRed)  return "#e00051";
      if (isBlue) return "#0084ce";
      return "#000000";
    }

    function pxInt(px){
      const n = parseFloat(px);
      if (isNaN(n)) return "";
      return `${Math.round(n)}px`;
    }

    // Helper to make a design control block with grid coords
    function makeLabelControl(labelElOrText, row, col = 1){
      const id = controlId();

      let text = 'Label Text';
      let font = {
        alignment: "",
        color: "",
        decoration: "",
        family: "Arial, sans-serif",         // force OT-friendly family
        size: "",
        style: "",
        weight: ""
      };

      if (labelElOrText && labelElOrText.nodeType === 1) {
        const el = labelElOrText;
        text = (el.textContent || '').trim() || text;

        const cs = getComputedStyle(el);

        font.color = normalizeOTColor(cs.color);
        font.size  = snapOTFontSize(cs.fontSize);
        font.style = (cs.fontStyle?.toLowerCase() === 'italic') ? 'italic' : '';

        const fw = cs.fontWeight || '';
        font.weight = (String(fw).toLowerCase() === 'bold' || parseInt(fw,10) >= 600) ? 'bold' : '';

        const deco = (cs.textDecorationLine || '').toLowerCase();
        font.decoration = (/^(underline|line-through)$/.test(deco)) ? deco : '';

        // Keep family hardcoded to Arial for OT compatibility
        font.family = "Arial, sans-serif";
      } else {
        text = (labelElOrText || text);
      }

      return {
        data:{
          designer:{ allowHeightToBeResized:true, isContainer:false },
          id,
          runtime:{
            backgroundColor:"",
            controls:[],
            displayName:"Label",
            height:{ unit:"px", value:28 },
            parentId:idGrid,
            placeholder:"",
            propertyPath:"",
            readOnly:false, repeating:false, required:false,
            schemaId:"", sort:"", tooltip:"",
            type:"label",
            user:{ showGroups:false, showUsers:false },
            width:{ unit:"%", value:300 },
            themes:{},
            layoutTextStyle:"ocpd-label-p",
            maxSnapRows:1,
            label:{
              alignment:"start",
              font,
              position:"column",
              show:true,
              text,
              width:""
            },
            gridChild:{
              gridColumnEnd: 1,
              gridColumnStart: 1,
              gridRowEnd: 1,
              gridRowStart: row
            }
          }
        },
        schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls",
        id
      };
    }

    function makeLinkControl(text, href, row, col=1){
      const id = controlId();
      return {
        data:{
          designer:{ allowHeightToBeResized:true, isContainer:false },
          id,
          runtime:{
            backgroundColor:"",
            controls:[],
            displayName:"Link",
            height:{ unit:"px", value:28 },
            parentId:idGrid,
            placeholder:"",
            propertyPath:"",
            readOnly:false, repeating:false, required:false,
            schemaId:"", sort:"", tooltip:"",
            type:"link",
            user:{ showGroups:false, showUsers:false },
            width:{ unit:"%", value:300 },
            themes:{},
            maxSnapRows:1,
            label:{
              alignment:"start",
              font:{ alignment:"", color:"", decoration:"", family:"", size:"", style:"", weight:"" },
              position:"column",
              show:true,
              text: text || "Link Text",
              width:""
            },
            urlControl:{
              useFreeText:true,
              referrerPolicy:"no-referrer",
              link:{},
              freeTextUrl: href || "https://example.com"
            },
            gridChild: {
              gridColumnEnd: 1,
              gridColumnStart: 1,
              gridRowEnd: 1,
              gridRowStart: row
            }
          }
        },
        schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls",
        id
      };
    }

    function makeButtonControl(text, row, col=1){
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
            parentId:idGrid,
            placeholder:"",
            propertyPath:"",
            readOnly:false, repeating:false, required:false,
            schemaId:"", sort:"", tooltip:"",
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
            gridChild: {
              gridColumnEnd: 1,
              gridColumnStart: 1,
              gridRowEnd: 1,
              gridRowStart: row
            }
          }
        },
        schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls",
        id
      };
    }

    // Lay them out: labels row 1..N, links next, buttons next
    const controlsDesign = [];

    // Canvas
    const canvasId = idCanvas;
    controlsDesign.push({
      id: canvasId,
      data:{
        designer:{ allowHeightToBeResized:true, isContainer:true, grid:{ inheritParentColumnCount:true, numberOfColumns:4, numberOfRows:0 } },
        id: canvasId,
        runtime:{
          backgroundColor:"",
          controls:[],
          displayName:"Canvas",
          height:{ unit:"px", value:"52" },
          parentId:"",
          placeholder:"",
          propertyPath:"", readOnly:false, repeating:false, required:false, schemaId:"", sort:"", tooltip:"",
          type:"canvas",
          user:{ showGroups:false, showUsers:false },
          width:{ unit:"%", value:100 },
          themes:{},
          rearrangeControlsForSmallScreens:true
        }
      },
      schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls"
    });

    // Form container
    const formId = idForm;
    controlsDesign.push({
      id: formId,
      data:{
        designer:{ allowHeightToBeResized:true, isContainer:true, grid:{ inheritParentColumnCount:true, numberOfColumns:4, numberOfRows:0 } },
        id: formId,
        runtime:{
          backgroundColor:"",
          controls:[],
          displayName:"Form control",
          height:{ unit:"px", value:"52" },
          parentId: canvasId,
          placeholder:"",
          propertyPath:"", readOnly:false, repeating:false, required:false, schemaId:"", sort:"", tooltip:"",
          type:"form-container",
          user:{ showGroups:false, showUsers:false },
          width:{ unit:"%", value:100 },
          themes:{},
          rearrangeControlsForSmallScreens:true
        }
      },
      schemaId:"https://www.opentext.com/ocp/devx/ui/1.0.0/designerControls"
    });

    // Grid container
    const gridId = idGrid;
    controlsDesign.push({
      id: gridId,
      data:{
        designer:{ allowHeightToBeResized:true, isContainer:true },
        id: gridId,
        runtime:{
          backgroundColor:"",
          controls:[],
          displayName:"Grid container",
          height:{ unit:"px", value:512 },
          parentId: formId,
          placeholder:"",
          propertyPath:"", readOnly:false, repeating:false, required:false, schemaId:"", sort:"", tooltip:"",
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
    });

    // Populate rows
    let row = 1;
    const childIds = []; // collect child control IDs

    labels.slice(0, 12).forEach(l => {
      const ctrl = makeLabelControl(l, row++, 1);
      controlsDesign.push(ctrl);
      childIds.push(ctrl.id);
    });

    links.slice(0, 8).forEach(a => {
      const ctrl = makeLinkControl(txt(a) || a.href, a.getAttribute('href'), row++, 1);
      controlsDesign.push(ctrl);
      childIds.push(ctrl.id);
    });

    buttons.slice(0, 8).forEach(b => {
      const ctrl = makeButtonControl(txt(b) || b.name || 'Button', row++, 1);
      controlsDesign.push(ctrl);
      childIds.push(ctrl.id);
    });

    // inject the child IDs into the grid container runtime.controls
    const gridEntry = controlsDesign.find(c => c.id === idGrid);
    if (gridEntry) {
      gridEntry.data.runtime.controls = childIds.slice();
    }

    return controlsDesign;

  }

  // ======== Exporter: full OpenText UI payload =================================
  function exportToOpenTextUI(){
    takenPropKeys.clear();

    // Build schema
    const schema = {
      required: [],
      properties: {},
      $id: `https://www.opentext.com/ocp/devx/ui/${(document.location.host || 'local')}/1.0/` + uuidv4(),
      type: 'object'
    };

    const ctrls = qa('.ctrl');
    ctrls.forEach(ctrl => {
      if (isClassicYesNo(ctrl) || ctrl.querySelector('.rc-wrap')) {
        mapClassicReadCode(ctrl, schema.properties);
      } else if (isClassicReadList(ctrl)) {
        mapClassicReadList(ctrl, schema.properties);
      } else {
        mapGeneric(ctrl, schema.properties);
      }
    });

    // Build design layer (labels, links, buttons)
    const designControls = buildDesignLayer();

    // Top wrapper
    const title = getDisplayTitle();
    const baseName = title.replace(/\.[Tt][Ee][Xx]$/,'').replace(/\s+/g,'_') || 'TT_Template';
    const compId = uuidv4();

    const payload = {
      id: compId,
      schemaId: "https://www.opentext.com/ocp/devx/ui/1.0.0/UIComponent",
      data: {
        namespace: "ttmickp",
        name: keyify(baseName).toLowerCase(),
        displayName: baseName.replace(/_/g,' '),
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

    // Download
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}_opentext_ui.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // Expose globally so other scripts (or inline calls) can use it.
  window.addOpenTextUIExportButton = addOpenTextUIExportButton;

  // OPTIONAL auto-init: inline block also *called* the function
  // with no args, can auto-run it on DOM ready. If function needs args,
  // delete this listener and keep the call inline in the HTML as shown below.
  document.addEventListener('DOMContentLoaded', () => {
    try {
      addOpenTextUIExportButton();
    } catch (e) {
      // Safe no-op if you remove auto-init or need params.
      console.debug('addOpenTextUIExportButton init skipped or needs params.', e);
    }
  });
})();
