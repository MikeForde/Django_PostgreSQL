// static/myapp/js/audio_poc.js
$(document).ready(function () {
    // Insert canvases into a simple container (keeps your IDs & sizes)
    // const $root = $("#audio-root");
    // $root.append('<canvas id="canvas"  width="450" height="300" style="left:10px;  top:140px; position:absolute; z-index:0;"></canvas>');
    // $root.append('<canvas id="canvas2" width="450" height="300" style="left:460px; top:140px; position:absolute; z-index:0;"></canvas>');
    // $root.append('<canvas id="canvas3" width="450" height="300" style="left:10px;  top:500px; position:absolute; z-index:0;"></canvas>');
    // $root.append('<canvas id="canvas4" width="450" height="300" style="left:460px; top:500px; position:absolute; z-index:0;"></canvas>');

    // (Unchanged variables from your code)
    var iRefer = 0;
    var iWarning = 0;

    var canvas, context, Val_max, Val_min, sections, xScale, yScale, columnSize;
    var RightEar = [0, 0, 0, 0, 0, 0, 0];
    var LeftEar = [0, 0, 0, 0, 0, 0, 0];

    var ORIGIN_X = -20;
    var ORIGIN_Y = 0;
    var RIGHT_PAD = 24;
    var BOTTOM_PAD = 48;

    // Date inputs (present in template)
    var dtCurrent = document.querySelector("[data-id='dtCurrent']");
    var dtPrevious = document.querySelector("[data-id='dtPrevious']");
    var currentDate = new Date();
    var cDay = currentDate.getDate();
    var cMonth = currentDate.getMonth() + 1;
    var cYear = currentDate.getFullYear();
    dtCurrent.value = "" + cDay + "/" + cMonth + "/" + cYear;
    dtPrevious.addEventListener("blur", fnDateChange);
    function fnDateChange() { showAnalysis(); }

    // === Your original functions (unaltered logic) ===
    window.draw = function (bolCalc, canvasName) {
        sections = 7; Val_max = 130; Val_min = -20;
        var stepSize = 10;
        columnSize = 48;            // top padding
        var rowSize = 56;           // left padding (room for y labels)
        BOTTOM_PAD = 48;            // bottom padding (global)
        RIGHT_PAD  = 24;        // right padding
        var xAxis = ["500Hz", "1KHz", "2KHz", "3KHz", "4KHz", "6KHz", "8KHz"];

        canvas = document.getElementById(canvasName);
        context = canvas.getContext("2d");
        if (window.devicePixelRatio) context.setTransform(1, 0, 0, 1, 0.5, 0.5);
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#666666";
        context.font = "10px Verdana";

        ORIGIN_X = rowSize;         // global origin for X
        ORIGIN_Y = columnSize;        // global origin for Y

        yScale = (canvas.height - columnSize - BOTTOM_PAD) / (Val_max - Val_min);
        xScale = (canvas.width  - ORIGIN_X   - RIGHT_PAD)  / sections;

        var xOffSet = (0.06 * xScale); // slightly tighter than 0.08

        context.strokeStyle = "#888888";
        context.beginPath();

        for (i = 1; i <= sections; i++) {
            var x = ORIGIN_X + i * xScale;
            context.fillText(xAxis[i - 1], x - (xOffSet * 3), ORIGIN_Y - 8);
            context.moveTo(x, ORIGIN_Y);
            context.lineTo(x, canvas.height - BOTTOM_PAD);
        }

        const firstTickX = ORIGIN_X + xScale; // start at 500Hz vertical axis

        for (scale = Val_min; scale <= Val_max; scale += stepSize) {
            var y = ORIGIN_Y + (yScale * (scale + 20));
            context.fillText(scale, ORIGIN_X - 10, y + 3);
            context.moveTo(firstTickX, y);                 // ⬅️ no line into the label gutter
            context.lineTo(canvas.width - RIGHT_PAD, y);
        }
        context.stroke();

        var txtBoxLName = "TextBoxL";
        var txtBoxRName = "TextBoxR";

        if (canvasName == "canvas2") {
            txtBoxLName = "TextBoxLC"; txtBoxRName = "TextBoxRC";
        } else if (canvasName == "canvas3") {
            txtBoxLName = "TextBoxR"; txtBoxRName = "TextBoxRC";
        } else if (canvasName == "canvas4") {
            txtBoxLName = "TextBoxL"; txtBoxRName = "TextBoxLC";
        }

        for (i = 1; i <= sections; i++) {
            var txtL = document.querySelector("[data-id='" + txtBoxLName + i + "']");
            var txtR = document.querySelector("[data-id='" + txtBoxRName + i + "']");
            LeftEar[i - 1] = +txtL.value;
            RightEar[i - 1] = +txtR.value;
        }

        context.font = "15px Verdana";
        if (canvasName == "canvas" || canvasName == "canvas2") {
            context.strokeStyle = "#FF0066"; context.fillStyle = "#FF0066";
        } else {
            context.strokeStyle = "#009a00"; context.fillStyle = "#009a00";
        }
        plotData(RightEar, "o", 4);

        if (canvasName == "canvas" || canvasName == "canvas2") {
            context.strokeStyle = "#3341ff"; context.fillStyle = "#3341ff";
        } else {
            context.strokeStyle = "#ff6d4e"; context.fillStyle = "#ff6d4e";
        }
        plotData(LeftEar, "x", 4);

        if (bolCalc == 1) { showAnalysis(canvasName); }
    };

    window.plotData = function (dataSet, sSymbol, offset) {
        context.beginPath();
        var x = ORIGIN_X + 1 * xScale;
        var y = ORIGIN_Y + (yScale * (dataSet[0] + 20));
        var xOffSet = (0.08 * xScale);
        var yOffSet = (2.5 * yScale);

        context.moveTo(x, y);
        context.fillText(sSymbol, x - xOffSet, y + yOffSet);

        for (i = 2; i <= sections; i++) {
            x = ORIGIN_X + i * xScale;
            y = ORIGIN_Y + (yScale * (dataSet[i - 1] + 20));
            context.lineTo(x, y);
            context.fillText(sSymbol, x - xOffSet, y + yOffSet);
        }
        context.stroke();
    };

    window.showAnalysis = function (canvasName) {
        var lblA;
        if (canvasName == "canvas") {
            lblA = document.querySelector("[data-id='lblAnalysis'] div");
        } else {
            lblA = document.querySelector("[data-id='lblAnalysis2'] div");
        }
        lblA.innerHTML = fnHGrade(canvasName);
        fullAnalysis();
    };

    function fullAnalysis() {
        var txtULH = document.querySelector("[data-id='txtULH']");
        var txtHCP = document.querySelector("[data-id='txtHCP']");
        var txtSigDiff = document.querySelector("[data-id='txtSigDiff']");
        var txtRapid = document.querySelector("[data-id='txtRapid']");
        var txtHGrade = document.querySelector("[data-id='txtHGrade']");

        txtULH.value = fnUnilateralLoss();
        txtHCP.value = fnWarningReferral();
        txtSigDiff.value = fnSigChange();
        txtRapid.value = fnRapidLoss();
        txtHGrade.value = fnHGradeBoth();
    }

    function fnUnilateralLoss() {
        var iSumLeft = 0, iSumRight = 0, sReport = "", dCalc;
        var txtBoxLName = "TextBoxL", txtBoxRName = "TextBoxR";
        for (i = 2; i <= 5; i++) {
            var txtL = document.querySelector("[data-id='" + txtBoxLName + i + "']");
            var txtR = document.querySelector("[data-id='" + txtBoxRName + i + "']");
            iSumLeft += +txtL.value;
            iSumRight += +txtR.value;
        }
        dCalc = Math.sqrt(Math.pow((iSumLeft - iSumRight), 2));
        if (dCalc > 40) {
            sReport = "Audiogram shows a unilateral hearing loss, refer to the Medical Officer or an occupationally qualified nurse.";
        } else {
            sReport = "There is no indication of unilateral hearing loss.";
        }
        sReport += "\n\nCalculation: RIGHT Sum(1,2,3,4 KHz) = " + iSumRight +
            ", LEFT Sum(1,2,3,4 KHz) = " + iSumLeft + ", Difference =" + dCalc + ", Threshold > 40";
        return sReport;
    }

    function fnWarningReferral() {
        var iSumLeft = 0, iSumRight = 0, sReport = "";
        var txtBoxLName = "TextBoxL", txtBoxRName = "TextBoxR";
        for (i = 2; i <= 6; i++) {
            var txtL = document.querySelector("[data-id='" + txtBoxLName + i + "']");
            var txtR = document.querySelector("[data-id='" + txtBoxRName + i + "']");
            iSumLeft += +txtL.value;
            iSumRight += +txtR.value;
        }
        if (iSumLeft >= iRefer || iSumRight >= iRefer) {
            sReport = "Referral required. Sum of 1, 2, 3, 4 and 6 KHz is greater or equal to Referral level."
                + "\nThe individual is to be referred to a service approved audiology Service for clinical audiometry, and ORL opinion."
                + "\nInform patient and line manager and place an annual HCP recall. Consistent with HCP action required."
                + "\nReferral to OM should be considered depending on the final outcome.";
        } else if (iSumLeft >= iWarning || iSumRight >= iWarning) {
            sReport = "Warning. Sum of 1, 2, 3, 4 and 6 KHz is greater or equal to Warning level, but below Referral level."
                + "\nInform patient and line manager and place an annual HCP recall. Consistent with HCP pass.";
        } else {
            sReport = "Normal. Sum of 1, 2, 3, 4 and 6 KHz is lower than Warning level. No action required."
                + "\nRemain on current HCP recall frequency. Consistent with HCP pass.";
        }
        sReport += "\n\nCalculation: RIGHT Sum(1,2,3,4,6 KHz) = " + iSumRight +
            ", LEFT Sum(1,2,3,4, 6 KHz) = " + iSumLeft +
            ", Thresholds: Warning >=" + iWarning + ", Referral >=" + iRefer;
        return sReport;
    }

    window.fnCalcWarnReferLevels = function () {
        var txtGender = document.querySelector("[data-id='txtGender']");
        var arrWarnRefer;
        if (txtGender.value == "M") {
            arrWarnRefer = [51, 95, 67, 113, 82, 132, 100, 154, 121, 183, 142, 211, 165, 240, 190, 269, 217, 296, 235, 311];
        } else {
            arrWarnRefer = [46, 78, 55, 91, 63, 105, 71, 119, 80, 134, 93, 153, 111, 176, 131, 204, 157, 235, 175, 255];
        }
        var txtAge = document.querySelector("[data-id='txtAge']");
        var iAge = +txtAge.value;
        if (iAge < 20) iAge = 20; else if (iAge > 69) iAge = 69;
        iAge = parseInt((iAge - 20) / 5); iAge = iAge * 2;
        iWarning = arrWarnRefer[iAge];
        iRefer = arrWarnRefer[iAge + 1];
    };

    function fnSigChange() {
        var dCalcLeftLow, dCalcLeftHigh, dCalcRightLow, dCalcRightHigh;
        var iSumLeftLow = 0, iSumRightLow = 0, iSumLeftHigh = 0, iSumRightHigh = 0;
        var iSumLeft2Low = 0, iSumRight2Low = 0, iSumLeft2High = 0, iSumRight2High = 0;
        var sReport = ""; var txtBoxLName = "TextBoxL", txtBoxRName = "TextBoxR";

        for (i = 1; i <= 3; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeftLow += +L.value; iSumRightLow += +R.value; }
        for (i = 4; i <= 6; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeftHigh += +L.value; iSumRightHigh += +R.value; }

        txtBoxLName = "TextBoxLC"; txtBoxRName = "TextBoxRC";
        for (i = 1; i <= 3; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeft2Low += +L.value; iSumRight2Low += +R.value; }
        for (i = 4; i <= 6; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeft2High += +L.value; iSumRight2High += +R.value; }

        dCalcLeftLow = Math.sqrt(Math.pow((iSumLeftLow - iSumLeft2Low), 2));
        dCalcLeftHigh = Math.sqrt(Math.pow((iSumLeftHigh - iSumLeft2High), 2));
        dCalcRightLow = Math.sqrt(Math.pow((iSumRightLow - iSumRight2Low), 2));
        dCalcRightHigh = Math.sqrt(Math.pow((iSumRightHigh - iSumRight2High), 2));

        var dtPrevStr = document.querySelector("[data-id='dtPrevious']").value || "(previous)";
        if (dCalcLeftLow < 25 && dCalcLeftHigh < 25 && dCalcRightLow < 25 && dCalcRightHigh < 25) {
            sReport = "There is no significant difference between this audiogram and the audiogram dated " + dtPrevStr + ".";
        } else {
            sReport = "There is a significant difference between this audiogram and the audiogram dated " + dtPrevStr + "."
                + "\nIf this is a first test, then repeat the audiogram, ensuring that there has been no exposure to significant noise in the preceding 16 hours, and that there are no clinical contra-indications."
                + "\nIf this is already the repeat audiogram, and a significant difference persists, then refer to the Medical Officer or an occupationally qualified nurse.";
        }

        sReport += "\n\nCalculation (Difference Threshold for all is >=25): "
            + "\nThis RIGHT Sum(500Hz, 1,2 KHz) = " + iSumRightLow + ", Previous RIGHT Sum = " + iSumRight2Low + ", Difference =" + dCalcRightLow
            + "\nThis LEFT  Sum(500Hz, 1,2 KHz) = " + iSumLeftLow + ", Previous LEFT  Sum = " + iSumLeft2Low + ", Difference =" + dCalcLeftLow
            + "\nThis RIGHT Sum(3,4,6 KHz)     = " + iSumRightHigh + ", Previous RIGHT Sum = " + iSumRight2High + ", Difference =" + dCalcRightHigh
            + "\nThis LEFT  Sum(3,4,6 KHz)     = " + iSumLeftHigh + ", Previous LEFT  Sum = " + iSumLeft2High + ", Difference =" + dCalcLeftHigh;

        return sReport;
    }

    function fnRapidLoss() {
        var iSumLeftHigh = 0, iSumRightHigh = 0, iSumLeft2High = 0, iSumRight2High = 0;
        var dtNew, dtOld, dDiff, sReport = "";

        var txtBoxLName = "TextBoxL", txtBoxRName = "TextBoxR";
        for (i = 4; i <= 6; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeftHigh += +L.value; iSumRightHigh += +R.value; }
        txtBoxLName = "TextBoxLC"; txtBoxRName = "TextBoxRC";
        for (i = 4; i <= 6; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeft2High += +L.value; iSumRight2High += +R.value; }

        dtNew = document.querySelector("[data-id='dtCurrent']").value;
        dtOld = document.querySelector("[data-id='dtPrevious']").value;
        dDiff = DateDiff(dtOld, dtNew);

        var dCalcLeftHigh = (iSumLeftHigh - iSumLeft2High) / dDiff;
        var dCalcRightHigh = (iSumRightHigh - iSumRight2High) / dDiff;

        if (dCalcLeftHigh > 9 || dCalcRightHigh > 9) {
            sReport = "Audiogram shows rapid hearing loss: refer to the Medical Officer or an occupationally qualified nurse.";
        } else {
            sReport = "No indication of rapid hearing loss.";
        }

        sReport += "\n\nCalculation: New date = " + dtNew + ", Old date = " + dtOld + ", Date Interval(years) = " + Round1(dDiff)
            + "\nDifference divided by Date Interval Threshold > 9"
            + "\nRIGHT Sum(3,4,6 KHz) = " + iSumRightHigh + ", Previous RIGHT Sum = " + iSumRight2High + ", Difference/Years = " + Round1(dCalcRightHigh)
            + "\nLEFT  Sum(3,4,6 KHz) = " + iSumLeftHigh + ", Previous LEFT  Sum = " + iSumLeft2High + ", Difference/Years = " + Round1(dCalcLeftHigh);

        return sReport;
    }

    function Round1(val) { return Math.round(val * 10) / 10; }

    function DateDiff(date1, date2) {
        // dd/mm/yyyy → years
        function parse(d) {
            if (!d) return null;
            const [dd, mm, yyyy] = d.split('/');
            return new Date(+yyyy, (+mm) - 1, +dd);
        }
        var dt1 = parse(date1), dt2 = parse(date2);
        if (!dt1 || !dt2) return 1; // guard against divide-by-zero
        var ms = Date.UTC(dt2.getFullYear(), dt2.getMonth(), dt2.getDate()) - Date.UTC(dt1.getFullYear(), dt1.getMonth(), dt1.getDate());
        return Math.floor(ms / (1000 * 60 * 60 * 24)) / 365;
    }

    function fnGetLowH(iSum) { return (iSum > 150) ? 4 : (iSum > 84) ? 3 : (iSum > 45) ? 2 : 1; }
    function fnGetHighH(iSum) { return (iSum > 210) ? 4 : (iSum > 123) ? 3 : (iSum > 45) ? 2 : 1; }
    function fnGetHasS(iH) { return (iH == 4) ? "H4/8" : "H" + iH; }

    function fnHGrade(canvasName) {
        var iSumLeftLow = 0, iSumRightLow = 0, iSumLeftHigh = 0, iSumRightHigh = 0;
        var iHLeftLow = 0, iHRightLow = 0, iHLeftHigh = 0, iHRightHigh = 0;
        var iHLeft = 0, iHRight = 0, sHLeft = "", sHRight = "";
        var txtBoxLName = "TextBoxL", txtBoxRName = "TextBoxR";
        if (canvasName == "canvas2") { txtBoxLName = "TextBoxLC"; txtBoxRName = "TextBoxRC"; }

        for (i = 1; i <= 3; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeftLow += +L.value; iSumRightLow += +R.value; }
        for (i = 4; i <= 6; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeftHigh += +L.value; iSumRightHigh += +R.value; }

        iHLeftLow = fnGetLowH(iSumLeftLow); iHRightLow = fnGetLowH(iSumRightLow);
        iHLeftHigh = fnGetHighH(iSumLeftHigh); iHRightHigh = fnGetHighH(iSumRightHigh);

        iHLeft = Math.max(iHLeftLow, iHLeftHigh);
        iHRight = Math.max(iHRightLow, iHRightHigh);

        sHLeft = fnGetHasS(iHLeft);
        sHRight = fnGetHasS(iHRight);
        return "HH Grades are LEFT: " + sHLeft + " and RIGHT: " + sHRight;
    }

    function fnHGradeBoth() {
        var iSumLeftLow = 0, iSumRightLow = 0, iSumLeftHigh = 0, iSumRightHigh = 0;
        var iHLeftLow = 0, iHRightLow = 0, iHLeftHigh = 0, iHRightHigh = 0;
        var iHLeft = 0, iHRight = 0, sHLeft = "", sHRight = "";
        var iSumLeft2Low = 0, iSumRight2Low = 0, iSumLeft2High = 0, iSumRight2High = 0;
        var iHLeft2Low = 0, iHRight2Low = 0, iHLeft2High = 0, iHRight2High = 0;
        var iHLeft2 = 0, iHRight2 = 0, sHLeft2 = "", sHRight2 = "";

        var txtBoxLName = "TextBoxL", txtBoxRName = "TextBoxR";
        for (i = 1; i <= 3; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeftLow += +L.value; iSumRightLow += +R.value; }
        for (i = 4; i <= 6; i++){ let L=document.querySelector("[data-id='"+txtBoxLName+i+"']"); let R=document.querySelector("[data-id='"+txtBoxRName+i+"']"); iSumLeftHigh+=+L.value; iSumRightHigh+=+R.value; }

        iHLeftLow = fnGetLowH(iSumLeftLow); iHRightLow = fnGetLowH(iSumRightLow);
        iHLeftHigh = fnGetHighH(iSumLeftHigh); iHRightHigh = fnGetHighH(iSumRightHigh);

        iHLeft = Math.max(iHLeftLow, iHLeftHigh);
        iHRight = Math.max(iHRightLow, iHRightHigh);

        sHLeft = fnGetHasS(iHLeft);
        sHRight = fnGetHasS(iHRight);

        txtBoxLName = "TextBoxLC"; txtBoxRName = "TextBoxRC";
        for (i = 1; i <= 3; i++) { let L = document.querySelector("[data-id='" + txtBoxLName + i + "']"); let R = document.querySelector("[data-id='" + txtBoxRName + i + "']"); iSumLeft2Low += +L.value; iSumRight2Low += +R.value; }
        for (i = 4; i <= 6; i++) { let L = document.querySelector("[data-id='"+txtBoxLName+i+"']"); let R=document.querySelector("[data-id='"+txtBoxRName+i+"']"); iSumLeft2High+=+L.value; iSumRight2High+=+R.value; }

        iHLeft2Low = fnGetLowH(iSumLeft2Low); iHRight2Low = fnGetLowH(iSumRight2Low);
        iHLeft2High = fnGetHighH(iSumLeft2High); iHRight2High = fnGetHighH(iSumRight2High);

        iHLeft2 = Math.max(iHLeft2Low, iHLeft2High);
        iHRight2 = Math.max(iHRight2Low, iHRight2High);

        sHLeft2 = fnGetHasS(iHLeft2);
        sHRight2 = fnGetHasS(iHRight2);

        var sReport = (iHLeft == iHLeft2 && iHRight == iHRight2)
            ? "No change in H grade noted."
            : "H grade has changed: refer to the Medical Officer or an occupationally qualified nurse. Inform employee of ways to minimise or prevent further loss.";

        sReport += "\n\nCalculation:"
            + "\nThis Grade R" + sHRight + " L" + sHLeft + " - Previous Grade R" + sHRight2 + " L" + sHLeft2
            + "\nThresholds for LOW tones (500Hz,1,2KHz) are >150:H4/8, >84:H3, >45:H2 else H1"
            + "\nThresholds for HIGH tones (3,4,6 KHz) are >210:H4/8, >123:H3, >45:H2 else H1"
            + "\nMore Recent RIGHT LOW Sum: " + iSumRightLow + " → H" + iHRightLow + ", RIGHT HIGH Sum: " + iSumRightHigh + " → H" + iHRightHigh + " → overall " + sHRight
            + "\nPrevious    RIGHT LOW Sum: " + iSumRight2Low + " → H" + iHRight2Low + ", RIGHT HIGH Sum: " + iSumRight2High + " → H" + iHRight2High + " → overall " + sHRight2
            + "\nMore Recent LEFT  LOW Sum: " + iSumLeftLow + " → H" + iHLeftLow + ", LEFT  HIGH Sum: " + iSumLeftHigh + " → H" + iHLeftHigh + " → overall " + sHLeft
            + "\nPrevious    LEFT  LOW Sum: " + iSumLeft2Low + " → H" + iHLeft2Low + ", LEFT  HIGH Sum: " + iSumLeft2High + " → H" + iHLeft2High + " → overall " + sHLeft2;

        return sReport;
    }

    window.updateAudio = function (canvasName) {
        draw(1, canvasName);
        draw(0, "canvas3");
        draw(0, "canvas4");
    };

    window.setRandom = function (canvasName) {
        var rndNum = 0, rndDiv = 1;
        var txtBoxLName = "TextBoxL", txtBoxRName = "TextBoxR";
        if (canvasName == "canvas2") { txtBoxLName = "TextBoxLC"; txtBoxRName = "TextBoxRC"; rndDiv = 2; }

        for (i = 1; i <= 3; i++) {
            var txtL = document.querySelector("[data-id='" + txtBoxLName + i + "']");
            var txtR = document.querySelector("[data-id='" + txtBoxRName + i + "']");
            rndNum = Math.floor(Math.random() * (40 / rndDiv)) - (20 / rndDiv); txtL.value = "" + rndNum;
            rndNum = Math.floor(Math.random() * (40 / rndDiv)) - (20 / rndDiv); txtR.value = "" + rndNum;
        }
        for (i = 4; i <= 6; i++) {
            var txtL = document.querySelector("[data-id='" + txtBoxLName + i + "']");
            var txtR = document.querySelector("[data-id='" + txtBoxRName + i + "']");
            rndNum = Math.floor(Math.random() * (150 / rndDiv)) - (20 / rndDiv); txtL.value = "" + rndNum;
            rndNum = Math.floor(Math.random() * (150 / rndDiv)) - (20 / rndDiv); txtR.value = "" + rndNum;
        }
        for (i = 7; i <= 7; i++) {
            var txtL = document.querySelector("[data-id='" + txtBoxLName + i + "']");
            var txtR = document.querySelector("[data-id='" + txtBoxRName + i + "']");
            rndNum = Math.floor(Math.random() * (40 / rndDiv)) - (20 / rndDiv); txtL.value = "" + rndNum;
            rndNum = Math.floor(Math.random() * (40 / rndDiv)) - (20 / rndDiv); txtR.value = "" + rndNum;
        }

        draw(1, canvasName);
        draw(0, "canvas3");
        draw(0, "canvas4");
    };

    // Initial setup
    fnCalcWarnReferLevels();
    draw(0, "canvas");
    draw(0, "canvas2");
    draw(0, "canvas3");
    draw(0, "canvas4");
});
