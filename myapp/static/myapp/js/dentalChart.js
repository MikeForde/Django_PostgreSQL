console.log('dentalChart loaded v4');

// dentalChart.js
$(document).ready(function () {
    const chartCanvas = document.getElementById('chartCanvas');
    const itemsCanvas = document.getElementById('itemsCanvas');
    const ctx = chartCanvas.getContext('2d');
    const itemsCtx = itemsCanvas.getContext('2d');

    const teeth = [];
    const totalTeeth = 16; // Total teeth in a row
    const toothWidth = 50;
    const toothHeight = 50;
    const rootHeight = toothHeight * 2.8; // Taller roots
    const gap = 10;
    const margin = 5;
    const adjustment = 12;
    const rootToothGap = 5;

    // const canvasWidth = (totalTeeth * (toothWidth + gap)) + gap;
    // const chartHeight = (1.8 * (toothHeight + rootHeight + rootToothGap + gap)) + (4 * gap) + adjustment;
    const itemsHeight = 200;

    const DESIGN = {
        width: (totalTeeth * (toothWidth + gap)) + gap + (2 * margin),       // original design width
        chartHeight: (1.8 * (toothHeight + rootHeight + rootToothGap + gap)) + (4 * gap) + adjustment + (2 * margin),
        itemsHeight: itemsHeight + (2 * margin)
    };

    let uiScale = 1;                              // current scale vs design
    const dpr = window.devicePixelRatio || 1;     // retina handling
    let hoverTooltip = null;

    function clearCanvas(ctx, canvas) {
        // Clear in device pixels irrespective of current transform
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    function resizeCanvases() {
        const container = document.querySelector('.canvas-col') || chartCanvas.parentElement;
        const cssTargetWidth = container.clientWidth || window.innerWidth;

        // Don’t upscale above design size; scale down on smaller screens
        uiScale = uiScale = cssTargetWidth / DESIGN.width;

        // Set CSS (display) size
        chartCanvas.style.width = (DESIGN.width * uiScale) + 'px';
        chartCanvas.style.height = (DESIGN.chartHeight * uiScale) + 'px';
        itemsCanvas.style.width = (DESIGN.width * uiScale) + 'px';
        itemsCanvas.style.height = (DESIGN.itemsHeight * uiScale) + 'px';

        // Set internal pixel buffer (retina-aware)
        chartCanvas.width = Math.floor(DESIGN.width * uiScale * dpr);
        chartCanvas.height = Math.floor(DESIGN.chartHeight * uiScale * dpr);
        itemsCanvas.width = Math.floor(DESIGN.width * uiScale * dpr);
        itemsCanvas.height = Math.floor(DESIGN.itemsHeight * uiScale * dpr);

        // Apply transform so all drawing uses design coordinates
        ctx.setTransform(dpr * uiScale, 0, 0, dpr * uiScale, 0, 0);
        itemsCtx.setTransform(dpr * uiScale, 0, 0, dpr * uiScale, 0, 0);

        // Redraw everything
        drawProblems();   // this internally calls drawTeeth() etc.
        drawItems();
    }

    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }
    window.addEventListener('resize', debounce(resizeCanvases, 100));

    const lineDrawings = {
        acrylicDenture: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(x + width * 0.25, y + height); // Left part of 'A'
            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(x + width * 0.75, y + height); // Right part of 'A'
            ctx.moveTo(x, y + height / 2);
            ctx.lineTo(x + width, y + height / 2); // Horizontal part of 'A'
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        missing: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y + height / 2);
            ctx.lineTo(x + width, y + height / 2); // Diagonal part 1
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        closed: (ctx, x, y, width, height, lineColor, bgcolor, items) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;

            // Draw narrow tooth effect
            ctx.fillStyle = 'white';
            ctx.fillRect(x, y, width, height); // White background to "erase" the original tooth

            // Draw narrower rectangle
            if (!items) {
                const narrowWidth = width / 2;
                const offsetX = x + (width - narrowWidth) / 2; // Center the narrow rectangle
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.fillRect(offsetX, y, narrowWidth, height);
                ctx.strokeRect(offsetX, y, narrowWidth, height);
            }

            // Draw horizontal line with arrows
            ctx.beginPath();
            ctx.moveTo(x + width / 4, y + height / 2);
            ctx.lineTo(x + 3 * width / 4, y + height / 2); // Horizontal line (half-width)

            ctx.strokeStyle = lineColor;
            // Draw arrows
            const arrowSize = 5;
            // Left arrow
            ctx.moveTo(x + width / 4, y + height / 2);
            ctx.lineTo(x + width / 4 + arrowSize, y + height / 2 + arrowSize);
            ctx.moveTo(x + width / 4, y + height / 2);
            ctx.lineTo(x + width / 4 + arrowSize, y + height / 2 - arrowSize);

            // Right arrow
            ctx.moveTo(x + 3 * width / 4, y + height / 2);
            ctx.lineTo(x + 3 * width / 4 - arrowSize, y + height / 2 + arrowSize);
            ctx.moveTo(x + 3 * width / 4, y + height / 2);
            ctx.lineTo(x + 3 * width / 4 - arrowSize, y + height / 2 - arrowSize);

            ctx.stroke();
        },
        extracted: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + width, y + height); // Diagonal part 1
            ctx.moveTo(x + width, y);
            ctx.lineTo(x, y + height); // Diagonal part 2
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        extracted2: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + width, y);
            ctx.lineTo(x, y + height); // Diagonal part 2
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        circle: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        arrowLeft: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;

            // Draw arrow pointing left
            ctx.beginPath();
            ctx.moveTo(x + width, y + height / 2); // Right middle
            ctx.lineTo(x, y + height / 2); // Left middle

            // Draw arrow head
            ctx.lineTo(x + 10, y + height / 2 - 5); // Top left
            ctx.moveTo(x, y + height / 2); // Back to left middle
            ctx.lineTo(x + 10, y + height / 2 + 5); // Bottom left
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        arrowRight: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;

            // Draw arrow pointing right
            ctx.beginPath();
            ctx.moveTo(x, y + height / 2); // Left middle
            ctx.lineTo(x + width, y + height / 2); // Right middle

            // Draw arrow head
            ctx.lineTo(x + width - 10, y + height / 2 - 5); // Top right
            ctx.moveTo(x + width, y + height / 2); // Back to right middle
            ctx.lineTo(x + width - 10, y + height / 2 + 5); // Bottom right
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        arrowUp: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;

            // Draw arrow pointing up
            ctx.beginPath();
            ctx.moveTo(x + width / 2, y + height); // Bottom middle
            ctx.lineTo(x + width / 2, y); // Top middle

            // Draw arrow head
            ctx.lineTo(x + width / 2 - 5, y + 10); // Top left
            ctx.moveTo(x + width / 2, y); // Back to top middle
            ctx.lineTo(x + width / 2 + 5, y + 10); // Top right
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        arrowDown: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;

            // Draw arrow pointing down
            ctx.beginPath();
            ctx.moveTo(x + width / 2, y); // Top middle
            ctx.lineTo(x + width / 2, y + height); // Bottom middle

            // Draw arrow head
            ctx.lineTo(x + width / 2 - 5, y + height - 10); // Bottom left
            ctx.moveTo(x + width / 2, y + height); // Back to bottom middle
            ctx.lineTo(x + width / 2 + 5, y + height - 10); // Bottom right
            ctx.stroke();
            ctx.lineWidth = 1;
        },
        rotateClockwise: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;

            const radius = Math.min(width, height) / 2.5; // Radius for the arc
            const centerX = x + width / 2;
            const centerY = y + height / 2;

            // Draw clockwise ¾ circular arrow
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0.25 * Math.PI, 2 * Math.PI); // ¾ circle arc from 45 degrees to 360 degrees
            ctx.stroke();

            // Draw arrow head
            ctx.beginPath();
            ctx.moveTo(centerX + radius * Math.cos(2 * Math.PI), centerY + radius * Math.sin(2 * Math.PI)); // End of arc
            ctx.lineTo(centerX + radius * Math.cos(2 * Math.PI) - 5, centerY + radius * Math.sin(2 * Math.PI) - 5); // Top arrow head
            ctx.moveTo(centerX + radius * Math.cos(2 * Math.PI), centerY + radius * Math.sin(2 * Math.PI)); // End of arc
            ctx.lineTo(centerX + radius * Math.cos(2 * Math.PI) + 5, centerY + radius * Math.sin(2 * Math.PI) - 5); // Bottom arrow head
            ctx.stroke();
            ctx.lineWidth = 1;
        },

        rotateAntiClockwise: (ctx, x, y, width, height, lineColor) => {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;

            const radius = Math.min(width, height) / 2.5; // Radius for the arc
            const centerX = x + width / 2;
            const centerY = y + height / 2;

            // Draw anti-clockwise ¾ circular arrow
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 1.2 * Math.PI, -0.5 * Math.PI, true); // ¾ circle arc from 135 degrees to -90 degrees
            ctx.stroke();

            // Draw arrow head
            ctx.beginPath();
            ctx.moveTo(centerX + radius * Math.cos(-0.5 * Math.PI), centerY + radius * Math.sin(-0.5 * Math.PI)); // End of arc
            ctx.lineTo(centerX + radius * Math.cos(-0.5 * Math.PI) + 5, centerY + radius * Math.sin(-0.5 * Math.PI) - 5); // Top arrow head
            ctx.moveTo(centerX + radius * Math.cos(-0.5 * Math.PI), centerY + radius * Math.sin(-0.5 * Math.PI)); // End of arc
            ctx.lineTo(centerX + radius * Math.cos(-0.5 * Math.PI) + 5, centerY + radius * Math.sin(-0.5 * Math.PI) + 5); // Bottom arrow head
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    };

    const rootDrawings = {
        halfscrew: (ctx, x, y, width, height, lineColor, fillColor, isTop) => {
            const triangleHeight = width / 2; // Height of the triangle is half the width

            // Draw pencil-like shape
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = lineColor;

            // Draw the rectangle
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = lineColor;
            ctx.fillRect(x + width / 2 - width / 4, y, width / 2, height);
            ctx.strokeRect(x + width / 2 - width / 4, y, width / 2, height);

            if (isTop) {
                // Draw the triangle for top root
                ctx.beginPath();
                ctx.moveTo(x + width / 2 - width / 4, y); // Bottom left of triangle
                ctx.lineTo(x + width / 2, y - triangleHeight); // Top of triangle
                ctx.lineTo(x + width / 2 + width / 4, y); // Bottom right of triangle
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                // Draw the triangle for bottom root
                ctx.beginPath();
                ctx.moveTo(x + width / 2 - width / 4, y + height); // Top left of triangle
                ctx.lineTo(x + width / 2, y + height + triangleHeight); // Bottom of triangle
                ctx.lineTo(x + width / 2 + width / 4, y + height); // Top right of triangle
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        },
        fullscrew: (ctx, x, y, width, height, lineColor, fillColor, isTop, isItem) => {
            const triangleHeight = width / 2; // Height of the triangle is half the width

            // Draw pencil-like shape
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = lineColor;

            // Clear the area behind the fullscrew
            if (!isItem) {
                // replace background with grey colour of 
                ctx.fillStyle = '#f4f4f4'; // Light grey background
                if (isTop) {
                    ctx.fillRect(x - 18, y - 40, width + 30, height + 40);
                } else {
                    ctx.fillRect(x - 18, y, width + 30, height + 40);
                }
            }


            // Draw the rectangle
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = lineColor;
            ctx.fillRect(x + width / 2 - width / 4, y, width / 2, height);
            ctx.strokeRect(x + width / 2 - width / 4, y, width / 2, height);

            if (isTop) {
                // Draw the triangle for top root
                ctx.beginPath();
                ctx.moveTo(x + width / 2 - width / 4, y); // Bottom left of triangle
                ctx.lineTo(x + width / 2, y - triangleHeight); // Top of triangle
                ctx.lineTo(x + width / 2 + width / 4, y); // Bottom right of triangle
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                // Draw the triangle for bottom root
                ctx.beginPath();
                ctx.moveTo(x + width / 2 - width / 4, y + height); // Top left of triangle
                ctx.lineTo(x + width / 2, y + height + triangleHeight); // Bottom of triangle
                ctx.lineTo(x + width / 2 + width / 4, y + height); // Top right of triangle
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        },
        rootfill: (ctx, x, y, width, height, lineColor, fillColor, isTop, toothType) => {
            if (toothType !== 1) {
                // Define points for Type 2 root fill polygon
                const points = [
                    { x: x + width * 0.2, y: y },                      // Top left
                    { x: x + width * 0.1, y: y + height / 2 },         // Left middle upper
                    { x: x + width * 0.2, y: y + height },             // Bottom left
                    { x: x + width * 0.6, y: y + height },             // Bottom right
                    { x: x + width * 0.7, y: y + height / 2 },         // Right middle upper
                    { x: x + width * 0.6, y: y },                      // Top right
                    { x: x + width * 0.55, y: y },                     // Right of top right
                    { x: x + width * 0.55, y: y + height * 0.5 },      // Middle right
                    { x: x + width * 0.45, y: y + height * 0.6 },      // Below middle right
                    { x: x + width * 0.35, y: y + height * 0.6 },      // Below middle left
                    { x: x + width * 0.25, y: y + height * 0.5 },      // Middle left
                    { x: x + width * 0.25, y: y },                     // Left of top left
                    { x: x + width * 0.2, y: y }                       // Closing the shape
                ];

                // Adjust for bottom roots
                if (!isTop) {
                    points.forEach(point => {
                        point.y = y + height - (point.y - y);
                    });
                }

                // Draw the polygon
                ctx.fillStyle = fillColor;
                ctx.strokeStyle = lineColor;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (toothType === 1) {
                // Define shape for Type 1 root fill
                const narrowWidth = width - 40; // 7px narrower on each side
                const offsetX = x + 14; // Adjust starting x position
                ctx.fillStyle = fillColor;
                ctx.strokeStyle = lineColor;
                height = height * 2;

                ctx.beginPath();
                if (isTop) {
                    y = y - 70;
                    ctx.moveTo(offsetX, y + height);
                    ctx.quadraticCurveTo(offsetX + narrowWidth / 2, y - 20, offsetX + narrowWidth, y + height);
                } else {
                    ctx.moveTo(offsetX, y);
                    ctx.quadraticCurveTo(offsetX + narrowWidth / 2, y + height + 20, offsetX + narrowWidth, y);
                }
                ctx.lineTo(offsetX + narrowWidth, isTop ? y + height : y);
                ctx.lineTo(offsetX, isTop ? y + height : y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
    };


    let activeTab = 'Observations';

    const problemCodes = [
        {
            code: 'EMISD_AC3',
            description: 'Acquired absence of single tooth',
            short: 'Missing',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'missing',
            lineColor: '#666666',
            backgroundColor: '#FFFFFF',
            tab: 'Observations'
        },
        {
            code: 'EMISD_AC4',
            description: 'Acquired absence of teeth, space closed ',
            short: 'Closed',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'closed',
            lineColor: '#555555',
            backgroundColor: '#FFFFFF',
            tab: 'Observations'
        },
        {
            code: 'EMISD_AN1L',
            description: 'Tooth displaced',
            short: 'Displaced',
            type: 'Whole', // Type 1
            subtype: 'Graphic',
            graphic: 'arrowLeft', // Reference to the arrow graphic
            lineColor: '#BBBBBB',
            tab: 'Observations'
        },
        {
            code: 'EMISD_AN1R',
            description: 'Tooth displaced',
            short: 'Displaced',
            type: 'Whole', // Type 1
            subtype: 'Graphic',
            graphic: 'arrowRight', // Reference to the arrow graphic
            lineColor: '#BBBBBB',
            tab: 'Observations'
        },
        {
            code: 'EMISD_AN1U',
            description: 'Tooth displaced',
            short: 'Displaced',
            type: 'Whole', // Type 1
            subtype: 'Graphic',
            graphic: 'arrowUp', // Reference to the arrow graphic
            lineColor: '#BBBBBB',
            tab: 'Observations'
        },
        {
            code: 'EMISD_AN1D',
            description: 'Tooth displaced',
            short: 'Displaced',
            type: 'Whole', // Type 1
            subtype: 'Graphic',
            graphic: 'arrowDown', // Reference to the arrow graphic
            lineColor: '#BBBBBB',
            tab: 'Observations'
        },
        {
            code: 'EMISD_RO6',
            description: 'Tooth rotated clockwise',
            short: 'Rotated CW',
            type: 'Whole', // Type 1
            subtype: 'Graphic',
            graphic: 'rotateClockwise',
            lineColor: '#444444',
            tab: 'Observations'
        },
        {
            code: 'EMISD_RO5',
            description: 'Tooth rotated anti-clockwise',
            short: 'Rotated ACW',
            type: 'Whole', // Type 1
            subtype: 'Graphic',
            graphic: 'rotateAntiClockwise',
            lineColor: '#444444',
            tab: 'Observations'
        },
        {
            code: 'DMSD016',
            description: 'Fracture of tooth; treatment required',
            short: 'Fracture to treat',
            type: 'BMPDO',
            text: '#',
            color: '#FF0000',
            shape: 'character',
            tab: 'Observations'
        },
        {
            code: 'EMISD_FR4',
            description: 'Fracture of tooth, Fracture to watch',
            short: 'Fracture to watch',
            type: 'BMPDO',
            text: '#',
            color: '#999999',
            shape: 'character',
            tab: 'Observations'
        },
        {
            code: 'EMISD_NO1',
            description: 'NonVital',
            short: 'NonVital',
            type: 'Whole',
            subtype: 'Chars',
            text: 'NV',
            color: '#888888',
            tab: 'Observations'
        },
        {
            code: 'DMSD017',
            description: 'Tooth Surface Loss',
            short: 'Tooth Surf Loss',
            type: 'BMPDO',
            text: 'TSL',
            color: '#888888',
            shape: 'character',
            tab: 'Observations'
        },
        {
            code: 'EMISD_TO13',
            description: 'Tooth unerupted',
            short: 'Unerupt',
            type: 'Whole',
            subtype: 'Chars',
            text: 'UE',
            color: '#888888',
            tab: 'Observations'
        },
        {
            code: 'EMISD_TO12',
            description: 'Tooth partially erupted',
            short: 'Partially erupted',
            type: 'Whole',
            subtype: 'Chars',
            text: 'PE',
            color: '#888888',
            tab: 'Observations'
        },
        {
            code: 'DMSD648',
            description: 'Not Recorded',
            short: 'Not Recorded',
            type: 'Whole',
            subtype: 'Chars',
            text: 'NR',
            color: '#222222',
            tab: 'Observations'
        },
        {
            code: 'EMISD_DE29',
            description: 'Cavity to restore',
            short: 'Cavity to restore',
            type: 'BMPDO',
            fillColor: '#FFFFFF',
            strokeColor: '#FF0000',
            shape: 'circle',
            tab: 'Observations'
        },
        {
            code: 'EMISD_TO26',
            description: 'Tooth under observation',
            short: 'Cavity to watch',
            type: 'BMPDO',
            fillColor: '#FFFFFF',
            strokeColor: '#666666',
            shape: 'circle',
            tab: 'Observations'
        },
        {
            code: 'DMSD013',
            description: 'Watch',
            short: 'Watch',
            type: 'BMPDO',
            text: 'W',
            color: '#FF0000',
            shape: 'character',
            tab: 'Observations'
        },
        {
            code: 'DMSD018',
            description: 'Caries R1',
            short: 'Caries R1',
            type: 'BMPDO',
            text: 'R1',
            color: '#888888',
            shape: 'character',
            tab: 'Observations'
        },
        {
            code: 'DMSD019',
            description: 'Caries R2',
            short: 'Caries R2',
            type: 'BMPDO',
            text: 'R2',
            color: '#888888',
            shape: 'character',
            tab: 'Observations'
        },
        {
            code: 'DMSD020',
            description: 'Caries R3',
            short: 'Caries R3',
            type: 'BMPDO',
            text: 'R3',
            color: '#888888',
            shape: 'character',
            tab: 'Observations'
        },
        {
            code: 'EMISD_RE54',
            description: 'Retained dental root',
            short: 'Retained Root',
            type: 'BMPDO',
            text: 'x',
            color: '#999999',
            shape: 'character',
            replace: true,
            tab: 'Observations'
        },
        {
            code: 'EMISD_DE54',
            description: 'Dental amalgam filling present',
            short: 'Amalgam',
            type: 'BMPDO',
            fillColor: '#666666',
            strokeColor: '#666666',
            shape: 'circle',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE55',
            description: 'Dental composite filling present',
            short: 'Composite',
            type: 'BMPDO',
            fillColor: '#0000FF',
            strokeColor: '#0000FF',
            shape: 'circle',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE56',
            description: 'Dental glass-ionomer filling present',
            short: 'Glass Ionomer',
            type: 'BMPDO',
            fillColor: '#33FF00',
            strokeColor: '#33FF00',
            shape: 'circle',
            tab: 'Existing Restorations'
        },
        {
            code: 'DMSD780',
            description: 'Direct Gold filling present',
            short: 'Gold Direct',
            type: 'BMPDO',
            fillColor: '#FFCC00',
            strokeColor: '#FFCC00',
            shape: 'circle',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_FI14',
            description: 'Fissure sealant present',
            short: 'Sealant',
            type: 'BMPDO',
            text: 'FS',
            color: '#888888',
            shape: 'character',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_PA14',
            description: 'Partial denture, resin base present',
            short: 'Acrylic Denture',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'acrylicDenture',
            lineColor: '#666666',
            backgroundColor: '#FF99CC',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_PA13',
            description: 'Partial denture, cast metal base with resin saddles present',
            short: 'Metal Denture',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'acrylicDenture',
            lineColor: '#666666',
            backgroundColor: '#CCCCCC',
            tab: 'Existing Restorations'
        },
        {
            code: 'DMSD688',
            description: 'Acrylic Overdenture',
            short: 'Acrylic Overdent',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'acrylicDenture',
            lineColor: '#666666',
            backgroundColor: '#FF99CC',
            tab: 'Existing Restorations'
        },
        {
            code: 'DMSD687',
            description: 'Metal Overdenture',
            short: 'Metal Overdent',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'acrylicDenture',
            lineColor: '#666666',
            backgroundColor: '#CCCCCC',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_LO6',
            description: 'Loss of teeth due to extraction',
            short: 'Extracted',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'extracted',
            lineColor: '#000000',
            backgroundColor: '#FFFFFF',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_TE4',
            description: 'Temporary dental filling present',
            short: 'Temp Dressing',
            type: 'BMPDO',
            fillColor: '#FF0000',
            strokeColor: '#FF0000',
            shape: 'circle',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE50',
            description: 'Dental crown present, bonded',
            short: 'Bonded Crown',
            type: 'Whole',
            subtype: 'Colour',
            fillColor: '#66CCFF',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE52',
            description: 'Dental crown present, porcelain/ceramic',
            short: 'Ceramic Crown',
            type: 'Whole',
            subtype: 'Colour',
            fillColor: '#CC99CC',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE51',
            description: 'Dental crown present, gold alloy',
            short: 'Gold Crown',
            type: 'Whole',
            subtype: 'Colour',
            fillColor: '#FFCC00',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE97',
            description: 'Dental crown present, prefabricated stainless steel',
            short: 'St Steel Crown',
            type: 'Whole',
            subtype: 'Colour',
            fillColor: '#CCCCCC',
            tab: 'Existing Restorations'
        },
        {
            code: 'DMSD649',
            description: 'Composite inlay present',
            short: 'Composite Inlay',
            type: 'BMPDO-All',
            fillColor: '#0000FF',
            strokeColor: '#0000FF',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE58',
            description: 'Dental inlay present, porcelain/ceramic',
            short: 'Ceramic Inlay',
            type: 'BMPDO-All',
            fillColor: '#CC99CC',
            strokeColor: '#CC99CC',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE57',
            description: 'Dental inlay present, gold',
            short: 'Gold Inlay',
            type: 'BMPDO-All',
            fillColor: '#FFCC00',
            strokeColor: '#FFCC00',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE130',
            description: 'Dental veneer present, composite/resin',
            short: 'Composite Veneer',
            type: 'BMPDO-All',
            fillColor: '#0000FF',
            strokeColor: '#0000FF',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_PO4',
            description: 'Porcelain veneer present',
            short: 'Ceramic Veneer',
            type: 'BMPDO-All',
            fillColor: '#CC99CC',
            strokeColor: '#CC99CC',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE131',
            description: 'Dental veneer present, metal',
            short: 'Metal Veneer',
            type: 'BMPDO-All',
            fillColor: '#999999',
            strokeColor: '#999999',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE94',
            description: 'Dental bridge retainer present',
            short: 'Ad Bridge Retainer',
            type: 'BMPDO-All',
            fillColor: '#336666',
            strokeColor: '#336666',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE42',
            description: 'Dental bridge pontic, bonded present',
            short: 'Pontic',
            type: 'Whole',
            subtype: 'Chars',
            text: 'Pon',
            color: '#666666',
            backgroundColor: '#CCCCCC',
            tab: 'Existing Restorations'
        },
        {
            code: 'DMSD027',
            description: 'Connector present',
            short: 'Connector',
            type: 'Connector',
            color: '#000000',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE114',
            description: 'Dental pin present',
            short: 'Pin',
            type: 'BMPDO',
            text: 'T',
            color: '#000000',
            shape: 'character',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_DE110',
            description: 'Dental post present',
            short: 'Post',
            type: 'Root',
            rootType: 'halfscrew',
            lineColor: '#000000',
            fillColor: '#3300FF',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_IM1',
            description: 'Implantable dental prosthesis present',
            short: 'Implant',
            type: 'Root',
            rootType: 'fullscrew',
            lineColor: '#666666',
            fillColor: '#CCCCCC',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_EN3',
            description: 'Endodontic treatment present',
            short: 'Root Fill',
            type: 'Root',
            rootType: 'rootfill',
            lineColor: '#DD77AA',
            fillColor: '#DD77AA',
            tab: 'Existing Restorations'
        },
        {
            code: 'DMSD650',
            description: 'Temporary Root Dressing',
            short: 'Root Dressing',
            type: 'Root',
            rootType: 'rootfill',
            lineColor: '#999999',
            fillColor: '#FFFFFF',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_EN3D', // Note also uses code: EMISD_EN3 so made up code
            description: 'Endodontic treatment present',
            short: 'Decid MolarEndo',
            type: 'Root',
            rootType: 'rootfill',
            lineColor: '#33FF33',
            fillColor: '#33FF33',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_TE2',
            description: 'Temporary crown present',
            short: 'Temp Crown',
            type: 'Whole',
            subtype: 'Colour',
            fillColor: '#FF0000',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_FL5',
            description: 'Fluoride bead attached to tooth',
            short: 'Fluoride Bead',
            type: 'BMPDO',
            fillColor: '#FF66CC',
            strokeColor: '#FF66CC',
            shape: 'circle',
            tab: 'Existing Restorations'
        },
        {
            code: 'EMISD_FI9',
            description: 'Fissure sealant present',
            short: 'Sealant',
            type: 'BMPDO',
            text: 'FS',
            color: '#FF0000',
            shape: 'character',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_PA10',
            description: 'Partial denture required, acrylic',
            short: 'Acrylic Denture',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'acrylicDenture',
            lineColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_PA11',
            description: 'Partial denture required, metal based',
            short: 'Metal Denture',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'acrylicDenture',
            lineColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_TO9',
            description: 'Tooth extraction required',
            short: 'Extract',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'extracted2',
            lineColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_DE28',
            description: 'Dental crown required',
            short: 'Crown',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'circle',
            lineColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_DE98',
            description: 'Dental crown required, prefabricated stainless steel',
            short: 'St Steel Crown',
            type: 'Whole',
            subtype: 'Graphic',
            graphic: 'circle',
            lineColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_DE30',
            description: 'Dental inlay required',
            short: 'Inlay',
            type: 'BMPDO-All',
            fillColor: '#FFFFFF',
            strokeColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_DE31',
            description: 'Dental veneer required',
            short: 'Veneer',
            type: 'BMPDO-All',
            fillColor: '#FFFFFF',
            strokeColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_DE87',
            description: 'Dental bridge retainer required',
            short: 'Ad bridge retainer',
            type: 'BMPDO-All',
            fillColor: '#666666',
            strokeColor: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_DE79',
            description: 'Dental bridge pontic, bonded required',
            short: 'Pontic',
            type: 'Whole',
            subtype: 'Chars',
            text: 'Pon',
            color: '#FF0000',
            graphic: 'circle',
            tab: 'Planned Restorations'
        },
        {
            code: 'DMSD047',
            description: 'Connector Required',
            short: 'Connector',
            type: 'Connector',
            color: '#FF0000',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_PO2',
            description: 'Post and core required',
            short: 'Post',
            type: 'Root',
            rootType: 'halfscrew',
            lineColor: '#FF0000',
            fillColor: '#FFFF33',
            tab: 'Planned Restorations'
        },
        {
            code: 'DMSD053',
            description: 'Implant required',
            short: 'Implant',
            type: 'Root',
            rootType: 'fullscrew',
            lineColor: '#FF0000',
            fillColor: '#FFFFFF',
            leave: true,
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_RF1',
            description: 'Root Fill',
            short: 'Root Fill',
            type: 'Root',
            rootType: 'rootfill',
            lineColor: '#FF0000',
            fillColor: '#FF3333',
            tab: 'Planned Restorations'
        },
        {
            code: 'EMISD_FL4',
            description: 'Fluoride bead required',
            short: 'Fluoride Bead',
            type: 'BMPDO',
            fillColor: '#FF77DD',
            strokeColor: '#FF0000',
            shape: 'circle',
            tab: 'Planned Restorations'
        },
        {
            code: 'DMSD048',
            description: 'Replacement of amalgam filling required',
            short: 'Amalgam',
            type: 'BMPDO',
            fillColor: '#666666',
            strokeColor: '#FF0000',
            shape: 'circle',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD049',
            description: 'Replacement of composite filling required',
            short: 'Composite',
            type: 'BMPDO',
            fillColor: '#0000FF',
            strokeColor: '#FF0000',
            shape: 'circle',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD050',
            description: 'Replacement of glass ionomer filling required',
            short: 'Glass Ionomer',
            type: 'BMPDO',
            fillColor: '#00FF00',
            strokeColor: '#FF0000',
            shape: 'circle',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD051',
            description: 'Replacement of gold filling required',
            short: 'Gold',
            type: 'BMPDO',
            fillColor: '#FFCC00',
            strokeColor: '#FF0000',
            shape: 'circle',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD655',
            description: 'Replace fissure sealant',
            short: 'Sealant',
            type: 'BMPDO',
            text: 'FS',
            color: '#FF9900',
            shape: 'character',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD657',
            description: 'Replace Adhesive Bridge Retainer',
            short: 'Ad bridge retainer',
            type: 'BMPDO-All',
            fillColor: '#336666',
            strokeColor: '#FF0000',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD750',
            description: 'Replace Connector',
            short: 'Connector',
            type: 'Connector',
            color: '#FF9900',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD748',
            description: 'Replace post',
            short: 'Post',
            type: 'Root',
            rootType: 'halfscrew',
            lineColor: '#FF0000',
            fillColor: '#339933',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD054',
            description: 'Replacement of Implant required',
            short: 'Implant',
            type: 'Root',
            rootType: 'fullscrew',
            lineColor: '#FF0000',
            fillColor: '#999999',
            tab: 'Replace Restorations'
        },
        {
            code: 'DMSD656',
            description: 'Replace Root Fill Post',
            short: 'Root Fill',
            type: 'Root',
            rootType: 'rootfill',
            lineColor: '#FF9900',
            fillColor: '#FF9900',
            tab: 'Replace Restorations'
        }
    ];

    function problemToRow(problem) {
        // Lookup metadata
        const meta = problemCodes.find(p => p.code === problem.code);
        const label = meta ? (meta.short || meta.description || problem.code) : problem.code;

        // Build fields
        let target = '';
        if (problem.tooth) target = problem.tooth;
        if (problem.teeth) target = problem.teeth.join('–');

        const area = problem.dentalArea || '';

        const instances = typeof problem.instances === 'number' ? problem.instances : '';

        return { label, code: problem.code, target, area, instances };
    }

    function updatePanel() {
        const panel = document.getElementById('problemsPanel');
        const meta = document.getElementById('panelMeta');

        // Sort for readability: by tooth (or first tooth), then by code
        const sorted = [...dentalProblems].sort((a, b) => {
            const aKey = a.tooth ?? (a.teeth ? a.teeth[0] : 0);
            const bKey = b.tooth ?? (b.teeth ? b.teeth[0] : 0);
            if (aKey !== bKey) return aKey - bKey;
            return String(a.code).localeCompare(String(b.code));
        });

        if (meta) meta.textContent = `${sorted.length} item${sorted.length === 1 ? '' : 's'}`;

        if (!sorted.length) {
            panel.innerHTML = '<div class="muted">Nothing selected yet. Click a code on the left, then click a tooth area.</div>';
            return;
        }

        let html = '<table><thead><tr>' +
            '<th>Item</th><th>Code</th><th>Tooth/Teeth</th><th>Area</th><th>×</th>' +
            '</tr></thead><tbody>';


        for (const p of sorted) {
            const row = problemToRow(p);
            html += `<tr>
                <td>${row.label}</td>
                <td>${row.code}</td>
                <td>${row.target || ''}</td>
                <td>${row.area || ''}</td>
                <td style="text-align:center">${row.instances || ''}</td>
            </tr>`;
        }
        html += '</tbody></table>';

        panel.innerHTML = html;
    }

    // Hook up panel buttons once DOM is ready
    $(document).ready(function () {
        $('#clearAllBtn').on('click', function () {
            dentalProblems.length = 0;
            drawProblems();
        });
        $('#copyJsonBtn').on('click', async function () {
            try {
                const txt = JSON.stringify(dentalProblems, null, 2);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(txt);
                    alert('Selections copied to clipboard as JSON.');
                } else {
                    // Fallback: open in a prompt
                    window.prompt('Copy JSON:', txt);
                }
            } catch (e) {
                console.error(e);
            }
        });

        // Initial empty state
        updatePanel();

    });

    const tip = document.createElement('div');
    tip.id = 'itemsTooltip';
    Object.assign(tip.style, {
        position: 'fixed',
        padding: '4px 6px',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        font: '12px/1.2 Arial, sans-serif',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: '9999',
        display: 'none'
    });
    document.body.appendChild(tip);

    itemsCanvas.addEventListener('mousemove', function (event) {
        if (!hoverTooltip) return;
        const rect = itemsCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / uiScale;
        const y = (event.clientY - rect.top) / uiScale;

        const match = hoverTooltip.find(r =>
            x >= r.x && x <= r.x + r.w &&
            y >= r.y && y <= r.y + r.h
        );

        if (match) {
            tip.textContent = `${match.label} — ${match.code}`;
            tip.style.left = (event.clientX + 10) + 'px';
            tip.style.top = (event.clientY + 12) + 'px';
            tip.style.display = 'block';
        } else {
            tip.style.display = 'none';
        }
    });

    itemsCanvas.addEventListener('mouseleave', function () {
        tip.style.display = 'none';
    });

    function drawTeeth() {
        teeth.length = 0;
        clearCanvas(ctx, chartCanvas);
        const topNumbers = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
        const bottomNumbers = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

        ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

        // Draw top row of roots
        for (let i = 0; i < totalTeeth; i++) {
            const x = i * (toothWidth + gap) + gap + margin;
            const y = margin;
            const type = (i < 5 || i >= 11) ? 2 : 1; // 5 type 2, 6 type 1, 5 type 2
            if (type === 1) {
                drawType1Root(ctx, x, y, toothWidth, rootHeight, true);
            } else {
                drawType2Root(ctx, x, y, toothWidth, rootHeight, true);
            }
        }

        // Draw top row of teeth
        for (let i = 0; i < totalTeeth; i++) {
            const x = i * (toothWidth + gap) + gap + margin;
            const y = rootHeight + rootToothGap + margin;
            const type = (i < 5 || i >= 11) ? 2 : 1; // 5 type 2, 6 type 1, 5 type 2
            teeth.push({ x, y, width: toothWidth, height: toothHeight, type, status: 'healthy', number: topNumbers[i], damagedAreas: [] });
            if (type === 1) {
                drawType1Tooth(ctx, x, y, toothWidth, toothHeight, 'white', topNumbers[i], []);
            } else {
                drawType2Tooth(ctx, x, y, toothWidth, toothHeight, 'white', topNumbers[i], []);
            }
            drawNumber(ctx, x, y + toothHeight + 12, topNumbers[i]); // Positioning number below top teeth
        }

        // Draw bottom row of teeth
        for (let i = 0; i < totalTeeth; i++) {
            const x = i * (toothWidth + gap) + gap + margin;
            const y = rootHeight + rootToothGap + margin + toothHeight + (3 * gap) + adjustment;
            const type = (i < 5 || i >= 11) ? 2 : 1; // 5 type 2, 6 type 1, 5 type 2
            teeth.push({ x, y, width: toothWidth, height: toothHeight, type, status: 'healthy', number: bottomNumbers[i], damagedAreas: [] });
            if (type === 1) {
                drawType1Tooth(ctx, x, y, toothWidth, toothHeight, 'white', bottomNumbers[i], []);
            } else {
                drawType2Tooth(ctx, x, y, toothWidth, toothHeight, 'white', bottomNumbers[i], []);
            }
            drawNumber(ctx, x, y - 6, bottomNumbers[i]); // Positioning number above bottom teeth
        }

        // Draw bottom row of roots
        for (let i = 0; i < totalTeeth; i++) {
            const x = i * (toothWidth + gap) + gap + margin;
            const y = rootHeight + rootToothGap + margin + toothHeight + (4 * gap) + adjustment + toothHeight - 5;
            const type = (i < 5 || i >= 11) ? 2 : 1; // 5 type 2, 6 type 1, 5 type 2
            if (type === 1) {
                drawType1Root(ctx, x, y, toothWidth, rootHeight, false);
            } else {
                drawType2Root(ctx, x, y, toothWidth, rootHeight, false);
            }
        }
    }


    function drawType1Tooth(ctx, x, y, width, height, color, number, damagedAreas) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);

        const rectWidth = width * 0.5;
        const rectHeight = width * 0.25;
        const rectX = x + width * 0.25;
        const rectY = y + height * 0.375;

        // Draw the central rectangle
        ctx.fillStyle = 'white';
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

        // Draw the inner diagonal lines
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(rectX, rectY);
        ctx.moveTo(x + width, y);
        ctx.lineTo(rectX + rectWidth, rectY);
        ctx.moveTo(x, y + height);
        ctx.lineTo(rectX, rectY + rectHeight);
        ctx.moveTo(x + width, y + height);
        ctx.lineTo(rectX + rectWidth, rectY + rectHeight);
        ctx.stroke();

        // Determine label positions
        let labels = getLabels(number);

        // Draw the labels
        drawLabels(ctx, rectX, rectWidth, rectY, rectHeight, labels, x, width, y, height);
    }


    function drawType2Tooth(ctx, x, y, width, height, color, number, damagedAreas) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);

        const squareSize = width * 0.5;
        const squareX = x + width * 0.25;
        const squareY = y + height * 0.25;

        // Draw the central square
        ctx.fillStyle = 'white';
        ctx.fillRect(squareX, squareY, squareSize, squareSize);
        ctx.strokeRect(squareX, squareY, squareSize, squareSize);

        // Draw the inner diagonal lines
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(squareX, squareY);
        ctx.moveTo(x + width, y);
        ctx.lineTo(squareX + squareSize, squareY);
        ctx.moveTo(x, y + height);
        ctx.lineTo(squareX, squareY + squareSize);
        ctx.moveTo(x + width, y + height);
        ctx.lineTo(squareX + squareSize, squareY + squareSize);
        ctx.stroke();

        // Determine label positions
        let labels = getLabels(number);

        // Draw the labels
        drawLabels(ctx, squareX, squareSize, squareY, squareSize, labels, x, width, y, height);
    }


    function drawType1Root(ctx, x, y, width, height, isTop) {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        const rootNarrowWidth = width - 10; // 5px narrower on both sides
        const offsetX = x + 5; // Adjust starting x position

        ctx.beginPath();
        if (isTop) {
            ctx.moveTo(offsetX, y + height);
            ctx.quadraticCurveTo(offsetX + rootNarrowWidth / 2, y - 28, offsetX + rootNarrowWidth, y + height);
        } else {
            ctx.moveTo(offsetX, y);
            ctx.quadraticCurveTo(offsetX + rootNarrowWidth / 2, y + height + 28, offsetX + rootNarrowWidth, y);
        }
        ctx.lineTo(offsetX + rootNarrowWidth, isTop ? y + height : y);
        ctx.lineTo(offsetX, isTop ? y + height : y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }


    function drawType2Root(ctx, x, y, width, height, isTop) {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        if (isTop) {
            ctx.moveTo(x, y + height);
            ctx.quadraticCurveTo(x + width / 4, y, x + width / 2, y + height - 30);
            ctx.quadraticCurveTo(x + (3 * width) / 4, y, x + width, y + height);
        } else {
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + width / 4, y + height, x + width / 2, y + 30);
            ctx.quadraticCurveTo(x + (3 * width) / 4, y + height, x + width, y);
        }
        ctx.lineTo(x + width, isTop ? y + height : y);
        ctx.lineTo(x, isTop ? y + height : y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    function drawNumber(ctx, x, y, number) {
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.fillText(number, x + toothWidth / 2 - 6, y);
    }

    function getToothAt(x, y) {
        return teeth.find(tooth => x >= tooth.x && x <= tooth.x + tooth.width && y >= tooth.y && y <= tooth.y + tooth.height);
    }


    const items = [
        { name: 'Repair', image: drawRepairImage },
        { name: 'Filling', image: drawFillingImage }
    ];

    let activeItem = null; // To store the currently selected item

    // Define item images
    function drawRepairImage(ctx, x, y, size) {
        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, size, size);
    }

    function drawFillingImage(ctx, x, y, size) {
        ctx.fillStyle = 'grey';
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }


    function drawItems() {
        const itemSize = 30; // Size of the item image
        const textOffset = 10; // Offset for the text to be placed next to the image
        const lineHeight = itemSize + 10; // Height of each line (image + text spacing)
        const textMargin = 5; // Space between the image and the text
        const columnMargin = 100; // Margin between columns
        const hoverRegions = [];


        clearCanvas(itemsCtx, itemsCanvas);

        // Calculate the number of items that fit vertically
        const maxItemsPerColumn = Math.floor((itemsHeight - 2 * margin) / lineHeight);

        // Filter problem codes by active tab
        const filteredProblemCodes = problemCodes.filter(item => item.tab === activeTab);

        filteredProblemCodes.forEach((item, index) => {
            // Calculate current column and row
            const column = Math.floor(index / maxItemsPerColumn);
            const row = index % maxItemsPerColumn;

            // Calculate x and y positions
            const x = margin + column * (itemSize + textOffset + columnMargin);
            const y = row * lineHeight + margin;

            // Draw the image
            if (item.type === 'Connector') {
                drawConnector(itemsCtx, x + itemSize / 2 - 3, y + itemSize / 2 - 3, x + itemSize / 2 + 3, y + itemSize / 2 + 3, item.color);
            } else if (item.type === 'BMPDO-All') {
                drawBMPDOAll(itemsCtx, x, y, itemSize, itemSize, 'O', item.fillColor, item.strokeColor, 2); // Draw 'O' for item display
            } else if (item.type === 'BMPDO') {
                if (item.shape === 'circle') {
                    const problemCode = { fillColor: item.fillColor, strokeColor: item.strokeColor, text: '', color: '', shape: 'circle' };
                    drawBMPDO(itemsCtx, x, y, itemSize, itemSize, 'O', problemCode, 1); // Draw single circle for display
                } else if (item.shape === 'character') {
                    const problemCode = { fillColor: '', strokeColor: '', text: item.text, color: item.color, shape: 'character' };
                    drawBMPDO(itemsCtx, x, y, itemSize, itemSize, 'O', problemCode, 1); // Draw single character for display
                }
            } else if (item.type === 'Whole') {
                if (item.subtype === 'Colour') {
                    drawWholeColour(itemsCtx, x, y, itemSize, itemSize, item.fillColor);
                } else if (item.subtype === 'Chars') {
                    drawWholeChars(itemsCtx, x, y, itemSize, itemSize, item.text, item.color, item.backgroundColor, item.graphic);
                } else if (item.subtype === 'Graphic') {
                    drawWholeGraphic(itemsCtx, x, y, itemSize, itemSize, item.graphic, item.lineColor, item.backgroundColor, true);
                }
            } else if (item.type === 'Root') {
                const drawRoot = rootDrawings[item.rootType];
                drawRoot(itemsCtx, x + 4, y + 8, itemSize / 1.5, itemSize / 1.5, item.lineColor, item.fillColor, true, true);
            }

            // Draw the text next to the image
            itemsCtx.fillStyle = 'black';
            itemsCtx.font = '12px Arial';
            itemsCtx.fillText(item.short, x + itemSize + textMargin, y + itemSize / 2 + 4); // Center text vertically

            const textWidth = itemsCtx.measureText(item.short).width;
            hoverRegions.push({
                x: x + itemSize + textMargin,
                y: y,
                w: textWidth,
                h: itemSize,
                code: item.code,
                label: item.short   // ← ADDED
            });

            // existing ICON region
            hoverRegions.push({
                x: x,
                y: y,
                w: itemSize,
                h: itemSize,
                code: item.code,
                label: item.short   // ← ADDED
            });
        });
        hoverTooltip = hoverRegions;
    }

    itemsCanvas.addEventListener('click', function (event) {
        const textOffset = 10;
        const rect = itemsCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / uiScale;
        const y = (event.clientY - rect.top) / uiScale;
        const itemSize = 30;
        const lineHeight = itemSize + 10; // Height of each line
        const columnMargin = 100; // Margin between columns
        const maxItemsPerColumn = Math.floor((itemsHeight - 2 * margin) / lineHeight);

        // Filter problem codes by active tab
        const filteredProblemCodes = problemCodes.filter(item => item.tab === activeTab);

        filteredProblemCodes.forEach((item, index) => {
            const column = Math.floor(index / maxItemsPerColumn);
            const row = index % maxItemsPerColumn;

            const itemX = margin + column * (itemSize + textOffset + columnMargin);
            const itemY = row * lineHeight + margin;

            if (x >= itemX && x <= itemX + itemSize && y >= itemY && y <= itemY + itemSize) {
                activeItem = item;
                // Highlight selected item
                itemsCtx.clearRect(0, 0, itemsCanvas.width, itemsCanvas.height);
                drawItems();
                itemsCtx.strokeStyle = 'blue';
                itemsCtx.strokeRect(itemX - 2, itemY - 2, itemSize + 4, itemSize + 4);
            }
        });
    });


    const dentalProblems = [];

    $('#chartCanvas').click(function (event) {
        const rect = chartCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / uiScale;
        const y = (event.clientY - rect.top) / uiScale;

        let tooth = null;
        let area = null;
        let dentalArea = null;
        let adjacentTooth = null;
        let tooth2 = null;

        if (!activeItem) return; // Ignore if no active item

        if (activeItem.type === 'Root') {
            tooth = getToothForRoot(x, y); // Check if click is on the root
            if (tooth) {
                area = calculateRootArea(x, y, tooth); // Calculate root area
            }
        } else if (activeItem.type === 'Connector') {
            // First determine if between two teeth
            tooth = getToothAt(x - 11, y);
            tooth2 = getToothAt(x + 11, y);
            if ((tooth && tooth2) && (tooth.number !== tooth2.number)) {
                console.log('Connector between teeth', tooth.number, tooth2.number);
            } else {
                return; // Ignore if not between two teeth
            }
        } else {
            tooth = getToothAt(x, y); // Check if click is on the tooth
            if (tooth) {
                area = calculateArea(x, y, tooth); // Calculate tooth area
                // convert area into dentalArea for BMPDO - conversion will depend on tooth number
                dentalArea = getLabelArea(tooth, area);
            } else {
                return; // Ignore if no tooth
            }
        }

        if (!tooth === null) return; // Ignore if no tooth/root or invalid area


        if (event.shiftKey) {
            // Remove problem if Shift key is pressed
            let existingProblemIndex;
            if (activeItem.type === 'BMPDO' || activeItem.type === 'BMPDO-All') {
                existingProblemIndex = dentalProblems.findIndex(p => p.code === activeItem.code && p.tooth === tooth.number && p.area === area);
                if (existingProblemIndex !== -1) {
                    const existingProblem = dentalProblems[existingProblemIndex];
                    if (activeItem.type === 'BMPDO') {
                        existingProblem.instances -= 1;
                        if (existingProblem.instances <= 0) {
                            dentalProblems.splice(existingProblemIndex, 1);
                        }
                    } else {
                        dentalProblems.splice(existingProblemIndex, 1);
                    }
                }
            } else if (activeItem.type === 'Root' || activeItem.type === 'Whole') {
                existingProblemIndex = dentalProblems.findIndex(p => p.code === activeItem.code && p.tooth === tooth.number);
                if (existingProblemIndex !== -1) {
                    dentalProblems.splice(existingProblemIndex, 1);
                }
            } else if (activeItem.type === 'Connector') {
                const existingProblemIndex = dentalProblems.findIndex(p => p.code === activeItem.code && p.teeth.includes(tooth.number) && p.teeth.includes(tooth2.number));
                if (existingProblemIndex !== -1) {
                    dentalProblems.splice(existingProblemIndex, 1);
                }
            }
        } else {
            // Add problem if Shift key is not pressed
            let problem = null;
            if (activeItem.type === 'BMPDO' || activeItem.type === 'BMPDO-All') {
                const existingProblem = dentalProblems.find(p => p.code === activeItem.code && p.tooth === tooth.number && p.area === area);
                if (activeItem.type === 'BMPDO-All') {
                    if (!existingProblem) {
                        problem = { code: activeItem.code, tooth: tooth.number, area, dentalArea };
                        dentalProblems.push(problem);
                    }
                } else if (activeItem.type === 'BMPDO') {
                    let instances = 1;
                    if (existingProblem) {
                        instances = existingProblem.instances + 1;
                        if (instances <= 3) {
                            existingProblem.instances = instances;
                        }
                    } else {
                        problem = { code: activeItem.code, tooth: tooth.number, area, instances, dentalArea };
                        dentalProblems.push(problem);
                    }
                }
            } else if (activeItem.type === 'Root' || activeItem.type === 'Whole') {
                const existingProblem = dentalProblems.find(p => p.code === activeItem.code && p.tooth === tooth.number);
                if (!existingProblem) {
                    problem = { code: activeItem.code, tooth: tooth.number };
                    dentalProblems.push(problem);
                }
            } else if (activeItem.type === 'Connector') {
                const existingProblem = dentalProblems.find(p => p.code === activeItem.code && p.teeth.includes(tooth.number) && p.teeth.includes(tooth2.number));
                if (!existingProblem) {
                    dentalProblems.push({ code: activeItem.code, teeth: [tooth.number, tooth2.number] });
                }
            }
        }

        drawProblems(); // Redraw the problems on the canvas
    });


    function drawProblems() {
        drawTeeth(); // Redraw teeth first to clear previous problems
        console.clear();
        dentalProblems.forEach(problem => {
            console.log(problem);
            let tooth = teeth.find(t => t.number === problem.tooth);
            const problemCode = problemCodes.find(p => p.code === problem.code);

            if (!problemCode) return; // Skip if no matching problem code

            if (tooth) {
                const { x, y, width, height } = tooth;
                // const rectWidth = width * 0.5;
                // const rectHeight = width * 0.25;
                // const rectX = x + width * 0.25;
                // const rectY = y + height * 0.375;

                switch (problemCode.type) {
                    case 'Whole':
                        if (problemCode.subtype === 'Colour') {
                            drawWholeColour(ctx, x, y, width, height, problemCode.fillColor);
                        } else if (problemCode.subtype === 'Chars') {
                            drawWholeChars(ctx, x, y, width, height, problemCode.text, problemCode.color, problemCode.backgroundColor, problemCode.graphic);
                        } else if (problemCode.subtype === 'Graphic') {
                            drawWholeGraphic(ctx, x, y, width, height, problemCode.graphic, problemCode.lineColor, problemCode.backgroundColor);
                        }
                        break;
                    case 'Root':
                        tooth = teeth.find(t => t.number === problem.tooth);
                        if (tooth) {
                            const { x, y, width, height } = tooth;
                            const isTopRoot = problem.tooth >= 11 && problem.tooth <= 28;
                            const rootY = isTopRoot ? y - (height / 2) - 29 : y + height + (height / 2) - 21;
                            const rootHeight = height / 2; // Height for the root graphics

                            const drawRoot = rootDrawings[problemCode.rootType];
                            if (drawRoot) {
                                if (problemCode.rootType === 'fullscrew') {
                                    drawRoot(ctx, x + 8, rootY, width / 1.5, rootHeight * 2, problemCode.lineColor, problemCode.fillColor, isTopRoot, problemCode.leave);
                                } else if (problemCode.rootType === 'halfscrew') {
                                    if (isTopRoot) {
                                        drawRoot(ctx, x + 8, rootY + rootHeight + 2, width / 1.5, rootHeight, problemCode.lineColor, problemCode.fillColor, isTopRoot);
                                    } else {
                                        drawRoot(ctx, x + 8, rootY - 2, width / 1.5, rootHeight, problemCode.lineColor, problemCode.fillColor, isTopRoot);
                                    }
                                } else {
                                    if (isTopRoot) {
                                        drawRoot(ctx, x - 1, rootY - 20, width * 1.3, rootHeight * 2.8, problemCode.lineColor, problemCode.fillColor, isTopRoot, tooth.type);
                                    } else {
                                        drawRoot(ctx, x - 1, rootY, width * 1.3, rootHeight * 2.8, problemCode.lineColor, problemCode.fillColor, isTopRoot, tooth.type);
                                    }
                                }
                            }
                        }
                        break;
                    case 'BMPDO-All':
                        drawBMPDOAll(ctx, x, y, width, height, problem.area, problemCode.fillColor, problemCode.strokeColor, tooth.type);
                        break;
                    case 'BMPDO':
                        drawBMPDO(ctx, x, y, width, height, problem.area, problemCode, problem.instances, tooth.type);
                        break;
                }
            } else if (problemCode.type === 'Connector') {
                const [tooth1, tooth2] = problem.teeth.map(n => teeth.find(t => t.number === n));
                if (tooth1 && tooth2) {
                    drawConnector(ctx, tooth1.x + 25, tooth1.y + 25, tooth2.x + 25, tooth2.y + 25, problemCode.color);
                }
            }
        });
        updatePanel();
    }

    function drawWholeColour(ctx, x, y, width, height, fillColor) {
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = fillColor;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
    }

    function drawWholeChars(ctx, x, y, width, height, text, color, bgcolor, graphic) {

        if (graphic) {
            drawWholeGraphic(ctx, x, y, width, height, graphic, color, bgcolor)
        } else if (bgcolor) {
            ctx.fillStyle = bgcolor;
            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
        }
        ctx.fillStyle = color;
        ctx.font = `${Math.min(width, height) * 0.3}px Arial bold`;
        const mainTextAlign = ctx.textAlign;
        const mainTextBaseline = ctx.textBaseline;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + width / 2, y + height / 2);
        ctx.textAlign = mainTextAlign;
        ctx.textBaseline = mainTextBaseline;
    }

    function drawWholeGraphic(ctx, x, y, width, height, graphicName, lineColor, backgroundColor, items) {
        if (backgroundColor) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(x, y, width, height);
        }
        if (lineDrawings[graphicName]) {
            lineDrawings[graphicName](ctx, x, y, width, height, lineColor, backgroundColor, items);
        }
    }

    // Draw connector between two teeth
    function drawConnector(ctx, x1, y1, x2, y2, color) {
        const gap = 10; // Assuming the gap between teeth
        const centerX = ((x1 + x2) / 2);
        const centerY = (y1 + y2) / 2;
        const size = gap; // Size of the connector square

        ctx.fillStyle = color;
        ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
    }


    function calculateArea(x, y, tooth) {
        const relativeX = x - tooth.x;
        const relativeY = y - tooth.y;

        if (tooth.type === 1) { // Type 1 teeth (rectangle in the center)
            // Central rectangle for Type 1
            if (relativeX > 13 && relativeX < 37 && relativeY > 23 && relativeY < 33) return 'O';

            // Determine other areas for Type 1
            if (relativeX > 13 && relativeX < 37 && relativeY <= 23) return 'T'; // Top
            if (relativeX > 13 && relativeX < 37 && relativeY >= 33) return 'B'; // Bottom
            if (relativeY > 23 && relativeY < 33 && relativeX <= 13) return 'L'; // Left
            if (relativeY > 23 && relativeY < 33 && relativeX >= 37) return 'R'; // Right
        } else if (tooth.type === 2) { // Type 2 teeth (square in the center)
            // Central square for Type 2
            if (relativeX > 13 && relativeX < 37 && relativeY > 13 && relativeY < 37) return 'O';

            // Determine other areas for Type 2
            if (relativeX > 13 && relativeX < 37 && relativeY <= 13) return 'T'; // Top
            if (relativeX > 13 && relativeX < 37 && relativeY >= 37) return 'B'; // Bottom
            if (relativeY > 13 && relativeY < 37 && relativeX <= 13) return 'L'; // Left
            if (relativeY > 13 && relativeY < 37 && relativeX >= 37) return 'R'; // Right
        }

        return null; // Ignore if not within any specified area
    }

    function getToothForRoot(x, y) {
        return teeth.find(tooth => {
            const relativeX = x - tooth.x;
            const relativeY = y - tooth.y;

            // Check for top row roots
            if (tooth.number >= 11 && tooth.number <= 28) {
                return (relativeX >= 0 && relativeX <= tooth.width && relativeY <= 0 && relativeY >= -tooth.height - 10);
            }

            // Check for bottom row roots
            if (tooth.number >= 31 && tooth.number <= 48) {
                return (relativeX >= 0 && relativeX <= tooth.width && relativeY >= tooth.height && relativeY <= tooth.height * 2.4);
            }

            return false; // Not in root area
        });
    }

    function calculateRootArea(x, y, tooth) {
        const relativeX = x - tooth.x;
        const relativeY = y - tooth.y;

        // Determine if the root is in the top or bottom row based on tooth number
        const isTopRoot = tooth.number >= 11 && tooth.number <= 28;
        const isBottomRoot = tooth.number >= 31 && tooth.number <= 48;

        // For top row roots
        if (isTopRoot) {
            if (relativeX >= 0 && relativeX <= tooth.width && relativeY <= 0 && relativeY >= -tooth.height - 10) {
                return 'Root';
            }
        }

        // For bottom row roots
        if (isBottomRoot) {
            if (relativeX >= 0 && relativeX <= tooth.width && relativeY >= tooth.height && relativeY <= tooth.height * 2.4) {
                return 'Root';
            }
        }

        return null; // Ignore if not within the root area
    }

    function getLabelArea(tooth, area) {
        if (tooth.number >= 11 && tooth.number <= 18) {
            switch (area) {
                case 'T':
                    dentalArea = 'B';
                    break;
                case 'R':
                    dentalArea = 'M';
                    break;
                case 'B':
                    dentalArea = 'P';
                    break;
                case 'L':
                    dentalArea = 'D';
                    break;
                case 'O':
                    dentalArea = 'O';
                    break;
            }
        } else if (tooth.number >= 21 && tooth.number <= 28) {
            switch (area) {
                case 'T':
                    dentalArea = 'B';
                    break;
                case 'R':
                    dentalArea = 'D';
                    break;
                case 'B':
                    dentalArea = 'P';
                    break;
                case 'L':
                    dentalArea = 'M';
                    break;
                case 'O':
                    dentalArea = 'O';
                    break;
            }
        } else if (tooth.number >= 41 && tooth.number <= 48) {
            switch (area) {
                case 'T':
                    dentalArea = 'P';
                    break;
                case 'R':
                    dentalArea = 'M';
                    break;
                case 'B':
                    dentalArea = 'B';
                    break;
                case 'L':
                    dentalArea = 'D';
                    break;
                case 'O':
                    dentalArea = 'O';
                    break;
            }
        } else if (tooth.number >= 31 && tooth.number <= 38) {
            switch (area) {
                case 'T':
                    dentalArea = 'P';
                    break;
                case 'R':
                    dentalArea = 'D';
                    break;
                case 'B':
                    dentalArea = 'B';
                    break;
                case 'L':
                    dentalArea = 'M';
                    break;
                case 'O':
                    dentalArea = 'O';
                    break;
            }
        }
        return dentalArea;
    }

    function getLabels(number) {
        let labels = {};
        if (number >= 11 && number <= 18) {
            labels = { T: 'B', R: 'M', B: 'P', L: 'D' };
        } else if (number >= 21 && number <= 28) {
            labels = { T: 'B', R: 'D', B: 'P', L: 'M' };
        } else if (number >= 41 && number <= 48) {
            labels = { T: 'P', R: 'M', B: 'B', L: 'D' };
        } else if (number >= 31 && number <= 38) {
            labels = { T: 'P', R: 'D', B: 'B', L: 'M' };
        }
        return labels;
    }

    function drawLabels(ctx, rectX, rectWidth, rectY, rectHeight, labels, x, width, y, height) {
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText('O', rectX + rectWidth / 2 - 3, rectY + rectHeight / 2 + 3);
        ctx.fillText(labels.T, x + width / 2 - 3, y + 10);
        ctx.fillText(labels.R, x + width - 10, y + height / 2 + 3);
        ctx.fillText(labels.B, x + width / 2 - 3, y + height - 2);
        ctx.fillText(labels.L, x + 2, y + height / 2 + 3);
    }

    function drawBMPDOAll(ctx, x, y, width, height, area, fillColor, strokeColor, toothType) {
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;

        // Define coordinates based on tooth type
        let centralX1, centralX2, centralY1, centralY2;
        if (toothType === 1) { // Type 1 teeth
            centralX1 = width * 0.25;
            centralX2 = width * 0.75;
            centralY1 = height * 0.35;
            centralY2 = height * 0.65;
        } else if (toothType === 2) { // Type 2 teeth
            centralX1 = width * 0.25;
            centralX2 = width * 0.75;
            centralY1 = height * 0.25;
            centralY2 = height * 0.75;
        }

        ctx.beginPath();
        switch (area) {
            case 'T': // Top
                ctx.moveTo(x, y); // Top-left corner
                ctx.lineTo(x + width, y); // Top-right corner
                ctx.lineTo(x + centralX2, y + centralY1); // Right corner of central area
                ctx.lineTo(x + centralX1, y + centralY1); // Left corner of central area
                ctx.closePath();
                break;
            case 'B': // Bottom
                ctx.moveTo(x, y + height); // Bottom-left corner
                ctx.lineTo(x + width, y + height); // Bottom-right corner
                ctx.lineTo(x + centralX2, y + centralY2); // Right corner of central area
                ctx.lineTo(x + centralX1, y + centralY2); // Left corner of central area
                ctx.closePath();
                break;
            case 'L': // Left
                ctx.moveTo(x, y); // Top-left corner
                ctx.lineTo(x, y + height); // Bottom-left corner
                ctx.lineTo(x + centralX1, y + centralY2); // Bottom corner of central area
                ctx.lineTo(x + centralX1, y + centralY1); // Top corner of central area
                ctx.closePath();
                break;
            case 'R': // Right
                ctx.moveTo(x + width, y); // Top-right corner
                ctx.lineTo(x + width, y + height); // Bottom-right corner
                ctx.lineTo(x + centralX2, y + centralY2); // Bottom corner of central area
                ctx.lineTo(x + centralX2, y + centralY1); // Top corner of central area
                ctx.closePath();
                break;
            case 'O': // Center
                ctx.rect(x + centralX1, y + centralY1, centralX2 - centralX1, centralY2 - centralY1);
                break;
        }
        ctx.fill();
        ctx.stroke();
    }

    function drawBMPDO(ctx, x, y, width, height, area, problemCode, instances, toothType) {
        const fillColor = problemCode.fillColor;
        const strokeColor = problemCode.strokeColor;
        const text = problemCode.text;
        const color = problemCode.color;
        const shape = problemCode.shape;
        let replace = false;
        if (problemCode.replace) { replace = true; }
        let charsize = 12; // Size of the character element
        if (text && text.length > 1) {
            charsize = 9;
        }
        const circlesize = 6; // Size of the circle element

        // Define area center based on area
        let centerX, centerY, isVertical;
        switch (area) {
            case 'T': // Top
                centerX = x + width / 2;
                centerY = (y + circlesize / 2) + 5;
                isVertical = false;
                break;
            case 'B': // Bottom
                centerX = x + width / 2;
                centerY = (y + height - circlesize / 2) - 2;
                isVertical = false;
                break;
            case 'L': // Left
                centerX = (x + circlesize / 2) + 2;
                centerY = y + height / 2;
                isVertical = true;
                break;
            case 'R': // Right
                centerX = (x + width - circlesize / 2) - 2;
                centerY = y + height / 2;
                isVertical = true;
                break;
            case 'O': // Center
                centerX = x + width / 2;
                centerY = y + height / 2;
                isVertical = false; // Default for 'O', adjust in layout logic
                break;
        }
        if (text && text.length > 1) { centerX = centerX - (text.length * 2); }

        // Helper function to get offsets
        function getOffsets(i, instances, size) {
            let offset;
            if (instances === 1) {
                offset = [0, 0];
            } else if (area === 'O' && instances === 3 && toothType === 2) {
                // Triangular arrangement for 'O' with 3 items
                const radius = 5; // Distance from center
                const angle = (Math.PI * 2 / 3) * i; // Angle for each point
                offset = [radius * Math.cos(angle), radius * Math.sin(angle)];
            } else {
                // Horizontal or vertical arrangement
                offset = (i - (instances - 1) / 2) * (size + 2);
                if (isVertical) {
                    return [0, offset]; // Vertical arrangement
                } else {
                    return [offset, 0]; // Horizontal arrangement
                }
            }
            return offset;
        }

        if (shape === 'circle') {
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            for (let i = 0; i < instances; i++) {
                let [offsetX, offsetY] = getOffsets(i, instances, circlesize);
                ctx.beginPath();
                ctx.arc(centerX + offsetX, centerY + offsetY, circlesize / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        } else if (shape === 'character') {
            ctx.fillStyle = color;
            ctx.font = `${charsize}px Arial`;
            for (let i = 0; i < instances; i++) {
                let [offsetX, offsetY] = getOffsets(i, instances, charsize);
                ctx.fillText(text, centerX + offsetX - charsize / 4, centerY + offsetY + charsize / 4);
            }
        }
    }

    function setActiveTab(tab) {
        activeTab = tab;
        drawItems();

        // Update tab button styles
        const buttons = document.querySelectorAll('#tabControls button');
        buttons.forEach(button => {
            if (button.innerText === activeTab) {
                button.style.backgroundColor = 'rgb(236, 234, 234)'; // Highlight active tab
                button.style.color = 'black'; // Set text color to ensure visibility
                //button.style.fontWeight = 'bold'; // Optionally, make the text bold
            } else {
                button.style.backgroundColor = ''; // Reset other tabs to default
                button.style.color = ''; // Reset text color
                button.style.fontWeight = ''; // Reset font weight
            }
        });
    }

    window.setActiveTab = setActiveTab;

    resizeCanvases();

});


