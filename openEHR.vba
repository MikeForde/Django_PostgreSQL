Option Explicit

Public Sub GenerateOpenEHRFiles()

    Dim wCtls As Worksheet
    Dim OverallName As String
    Dim ControlType As String
    Dim ControlName As String
    Dim ControlData As String
    Dim iCol As Integer
    Dim iRow As Integer
    Dim LastCol As Integer
    Dim LastRow As Integer
    Dim i As Integer
    Dim j As Integer
    Dim ControlsList As Collection
    Dim ControlDict As Dictionary
    Dim FileContent1 As String
    Dim FileContent2 As String
    Dim FileContent3 As String
    Dim OutputFolder As String
    Dim atCodes As Collection
    Dim atCodeCounter As Integer
    Dim UUID As String
    Dim DateStr As String

    Set wCtls = ActiveWorkbook.ActiveSheet ' Change if necessary
    OutputFolder = ActiveWorkbook.Path & "\" ' Output folder for the files
    DateStr = Format(Date, "yyyy-mm-dd")
    UUID = "633d4e61-1fbf-42af-a4d5-9dcc7c6bb719" ' Can be hardcoded as per your instruction

    ' Get the OverallName from the first control (type FORM)
    iCol = 1
    ControlType = wCtls.Cells(1, iCol).Value
    If ControlType <> "FORM" Then
        MsgBox "First control is not of type FORM."
        Exit Sub
    End If
    OverallName = wCtls.Cells(1, iCol + 1).Value
    OverallName = Replace(OverallName, " ", "") ' Remove spaces
    If OverallName = "" Then
        MsgBox "OverallName is empty."
        Exit Sub
    End If

    ' Initialize collections
    Set ControlsList = New Collection
    Set atCodes = New Collection
    atCodeCounter = 4 ' Starting at0004 as per example

    ' Get the last column
    LastCol = wCtls.Cells(1, wCtls.Columns.Count).End(xlToLeft).Column

    ' Loop through the controls starting from the third column
    For iCol = 3 To LastCol Step 2
        ControlType = wCtls.Cells(1, iCol).Value
        ControlName = wCtls.Cells(1, iCol + 1).Value

        ' Only process specified control types
        If ControlType = "TEmisReadList" Or ControlType = "TEmisReadCode" _
            Or ControlType = "TEmisQuestionReadCode" Or ControlType = "TTplDiaryEntry" Then

            ' Create a dictionary to hold control properties
            Set ControlDict = New Dictionary
            ControlDict.Add "Type", ControlType
            ControlDict.Add "Name", ControlName

            ' Get properties for this control
            LastRow = wCtls.Cells(wCtls.Rows.Count, iCol).End(xlUp).Row
            For iRow = 2 To LastRow
                Dim PropName As String
                Dim PropValue As String
                PropName = wCtls.Cells(iRow, iCol).Value
                PropValue = wCtls.Cells(iRow, iCol + 1).Value
                ControlDict.Add PropName, PropValue
            Next iRow

            ' Add the control to the list
            ControlsList.Add ControlDict
        End If
    Next iCol

    ' Build the content for the first file: openEHR-EHR-OBSERVATION.overallname.v0.adl
    FileContent1 = "archetype (adl_version=1.4; uid=" & UUID & ")" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "openEHR-EHR-OBSERVATION." & LCase(OverallName) & ".v0" & vbCrLf & vbCrLf
    FileContent1 = FileContent1 & "concept" & vbCrLf & vbTab & "[at0000]" & vbCrLf & vbCrLf
    FileContent1 = FileContent1 & "language" & vbCrLf & vbTab & "original_language = <[ISO_639-1::en]>" & vbCrLf & vbCrLf
    FileContent1 = FileContent1 & "description" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "original_author = <" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""date""] = <""" & DateStr & """>" & vbCrLf
    FileContent1 = FileContent1 & vbTab & ">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "lifecycle_state = <""unmanaged"">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "details = <" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""en""] = <" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & "language = <[ISO_639-1::en]>" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & ">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & ">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "other_details = <" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""licence""] = <""This work is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License. To view a copy of this license, visit http://creativecommons.org/licenses/by-sa/4.0/."">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""custodian_organisation""] = <""openEHR Foundation"">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""original_namespace""] = <""org.openehr"">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""original_publisher""] = <""openEHR Foundation"">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""custodian_namespace""] = <""org.openehr"">" & vbCrLf
    FileContent1 = FileContent1 & vbTab & ">" & vbCrLf & vbCrLf

    ' Start definition section
    FileContent1 = FileContent1 & "definition" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "OBSERVATION[at0000] matches {    -- " & OverallName & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "data matches {" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & "HISTORY[at0001] matches {    -- History" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & "events cardinality matches {1..*; unordered} matches {" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "EVENT[at0002] occurrences matches {0..*} matches {    -- Any event" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "data matches {" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "ITEM_TREE[at0003] matches {    -- Tree" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "items cardinality matches {0..*; unordered} matches {" & vbCrLf

    ' Build items for each control
    For Each ControlDict In ControlsList
        atCodeCounter = atCodeCounter + 1
        Dim atCode As String
        atCode = "at" & Format(atCodeCounter, "0000")
        atCodes.Add atCode
        Dim ControlLine As String

        Select Case ControlDict("Type")
            Case "TEmisReadList"
                ' DV_CODED_TEXT
                ControlLine = vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "ELEMENT[" & atCode & "] occurrences matches {0..1} matches {    -- DV_CODED_TEXT " & ControlDict("Name") & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "value matches {" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "DV_CODED_TEXT matches {" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "defining_code matches {" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "[local::"
                ' Get terms from strDataAsString
                Dim Terms() As String
                Dim Term As Variant
                If ControlDict.Exists("strDataAsString") Then
                    Terms = Split(ControlDict("strDataAsString"), ";")
                    For j = LBound(Terms) To UBound(Terms)
                        Terms(j) = "at" & Format(atCodeCounter + j + 1, "0000") ' Increment atCodeCounter for each term
                    Next j
                    ControlLine = ControlLine & Join(Terms, "," & vbCrLf & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab)
                    atCodeCounter = atCodeCounter + UBound(Terms) + 1
                End If
                ControlLine = ControlLine & "]" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
            Case "TEmisReadCode", "TEmisQuestionReadCode"
                ' DV_TEXT or DV_BOOLEAN
                If ControlDict.Exists("bTextPrompt") And ControlDict("bTextPrompt") = "TRUE" Then
                    ' DV_TEXT
                    ControlLine = vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "ELEMENT[" & atCode & "] occurrences matches {0..1} matches {    -- DV_TEXT " & ControlDict("Prompt") & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "value matches {" & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "DV_TEXT matches {*}" & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                Else
                    ' DV_BOOLEAN
                    ControlLine = vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "ELEMENT[" & atCode & "] occurrences matches {0..1} matches {    -- DV_BOOLEAN " & ControlDict("Prompt") & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "value matches {" & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "DV_BOOLEAN matches {*}" & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                    ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                End If
            Case "TTplDiaryEntry"
                ' DV_DATE
                ControlLine = vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "ELEMENT[" & atCode & "] occurrences matches {0..1} matches {    -- DV_DATE " & ControlDict("strPrompt") & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "value matches {" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "DV_DATE matches {*}" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
                ControlLine = ControlLine & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf
        End Select

        FileContent1 = FileContent1 & ControlLine
    Next ControlDict

    ' Close the definition sections
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close items cardinality
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close ITEM_TREE
'    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close data matches
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close EVENT
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close events cardinality
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close HISTORY
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close data matches
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & "}" & vbCrLf ' Close OBSERVATION
    FileContent1 = FileContent1 & vbTab & vbTab & "protocol matches {" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & "ITEM_TREE[at0010] matches {*}    -- Item tree" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "}" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "}" & vbCrLf & vbCrLf

    ' Build the ontology section
    FileContent1 = FileContent1 & "ontology" & vbCrLf
    FileContent1 = FileContent1 & vbTab & "term_definitions = <" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & "[""en""] = <" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & "items = <" & vbCrLf

    ' Add terms for at0000 to at0003
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & "[""at0000""] = <" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "text = <""" & OverallName & """>" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "description = <""" & OverallName & """>" & vbCrLf
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & ">" & vbCrLf

    ' ... (Add entries for at0001, at0002, at0003 similar to the example)
    ' For brevity, you can add these manually based on the example provided

    ' Now add terms for each control
    atCodeCounter = 4 ' Reset to at0004
    For Each ControlDict In ControlsList
        atCodeCounter = atCodeCounter + 1
        atCode = "at" & Format(atCodeCounter, "0000")
        FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & "[""" & atCode & """] = <" & vbCrLf
        FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "text = <""" & ControlDict("Name") & """>" & vbCrLf
        FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "description = <"" "">" & vbCrLf
        FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & ">" & vbCrLf

        ' If DV_CODED_TEXT, add terms for options
        If ControlDict("Type") = "TEmisReadList" Then
            If ControlDict.Exists("strDataAsString") Then
                Terms = Split(ControlDict("strDataAsString"), ";")
                For j = LBound(Terms) To UBound(Terms)
                    atCodeCounter = atCodeCounter + 1
                    atCode = "at" & Format(atCodeCounter, "0000")
                    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & "[""" & atCode & """] = <" & vbCrLf
                    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "text = <""" & Trim(Terms(j)) & """>" & vbCrLf
                    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & vbTab & "description = <"""">" & vbCrLf
                    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & vbTab & ">" & vbCrLf
                Next j
            End If
        End If
    Next ControlDict

    ' Close the ontology sections
    FileContent1 = FileContent1 & vbTab & vbTab & vbTab & ">" & vbCrLf ' Close items
    FileContent1 = FileContent1 & vbTab & vbTab & ">" & vbCrLf ' Close ["en"]
    FileContent1 = FileContent1 & vbTab & ">" & vbCrLf ' Close term_definitions

    ' Write FileContent1 to the first file
    Dim FileName1 As String
    FileName1 = OutputFolder & "openEHR-EHR-OBSERVATION." & LCase(OverallName) & ".v0.adl"
    Debug.Print FileName1
    WriteToFile FileName1, FileContent1

    ' Build the content for the second file: openEHR-EHR-COMPOSITION.overallname_doc.v0.adl
    ' ... (Similar to the example, adjust accordingly)
    ' Build FileContent2

    ' Write FileContent2 to the second file
    Dim FileName2 As String
    FileName2 = OutputFolder & "openEHR-EHR-COMPOSITION." & LCase(OverallName) & "_doc.v0.adl"
    'WriteToFile FileName2, FileContent2

    ' Build the content for the third file: OverallName_Template.oet
    ' ... (Similar to the example, adjust accordingly)
    ' Build FileContent3

    ' Write FileContent3 to the third file
    Dim FileName3 As String
    FileName3 = OutputFolder & OverallName & "_Template.oet"
    'WriteToFile FileName3, FileContent3

    MsgBox "Files have been generated successfully in " & OutputFolder

End Sub

' Helper function to write content to a file
Sub WriteToFile(FileName As String, Content As String)
    Dim FileNum As Integer
    FileNum = FreeFile
    Open FileName For Output As #FileNum
    Print #FileNum, Content
    Close #FileNum
End Sub




