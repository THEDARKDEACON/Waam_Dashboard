import eventlet
eventlet.monkey_patch()

import io
import zipfile
import math
import threading
import time
from pathlib import Path

from flask import Flask, render_template, request, send_file, jsonify
from flask_socketio import SocketIO
from gcode_pipeline import clean_and_transpile
from kuka import KUKA, ROBOT_IP
from jogProducer import JogProducer

# ---------------- Robot Init ----------------
robot = None


def get_robot():
    global robot
    if robot is None:
        robot = KUKA(ROBOT_IP)
    return robot

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


@app.route("/api/gcode", methods=["POST"])
def upload_gcode():
    uploaded = request.files.get("file")
    if not uploaded:
        return jsonify({"error": "no file uploaded"}), 400

    raw_text = uploaded.read().decode("utf-8", errors="replace")
    candidate_name = Path(uploaded.filename or "").stem
    program_name = (candidate_name or "WAAM_PART").upper()

    result = clean_and_transpile(raw_text, program_name=program_name)

    archive = io.BytesIO()
    program_base = result["program_name"]
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr(f"{program_base}.src", result["src"])
        zf.writestr(f"{program_base}.dat", result["dat"])

    archive.seek(0)
    return send_file(
        archive,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{program_base}_krl.zip"
    )

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
            current_robot = get_robot()
            msg = current_robot.read("$AXIS_ACT")
            angles = parse_kuka_joints(msg)
            socketio.emit("joint_angles", angles)
        except ConnectionError as exc:
            print("Robot stream connection lost:", exc)
            time.sleep(1)
            continue
        except Exception as e:
            print("Robot read error:", e)
            time.sleep(0.1)
            continue
        time.sleep(0.05)

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
    try:
        current_robot = get_robot()
        current_robot.write("gMode", 1)
        current_robot.write("gJogAxis", axis_map[data["axis"]])
        current_robot.write("gJogDir", int(data["direction"]))
    except ConnectionError as exc:
        print("Jog start failed:", exc)
    # robot.write("gJogStep", float(data["step"]))
    # robot.write("gJogSpeed", float(data["speed"]))
    

@socketio.on("jog_stop")
def jog_stop():
    print("sending stop signal")
    try:
        current_robot = get_robot()
        current_robot.write("gJogDir", 0)
    except ConnectionError as exc:
        print("Jog stop failed:", exc)

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

    try:
        current_robot = get_robot()
        current_robot.write("gMode", 2)
        current_robot.write("gBatchSize", batch_size)

        for i, p in enumerate(points, start=1):
            kuka_pos = (
                f"{{X {p['X']},Y {p['Y']},Z {p['Z']},"
                f"A {p['A']},B {p['B']},C {p['C']}}}"
            )
            current_robot.write(f"gBatch[{i}]", kuka_pos)

        current_robot.write("gNewBatch", True)

        # Wait for robot to finish
        while True:
            done = current_robot.read("gProgramDone")
            if done == "TRUE":
                break
            time.sleep(0.1)

        current_robot.write("gNewBatch", False)
        current_robot.write("gMode", 1)

        socketio.emit("program_done")
    except ConnectionError as exc:
        print("Run program failed:", exc)
    except Exception as exc:
        print("Unexpected error during run_program:", exc)

# ---------------- Main ----------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=4900, debug=False, use_reloader=False)
