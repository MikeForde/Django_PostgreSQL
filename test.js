{
  "title": "TEX Conversions",
  "version": "2.0.0",
  "description": "eForms parsed externally from DMICP TEX format into format compatible with Form.Io",
  "name": "Project_with_AJAXExposureDMICP",
  "roles": {},
  "forms": {
    "ajaxExposureDMICPFormIoImported": {
      "title": "AJAX_Exposure_DMICP Form.io (Imported)",
      "type": "form",
      "name": "ajaxExposureDMICPFormIoImported",
      "path": "ajaxexposuredmicpformioimported",
      "pdfComponents": [],
      "display": "form",
      "tags": [],
      "settings": {},
      "components": [
        {
          "label": "Columns",
          "input": false,
          "tableView": false,
          "key": "columns",
          "type": "columns",
          "hideLabel": true,
          "columns": [
            {
              "components": [
                {
                  "type": "htmlelement",
                  "tag": "p",
                  "key": "content__AJAX_Exposure_R",
                  "input": false,
                  "content": "\n              AJAX Exposure Recording DMICP Template\n            ",
                  "hideLabel": true,
                  "attrs": [
                    {
                      "attr": "",
                      "value": ""
                    }
                  ],
                  "className": "",
                  "properties": {}
                },
                {
                  "type": "number",
                  "input": true,
                  "key": "Date_of_onset_of_AJAX_exposure_enter_111001_and_the_date_of_onset_of_exposure_va",
                  "label": "Date of onset of AJAX exposure - enter 111001 and the date of onset of exposure",
                  "tableView": true,
                  "labelPosition": "left-left",
                  "validate": {
                    "required": false,
                    "step": "any"
                  },
                  "tooltip": "DMSRESEARCH DMS Research\nAuto\\u002DEntered Text: \\u002D Exposure to AJAX recorded for HQ DPHC on behalf of Army HQ."
                },
                {
                  "type": "datetime",
                  "input": true,
                  "key": "Date_of_onset_of_AJAX_exposure_enter_111001_and_the_date_of_onset_of_exposure_da",
                  "label": "Date of onset of AJAX exposure - enter 111001 and the date of onset of exposure (date)",
                  "labelPosition": "left-left",
                  "tableView": true,
                  "enableDate": true,
                  "enableTime": false,
                  "datePicker": {
                    "showWeeks": true
                  },
                  "validate": {
                    "required": false
                  },
                  "tooltip": "DMSRESEARCH DMS Research\nAuto\\u002DEntered Text: \\u002D Exposure to AJAX recorded for HQ DPHC on behalf of Army HQ."
                },
                {
                  "type": "number",
                  "input": true,
                  "key": "Date_of_end_of_AJAX_exposure_enter_111002_and_the_date_of_the_end_of_the_exposur",
                  "label": "Date of end of AJAX exposure - enter 111002 and the date of the end of the exposure",
                  "tableView": true,
                  "labelPosition": "left-left",
                  "validate": {
                    "required": false,
                    "step": "any"
                  },
                  "tooltip": "DMSRESEARCH DMS Research\nAuto\\u002DEntered Text: \\u002D AJAX exposure recorded for HQ DPHC on behalf of Army HQ."
                },
                {
                  "type": "datetime",
                  "input": true,
                  "key": "Date_of_end_of_AJAX_exposure_enter_111002_and_the_date_of_the_end_of_the_exposur_2",
                  "label": "Date of end of AJAX exposure - enter 111002 and the date of the end of the exposure (date)",
                  "labelPosition": "left-left",
                  "tableView": true,
                  "enableDate": true,
                  "enableTime": false,
                  "datePicker": {
                    "showWeeks": true
                  },
                  "validate": {
                    "required": false
                  },
                  "tooltip": "DMSRESEARCH DMS Research\nAuto\\u002DEntered Text: \\u002D AJAX exposure recorded for HQ DPHC on behalf of Army HQ."
                },
                {
                  "type": "number",
                  "input": true,
                  "key": "Unknown_dates_of_AJAX_exposure_enter_111001_and_1900_in_the_date_field_value",
                  "label": "Unknown dates of AJAX exposure - enter 111001 and 1900 in the date field",
                  "tableView": true,
                  "labelPosition": "left-left",
                  "validate": {
                    "required": false,
                    "step": "any"
                  },
                  "tooltip": "DMSRESEARCH DMS Research\nAuto\\u002DEntered Text: \\u002D AJAX exposure recorded for HQ DPHC on behalf of Army HQ. No dates of exposure available."
                },
                {
                  "type": "datetime",
                  "input": true,
                  "key": "Unknown_dates_of_AJAX_exposure_enter_111001_and_1900_in_the_date_field_date",
                  "label": "Unknown dates of AJAX exposure - enter 111001 and 1900 in the date field (date)",
                  "labelPosition": "left-left",
                  "tableView": true,
                  "enableDate": true,
                  "enableTime": false,
                  "datePicker": {
                    "showWeeks": true
                  },
                  "validate": {
                    "required": false
                  },
                  "tooltip": "DMSRESEARCH DMS Research\nAuto\\u002DEntered Text: \\u002D AJAX exposure recorded for HQ DPHC on behalf of Army HQ. No dates of exposure available."
                },
                {
                  "type": "htmlelement",
                  "tag": "p",
                  "key": "content__20230518_v0_4",
                  "input": false,
                  "content": "\n              20230518  v0.4\n            ",
                  "hideLabel": true,
                  "attrs": [
                    {
                      "attr": "",
                      "value": ""
                    }
                  ],
                  "className": "",
                  "properties": {}
                }
              ],
              "width": 12,
              "offset": 0,
              "push": 0,
              "pull": 0,
              "size": "md",
              "currentWidth": 12
            }
          ]
        },
        {
          "input": true,
          "label": "Submit",
          "tableView": false,
          "key": "submit",
          "type": "button"
        }
      ],
      "properties": {},
      "controller": "",
      "submissionRevisions": "",
      "revisions": "",
      "esign": {}
    }
  },
  "actions": {
    "ajaxExposureDMICPFormIoImported:save": {
      "title": "Save Submission",
      "name": "save",
      "form": "ajaxExposureDMICPFormIoImported",
      "priority": 10,
      "method": [
        "create",
        "update"
      ],
      "handler": [
        "before"
      ]
    }
  },
  "resources": {},
  "revisions": {},
  "reports": {},
  "excludeAccess": true
}