(function () {
    const CANVAS = document.getElementById('canvas') || document;

    function qa(sel, root = CANVAS) { return Array.from(root.querySelectorAll(sel)); }
    function txt(n) { return (n && (n.textContent || '').trim()) || ''; }

    function getSelectedTexName() {
        const label = document.getElementById('selected-tex-label')?.textContent?.trim();
        if (label && label.toLowerCase() !== 'no tex file selected') return label;
        const libSel = document.querySelector('#lib-pane-list select');
        if (libSel && libSel.value) return libSel.value;
        const h1 = document.querySelector('h1')?.textContent?.trim();
        return h1 || 'Imported_TEX';
    }

    function makeBaseTitleFromTexName(name) {
        let base = String(name || '').trim();
        base = base.replace(/\.[Tt][Ee][Xx]$/, '');
        base = base.replace(/\s+/g, '_');
        base = base || 'Imported_TEX';
        return base;
    }

    function isClassicReadCode(ctrl) {
        return !!(
            ctrl.querySelector('.rc-wrap') ||
            ctrl.querySelector('.rc-yesno') ||
            ctrl.querySelector('.rc-chk') ||
            ctrl.querySelector('.rc-prompt')
        );
    }

    function hasAnyFormInputs(root) {
        return !!root.querySelector(
            'select,textarea,input[type="text"],input[type="date"],input[type="number"],input[type="checkbox"],input[type="radio"]'
        );
    }

    function geomFrom(el) {
        const s = getComputedStyle(el);
        function px(n) { return parseInt(n, 10) || 0; }
        return { x: px(s.left), y: px(s.top), w: px(s.width), h: px(s.height) };
    }

    function decodeUnicodeEscapes(str) {
        if (!str) return '';
        return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, g1) =>
            String.fromCharCode(parseInt(g1, 16))
        );
    }

    function buildTooltipFromReadcodeMeta(metaArray) {
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

    function readcodeInfo(el) {
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
                autoText = line.replace(/^\s*Auto-Entered Text\s*:\s*/i, '').trim();
            }
        });

        const entries = [];
        rawLines.forEach(line => {
            if (/^\s*Auto-Entered Text\s*:/i.test(line)) return;
            const m = line.split('—');
            const code = (m[0] || '').trim();
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


    //*****// uniqueIdFromLabel()
    function uniqueIdFromLabel(labelBase, hint = '') {
        const raw = (labelBase || '').trim() || 'field';
        const base = raw + (hint ? ('_' + hint) : '');
        return base
            .replace(/[^A-Za-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) + '_' +
            Math.random().toString(36).slice(2, 8);
    }

    //*****//toGenericFromReadCode()
    function toGenericFromReadCode(ctrl) {
        const geom = geomFrom(ctrl);

        // label
        const labelText = (ctrl.querySelector('.rc-prompt')?.textContent || '').trim() || 'Read code';

        // meta/tooltip
        const metaArray = readcodeInfo(ctrl);
        const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

        // parts we detected in mapReadCode():
        const yesInput = ctrl.querySelector('.rc-yes-label input.rc-yesno');
        const noInput = ctrl.querySelector('.rc-no-label  input.rc-yesno');
        const hasYesNo = !!(yesInput || noInput);

        const textEl = ctrl.querySelector('input[type="text"][name$="_text"]');
        const valEl = ctrl.querySelector('input[type="text"][name$="_val"]');
        const dateEl = ctrl.querySelector('input[type="date"]');
        const hasText = !!textEl;
        const hasVal = !!valEl;
        const hasDate = !!dateEl;

        const unitText = (() => {
            const span = valEl?.nextElementSibling;
            const t = span && span.tagName === 'SPAN' ? span.textContent.trim() : '';
            return t || '';
        })();

        // We'll gather sub-parts into data.parts[]
        const parts = [];

        if (hasYesNo) {
            const yesVal = yesInput?.value || 'yes';
            const noVal = noInput?.value || 'no';
            const defVal =
                yesInput?.checked ? yesVal :
                    (noInput?.checked ? noVal : '');

            parts.push({
                subKind: 'yesno',
                label: labelText,
                options: [
                    { value: yesVal, label: 'Yes' },
                    { value: noVal, label: 'No' }
                ],
                defaultValue: defVal
            });
        }

        if (hasText) {
            parts.push({
                subKind: 'text',
                label: hasYesNo ? (labelText + ' (text)') : labelText,
                defaultText: textEl?.value || '',
                required: textEl?.hasAttribute('required') || false
            });
        }

        if (hasVal) {
            parts.push({
                subKind: 'number',
                label: hasYesNo ? (labelText + ' (value)') : labelText,
                defaultNumber: valEl?.value ? Number(valEl.value) : null,
                unit: unitText || '',
                required: valEl?.hasAttribute('required') || false
            });
        }

        if (hasDate) {
            parts.push({
                subKind: 'date',
                label: hasYesNo ? (labelText + ' (date)') : (labelText + ' (date)'),
                defaultDate: dateEl?.value || '',
                required: dateEl?.hasAttribute('required') || false
            });
        }

        // pure date only / pure value only / pure text only case?
        // If we didn't push multiple subparts, it's effectively not compound.
        if (parts.length === 1) {
            const p = parts[0];
            switch (p.subKind) {
                case 'text':
                    return [{
                        id: uniqueIdFromLabel(labelText),
                        kind: 'text',
                        label: p.label,
                        tooltip: unifiedTooltip,
                        ui: { ...geom },
                        data: {
                            defaultText: p.defaultText || ''
                        },
                        flags: {
                            required: !!p.required,
                            readcodeDerived: true
                        }
                    }];
                case 'date':
                    return [{
                        id: uniqueIdFromLabel(labelText),
                        kind: 'date',
                        label: p.label,
                        tooltip: unifiedTooltip,
                        ui: { ...geom },
                        data: {
                            defaultDate: p.defaultDate || ''
                        },
                        flags: {
                            required: !!p.required,
                            readcodeDerived: true
                        }
                    }];
                case 'number':
                    return [{
                        id: uniqueIdFromLabel(labelText),
                        kind: 'number',
                        label: p.label,
                        tooltip: unifiedTooltip,
                        ui: { ...geom },
                        data: {
                            defaultNumber: p.defaultNumber,
                            unit: p.unit || ''
                        },
                        flags: {
                            required: !!p.required,
                            readcodeDerived: true
                        }
                    }];
                case 'yesno':
                    return [{
                        id: uniqueIdFromLabel(labelText),
                        kind: 'radio',
                        label: p.label,
                        tooltip: unifiedTooltip,
                        ui: { ...geom },
                        data: {
                            options: p.options,
                            defaultValue: p.defaultValue
                        },
                        flags: {
                            required: false,
                            readcodeDerived: true
                        }
                    }];
            }
        }

        // otherwise: genuine compound
        return [{
            id: uniqueIdFromLabel(labelText),
            kind: 'compound',
            label: labelText,
            tooltip: unifiedTooltip,
            ui: { ...geom },
            data: {
                parts,
                // full raw readcode entries too (so openEHR converter can play with codes):
                entries: metaArray
            },
            flags: {
                readcodeDerived: true
            }
        }];
    }


    //*****// toGenericFromReadList()
    function toGenericFromReadList(ctrl) {
        const geom = geomFrom(ctrl);
        const metaArray = readcodeInfo(ctrl);
        const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

        // First try msWrap (multi-dropdown) and native <select> branches,
        // then checkbox list, then radio list, mirroring mapReadList.

        const msWrap = ctrl.querySelector('.ms');
        if (msWrap) {
            const msLabelText = (msWrap.querySelector('.ms-label')?.textContent || '').trim() || 'List';
            const checkLabels = Array.from(msWrap.querySelectorAll('.ms-panel label'));
            const options = [];
            const defaults = [];

            checkLabels.forEach(lab => {
                const inp = lab.querySelector('input[type="checkbox"]');
                if (!inp) return;
                const value = inp.value || '';
                let lbl = (lab.textContent || '').trim();
                // light cleanup
                if (value && lbl.startsWith(value)) {
                    lbl = lbl.replace(value, '').trim();
                }
                options.push({ value, label: lbl || value });
                if (inp.checked) defaults.push(value);
            });

            return [{
                id: uniqueIdFromLabel(msLabelText),
                kind: 'select-multi',
                label: msLabelText,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    options,
                    defaultValues: defaults
                },
                flags: {
                    multiSelect: true
                }
            }];
        }

        const select = ctrl.querySelector('select');
        if (select) {
            const capGuess =
                (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
                (ctrl.querySelector('label')?.textContent || '').trim() ||
                'List';

            // collect options
            const rawOptions = Array.from(select.querySelectorAll('option'))
                .filter(o => (o.value || (o.textContent || '').trim()));
            const builtOptions = rawOptions.map(o => ({
                value: o.value || (o.textContent || '').trim(),
                label: (o.textContent || '').trim() || o.value || ''
            }));

            const multiple = !!select.multiple;

            // TEX quirk: first option might actually be label. If single-select & cap is generic,
            // we promote that first option to label.
            let labelFinal = capGuess;
            let finalOptions = builtOptions.slice();

            if (!multiple && builtOptions.length >= 2) {
                const capIsGeneric = !capGuess || capGuess.toLowerCase() === 'list';
                if (capIsGeneric) {
                    const firstOpt = builtOptions[0];
                    if (firstOpt && firstOpt.label) {
                        labelFinal = firstOpt.label;
                        finalOptions = builtOptions.slice(1);
                    }
                }
            }

            // defaults
            let defaultValues = [];
            let defaultValue = '';
            if (multiple) {
                defaultValues = Array.from(select.selectedOptions || []).map(o => o.value);
            } else {
                defaultValue = select.value || '';
            }

            return [{
                id: uniqueIdFromLabel(labelFinal),
                kind: multiple ? 'select-multi' : 'select-single',
                label: labelFinal,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: multiple ? {
                    options: finalOptions,
                    defaultValues
                } : {
                    options: finalOptions,
                    defaultValue
                },
                flags: {
                    multiSelect: multiple
                }
            }];
        }

        // Visible checkbox list
        const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
        if (checks.length) {
            const cap =
                (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
                (ctrl.querySelector('label')?.textContent || '').trim() ||
                'List';

            const options = [];
            const defaults = [];
            checks.forEach(ch => {
                const lbl = (ch.closest('label')?.textContent || ch.value || 'Option').trim();
                options.push({
                    value: (lbl || '').replace(/\s+/g, '_'),
                    label: lbl
                });
                if (ch.checked) defaults.push((lbl || '').replace(/\s+/g, '_'));
            });

            return [{
                id: uniqueIdFromLabel(cap),
                kind: 'select-multi',
                label: cap,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    options,
                    defaultValues: defaults
                },
                flags: {
                    multiSelect: true
                }
            }];
        }

        // Visible radio list
        const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
        if (radios.length) {
            const cap =
                (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
                (ctrl.querySelector('label')?.textContent || '').trim() ||
                'List';

            const seen = new Set();
            const options = [];
            radios.forEach(r => {
                let lbl = (r.closest('label')?.textContent || r.value || 'Option').trim();
                const val = r.value || lbl.replace(/\s+/g, '_');
                if (!seen.has(val)) {
                    seen.add(val);
                    options.push({ value: val, label: lbl });
                }
            });
            const def = (radios.find(r => r.checked)?.value) || '';

            return [{
                id: uniqueIdFromLabel(cap),
                kind: 'radio',
                label: cap,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    options,
                    defaultValue: def
                },
                flags: {}
            }];
        }

        // fallback plain label
        const cap2 =
            (ctrl.querySelector('.rl-caption')?.textContent || '').trim() ||
            (ctrl.querySelector('label')?.textContent || '').trim() ||
            'List';

        return [{
            id: uniqueIdFromLabel(cap2),
            kind: 'label',
            label: cap2,
            tooltip: unifiedTooltip,
            ui: { ...geom },
            data: {},
            flags: {}
        }];
    }


    //*****// toGenericFromGenericControls()
    function toGenericFromGenericControls(ctrl) {
        const geom = geomFrom(ctrl);
        const out = [];

        function findLabelFor(el) {
            // 1. label[for=id]
            if (el.id) {
                const m = el.closest('.ctrl, .row, .readcode-host')  // stay local-ish
                    ?.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                if (m) {
                    const t = (m.textContent || '').trim();
                    if (t) return t;
                }
            }

            // 2. wrapping <label>
            const wrap = el.closest('label');
            if (wrap) {
                const t = (wrap.textContent || '').trim();
                if (t) return t;
            }

            // 3. previous sibling label/span/strong
            let prev = el.previousElementSibling;
            if (prev && /^(LABEL|SPAN|STRONG)$/i.test(prev.tagName)) {
                const t = (prev.textContent || '').trim();
                if (t) return t;
            }

            // 3b. NEXT sibling label (this fixes the "Remedial" case)
            let next = el.nextElementSibling;
            if (next && /^LABEL$/i.test(next.tagName)) {
                const t = (next.textContent || '').trim();
                if (t) return t;
            }

            // 4. fieldset legend
            const fs = el.closest('fieldset');
            const lg = fs?.querySelector('legend');
            if (lg) {
                const t = (lg.textContent || '').trim();
                if (t) return t;
            }

            // 5. fallback to element name/placeholder
            if (el.name && el.name.trim()) return el.name.trim();
            if (el.placeholder && el.placeholder.trim()) return el.placeholder.trim();

            // 6. FINAL DESPERATION: derive from readcodeInfo()
            // (only now do we generate "Last Entry for CODE")
            const metaArray = readcodeInfo(el);
            if (metaArray && metaArray.length) {
                const first = metaArray[0];
                if (first && first.code) {
                    return `Last Entry for ${first.code}`;
                }
            }

            // 7. utterly nothing
            return 'Field';
        }


        // radios grouped by name
        const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
        const groupMap = new Map();
        radios.forEach(r => {
            const name = r.name || '_radio_' + Math.random().toString(36).slice(2);
            if (!groupMap.has(name)) groupMap.set(name, []);
            groupMap.get(name).push(r);
        });
        groupMap.forEach(group => {
            const label = findLabelFor(group[0]);
            const opts = [];
            const seenVals = new Set();
            group.forEach(r => {
                let lbl = txt(r.closest('label')) ||
                    (r.nextSibling?.nodeType === 3 ? (r.nextSibling.nodeValue || '').trim() : '') ||
                    r.value || 'Option';
                const val = r.value || lbl.replace(/\s+/g, '_');
                if (!seenVals.has(val)) {
                    seenVals.add(val);
                    opts.push({ value: val, label: lbl });
                }
            });
            const defVal = (group.find(r => r.checked)?.value) || '';
            const metaArray = readcodeInfo(group[0]);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'radio',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    options: opts,
                    defaultValue: defVal
                },
                flags: {}
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
            const defVals = multiple
                ? Array.from(sel.selectedOptions || []).map(o => o.value || txt(o))
                : [];
            const defVal = multiple ? '' : (sel.value || '');

            const metaArray = readcodeInfo(sel);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

            out.push({
                id: uniqueIdFromLabel(label),
                kind: multiple ? 'select-multi' : 'select-single',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: multiple ? {
                    options: opts,
                    defaultValues: defVals
                } : {
                    options: opts,
                    defaultValue: defVal
                },
                flags: { multiSelect: multiple }
            });
        });

        // checkboxes
        const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
        checks.forEach(ch => {
            const label = findLabelFor(ch);
            const metaArray = readcodeInfo(ch);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'checkbox',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    checked: !!ch.checked
                },
                flags: {
                    required: ch.hasAttribute('required')
                }
            });
        });

        // dates
        const dates = Array.from(ctrl.querySelectorAll('input[type="date"]'));
        dates.forEach(d => {
            const label = findLabelFor(d);
            const metaArray = readcodeInfo(d);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'date',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    defaultDate: d.value || ''
                },
                flags: {
                    required: d.hasAttribute('required')
                }
            });
        });

        // textareas
        const areas = Array.from(ctrl.querySelectorAll('textarea'));
        areas.forEach(a => {
            const label = findLabelFor(a);
            const metaArray = readcodeInfo(a);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'textarea',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    rows: Math.max(1, parseInt(a.getAttribute('rows') || '3', 10)),
                    defaultText: a.value || ''
                },
                flags: {
                    required: a.hasAttribute('required')
                }
            });
        });

        // text / number (not readOnly)
        const texts = Array.from(ctrl.querySelectorAll('input[type="text"],input[type="number"]'))
            .filter(i => !i.readOnly);
        texts.forEach(ti => {
            const label = findLabelFor(ti);
            const metaArray = readcodeInfo(ti);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

            if (ti.type === 'number') {
                out.push({
                    id: uniqueIdFromLabel(label),
                    kind: 'number',
                    label,
                    tooltip: unifiedTooltip,
                    ui: { ...geom },
                    data: {
                        defaultNumber: ti.value ? Number(ti.value) : null
                    },
                    flags: {
                        required: ti.hasAttribute('required')
                    }
                });
            } else {
                out.push({
                    id: uniqueIdFromLabel(label),
                    kind: 'text',
                    label,
                    tooltip: unifiedTooltip,
                    ui: { ...geom },
                    data: {
                        defaultText: ti.value || ''
                    },
                    flags: {
                        required: ti.hasAttribute('required')
                    }
                });
            }
        });

        // if nothing detected, maybe it's just a label block
        if (!out.length) {
            const leg = ctrl.querySelector('legend');
            if (leg) {
                out.push({
                    id: uniqueIdFromLabel(txt(leg)),
                    kind: 'label',
                    label: txt(leg),
                    tooltip: undefined,
                    ui: { ...geom },
                    data: {},
                    flags: {}
                });
            } else {
                const anyLabel = ctrl.querySelector('label');
                if (anyLabel) {
                    out.push({
                        id: uniqueIdFromLabel(txt(anyLabel)),
                        kind: 'label',
                        label: txt(anyLabel),
                        tooltip: undefined,
                        ui: { ...geom },
                        data: {},
                        flags: {}
                    });
                }
            }
        }

        return out;
    }

    function toGenericFromLabelOrLink(ctrl) {
        const geom = geomFrom(ctrl);
        const a = ctrl.querySelector('a[href]');
        if (a) {
            return [{
                id: uniqueIdFromLabel(txt(a) || a.href),
                kind: 'link',
                label: txt(a) || a.href,
                tooltip: undefined,
                ui: { ...geom },
                data: { href: a.href },
                flags: {}
            }];
        }
        const labelEl = ctrl.querySelector('label');
        if (labelEl) {
            return [{
                id: uniqueIdFromLabel(txt(labelEl)),
                kind: 'label',
                label: txt(labelEl),
                tooltip: undefined,
                ui: { ...geom },
                data: {},
                flags: {}
            }];
        }
        return [];
    }


    //*****// toGenericFromLabelOrLink()
    function toGenericFromGenericControls(ctrl) {
        const geom = geomFrom(ctrl);
        const out = [];

        function findLabelFor(el) {
            if (el.id) {
                const m = ctrl.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                if (m) return txt(m);
            }
            const wrap = el.closest('label');
            if (wrap) return txt(wrap);

            let p = el.previousElementSibling;
            if (p && /^(LABEL|SPAN|STRONG)$/i.test(p.tagName)) {
                const t = txt(p);
                if (t) return t;
            }

            const fs = el.closest('fieldset');
            const lg = fs?.querySelector('legend');
            if (lg) return txt(lg);

            const isAuditStyle = el.classList.contains('tpl-lastentry') ||
                el.closest('.tpl-lastentry');

            if (isAuditStyle) {
                const metaArray = readcodeInfo(el);
                if (metaArray && metaArray.length) {
                    const first = metaArray[0];
                    if (first && first.code) {
                        return `Last Entry for ${first.code}`;
                    }
                }

                // fallback: some last-entry fields literally encode "Last Entry for XYZ."
                // in their data-readcodes attribute. We can reuse that text directly.
                const host = el.closest('.readcode-host');
                const rcBlob = host?.getAttribute('data-readcodes') || '';
                const m = rcBlob.match(/Last\s+Entry\s+for\s+(.+?)\s*$/i);
                if (m) {
                    return `Last Entry for ${m[1].trim()}`;
                }
            }

            return el.name || el.placeholder || 'Field';
        }

        // radios grouped by name
        const radios = Array.from(ctrl.querySelectorAll('input[type="radio"]'));
        const groupMap = new Map();
        radios.forEach(r => {
            const name = r.name || '_radio_' + Math.random().toString(36).slice(2);
            if (!groupMap.has(name)) groupMap.set(name, []);
            groupMap.get(name).push(r);
        });
        groupMap.forEach(group => {
            const label = findLabelFor(group[0]);
            const opts = [];
            const seenVals = new Set();
            group.forEach(r => {
                let lbl = txt(r.closest('label')) ||
                    (r.nextSibling?.nodeType === 3 ? (r.nextSibling.nodeValue || '').trim() : '') ||
                    r.value || 'Option';
                const val = r.value || lbl.replace(/\s+/g, '_');
                if (!seenVals.has(val)) {
                    seenVals.add(val);
                    opts.push({ value: val, label: lbl });
                }
            });
            const defVal = (group.find(r => r.checked)?.value) || '';
            const metaArray = readcodeInfo(group[0]);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'radio',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    options: opts,
                    defaultValue: defVal
                },
                flags: {}
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
            const defVals = multiple
                ? Array.from(sel.selectedOptions || []).map(o => o.value || txt(o))
                : [];
            const defVal = multiple ? '' : (sel.value || '');

            const metaArray = readcodeInfo(sel);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

            out.push({
                id: uniqueIdFromLabel(label),
                kind: multiple ? 'select-multi' : 'select-single',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: multiple ? {
                    options: opts,
                    defaultValues: defVals
                } : {
                    options: opts,
                    defaultValue: defVal
                },
                flags: { multiSelect: multiple }
            });
        });

        // checkboxes
        const checks = Array.from(ctrl.querySelectorAll('input[type="checkbox"]'));
        checks.forEach(ch => {
            const label = findLabelFor(ch);
            const metaArray = readcodeInfo(ch);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'checkbox',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    checked: !!ch.checked
                },
                flags: {
                    required: ch.hasAttribute('required')
                }
            });
        });

        // dates
        const dates = Array.from(ctrl.querySelectorAll('input[type="date"]'));
        dates.forEach(d => {
            const label = findLabelFor(d);
            const metaArray = readcodeInfo(d);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'date',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    defaultDate: d.value || ''
                },
                flags: {
                    required: d.hasAttribute('required')
                }
            });
        });

        // textareas
        const areas = Array.from(ctrl.querySelectorAll('textarea'));
        areas.forEach(a => {
            const label = findLabelFor(a);
            const metaArray = readcodeInfo(a);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);
            out.push({
                id: uniqueIdFromLabel(label),
                kind: 'textarea',
                label,
                tooltip: unifiedTooltip,
                ui: { ...geom },
                data: {
                    rows: Math.max(1, parseInt(a.getAttribute('rows') || '3', 10)),
                    defaultText: a.value || ''
                },
                flags: {
                    required: a.hasAttribute('required')
                }
            });
        });

        // text / number (not readOnly)
        const texts = Array.from(ctrl.querySelectorAll('input[type="text"],input[type="number"]'))
            .filter(i => !i.readOnly);
        texts.forEach(ti => {
            const label = findLabelFor(ti);
            const metaArray = readcodeInfo(ti);
            const unifiedTooltip = buildTooltipFromReadcodeMeta(metaArray);

            if (ti.type === 'number') {
                out.push({
                    id: uniqueIdFromLabel(label),
                    kind: 'number',
                    label,
                    tooltip: unifiedTooltip,
                    ui: { ...geom },
                    data: {
                        defaultNumber: ti.value ? Number(ti.value) : null
                    },
                    flags: {
                        required: ti.hasAttribute('required')
                    }
                });
            } else {
                out.push({
                    id: uniqueIdFromLabel(label),
                    kind: 'text',
                    label,
                    tooltip: unifiedTooltip,
                    ui: { ...geom },
                    data: {
                        defaultText: ti.value || ''
                    },
                    flags: {
                        required: ti.hasAttribute('required')
                    }
                });
            }
        });

        // if nothing detected, maybe it's just a label block
        if (!out.length) {
            const leg = ctrl.querySelector('legend');
            if (leg) {
                out.push({
                    id: uniqueIdFromLabel(txt(leg)),
                    kind: 'label',
                    label: txt(leg),
                    tooltip: undefined,
                    ui: { ...geom },
                    data: {},
                    flags: {}
                });
            } else {
                const anyLabel = ctrl.querySelector('label');
                if (anyLabel) {
                    out.push({
                        id: uniqueIdFromLabel(txt(anyLabel)),
                        kind: 'label',
                        label: txt(anyLabel),
                        tooltip: undefined,
                        ui: { ...geom },
                        data: {},
                        flags: {}
                    });
                }
            }
        }

        return out;
    }

    function toGenericFromLabelOrLink(ctrl) {
        const geom = geomFrom(ctrl);
        const a = ctrl.querySelector('a[href]');
        if (a) {
            return [{
                id: uniqueIdFromLabel(txt(a) || a.href),
                kind: 'link',
                label: txt(a) || a.href,
                tooltip: undefined,
                ui: { ...geom },
                data: { href: a.href },
                flags: {}
            }];
        }
        const labelEl = ctrl.querySelector('label');
        if (labelEl) {
            return [{
                id: uniqueIdFromLabel(txt(labelEl)),
                kind: 'label',
                label: txt(labelEl),
                tooltip: undefined,
                ui: { ...geom },
                data: {},
                flags: {}
            }];
        }
        return [];
    }


    //*****// collectGenericControls()
    function collectGenericControls() {
        const controls = qa('.ctrl');
        const generic = [];

        controls.forEach(ctrl => {
            let added = [];
            if (isClassicReadCode(ctrl)) {
                added = toGenericFromReadCode(ctrl);
            } else if (
                ctrl.querySelector('.rl-wrap, select[name^="Readlist"], select[id^="Readlist"]')
            ) {
                added = toGenericFromReadList(ctrl);
            } else if (hasAnyFormInputs(ctrl)) {
                added = toGenericFromGenericControls(ctrl);
            } else {
                added = toGenericFromLabelOrLink(ctrl);
            }
            if (added && added.length) generic.push(...added);
        });

        return generic;
    }


    //*****// exportGenericJSON()
    function exportGenericJSON() {
        const texNameRaw = getSelectedTexName();
        const baseTitle = makeBaseTitleFromTexName(texNameRaw);

        const genericControls = collectGenericControls();

        const payload = {
            texName: texNameRaw,
            title: baseTitle,
            scrapedAtISO: new Date().toISOString(),
            controls: genericControls
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${baseTitle}_generic.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
    }


    //*****// the new btn3 in addButtons()
    const mount = document.getElementById('export-buttons-mount');
    if (!mount) return;
    const btn3 = document.createElement('button');
    btn3.type = 'button';
    btn3.title = 'Export Generic JSON format (intermediate representation)';
    btn3.style.marginLeft = '5px';
    btn3.style.padding = '6px 10px';
    btn3.style.fontSize = '12px';
    btn3.style.border = '1px solid #888';
    btn3.style.borderRadius = '4px';
    btn3.style.background = '#f5f5f5';
    btn3.style.cursor = 'pointer';
    btn3.style.transition = 'background 0.2s, box-shadow 0.2s';

    // hover styling like others
    btn3.addEventListener('mouseenter', () => {
        btn3.style.background = '#eaeaea';
        btn3.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
    });
    btn3.addEventListener('mouseleave', () => {
        btn3.style.background = '#f5f5f5';
        btn3.style.boxShadow = 'none';
    });
    btn3.addEventListener('mousedown', () => {
        btn3.style.background = '#ddd';
    });
    btn3.addEventListener('mouseup', () => {
        btn3.style.background = '#eaeaea';
    });

    btn3.textContent = '→ Generic JSON'; // plain text is fine for now
    btn3.addEventListener('click', exportGenericJSON);
    mount.appendChild(btn3);
})();