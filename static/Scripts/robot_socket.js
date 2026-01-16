// import { setJointAngles } from "./kuka_comm.js";
var angles = [0, 0, 0, 0, 0, 0]
var sensor_data
const socket = io("http://192.168.0.100:4900");
const wsUrl = "ws://192.168.0.100:9900";
const sensors = new WebSocket(wsUrl);

const current_data = document.getElementById("current_data")
const voltage_data = document.getElementById("voltage_data")
const wfs_data = document.getElementById("WFS_data")

const joint_values = document.querySelectorAll(".joint-angles")
const MAX_POINTS = 16

const ctx = document.querySelector(".temp-display-canvas").getContext('2d')
const temp_label = document.getElementById("temp_label")

const chartData = {
    labels: [],
    datasets: [
        { label: 'T1', data: [], borderWidth: 2 },
        { label: 'T2', data: [], borderWidth: 2 },
        { label: 'T3', data: [], borderWidth: 2 },
        { label: 'T4', data: [], borderWidth: 2 }
    ]
};

const tempChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'linear',
                title: { display: true, text: 'Time (s)' }
            },
            y: {
                title: { display: true, text: 'Temperature' }
            }
        },
        plugins: {
            legend: { display: true }
        }
    }
});


sensors.onmessage = (event) => {
    sensor_data = JSON.parse(event.data);
    // console.log(sensor_data)
    current_data.textContent = sensor_data["C"]
    voltage_data.textContent = sensor_data["V"]
    wfs_data.textContent = sensor_data["E"]

    // Add x-axis label (time or index)
    chartData.labels.push(sensor_data["Time(S)"]);
    var average = Math.round((sensor_data.T1 + sensor_data.T2 + sensor_data.T3 + sensor_data.T4)/4)
    temp_label.textContent = average
    chartData.datasets[0].data.push(sensor_data.T1);
    chartData.datasets[1].data.push(sensor_data.T2);
    chartData.datasets[2].data.push(sensor_data.T3);
    chartData.datasets[3].data.push(sensor_data.T4);

    // Enforce rolling window
    if (chartData.labels.length > MAX_POINTS) {
        chartData.datasets.forEach(ds => ds.data.shift());
        chartData.labels.shift();
    }

    tempChart.update('none'); // no animation for real-time

}

// When socket connects, tell backend to start streaming
socket.on("connect", () => {
    socket.emit("start_stream");
    console.log("Connected to backend");
});

// Receive angles and update robot model
socket.on("joint_angles", (angles2) => {
    // angles is already in radians from backend
    // console.log(angles)
    angles = angles2;
    for (let index = 0; index < angles.length; index++) {
        joint_values[index].value = angles[index];
        
    }
});

export {angles, sensor_data}
