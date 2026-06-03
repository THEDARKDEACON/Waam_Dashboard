const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const kurtosisDisp = document.getElementById("kurtosis");
const ampKurtToggleBtn = document.getElementById('kurtosisBtn');

// Set internal canvas resolution
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// WebSocket setup
const socket = new WebSocket('ws://192.168.0.100:10000');
socket.binaryType = 'arraybuffer';

socket.onopen =() =>{
    console.log("connected to audio");
}

const audioLength = 10
const kurtoses = []
let drawMode="kurt";
socket.onmessage = (event) => {
    // Use Int16Array if your Python backend sends 16-bit PCM
    // Use Float32Array if your backend sends normalized floats

    const data = new Int16Array(JSON.parse(event.data).audio);
    const kurtosisValue = new Float32Array([JSON.parse(event.data).kurtosis]);
    kurtosisDisp.innerText = kurtosisValue[kurtosisValue.length - 1].toFixed(3);

    if (drawMode=="kurt"){
        kurtoses.push(kurtosisValue)

        if(kurtoses.length > audioLength){
            kurtoses.shift()
        }
        
        draw(kurtoses, 10);
    }

    else if (drawMode=="amp"){
        
        draw(data, 250);
    }

    
};

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

// Handle window resizing
window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
});

ampKurtToggleBtn.addEventListener("click", function(event) {
  
 if (drawMode=="kurt"){
    drawMode="amp";
 }
 else if (drawMode=="amp"){
    drawMode="kurt";
 }
});