const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const kurtosisDisp = document.getElementById("kurtosis");
const ampKurtToggleBtn = document.getElementById('kurtosisBtn');

// Set internal canvas resolution
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

const audioLength = 10;
const kurtoses = [];
let drawMode = "kurt";

function initPlotterListener() {
    console.log("Initializing audio plotter event listener...");

    window.addEventListener('ws-plot-data', (event) => {
        const { audio, kurtosis } = event.detail;

        const data = new Int16Array(audio);
        const kurtosisValue = new Float32Array([kurtosis]);
        
        kurtosisDisp.innerText = kurtosisValue[kurtosisValue.length - 1].toFixed(3);

        if (drawMode == "kurt") {
            kurtoses.push(kurtosisValue);

            while (kurtoses.length > audioLength) {
                kurtoses.shift();
            }
            
            draw(kurtoses, 10);
            // console.log("kurt");
            // console.log(kurtoses.length);
        } 
        else if (drawMode == "amp") {
            draw(data, 50000);
            // console.log("amp");
            // console.log(data.length);
        }
    });
}


function draw(data, scale_divisor) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Center Line (X-Axis)
    ctx.strokeStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Draw Waveform
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#00ffcc'; // Cyan wave
    ctx.lineJoin = 'round';

    const sliceWidth = canvas.width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
        // Normalize 16-bit int (-32768 to 32767) to canvas height
        // const amplitude = data[i] /5120;
        const amplitude = data[i];
        const y = ((amplitude / scale_divisor ) * (canvas.height / 2)) + (canvas.height / 2);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
    }

    ctx.stroke();
}

initPlotterListener();

// Handle window resizing
window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
});

ampKurtToggleBtn.addEventListener("click", function(event) {
  
 if (drawMode=="kurt"){
    drawMode="amp";
    ampKurtToggleBtn.textContent = "View Kurtosis"
 }
 else if (drawMode=="amp"){
    drawMode="kurt";
    ampKurtToggleBtn.textContent = "View Amplitude";
 }
});