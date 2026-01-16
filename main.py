import eventlet
eventlet.monkey_patch()
import os
import math
import webview
from flask import Flask, render_template
from flask_socketio import SocketIO
from kuka import KUKA, ROBOT_IP
try:
    robot = KUKA(ROBOT_IP)  
    
except Exception as e:
    print("failed to connet to robot")
    
    
app = Flask(
    __name__,
    static_folder="./static",
    template_folder="./templates"
)

# ---- Your existing route ----
@app.route("/")
def index():
    return render_template("main.html")

# ---- Add Socket.IO ----
socketio = SocketIO(app, cors_allowed_origins="*")

def parse_kuka_joints(msg):
    data = {}
    parts = msg.replace("{", "").replace("}", "").replace("E6AXIS:", "").split(",")

    for p in parts:
        p = p.strip()
        if p.startswith("A"):
            key, val = p.split(" ")
            data[key] = float(val)

    return [
        math.radians(data["A1"]),
        math.radians(data["A2"]),
        math.radians(data["A3"]),
        math.radians(data["A4"]),
        math.radians(data["A5"]),
        math.radians(data["A6"]),
    ]

# --- Socket Events ---
@socketio.on("connect")
def on_connect():
    print("Frontend connected")

@socketio.on("start_stream")
def start_stream():
    print("Streaming started")
    while True:
        try:
            msg = robot.read("$AXIS_ACT")
            angles = parse_kuka_joints(msg)
            socketio.emit("joint_angles", angles)
            socketio.sleep(0.05)  # 20 Hz
            # socketio.sleep(0.05)  # 20 Hz
        except Exception as e:
            print("error occured")
            msg = "{E6AXIS: A1 31.0180302, A2 -92.2673, A3 108.684845, A4 38.5819244, A5 -18.3371429, A6 -219.491379, E1 0.0, E2 0.0, E3 0.0, E4 0.0, E5 0.0, E6 0.0}"
            # robot = KUKA(ROBOT_IP)
            angles = parse_kuka_joints(msg)
            socketio.emit("joint_angles", angles)
            socketio.sleep(5) 

# ---- Run server with SocketIO instead of app.run ----
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=4900, debug=True)
