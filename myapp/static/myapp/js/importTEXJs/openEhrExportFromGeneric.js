(function(){

  // ==========================
  // CONFIG / CONSTANTS
  // ==========================
  const UUID = "633d4e61-1fbf-42af-a4d5-9dcc7c6bb719"; // keep same UUID convention
  function todayIsoDate(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  // utilities
  function downloadTextFile(filename, content){
    const blob = new Blob([content], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // We still reuse these (no DOM scrape, just reuse naming logic)
  function getSelectedTexName(){
    const label = document.getElementById('selected-tex-label')?.textContent?.trim();
    if (label && label.toLowerCase() !== 'no tex file selected') return label;
    const libSel = document.querySelector('#lib-pane-list select');
    if (libSel && libSel.value) return libSel.value;
    const h1 = document.querySelector('h1')?.textContent?.trim();
    return h1 || 'Imported_TEX';
  }

  function normalizeOverallName(raw){
    let base = String(raw||'').trim();
    base = base.replace(/\.[A-Za-z0-9]+$/,''); // drop .tex etc
    base = base.replace(/\s+/g,'');           // strip spaces
    if (!base) base = 'Imported_TEX';
    return base;
  }

  // escape for ontology text/description
  function esc(s){ return String(s||"").replace(/"/g,'""'); }

  // ==========================
  // OBSERVATION builder FROM GENERIC SNAPSHOT
  // ==========================
  function buildObservationAdlFromGeneric(overallName, genericControls){
    const DateStr = todayIsoDate();
    const lowerName = overallName.toLowerCase();

    // --- atCode allocator ---
    // We'll start at at0004 and go upward.
    // We'll reserve structural at0000..at0003 and at0010 as before.
    let atCounter = 4;
    function nextAt(){
      // skip at0010 (protocol)
      if (atCounter === 9) {
        // next would become at0010; jump to 11
        atCounter = 10; // so that after increment below we land on 11
      }
      atCounter += 1;
      return "at" + String(atCounter).padStart(4,"0");
    }

    // We'll collect:
    const elementBlocks = [];   // string chunks for ELEMENT[...] { ... }
    const ontologyItems = [];   // {atCode,text,desc} including sub-options
    const termBindingMap = {};  // { parentAt: "READCODE" } from coded lists
    const quantityUnits = [];   // {unit,labelForOntology} if we ever want to emit DV_QUANTITY like cm/s2

    // helper to push ontology items
    function addOntology(atCode, text, desc){
      ontologyItems.push({
        atCode,
        text: text || "",
        desc: (desc == null ? "" : desc)
      });
    }

    // ---- DV_TEXT ----
    function emitDvText(label){
      const atCode = nextAt();
      addOntology(atCode, "DV_TEXT " + label, "");
      const block =
        "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_TEXT " + label + "\n" +
        "\t\t\t\t\t\t\t\tvalue matches {\n" +
        "\t\t\t\t\t\t\t\t\tDV_TEXT matches {*}\n" +
        "\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t}\n";
      return block;
    }

    // ---- DV_BOOLEAN ----
    function emitDvBoolean(label){
      const atCode = nextAt();
      addOntology(atCode, "DV_BOOLEAN", "");
      const block =
        "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_BOOLEAN\n" +
        "\t\t\t\t\t\t\t\tvalue matches {\n" +
        "\t\t\t\t\t\t\t\t\tDV_BOOLEAN matches {*}\n" +
        "\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t}\n";
      return block;
    }

    // ---- DV_DATE ----
    function emitDvDate(label){
      const atCode = nextAt();
      addOntology(atCode, "DV_DATE", "");
      const block =
        "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_DATE\n" +
        "\t\t\t\t\t\t\t\tvalue matches {\n" +
        "\t\t\t\t\t\t\t\t\tDV_DATE matches {*}\n" +
        "\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t}\n";
      return block;
    }

    // ---- DV_QUANTITY ----
    // We don't have units guaranteed, but generic.number might carry data.unit.
    // We'll emit a very simple DV_QUANTITY matches {*} like your previous script.
    function emitDvQuantity(label, unit){
      const atCode = nextAt();
      addOntology(atCode, "DV_QUANTITY", "");
      if (unit) {
        // remember for ontology later (optional)
        quantityUnits.push({unit, labelForOntology: label});
      }
      const block =
        "\t\t\t\t\t\t\tELEMENT[" + atCode + "] occurrences matches {0..1} matches {    -- DV_QUANTITY\n" +
        "\t\t\t\t\t\t\t\tvalue matches {\n" +
        "\t\t\t\t\t\t\t\t\tDV_QUANTITY matches {*}\n" +
        "\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t}\n";
      return block;
    }

    // ---- DV_CODED_TEXT ----
    // optionsArr: [{label, value?, code?}] In generic we store:
    //   for radio/select-single: ctrl.data.options: [{value:"RAFPUS21",label:"S2"}, ...]
    // We'll create:
    //   ELEMENT[parentAt]
    //     DV_CODED_TEXT.defining_code matches {
    //        [local::
    //          at0006,    -- Term 1
    //          at0007]    -- Term 2
    //     }
    //
    // We'll add ontology for parentAt as "DV_CODED_TEXT <label>".
    // Then ontology for each option atCode.
    function emitDvCodedText(label, optionsArr){
      const parentAt = nextAt();
      addOntology(parentAt, "DV_CODED_TEXT " + label, "");

      // build sub-options
      const optLines = [];
      const subAts = []; // keep so we can push ontology for each
      optionsArr.forEach(opt => {
        const optText = opt.label || opt.value || "Option";
        const optDesc = opt.value ? (opt.value + " " + optText) : optText;
        const thisOptAt = nextAt();
        subAts.push({ atCode: thisOptAt, txt: optText, desc: optDesc });

        // term binding: first with a plausible code (looks like readcode/value) "wins"
        if (!termBindingMap[parentAt] && opt.value) {
          // tiny cleanup e.g. 'RAFPUS01' -> 'RAFPUS01' (no trailing dots)
          termBindingMap[parentAt] = String(opt.value).replace(/\.+$/,'');
        }

        optLines.push({ atCode: thisOptAt, label: optText });
      });

      // add sub-options to ontology
      subAts.forEach(s => {
        addOntology(s.atCode, s.txt, s.desc);
      });

      // Now build the block with defining_code
      // We want:
      // defining_code matches {
      //   [local::
      //   at0006,    -- Term 1
      //   at0007]    -- Term 2
      // }
      let definingChunk = "";
      if (optLines.length === 0){
        definingChunk =
          "[local::\n" +
          parentAt + "]\n";
      } else if (optLines.length === 1){
        const only = optLines[0];
        definingChunk =
          "[local::\n" +
          only.atCode + "]    -- " + only.label + "\n";
      } else {
        const allButLast = optLines.slice(0,-1).map(line => {
          return line.atCode + ",    -- " + line.label;
        }).join("\n");
        const last = optLines[optLines.length-1];
        const lastLine = last.atCode + "]    -- " + last.label;
        definingChunk =
          "[local::\n" +
          allButLast + "\n" +
          lastLine + "\n";
      }

      const block =
        "\t\t\t\t\t\t\tELEMENT[" + parentAt + "] occurrences matches {0..1} matches {    -- DV_CODED_TEXT " + label + "\n" +
        "\t\t\t\t\t\t\t\tvalue matches {\n" +
        "\t\t\t\t\t\t\t\t\tDV_CODED_TEXT matches {\n" +
        "\t\t\t\t\t\t\t\t\t\tdefining_code matches {\n" +
        "\t\t\t\t\t\t\t\t\t\t\t" + definingChunk +
        "\t\t\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t\t}\n" +
        "\t\t\t\t\t\t\t}\n";

      return block;
    }

    // ---- heuristics ----

    function looksLikeBooleanControl(ctrl){
      if (ctrl.kind === "checkbox") return true;

      if (ctrl.kind === "radio" && Array.isArray(ctrl.data?.options)) {
        const opts = ctrl.data.options.map(o => (o.label || "").toLowerCase());
        // crude yes/no detector
        if (opts.length === 2){
          const joined = opts.join("|");
          if (/yes|no/.test(joined) || /true|false/.test(joined)) {
            return true;
          }
        }
      }

      // compound parts with yesno are handled separately below,
      // so no need to detect them here.
      return false;
    }

    // turn each generic control into one-or-more ELEMENT blocks
    function emitFromGenericControl(ctrl){
      // note: each call pushes to elementBlocks[]
      const label = ctrl.label || "Field";

      // compound: explode its parts
      if (ctrl.kind === "compound"){
        const parts = ctrl.data?.parts || [];
        parts.forEach(p => {
          const pLabel = p.label || label;
          switch (p.subKind){
            case "yesno":
              elementBlocks.push( emitDvBoolean(pLabel) );
              break;
            case "text":
              elementBlocks.push( emitDvText(pLabel) );
              break;
            case "number":
              elementBlocks.push( emitDvQuantity(pLabel, p.unit || "") );
              break;
            case "date":
              elementBlocks.push( emitDvDate(pLabel) );
              break;
            default:
              // fallback
              elementBlocks.push( emitDvText(pLabel) );
          }
        });
        return;
      }

      // boolean-like
      if (looksLikeBooleanControl(ctrl)){
        elementBlocks.push( emitDvBoolean(label) );
        return;
      }

      // coded lists (radio, select-single, select-multi)
      if ( (ctrl.kind === "radio") ||
           (ctrl.kind === "select-single") ||
           (ctrl.kind === "select-multi") ) {
        const opts = Array.isArray(ctrl.data?.options) ? ctrl.data.options : [];
        elementBlocks.push( emitDvCodedText(label, opts) );
        return;
      }

      // date
      if (ctrl.kind === "date"){
        elementBlocks.push( emitDvDate(label) );
        return;
      }

      // number
      if (ctrl.kind === "number"){
        const unit = ctrl.data?.unit || "";
        elementBlocks.push( emitDvQuantity(label, unit) );
        return;
      }

      // textarea → DV_TEXT
      if (ctrl.kind === "textarea"){
        elementBlocks.push( emitDvText(label) );
        return;
      }

      // label/link: usually static display, not data.
      // We could skip, but skipping loses info for diffing, so emit DV_TEXT.
      if (ctrl.kind === "label" || ctrl.kind === "link"){
        elementBlocks.push( emitDvText(label) );
        return;
      }

      // text (plain input)
      if (ctrl.kind === "text"){
        elementBlocks.push( emitDvText(label) );
        return;
      }

      // fallback
      elementBlocks.push( emitDvText(label) );
    }

    // go through each generic control and emit ELEMENT blocks
    genericControls.forEach(gc => {
      emitFromGenericControl(gc);
    });

    // build ADL header/body/footer exactly like before
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

    out += "\t\t\t\t\t\t\t\t}\n"; // close items
    out += "\t\t\t\t\t\t\t}\n";   // close ITEM_TREE
    out += "\t\t\t\t\t\t}\n";     // close data matches
    out += "\t\t\t\t\t}\n";       // close EVENT
    out += "\t\t\t\t}\n";         // close events
    out += "\t\t\t}\n";           // close HISTORY
    out += "\t\t}\n";             // close data
    out += "\t\tprotocol matches {\n";
    out += "\t\t\tITEM_TREE[at0010] matches {*}    -- Item tree\n";
    out += "\t\t}\n";
    out += "\t}\n\n";

    // ontology
    out += "ontology\n";
    out += "\tterm_definitions = <\n";
    out += '\t\t["en"] = <\n';
    out += "\t\t\titems = <\n";

    // mandatory structural first
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

    // dynamic ontology
    ontologyItems.forEach(o => {
      // NOTE: we avoided adding at0000..at0003..at0010 dynamically.
      // We're free to add everything we recorded.
      out += '\t\t\t\t["' + o.atCode + '"] = <\n';
      out += '\t\t\t\t\ttext = <"' + esc(o.text) + '">\n';
      out += '\t\t\t\t\tdescription = <"' + esc(o.desc) + '">\n';
      out += "\t\t\t\t>\n";
    });

    // optional: also surface quantity unit labels in ontology for readability.
    // We'll add them with the unit string as the key, similar-ish to your sample.
    // (This is a bit hacky, but matches the spirit of your reference.)
    quantityUnits.forEach(u => {
      if (!u.unit) return;
      out += '\t\t\t\t["' + esc(u.unit) + '"] = <\n';
      out += '\t\t\t\t\ttext = <"' + esc(u.labelForOntology || u.unit) + '">\n';
      out += '\t\t\t\t\tdescription = <"' + esc(u.unit) + '">\n';
      out += "\t\t\t\t>\n";
    });

    out += "\t\t\t>\n"; // close items
    out += "\t\t>\n";   // close ["en"]
    out += "\t>\n";     // close term_definitions

    // term_binding block (DMSRead style)
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
  // COMPOSITION and TEMPLATE (reuse previous logic)
  // ==========================

  function buildCompositionAdl(overallName){
    const DateStr = todayIsoDate();
    const lowerName = overallName.toLowerCase();
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
    outText += '\tlifecycle_state = <"unmanaged">\n';
    outText += "\tdetails = <\n";
    outText += '\t\t["en"] = <\n';
    outText += '\t\t\tlanguage = <[ISO_639-1::en]>\n';
    outText += "\t\t>\n";
    outText += "\t>\n";
    outText += "\tother_details = <\n";
    outText += '\t\t["licence"] = <"This work is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License. To view a copy of this license, visit http://creativecommons.org/licenses/by-sa/4.0/.">\n';
    outText += '\t\t["custodian_organisation"] = <"openEHR Foundation">\n';
    outText += '\t\t["original_namespace"] = <"org.openehr">\n';
    outText += '\t\t["original_publisher"] = <"openEHR Foundation">\n';
    outText += '\t\t["custodian_namespace"] = <"org.openehr">\n';
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

  function buildTemplateOet(overallName){
    const lowerName = overallName.toLowerCase();
    const today = todayIsoDate();

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
  // BUTTON
  // ==========================
  function addOpenEhrExportButton(){
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Export to openEHR (3 files : Observation, Composition, Template)';
    btn.style.marginLeft = '5px';
    btn.style.padding = '6px 10px';
    btn.style.fontSize = '12px';
    btn.style.border = '1px solid #888';
    btn.style.borderRadius = '4px';
    btn.style.background = '#f5f5f5';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'background 0.2s, box-shadow 0.2s';

    const img1 = document.createElement('img');
    img1.src = '/static/myapp/images/openehr_logo.png';
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
      if (!window.getGenericSnapshot) {
        console.warn('getGenericSnapshot() not available');
        return;
      }

      const rawName = getSelectedTexName();
      const OverallName = normalizeOverallName(rawName);

      const snap = window.getGenericSnapshot(); // {title, controls, ...}
      // We *trust* OverallName from TEX label, not snap.title, to keep compatibility.
      const controls = snap.controls || [];

      const fileContentObs  = buildObservationAdlFromGeneric(OverallName, controls);
      const fileNameObs     = "openEHR-EHR-OBSERVATION." + OverallName.toLowerCase() + ".v0.adl";

      const fileContentComp = buildCompositionAdl(OverallName);
      const fileNameComp    = "openEHR-EHR-COMPOSITION." + OverallName.toLowerCase() + "_doc.v0.adl";

      const fileContentTpl  = buildTemplateOet(OverallName);
      const fileNameTpl     = OverallName + "_Template.oet";

      // fire all 3, slightly staggered
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
