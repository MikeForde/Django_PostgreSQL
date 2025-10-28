(function(){

  // ==========================
  // CONFIG / CONSTANTS
  // ==========================
  const UUID = "633d4e61-1fbf-42af-a4d5-9dcc7c6bb719"; // same as VBA
  function todayIsoDate(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  const CANVAS = document.getElementById('canvas') || document;
  function qa(sel, root=CANVAS){ return Array.from(root.querySelectorAll(sel)); }
  function txt(n){ return (n && (n.textContent || '').trim()) || ''; }

  function decodeUnicodeEscapes(str){
    if (!str) return '';
    return str
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, g1) =>
        String.fromCharCode(parseInt(g1, 16))
      )
      .replace(/\\u000A/gi, '\n');
  }

  // read all code→term entries from data-readcodes on a .readcode-host (or ctrl)
  function getReadcodeEntriesFromCtrl(ctrl){
    const host = ctrl.closest('.readcode-host') || ctrl;
    if (!host) return [];
    let blob = host.getAttribute('data-readcodes') || '';
    blob = decodeUnicodeEscapes(blob);

    const rawLines = blob.split(/\r?\n/).filter(Boolean);

    let autoText = '';
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) {
        autoText = line.replace(/^\s*Auto-Entered Text\s*:\s*/i,'').trim();
      }
    });

    const entries = [];
    rawLines.forEach(line => {
      if (/^\s*Auto-Entered Text\s*:/i.test(line)) return;
      const parts = line.split('—');
      const code = (parts[0] || '').trim();
      const label = (parts.slice(1).join('—') || '').trim();
      if (code || label){
        entries.push({
          code,
          label,
          autoText
        });
      }
    });

    return entries;
  }

  // download helper
  function downloadTextFile(filename, content){
    const blob = new Blob([content], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // ==========================
  // OverallName inference
  // ==========================
  function getSelectedTexName(){
    const label = document.getElementById('selected-tex-label')?.textContent?.trim();
    if (label && label.toLowerCase() !== 'no tex file selected') return label;
    const libSel = document.querySelector('#lib-pane-list select');
    if (libSel && libSel.value) return libSel.value;
    const h1 = document.querySelector('h1')?.textContent?.trim();
    return h1 || 'Imported_TEX';
  }

  function normalizeOverallName(raw){
    // VBA strips spaces and extension
    let base = String(raw||'').trim();
    base = base.replace(/\.[A-Za-z0-9]+$/,''); // drop .tex etc
    base = base.replace(/\s+/g,'');           // strip spaces
    if (!base) base = 'Imported_TEX';
    return base;
  }

  // ==========================
  // Collect controls for OpenEHR
  // ==========================
  function collectControlsForOpenEhr(){
    const out = [];
    const ctrls = qa('.ctrl');

    ctrls.forEach(ctrl => {
      const rlWrap = ctrl.querySelector('.rl-wrap');
      const selectEl = ctrl.querySelector('select');
      const msWrap   = ctrl.querySelector('.ms');

      const rcWrap  = ctrl.querySelector('.rc-wrap');
      const rcPromptText = (ctrl.querySelector('.rc-prompt')?.textContent || '').trim();

      const hasDateInput = !!ctrl.querySelector('input[type="date"]');

      const readcodeEntries = getReadcodeEntriesFromCtrl(ctrl);

      // ---------- TEmisReadList ----------
      if (rlWrap || selectEl || msWrap){
        // label
        let displayName =
          (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
          (msWrap ? (msWrap.querySelector('.ms-label')?.textContent || '').trim() : '') ||
          'List';

        // collect options
        let options = [];

        if (msWrap){
          // multi-dropdown style checkboxes
          const rows = msWrap.querySelectorAll('.ms-panel label');
          rows.forEach(lab => {
            const inp = lab.querySelector('input[type="checkbox"]');
            if (!inp) return;
            const value = (inp.value || '').trim();
            let labelTxt = txt(lab);
            if (value && labelTxt.startsWith(value)) {
              labelTxt = labelTxt.slice(value.length).trim();
            }
            if (labelTxt) options.push(labelTxt);
            else if (value) options.push(value);
          });

        } else if (selectEl){
          const rawOpts = Array.from(selectEl.querySelectorAll('option'))
            .filter(o => (o.value || txt(o)));

          // heuristic: first option is actually the field name for single-select dropdowns
          if (!selectEl.multiple && rawOpts.length >= 2) {
            const capIsGeneric = !displayName || displayName.toLowerCase() === 'list';
            if (capIsGeneric) {
              const firstText = (txt(rawOpts[0]) || rawOpts[0].value || '').trim();
              if (firstText) displayName = firstText;
              rawOpts.slice(1).forEach(o => {
                const lbl = (txt(o) || o.value || '').trim();
                if (lbl) options.push(lbl);
              });
            } else {
              rawOpts.forEach(o => {
                const lbl = (txt(o) || o.value || '').trim();
                if (lbl) options.push(lbl);
              });
            }
          } else {
            // native multi <select> or simple <select> with no weird first-item header
            rawOpts.forEach(o => {
              const lbl = (txt(o) || o.value || '').trim();
              if (lbl) options.push(lbl);
            });
          }

        } else if (rlWrap){
          // visible checkbox or radio list
          const chks = Array.from(rlWrap.querySelectorAll('input[type="checkbox"]'));
          const rdos = Array.from(rlWrap.querySelectorAll('input[type="radio"]'));

          if (chks.length){
            chks.forEach(inp => {
              const lbl = txt(inp.closest('label')) || inp.value || 'Option';
              if (lbl) options.push(lbl);
            });
          } else if (rdos.length){
            rdos.forEach(inp => {
              const lbl = txt(inp.closest('label')) || inp.value || 'Option';
              if (lbl) options.push(lbl);
            });
          }
        }

        const strDataAsString = options.join('; ');

        out.push({
          Type: "TEmisReadList",
          Name: displayName || 'List',
          strDataAsString
        });
        return;
      }

      // ---------- TEmisQuestionReadCode ----------
      const yesNoYes = ctrl.querySelector('.rc-yes-label input.rc-yesno');
      const yesNoNo  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
      if (rcWrap && (yesNoYes || yesNoNo)) {
        const prompt = rcPromptText || (readcodeEntries[0]?.label) || 'Question';
        out.push({
          Type: "TEmisQuestionReadCode",
          Name: prompt,
          Prompt: prompt,
          bTextPrompt: "FALSE"
        });
        return;
      }

      // ---------- TEmisReadCode ----------
      // Heuristic: if it's a readcode block with a text input or checkbox etc.
      // We'll skip pure date-only here (we'll send that to TTplDiaryEntry next).
      if (rcWrap) {
        const textInput = ctrl.querySelector('input[type="text"]:not([readonly])');
        const chkInput  = ctrl.querySelector('input.rc-chk, input[type="checkbox"]');
        const prompt = rcPromptText || (readcodeEntries[0]?.label) || 'Entry';
        const onlyDateNoText = (hasDateInput && !textInput && !chkInput);

        if (!onlyDateNoText){
          out.push({
            Type: "TEmisReadCode",
            Name: prompt,
            Prompt: prompt,
            bTextPrompt: textInput ? "TRUE" : "FALSE"
          });
          return;
        }
      }

      // ---------- TTplDiaryEntry ----------
      if (hasDateInput && rcWrap){
        const prompt = rcPromptText || (readcodeEntries[0]?.label) || 'Date';
        out.push({
          Type: "TTplDiaryEntry",
          Name: prompt,
          strPrompt: prompt
        });
        return;
      }

      // ignore anything we can't classify
    });

    return out;
  }

  // ==========================
  // ADL #1: OBSERVATION archetype
  // ==========================
  function buildObservationAdl(overallName, controls){
    const DateStr = todayIsoDate();
    const lowerName = overallName.toLowerCase();

    // We mirror VBA's atCodeCounter starting at 4
    let atCodeCounter = 4;
    let termDefs = [];         // [{atCode,text,description}]
    const elementBlocks = [];  // each ELEMENT[...] block

    function nextAtCode(){
      atCodeCounter += 1;
      return "at" + String(atCodeCounter).padStart(4,'0');
    }

    controls.forEach(ctrl => {
      const thisAt = nextAtCode();
      termDefs.push({
        atCode: thisAt,
        text: ctrl.Name || '',
        description: ''
      });

      if (ctrl.Type === "TEmisReadList"){
        // DV_CODED_TEXT with options
        let optionAtCodes = [];
        if (ctrl.strDataAsString){
          const opts = ctrl.strDataAsString.split(';');
          opts.forEach(raw => {
            const label = raw.trim();
            if (!label) return;
            const optAt = nextAtCode();
            optionAtCodes.push(optAt);
            termDefs.push({
              atCode: optAt,
              text: label,
              description: ''
            });
          });
        }

        let block = "";
        block += "\t\t\t\t\t\t\t\t\tELEMENT[" + thisAt + "] occurrences matches {0..1} matches {    -- DV_CODED_TEXT " + ctrl.Name + "\n";
        block += "\t\t\t\t\t\t\t\t\t\tvalue matches {\n";
        block += "\t\t\t\t\t\t\t\t\t\t\tDV_CODED_TEXT matches {\n";
        block += "\t\t\t\t\t\t\t\t\t\t\t\tdefining_code matches {\n";
        if (optionAtCodes.length){
          block += "\t\t\t\t\t\t\t\t\t\t\t\t\t[local::" + optionAtCodes.join(",") + "]\n";
        } else {
          block += "\t\t\t\t\t\t\t\t\t\t\t\t\t[local::" + thisAt + "]\n";
        }
        block += "\t\t\t\t\t\t\t\t\t\t\t\t}\n";
        block += "\t\t\t\t\t\t\t\t\t\t\t}\n";
        block += "\t\t\t\t\t\t\t\t\t\t}\n";
        block += "\t\t\t\t\t\t\t\t\t}\n";
        elementBlocks.push(block);

      } else if (ctrl.Type === "TEmisReadCode" || ctrl.Type === "TEmisQuestionReadCode"){
        const isText = (ctrl.bTextPrompt === "TRUE");
        if (isText){
          let block = "";
          block += "\t\t\t\t\t\t\t\t\tELEMENT[" + thisAt + "] occurrences matches {0..1} matches {    -- DV_TEXT " + (ctrl.Prompt||ctrl.Name) + "\n";
          block += "\t\t\t\t\t\t\t\t\t\tvalue matches {\n";
          block += "\t\t\t\t\t\t\t\t\t\t\tDV_TEXT matches {*}\n";
          block += "\t\t\t\t\t\t\t\t\t\t}\n";
          block += "\t\t\t\t\t\t\t\t\t}\n";
          elementBlocks.push(block);
        } else {
          let block = "";
          block += "\t\t\t\t\t\t\t\t\tELEMENT[" + thisAt + "] occurrences matches {0..1} matches {    -- DV_BOOLEAN " + (ctrl.Prompt||ctrl.Name) + "\n";
          block += "\t\t\t\t\t\t\t\t\t\tvalue matches {\n";
          block += "\t\t\t\t\t\t\t\t\t\t\tDV_BOOLEAN matches {*}\n";
          block += "\t\t\t\t\t\t\t\t\t\t}\n";
          block += "\t\t\t\t\t\t\t\t\t}\n";
          elementBlocks.push(block);
        }

      } else if (ctrl.Type === "TTplDiaryEntry"){
        let block = "";
        block += "\t\t\t\t\t\t\t\t\tELEMENT[" + thisAt + "] occurrences matches {0..1} matches {    -- DV_DATE " + (ctrl.strPrompt||ctrl.Name) + "\n";
        block += "\t\t\t\t\t\t\t\t\t\tvalue matches {\n";
        block += "\t\t\t\t\t\t\t\t\t\t\tDV_DATE matches {*}\n";
        block += "\t\t\t\t\t\t\t\t\t\t}\n";
        block += "\t\t\t\t\t\t\t\t\t}\n";
        elementBlocks.push(block);
      }

    });

    function ontologyHeader(overall){
      let s = "";
      s += '\t\t\t\t["at0000"] = <\n';
      s += '\t\t\t\t\ttext = <"' + overall + '">\n';
      s += '\t\t\t\t\tdescription = <"' + overall + '">\n';
      s += '\t\t\t\t>\n';

      s += '\t\t\t\t["at0001"] = <\n';
      s += '\t\t\t\t\ttext = <"History">\n';
      s += '\t\t\t\t\tdescription = <"History">\n';
      s += '\t\t\t\t>\n';

      s += '\t\t\t\t["at0002"] = <\n';
      s += '\t\t\t\t\ttext = <"Any event">\n';
      s += '\t\t\t\t\tdescription = <"Any point-in-time event">\n';
      s += '\t\t\t\t>\n';

      s += '\t\t\t\t["at0003"] = <\n';
      s += '\t\t\t\t\ttext = <"Tree">\n';
      s += '\t\t\t\t\tdescription = <"Data values captured in this observation.">\n';
      s += '\t\t\t\t>\n';

      return s;
    }

    function ontologyDynamicTerms(){
      let s = "";
      termDefs.forEach(t => {
        s += '\t\t\t\t["' + t.atCode + '"] = <\n';
        s += '\t\t\t\t\ttext = <"' + t.text.replace(/"/g,'""') + '">\n';
        s += '\t\t\t\t\tdescription = <"' + (t.description||'').replace(/"/g,'""') + '">\n';
        s += '\t\t\t\t>\n';
      });
      return s;
    }

    let outText = "";
    outText += "archetype (adl_version=1.4; uid=" + UUID + ")\n";
    outText += "\topenEHR-EHR-OBSERVATION." + lowerName + ".v0\n\n";
    outText += "concept\n";
    outText += "\t[at0000]\n\n";
    outText += "language\n";
    outText += "\toriginal_language = <[ISO_639-1::en]>\n\n";
    outText += "description\n";
    outText += "\toriginal_author = <\n";
    outText += '\t\t["date"] = <"' + DateStr + '">\n';
    outText += "\t>\n";
    outText += '\tlifecycle_state = <"unmanaged">' + "\n";
    outText += "\tdetails = <\n";
    outText += '\t\t["en"] = <' + "\n";
    outText += '\t\t\tlanguage = <[ISO_639-1::en]>' + "\n";
    outText += "\t\t>\n";
    outText += "\t>\n";
    outText += "\tother_details = <\n";
    outText += '\t\t["licence"] = <"This work is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License. To view a copy of this license, visit http://creativecommons.org/licenses/by-sa/4.0/.">' + "\n";
    outText += '\t\t["custodian_organisation"] = <"openEHR Foundation">' + "\n";
    outText += '\t\t["original_namespace"] = <"org.openehr">' + "\n";
    outText += '\t\t["original_publisher"] = <"openEHR Foundation">' + "\n";
    outText += '\t\t["custodian_namespace"] = <"org.openehr">' + "\n";
    outText += "\t>\n\n";

    outText += "definition\n";
    outText += "\tOBSERVATION[at0000] matches {    -- " + overallName + "\n";
    outText += "\t\tdata matches {\n";
    outText += "\t\t\tHISTORY[at0001] matches {    -- History\n";
    outText += "\t\t\t\tevents cardinality matches {1..*; unordered} matches {\n";
    outText += "\t\t\t\t\tEVENT[at0002] occurrences matches {0..*} matches {    -- Any event\n";
    outText += "\t\t\t\t\t\tdata matches {\n";
    outText += "\t\t\t\t\t\t\tITEM_TREE[at0003] matches {    -- Tree\n";
    outText += "\t\t\t\t\t\t\t\titems cardinality matches {0..*; unordered} matches {\n";

    elementBlocks.forEach(block => {
      outText += block;
    });

    outText += "\t\t\t\t\t\t\t\t}\n"; // items
    outText += "\t\t\t\t\t\t\t}\n"; // ITEM_TREE
    outText += "\t\t\t\t\t\t}\n";   // data
    outText += "\t\t\t\t\t}\n";     // EVENT
    outText += "\t\t\t\t}\n";       // events
    outText += "\t\t\t}\n";         // HISTORY
    outText += "\t\t}\n";           // data
    outText += "\t}\n";             // OBSERVATION
    outText += "\tprotocol matches {\n";
    outText += "\t\tITEM_TREE[at0010] matches {*}    -- Item tree\n";
    outText += "\t}\n\n";

    outText += "ontology\n";
    outText += "\tterm_definitions = <\n";
    outText += '\t\t["en"] = <' + "\n";
    outText += "\t\t\titems = <\n";
    outText += ontologyHeader(overallName);
    outText += ontologyDynamicTerms();
    outText += "\t\t\t>\n"; // items
    outText += "\t\t>\n";   // ["en"]
    outText += "\t>\n";     // term_definitions

    return outText;
  }

  // ==========================
  // ADL #2: COMPOSITION archetype
  // ==========================
  // We'll generate a simple COMPOSITION that references the OBSERVATION.
  // This is a minimal "document" style composition.
  function buildCompositionAdl(overallName){
    const DateStr = todayIsoDate();
    const lowerName = overallName.toLowerCase();

    let outText = "";
    outText += "archetype (adl_version=1.4; uid=" + UUID + ")\n";
    outText += "\topenEHR-EHR-COMPOSITION." + lowerName + "_doc.v0\n\n";
    outText += "concept\n";
    outText += "\t[at0000]\n\n";
    outText += "language\n";
    outText += "\toriginal_language = <[ISO_639-1::en]>\n\n";
    outText += "description\n";
    outText += "\toriginal_author = <\n";
    outText += '\t\t["date"] = <"' + DateStr + '">\n';
    outText += "\t>\n";
    outText += '\tlifecycle_state = <"unmanaged">' + "\n";
    outText += "\tdetails = <\n";
    outText += '\t\t["en"] = <' + "\n";
    outText += '\t\t\tlanguage = <[ISO_639-1::en]>' + "\n";
    outText += "\t\t>\n";
    outText += "\t>\n";
    outText += "\tother_details = <\n";
    outText += '\t\t["licence"] = <"This work is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License. To view a copy of this license, visit http://creativecommons.org/licenses/by-sa/4.0/.">' + "\n";
    outText += '\t\t["custodian_organisation"] = <"openEHR Foundation">' + "\n";
    outText += '\t\t["original_namespace"] = <"org.openehr">' + "\n";
    outText += '\t\t["original_publisher"] = <"openEHR Foundation">' + "\n";
    outText += '\t\t["custodian_namespace"] = <"org.openehr">' + "\n";
    outText += "\t>\n\n";

    outText += "definition\n";
    outText += "\tCOMPOSITION[at0000] matches {    -- " + overallName + " Document\n";
    outText += "\t\tcategory matches {\n";
    outText += "\t\t\tDV_CODED_TEXT matches {\n";
    outText += "\t\t\t\tdefining_code matches {[at0001]}\n";
    outText += "\t\t\t}\n";
    outText += "\t\t}\n";
    outText += "\t\tcontent cardinality matches {1..*; unordered} matches {\n";
    outText += "\t\t\tOBSERVATION[openEHR-EHR-OBSERVATION." + lowerName + ".v0]\n";
    outText += "\t\t}\n";
    outText += "\t}\n\n";

    outText += "ontology\n";
    outText += "\tterm_definitions = <\n";
    outText += '\t\t["en"] = <' + "\n";
    outText += "\t\t\titems = <\n";
    outText += '\t\t\t\t["at0000"] = <\n';
    outText += '\t\t\t\t\ttext = <"' + overallName + ' Document">\n';
    outText += '\t\t\t\t\tdescription = <"' + overallName + ' top-level COMPOSITION document.">\n';
    outText += "\t\t\t\t>\n";
    outText += '\t\t\t\t["at0001"] = <\n';
    outText += '\t\t\t\t\ttext = <"event">\n';
    outText += '\t\t\t\t\tdescription = <"Category of this COMPOSITION is event.">\n';
    outText += "\t\t\t\t>\n";
    outText += "\t\t\t>\n"; // items
    outText += "\t\t>\n";   // ["en"]
    outText += "\t>\n";     // term_definitions

    return outText;
  }

  // ==========================
  // TEMPLATE (.oet)
  // ==========================
  // We'll emit a minimal openEHR Template referencing the COMPOSITION and OBSERVATION.
  // This is a pragmatic/simple .oet wrapper that toolchains can then refine.
  function buildTemplateOet(overallName){
    const lowerName = overallName.toLowerCase();
    // We’ll generate a simple OPT-style XML-ish template body with archetype slots.
    // This won't be a full serialized OPT v1/v2, but it mirrors the intent:
    // a template that includes the COMPOSITION and OBSERVATION archetypes.
    //
    // Your VBA stub just wrote filename and hinted "Similar to example". We'll give you
    // a simple deterministic skeleton you can iterate on.

    let outText = "";
    outText += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    outText += "<template>\n";
    outText += "  <id>" + overallName + "_Template</id>\n";
    outText += "  <name>" + overallName + " Template</name>\n";
    outText += "  <description>Auto-generated template containing COMPOSITION and OBSERVATION archetypes derived from TEX form.</description>\n";
    outText += "  <definition>\n";
    outText += "    <archetype_id>openEHR-EHR-COMPOSITION." + lowerName + "_doc.v0</archetype_id>\n";
    outText += "    <children>\n";
    outText += "      <child>\n";
    outText += "        <archetype_id>openEHR-EHR-OBSERVATION." + lowerName + ".v0</archetype_id>\n";
    outText += "      </child>\n";
    outText += "    </children>\n";
    outText += "  </definition>\n";
    outText += "</template>\n";

    return outText;
  }

  // ==========================
  // BUTTON / CLICK HANDLER
  // ==========================
  function addOpenEhrExportButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to openEHR (3 files)';
    btn.style.marginLeft = '5px';
    btn.style.padding = '6px 10px';
    btn.style.fontSize = '12px';
    btn.style.border = '1px solid #888';
    btn.style.borderRadius = '4px';
    btn.style.background = '#f5f5f5';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'background 0.2s, box-shadow 0.2s';

    // Add the logo image
    const img1 = document.createElement('img');
    img1.src = '/static/myapp/images/openehr_logo.png'; // path for openEHR logo
    img1.alt = 'Export to openEHR format';
    img1.style.height = '14px';
    img1.style.width = 'auto';
    img1.style.display = 'block';
    img1.style.pointerEvents = 'none';
    btn.appendChild(img1);

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

      btn.addEventListener('click', () => {
      const rawName = getSelectedTexName();
      const OverallName = normalizeOverallName(rawName);
      const controls = collectControlsForOpenEhr();

      // 1. build all three file contents up front
      const fileContentObs  = buildObservationAdl(OverallName, controls);
      const fileNameObs     = "openEHR-EHR-OBSERVATION." + OverallName.toLowerCase() + ".v0.adl";

      const fileContentComp = buildCompositionAdl(OverallName);
      const fileNameComp    = "openEHR-EHR-COMPOSITION." + OverallName.toLowerCase() + "_doc.v0.adl";

      const fileContentTpl  = buildTemplateOet(OverallName);
      const fileNameTpl     = OverallName + "_Template.oet";

      // 2. stagger the downloads so the browser doesn't drop the first two
      setTimeout(() => {
        downloadTextFile(fileNameObs, fileContentObs);

        setTimeout(() => {
          downloadTextFile(fileNameComp, fileContentComp);

          setTimeout(() => {
            downloadTextFile(fileNameTpl, fileContentTpl);
          }, 150);
        }, 150);
      }, 0);
    });


    mount.appendChild(btn);
  }

  // init
  addOpenEhrExportButton();

})();
