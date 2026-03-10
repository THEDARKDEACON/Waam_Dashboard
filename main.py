import eventlet
eventlet.monkey_patch()

import math
import threading
import time
from flask import Flask, render_template
from flask_socketio import SocketIO
from kuka import KUKA, ROBOT_IP
from jogProducer import JogProducer

# ---------------- Robot Init ----------------
robot = KUKA(ROBOT_IP)

# ---------------- Flask Init ----------------
app = Flask(
    __name__,
    static_folder="./static",
    template_folder="./templates"
)

socketio = SocketIO(app, cors_allowed_origins="*")

@app.route("/")
def index():
    return render_template("main.html")

# ---------------- Helpers ----------------
def parse_kuka_joints(msg):
    data = {}
    parts = msg.replace("{", "").replace("}", "").replace("E6AXIS:", "").split(",")

    for p in parts:
        p = p.strip()
        if p.startswith("A"):
            key, val = p.split(" ")
            data[key] = float(val)

    return [math.radians(data[f"A{i}"]) for i in range(1, 7)]

# ---------------- Robot State Stream ----------------
def stream_joint_states():
    while True:
        try:
            msg = robot.read("$AXIS_ACT")
            angles = parse_kuka_joints(msg)
            socketio.emit("joint_angles", angles)
        except Exception as e:
            print("Robot read error:", e)
        # time.sleep(0.05)

# ---------------- Socket.IO Events ----------------
@socketio.on("connect")
def on_connect():
    print("Frontend connected")

@socketio.on("start_stream")
def start_stream():
    socketio.start_background_task(stream_joint_states)

# ---------------- Jog Control ----------------
@socketio.on("jog_start")
def jog_start(data):
    """
    data = {
      axis: "J1" | "Z" | ...
      direction: +1 | -1
      step: 0.01
    }
    """
    axis_map = {
        "J1": 1, "J2": 2, "J3": 3, "J4": 4, "J5": 5, "J6": 6,
        "X": 101, "Y": 102, "Z": 103, "A": 104, "B": 105, "C": 106
    }
    print("writing data ", data)
    robot.write("gMode", 1)
    robot.write("gJogAxis", axis_map[data["axis"]])
    robot.write("gJogDir", int(data["direction"]))
    # robot.write("gJogStep", float(data["step"]))
    # robot.write("gJogSpeed", float(data["speed"]))
    

@socketio.on("jog_stop")
def jog_stop():
    print("sending stop signal")
    robot.write("gJogDir", 0)

# jogger = JogProducer(robot)

# @socketio.on("jog_start")
# def jog_start(data):
#     jogger.start(
#         axis=data["axis"],     # "X", "Y", "Z", ...
#         direction=data["dir"]  # +1 or -1
#     )

# @socketio.on("jog_stop")
# def jog_stop():
#     jogger.stop()


# ---------------- Program Execution ----------------
@socketio.on("run_program")
def run_program(data):
    """
    data = [
      {X,Y,Z,A,B,C},
      {X,Y,Z,A,B,C},
      ...
    ]
    """
    points = data
    batch_size = len(points)

    robot.write("gMode", 2)
    robot.write("gBatchSize", batch_size)

    for i, p in enumerate(points, start=1):
        kuka_pos = (
            f"{{X {p['X']},Y {p['Y']},Z {p['Z']},"
            f"A {p['A']},B {p['B']},C {p['C']}}}"
        )
        robot.write(f"gBatch[{i}]", kuka_pos)

    robot.write("gNewBatch", True)

    # Wait for robot to finish
    while True:
        done = robot.read("gProgramDone")
        if done == "TRUE":
            break
        time.sleep(0.1)

    robot.write("gNewBatch", False)
    robot.write("gMode", 1)

    socketio.emit("program_done")

# ---------------- Main ----------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=4900, debug=True)
