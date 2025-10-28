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

    // helper: pull readcode entries if present, including Readcode itself
    // we’ll use this for term_binding later
    const readcodeEntries = getReadcodeEntriesFromCtrl(ctrl);
    // readcodeEntries looks like:
    // [ { code:"C10..", label:"Diabetes mellitus", autoText:"..." }, ... ]

    // --------------------------
    // TEmisReadList
    // --------------------------
    // This covers:
    //  - visible lists of checkboxes / radios inside .rl-wrap
    //  - native <select> (single or multiple)
    //  - TEX-style "dropdown multiselect" (.ms structure with checkbox panel)
    //
    // We need:
    //  {
    //    Type: "TEmisReadList",
    //    Name: <field label>,
    //    kindHint: "codedList",
    //    options: [ { label: "...", code: "C10.." }, ... ]  // code if known
    //  }
    //
    // So we now build an array of `options` objects, not just string-joined.
    //
    if (rlWrap || selectEl || msWrap){

      // 1. field label
      let displayName =
        (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
        (msWrap ? (msWrap.querySelector('.ms-label')?.textContent || '').trim() : '') ||
        'List';

      // 2. collect candidate options (labels + possible readcodes)
      const opts = [];

      if (msWrap){
        // TEX dropdown-multiselect:
        // <div class="ms-panel"><label><input type="checkbox" value="C10.."> Diabetes ...</label>...</div>
        const rows = msWrap.querySelectorAll('.ms-panel label');
        rows.forEach(lab => {
          const inp = lab.querySelector('input[type="checkbox"]');
          if (!inp) return;
          const rawCode = (inp.value || '').trim(); // this is often the Readcode like "C10.."
          let labelTxt = txt(lab);
          if (rawCode && labelTxt.startsWith(rawCode)) {
            labelTxt = labelTxt.slice(rawCode.length).trim();
          }
          // push {label, code}
          opts.push({
            label: labelTxt || rawCode || 'Option',
            code: rawCode || ''
          });
        });

      } else if (selectEl){
        // native <select>
        // we also have the TEX quirk: first <option> is actually the field label.
        const rawOpts = Array.from(selectEl.querySelectorAll('option'))
          .filter(o => (o.value || txt(o)));

        // if single-select and first option is actually heading => use that as displayName, drop it
        if (!selectEl.multiple && rawOpts.length >= 2) {
          const capIsGeneric = !displayName || displayName.toLowerCase() === 'list';
          if (capIsGeneric) {
            const firstText = (txt(rawOpts[0]) || rawOpts[0].value || '').trim();
            if (firstText) displayName = firstText;
            rawOpts.slice(1).forEach(o => {
              const rawVal = (o.value || '').trim();
              const lbl = (txt(o) || rawVal || '').trim();
              opts.push({
                label: lbl || 'Option',
                code: rawVal || '' // we treat <option value="C10.."> as the Readcode here
              });
            });
          } else {
            rawOpts.forEach(o => {
              const rawVal = (o.value || '').trim();
              const lbl = (txt(o) || rawVal || '').trim();
              opts.push({
                label: lbl || 'Option',
                code: rawVal || ''
              });
            });
          }
        } else {
          // multiple <select> OR normal <select> without weird first heading
          rawOpts.forEach(o => {
            const rawVal = (o.value || '').trim();
            const lbl = (txt(o) || rawVal || '').trim();
            opts.push({
              label: lbl || 'Option',
              code: rawVal || ''
            });
          });
        }

      } else if (rlWrap){
        // visible checkbox/radio list
        const chks = Array.from(rlWrap.querySelectorAll('input[type="checkbox"]'));
        const rdos = Array.from(rlWrap.querySelectorAll('input[type="radio"]'));

        if (chks.length){
          chks.forEach(inp => {
            const lbl = txt(inp.closest('label')) || inp.value || 'Option';
            const rawCode = (inp.value || '').trim(); // if checkbox value looks like a code, keep it
            opts.push({
              label: lbl.trim() || 'Option',
              code: rawCode || ''
            });
          });
        } else if (rdos.length){
          rdos.forEach(inp => {
            const lbl = txt(inp.closest('label')) || inp.value || 'Option';
            const rawCode = (inp.value || '').trim();
            opts.push({
              label: lbl.trim() || 'Option',
              code: rawCode || ''
            });
          });
        }
      }

      out.push({
        Type: "TEmisReadList",
        Name: displayName || 'List',
        kindHint: "codedList",
        options: opts,
        // we'll keep strDataAsString around for debugging but buildObservationAdl
        // won't rely on it anymore
        strDataAsString: opts.map(o => o.label).join('; ')
      });

      return;
    }


    // --------------------------
    // TEmisQuestionReadCode (Yes/No style)
    // --------------------------
    // This maps to DV_BOOLEAN in ADL.
    const yesNoYes = ctrl.querySelector('.rc-yes-label input.rc-yesno');
    const yesNoNo  = ctrl.querySelector('.rc-no-label  input.rc-yesno');
    if (rcWrap && (yesNoYes || yesNoNo)) {
      const prompt = rcPromptText ||
                     (readcodeEntries[0]?.label) ||
                     'Question';

      out.push({
        Type: "TEmisQuestionReadCode",
        Name: prompt,
        Prompt: prompt,
        bTextPrompt: "FALSE",
        kindHint: "boolean"
      });
      return;
    }


    // --------------------------
    // TEmisReadCode
    // --------------------------
    // This covers readcode-ish blocks that aren't just date.
    // We decide whether it's a TEXT (DV_TEXT), NUMBER (DV_QUANTITY), etc.
    const textInput = ctrl.querySelector('input[type="text"]:not([readonly])');
    const numInput  = ctrl.querySelector('input[type="number"]');
    const chkInput  = ctrl.querySelector('input.rc-chk, input[type="checkbox"]');

    if (rcWrap) {
      const prompt = rcPromptText || (readcodeEntries[0]?.label) || 'Entry';
      const onlyDateNoText = (hasDateInput && !textInput && !chkInput && !numInput);

      if (!onlyDateNoText){

        // decide kindHint
        let kindHint = "text";
        if (numInput) {
          kindHint = "quantity"; // DV_QUANTITY / numeric entry
        } else if (chkInput && !textInput) {
          // lone checkbox often semantically boolean
          kindHint = "boolean";
        } else if (textInput) {
          kindHint = "text";
        }

        out.push({
          Type: "TEmisReadCode",
          Name: prompt,
          Prompt: prompt,
          bTextPrompt: textInput ? "TRUE" : "FALSE",
          kindHint
        });
        return;
      }
    }


    // --------------------------
    // TTplDiaryEntry (date-style)
    // --------------------------
    if (hasDateInput && rcWrap){
      const prompt = rcPromptText || (readcodeEntries[0]?.label) || 'Date';
      out.push({
        Type: "TTplDiaryEntry",
        Name: prompt,
        strPrompt: prompt,
        kindHint: "date"
      });
      return;
    }

    // If nothing matched, ignore for now.
  });

  return out;
}


  // ==========================
  // ADL #1: OBSERVATION archetype
  // ==========================
  function buildObservationAdl(overallName, controls){
  const DateStr = todayIsoDate();
  const lowerName = overallName.toLowerCase();

  // --- atCode allocator -------------------------------------------------
  let atCounter = 4; // we'll follow your convention, first dynamic = at0005
  function nextAt(){
    atCounter += 1;
    return "at" + String(atCounter).padStart(4,"0");
  }

  // We will accumulate:
  const elementBlocks = [];    // the ELEMENT[...] chunks for ITEM_TREE
  const ontologyItems = [];    // {atCode,text,desc}
  const termBindingMap = {};   // { atCode: "READCODE" } (only 1 per element)

  // helper: push ontology term
  function addOntology(atCode, text, desc){
    ontologyItems.push({
      atCode,
      text: text || "",
      desc: (desc == null ? "" : desc)
    });
  }

  // helper: escape text for ontology lines
  function esc(s){ return String(s||"").replace(/"/g,'""'); }

  // helper: build DV_* element blocks for different types
  // returns string block
  function buildDvTextBlock(atCode, label){
    addOntology(atCode, label, "");
    return (
      "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_TEXT " + label + "\n" +
      "\t\t\t\t\t\t\t\tvalue matches {\n" +
      "\t\t\t\t\t\t\t\t\tDV_TEXT matches {*}\n" +
      "\t\t\t\t\t\t\t\t}\n" +
      "\t\t\t\t\t\t\t}\n"
    );
  }

  function buildDvBooleanBlock(atCode, label){
    addOntology(atCode, label, "");
    return (
      "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_BOOLEAN " + label + "\n" +
      "\t\t\t\t\t\t\t\tvalue matches {\n" +
      "\t\t\t\t\t\t\t\t\tDV_BOOLEAN matches {*}\n" +
      "\t\t\t\t\t\t\t\t}\n" +
      "\t\t\t\t\t\t\t}\n"
    );
  }

  function buildDvDateBlock(atCode, label){
    addOntology(atCode, label, "");
    return (
      "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_DATE " + label + "\n" +
      "\t\t\t\t\t\t\t\tvalue matches {\n" +
      "\t\t\t\t\t\t\t\t\tDV_DATE matches {*}\n" +
      "\t\t\t\t\t\t\t\t}\n" +
      "\t\t\t\t\t\t\t}\n"
    );
  }

  function buildDvQuantityBlock(atCode, label){
    // We’ll keep simple DV_QUANTITY matches {*}, like we had before (designer will show numeric)
    addOntology(atCode, label, "");
      return (
        "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_QUANTITY " + label + "\n" +
        "\t\t\t\t\t\t\t\tvalue matches {\n" +
        "\t\t\t\t\t\t\t\t\tDV_QUANTITY matches {*}\n" +
        "\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t}\n"
      );
    }

    function buildDvCodedTextBlock(parentLabel, optionsArr){
    const parentAt = nextAt();
    addOntology(parentAt, parentLabel, " ");

    const optLines = []; // we'll store {atCode, label}
    optionsArr.forEach(opt => {
      const thisOptAt = nextAt();
      const optText = opt.label || opt.code || "Option";
      const optDesc = (opt.code ? (opt.code + " " + optText) : optText);

      addOntology(thisOptAt, optText, optDesc);

      // remember first code for term_binding
      if (!termBindingMap[parentAt] && opt.code){
        const cleaned = opt.code.replace(/\.+$/,'');
        termBindingMap[parentAt] = cleaned;
      }

      optLines.push({
        atCode: thisOptAt,
        label: optText
      });
    });

    // Now build the ADL block for defining_code matches { [local:: ... ] }
    // We want:
    //
    // [local::
    // at0006,    -- Asthma
    // at0007,    -- Childhood asthma
    // at0008]    -- Acute exacerbation of asthma
    //
    // ...i.e. the closing ']' appears right after the last atCode, before its comment.

    let definingCodeChunk = "";
    if (optLines.length === 0){
      // fallback, no options -> just parentAt
      definingCodeChunk = "[local::\n" + parentAt + "]\n";
    } else if (optLines.length === 1){
      const only = optLines[0];
      definingCodeChunk =
        "[local::\n" +
        only.atCode + "]    -- " + only.label + "\n";
    } else {
      // all but last = "at0006,    -- Asthma"
      const allButLast = optLines.slice(0, -1).map(line => {
        return line.atCode + ",    -- " + line.label;
      }).join("\n");

      // last line = "at0008]    -- Acute exacerbation..."
      const last = optLines[optLines.length - 1];
      const lastLine =
        last.atCode + "]    -- " + last.label;

      definingCodeChunk =
        "[local::\n" +
        allButLast + "\n" +
        lastLine + "\n";
    }

    const block =
      "\t\t\t\t\t\t\tELEMENT[" + parentAt + "] occurrences matches {0..1} matches {    -- DV_CODED_TEXT " + parentLabel + "\n" +
      "\t\t\t\t\t\t\t\tvalue matches {\n" +
      "\t\t\t\t\t\t\t\t\tDV_CODED_TEXT matches {\n" +
      "\t\t\t\t\t\t\t\t\t\tdefining_code matches {\n" +
      "\t\t\t\t\t\t\t\t\t\t\t" + definingCodeChunk +
      "\t\t\t\t\t\t\t\t\t\t}\n" +
      "\t\t\t\t\t\t\t\t\t}\n" +
      "\t\t\t\t\t\t\t\t}\n" +
      "\t\t\t\t\t\t\t}\n";

    return { block, parentAt };
  }

  // --- walk controls and build ELEMENTs ---------------------------------
  // We’ll also need to know which structural atCodes exist so we can emit them in ontology:
  // structural fixed: at0000, at0001, at0002, at0003, at0010.
  // BUT note our dynamic allocator starts at at0005, so at0010 might get eaten.
  // To avoid collision with at0010, reserve it now:
  // We'll bump atCounter if needed so we never generate at0010 dynamically.
  function reserveAt0010(){
    // we want our dynamic codes to skip at0010
    // So if we ever cross 9 -> next is 10, skip to 11.
    if (String(atCounter+1).padStart(4,"0") === "0010"){
      atCounter += 1; // skip 0010
    }
  }

  // We'll manually build each ELEMENT in order by control:
  controls.forEach(ctrl => {
    reserveAt0010();

    const label =
      ctrl.Name ||
      ctrl.Prompt ||
      ctrl.strPrompt ||
      "Field";

    // classify
    const kind = (ctrl.kindHint || ctrl.Type || "").toLowerCase();

    if (kind.includes("codedlist") || ctrl.Type === "TEmisReadList") {
      // We expect ctrl.options = [ {label, code}, ... ]
      const opts = Array.isArray(ctrl.options) ? ctrl.options : [];

      const { block, parentAt } = buildDvCodedTextBlock(label, opts);
      elementBlocks.push(block);

    } else if (kind.includes("boolean") || ctrl.Type === "TEmisQuestionReadCode" && ctrl.bTextPrompt !== "TRUE") {
      const atCode = nextAt();
      elementBlocks.push( buildDvBooleanBlock(atCode, label) );

    } else if (kind.includes("date") || ctrl.Type === "TTplDiaryEntry") {
      const atCode = nextAt();
      elementBlocks.push( buildDvDateBlock(atCode, label) );

    } else if (kind.includes("number") || kind.includes("quantity")) {
      const atCode = nextAt();
      elementBlocks.push( buildDvQuantityBlock(atCode, label) );

    } else {
      // default free text
      const atCode = nextAt();
      elementBlocks.push( buildDvTextBlock(atCode, label) );
    }
  });

  // --- Now assemble the ADL text ----------------------------------------

  let out = "";
  out += "archetype (adl_version=1.4; uid=" + UUID + ")\n";
  out += "\topenEHR-EHR-OBSERVATION." + lowerName + ".v0\n\n";
  out += "concept\n";
  out += "\t[at0000]\n\n";
  out += "language\n";
  out += "\toriginal_language = <[ISO_639-1::en]>\n\n";
  out += "description\n";
  out += "\toriginal_author = <\n";
  out += '\t\t["date"] = <"' + DateStr + '">\n';
  out += "\t>\n";
  out += '\tlifecycle_state = <"unmanaged">\n';
  out += "\tdetails = <\n";
  out += '\t\t["en"] = <\n';
  out += "\t\t\tlanguage = <[ISO_639-1::en]>\n";
  out += "\t\t>\n";
  out += "\t>\n";
  out += "\tother_details = <\n";
  out += '\t\t["licence"] = <"This work is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License. To view a copy of this license, visit http://creativecommons.org/licenses/by-sa/4.0/.">\n';
  out += '\t\t["custodian_organisation"] = <"openEHR Foundation">\n';
  out += '\t\t["original_namespace"] = <"org.openehr">\n';
  out += '\t\t["original_publisher"] = <"openEHR Foundation">\n';
  out += '\t\t["custodian_namespace"] = <"org.openehr">\n';
  out += "\t>\n\n";

  out += "definition\n";
  out += "\tOBSERVATION[at0000] matches {    -- " + overallName + "\n";
  out += "\t\tdata matches {\n";
  out += "\t\t\tHISTORY[at0001] matches {    -- History\n";
  out += "\t\t\t\tevents cardinality matches {1..*; unordered} matches {\n";
  out += "\t\t\t\t\tEVENT[at0002] occurrences matches {0..*} matches {    -- Any event\n";
  out += "\t\t\t\t\t\tdata matches {\n";
  out += "\t\t\t\t\t\t\tITEM_TREE[at0003] matches {    -- Tree\n";
  out += "\t\t\t\t\t\t\t\titems cardinality matches {0..*; unordered} matches {\n";

  out += elementBlocks.join("");

  out += "\t\t\t\t\t\t\t\t}\n"; // close items cardinality
  out += "\t\t\t\t\t\t\t}\n";   // close ITEM_TREE
  out += "\t\t\t\t\t\t}\n";     // close data matches
  out += "\t\t\t\t\t}\n";       // close EVENT
  out += "\t\t\t\t}\n";         // close events cardinality
  out += "\t\t\t}\n";           // close HISTORY
  out += "\t\t}\n";             // close data matches
  out += "\t\tprotocol matches {\n";
  out += "\t\t\tITEM_TREE[at0010] matches {*}    -- Item tree\n";
  out += "\t\t}\n";
  out += "\t}\n\n";              // close OBSERVATION

  // ontology
  out += "ontology\n";
  out += "\tterm_definitions = <\n";
  out += '\t\t["en"] = <\n';
  out += "\t\t\titems = <\n";

  // structural entries
  out += '\t\t\t\t["at0000"] = <\n';
  out += '\t\t\t\t\ttext = <"' + esc(overallName) + '">\n';
  out += '\t\t\t\t\tdescription = <"' + esc(overallName) + '">\n';
  out += "\t\t\t\t>\n";

  out += '\t\t\t\t["at0001"] = <\n';
  out += '\t\t\t\t\ttext = <"History">\n';
  out += '\t\t\t\t\tdescription = <"@ internal @">\n';
  out += "\t\t\t\t>\n";

  out += '\t\t\t\t["at0002"] = <\n';
  out += '\t\t\t\t\ttext = <"Any event">\n';
  out += '\t\t\t\t\tdescription = <"">\n';
  out += "\t\t\t\t>\n";

  out += '\t\t\t\t["at0003"] = <\n';
  out += '\t\t\t\t\ttext = <"Tree">\n';
  out += '\t\t\t\t\tdescription = <"@ internal @">\n';
  out += "\t\t\t\t>\n";

  out += '\t\t\t\t["at0010"] = <\n';
  out += '\t\t\t\t\ttext = <"Item tree">\n';
  out += '\t\t\t\t\tdescription = <"@ internal @">\n';
  out += "\t\t\t\t>\n";

  // dynamic ontology items (elements and their options)
  ontologyItems.forEach(o => {
    // we already skipped at0000..at0003..at0010 by never adding them
    out += '\t\t\t\t["' + o.atCode + '"] = <\n';
    out += '\t\t\t\t\ttext = <"' + esc(o.text) + '">\n';
    out += '\t\t\t\t\tdescription = <"' + esc(o.desc) + '">\n';
    out += "\t\t\t\t>\n";
  });

  out += "\t\t\t>\n"; // close items
  out += "\t\t>\n";   // close ["en"]
  out += "\t>\n";     // close term_definitions

  // term_binding (optional)
  const termBindingKeys = Object.keys(termBindingMap);
  if (termBindingKeys.length){
    out += "term_binding = <\n";
    out += '\t["DMSRead"] = <\n';
    out += "\t\titems = <\n";
    termBindingKeys.forEach(parentAt => {
      const code = termBindingMap[parentAt];
      if (!code) return;
      out += '\t\t\t["' + parentAt + '"] = <[DMSRead::' + code + "]>\n";
    });
    out += "\t\t>\n";
    out += "\t>\n";
    out += ">\n";
  }

  return out;
}


  // ==========================
  // ADL #2: COMPOSITION archetype
  // ==========================
  // We'll generate a simple COMPOSITION that references the OBSERVATION.
  // This is a minimal "document" style composition.
    function buildCompositionAdl(overallName){
    const DateStr = todayIsoDate();
    const lowerName = overallName.toLowerCase();

    // Names in the working example:
    //   COMPOSITION comment uses "<OverallName>_Doc"
    //   ontology at0000 text/description are "<OverallName>_Doc"
    // We'll mirror that.
    const docName = overallName + "_Doc";

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
    outText += '\t\t["en"] = <\n';
    outText += '\t\t\tlanguage = <[ISO_639-1::en]>\n';
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
    outText += "\tCOMPOSITION[at0000] matches {    -- " + docName + "\n";
    outText += "\t\tcategory matches {\n";
    outText += "\t\t\tDV_CODED_TEXT[at0001] matches {    -- Coded text\n";
    outText += "\t\t\t\tdefining_code matches {\n";
    outText += "\t\t\t\t\t[openehr::433]\n";
    outText += "\t\t\t\t}\n";
    outText += "\t\t\t}\n";
    outText += "\t\t}\n";
    outText += "\t\tcontext matches {\n";
    outText += "\t\t\tEVENT_CONTEXT[at0002] matches {*}    -- Event Context\n";
    outText += "\t\t}\n";
    outText += "\t\tcontent cardinality matches {1..*; unordered} matches {\n";
    outText += "\t\t\tallow_archetype OBSERVATION[at0005] occurrences matches {0..*} matches {    -- OBSERVATION\n";
    outText += "\t\t\t\tinclude\n";
    outText += "\t\t\t\t\tarchetype_id/value matches {/openEHR-EHR-OBSERVATION\\." + lowerName + "\\.v0/}\n";
    outText += "\t\t\t}\n";
    outText += "\t\t}\n";
    outText += "\t}\n\n";

    outText += "ontology\n";
    outText += "\tterm_definitions = <\n";
    outText += '\t\t["en"] = <\n';
    outText += "\t\t\titems = <\n";
    outText += '\t\t\t\t["at0000"] = <\n';
    outText += '\t\t\t\t\ttext = <"' + docName + '">\n';
    outText += '\t\t\t\t\tdescription = <"' + docName + '">\n';
    outText += "\t\t\t\t>\n";
    outText += '\t\t\t\t["at0001"] = <\n';
    outText += '\t\t\t\t\ttext = <"Coded text">\n';
    outText += '\t\t\t\t\tdescription = <"">\n';
    outText += "\t\t\t\t>\n";
    outText += '\t\t\t\t["at0002"] = <\n';
    outText += '\t\t\t\t\ttext = <"Event Context">\n';
    outText += '\t\t\t\t\tdescription = <"">\n';
    outText += "\t\t\t\t>\n";
    outText += '\t\t\t\t["at0005"] = <\n';
    outText += '\t\t\t\t\ttext = <"OBSERVATION">\n';
    outText += '\t\t\t\t\tdescription = <"">\n';
    outText += "\t\t\t\t>\n";
    outText += "\t\t\t>\n";
    outText += "\t\t>\n";
    outText += "\t>\n";

    return outText;
  }


  // ==========================
  // TEMPLATE (.oet)
  // ==========================
  // Emit a minimal openEHR Template referencing the COMPOSITION and OBSERVATION.
    function buildTemplateOet(overallName){
    const lowerName = overallName.toLowerCase();
    const today = todayIsoDate();

    // In working file:
    // - root <template> has xmlns="openEHR/v1/Template"
    // - <name> is "<OverallName>_Template"
    // - <description> block has original_author/date, lifecycle_state, details, other_details/original_language
    // - <definition> is tem:COMPOSITION with attributes:
    //      archetype_id="openEHR-EHR-COMPOSITION.<lower>_doc.v0"
    //      concept_name="<OverallName>_Doc"
    //      name="<OverallName>_Template"
    //   and inside it -->single <Content ... xsi:type="tem:OBSERVATION"/>
    //
    // --> mirror format.
    //
    // Note: Archetype Designer priority:
    //   - xmlns on <template>
    //   - xmlns:tem and xmlns:xsi on <definition>
    //   - xsi:type on <definition> and <Content>
    //   - the Content element name is capitalized exactly "Content"
    //   - path is /content[at0005] in example; --> keep that literal

    const templateName   = overallName + "_Template";
    const conceptName    = overallName + "_Doc";
    const compArchetype  = "openEHR-EHR-COMPOSITION." + lowerName + "_doc.v0";
    const obsArchetype   = "openEHR-EHR-OBSERVATION." + lowerName + ".v0";

    let outText = "";
    outText += '<?xml version="1.0" encoding="UTF-8"?>\n';
    outText += '<template xmlns="openEHR/v1/Template">\n';
    outText += '\t<name>' + templateName + '</name>\n';
    outText += '\t<description>\n';
    outText += '\t\t<original_author>\n';
    outText += '\t\t\t<item>\n';
    outText += '\t\t\t\t<key>date</key>\n';
    outText += '\t\t\t\t<value>' + today + '</value>\n';
    outText += '\t\t\t</item>\n';
    outText += '\t\t</original_author>\n';
    outText += '\t\t<lifecycle_state>unmanaged</lifecycle_state>\n';
    outText += '\t\t<details/>\n';
    outText += '\t\t<other_details>\n';
    outText += '\t\t\t<item>\n';
    outText += '\t\t\t\t<key>original_language</key>\n';
    outText += '\t\t\t\t<value>ISO_639-1::en</value>\n';
    outText += '\t\t\t</item>\n';
    outText += '\t\t</other_details>\n';
    outText += '\t</description>\n';

    outText += '\t<definition '
      + 'archetype_id="' + compArchetype + '" '
      + 'concept_name="' + conceptName + '" '
      + 'name="' + templateName + '" '
      + 'xmlns:tem="openEHR/v1/Template" '
      + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
      + 'xsi:type="tem:COMPOSITION">\n';

    outText += '\t\t<Content '
      + 'archetype_id="' + obsArchetype + '" '
      + 'max="1" '
      + 'path="/content[at0005]" '
      + 'xsi:type="tem:OBSERVATION"/>\n';

    outText += '\t</definition>\n';
    outText += '</template>\n';

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
