// import {Papa } from "./lib/papaparse.min.js";
// ===============================
// GLOBAL STATE
// ===============================
var angles = [0, -3.14/2, 3.14/2, 0, 0, 0];
var sensor_data = null;

// WebSocket state
let sensors = null;
let reconnectTimer = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 10000;
const wsUrl = "ws://127.0.0.1:9900";

// Logging state
let isLogging = false;
let logBuffer = [];

// ===============================
// SOCKET.IO (UNCHANGED)
// ===============================
const socket = io("http://127.0.0.1:4900");

// ===============================
// DOM ELEMENTS
// ===============================
const current_set_button = document.getElementById("current_set_button");
const voltage_set_button = document.getElementById("voltage_set_button");
const wfs_set_button = document.getElementById("wfs_set_button");
const logButton = document.getElementById("log_button");

const current_set_value = document.getElementById("current_set_value");
const voltage_set_value = document.getElementById("voltage_set_value");
const wfs_set_value = document.getElementById("wfs_set_value");

const current_data = document.getElementById("current_data");
const voltage_data = document.getElementById("voltage_data");
const wfs_data = document.getElementById("WFS_data");

const joint_values = document.querySelectorAll(".joint-angles");
const cart_values = document.querySelectorAll(".coordinates")
const jogButtons = document.querySelectorAll(".jog_buttons");
let activeJogAxis = jogButtons.length ? jogButtons[0].textContent.trim() : "Z";

const ctx = document.querySelector(".temp-display-canvas").getContext("2d");
const temp_label = document.getElementById("temp_label");

// ===============================
// CHART SETUP
// ===============================
const MAX_POINTS = 16;

const chartData = {
    labels: [],
    datasets: [
        { label: "T1", data: [], borderWidth: 2 },
        { label: "T2", data: [], borderWidth: 2 },
        { label: "T3", data: [], borderWidth: 2 },
        { label: "T4", data: [], borderWidth: 2 }
    ]
};

const tempChart = new Chart(ctx, {
    type: "line",
    data: chartData,
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { type: "linear", title: { display: true, text: "Time (s)" } },
            y: { title: { display: true, text: "Temperature" } }
        },
        plugins: { legend: { display: true } }
    }
});

// ===============================
// WEBSOCKET CONNECTION
// ===============================
const torch_on = 0;
let time = 0;
function connectSensors() {
    console.log("Connecting to sensor WebSocket...");

    sensors = new WebSocket(wsUrl);

    sensors.onopen = () => {
        console.log("Sensor WebSocket connected");
        reconnectDelay = 1000;
    };

    sensors.onmessage = (event) => {
        sensor_data = JSON.parse(event.data);
        // console.log("Received sensor data:", sensor_data);

        // UI updates
        current_data.textContent = sensor_data.C;
        voltage_data.textContent = sensor_data.V;
        wfs_data.textContent = sensor_data.E;

        chartData.labels.push(sensor_data["Time(S)"]);

        const avgTemp = Math.round(
            (sensor_data.T1 + sensor_data.T2 + sensor_data.T3 + sensor_data.T4) / 4
        );
        temp_label.textContent = avgTemp;

        chartData.datasets[0].data.push(sensor_data.T1);
        chartData.datasets[1].data.push(sensor_data.T2);
        chartData.datasets[2].data.push(sensor_data.T3);
        chartData.datasets[3].data.push(sensor_data.T4);

        if (chartData.labels.length > MAX_POINTS) {
            chartData.labels.shift();
            chartData.datasets.forEach(ds => ds.data.shift());
        }

        tempChart.update("none");

        // Logging
        if (isLogging) {
            time = logBuffer.length + 1; // simple incremental time for x-axis in CSV
            logBuffer.push([
                new Date().toISOString(),
                sensor_data.T1,
                sensor_data.T2,
                sensor_data.T3,
                sensor_data.T4,
                sensor_data.E,
                sensor_data.V,
                sensor_data.C,
                torch_on,
                time
            ]);
        }
    };

    sensors.onclose = () => {
        console.warn("Sensor WebSocket disconnected");
        scheduleReconnect();
    };

    sensors.onerror = () => {
        sensors.close();
    };
}

function scheduleReconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        connectSensors();
    }, reconnectDelay);
}

connectSensors();

// ===============================
// SAFE COMMAND SENDER
// ===============================
function sendCommand(cmd) {
    if (sensors && sensors.readyState === WebSocket.OPEN) {
        sensors.send(cmd.endsWith("\n") ? cmd : cmd + "\n");
    }
}

// ===============================
// BUTTON HANDLERS
// ===============================
voltage_set_button.addEventListener("click", () => {
    sendCommand(`s 1 ${voltage_set_value.value}`);
});

current_set_button.addEventListener("click", () => {
    sendCommand(`s 2 ${current_set_value.value}`);
});

wfs_set_button.addEventListener("click", () => {
    sendCommand(`s 3 ${wfs_set_value.value}`);
});

// ===============================
// LOGGING TOGGLE
// ===============================
logButton.addEventListener("click", () => {
    if (!isLogging) {
        isLogging = true;
        logBuffer = [];
        logButton.textContent = "Stop Logging";
        console.log("Logging started");
    } else {
        isLogging = false;
        logButton.textContent = "Start Logging";
        console.log("Logging stopped");
        exportCSV();
    }
});

// ===============================
// CSV EXPORT
// ===============================
function exportCSV() {
    if (logBuffer.length === 0) return;

    const header = ["timestamp", "T1", "T2", "T3", "T4", "E", "V", "C", "Torch-on", "time"];
    const rows = [header, ...logBuffer];
    const csv = rows.map(r => r.join(",")).join("\n");

    // pywebview-safe file save
    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.save_csv(csv);
    } else {
        // fallback for real browsers
        browserDownload(csv);
    }
}

function browserDownload(csv) {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    console.log("Generated CSV URL:", url);
    openPlot(url);

    const a = document.createElement("a");
    a.href = url;
    a.download = `sensor_log_${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
}
// const url2 = "./sensor_log_1774515236476.csv";
function openPlot(url) {
    Papa.parse(url, {
        download: true,
        header: true,
        dynamicTyping: true,
        beforeFirstChunk: function () {
            console.log("Fetching data...");
        },


        complete: function (results) {
            const plotWindow = window.open('graph');

            window.addEventListener('message', (event) => {
                if (event.data === 'GRAPH_READY') {
                    plotWindow.postMessage({
                        type: 'INITIAL_DATA',
                        payload: results.data
                    }, '*');
                }
            }, { once: true });
        },

        error: function (error) {
            console.error("Error parsing remote file:", error);
        }
    });
}

// ===============================
// SOCKET.IO EVENTS (UNCHANGED)
// ===============================
socket.on("connect", () => {
    socket.emit("start_stream");
    console.log("Connected to backend");
});

socket.on("joint_angles", (angles2) => {
    angles = angles2;
    for (let i = 0; i < angles.length; i++) {
        joint_values[i].value = (angles[i] * 57.2957795).toFixed(2);
    }
});

socket.on("cartesian_coords", (coords) => {
    for (let i = 0; i < coords.length; i++) {
        cart_values[i].value = Number(coords[i]).toFixed(2);
    }
});

const plus_button = document.querySelector(".plus")
const minus_button = document.querySelector(".minus")

function setActiveJogButton(button) {
    jogButtons.forEach(btn => btn.classList.remove("active-jog"));
    button.classList.add("active-jog");
    activeJogAxis = button.dataset.axis || button.textContent.trim();
}

jogButtons.forEach(button => {
    button.dataset.axis = button.textContent.trim();
    button.addEventListener("click", () => setActiveJogButton(button));
});

if (jogButtons.length) {
    setActiveJogButton(jogButtons[0]);
}

const emitJogStart = (direction) => {
    let payload = {
        axis: activeJogAxis,
        direction,
        step: 1
    }
    console.log(payload)
    socket.emit("jog_start", payload)
}

const emitJogStop = () => socket.emit("jog_stop")

plus_button.addEventListener("mousedown", () => emitJogStart(1))

plus_button.addEventListener("mouseup", emitJogStop)
// plus_button.addEventListener("mouseleave", emitJogStop)
// plus_button.addEventListener("mouseleave", ()=>{
//     socket.emit("jog_stop")
// })

minus_button.addEventListener("mousedown", () => emitJogStart(-1))

minus_button.addEventListener("mouseup", emitJogStop)
// minus_button.addEventListener("mouseleave", emitJogStop)
// minus_button.addEventListener("mouseleave", ()=>{
//     socket.emit("jog_stop")
// })
// ===============================
// EXPORTS
// ===============================
export { angles, sensor_data, socket };
