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
from kuka import KUKA, ROBOT_IP, parse_kuka_coords, parse_kuka_joints
from jogProducer import JogProducer

# ---------------- Robot Init ----------------
robot = None
toolpath_segments = []


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

robot_online = False
current_admin_sid = None
pending_admin_request = None

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
    global toolpath_segments
    toolpath_segments = result.get("segments", [])
    print(toolpath_segments)
    
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


@app.route("/api/toolpath")
def get_toolpath():
    if not toolpath_segments:
        return jsonify({"error": "no toolpath generated"}), 404
    return jsonify(toolpath_segments)


def broadcast_admin_state():
    socketio.emit("admin_update", {
        "admin_sid": current_admin_sid,
        "pending_sid": pending_admin_request
    })


def update_robot_status(online: bool):
    global robot_online
    if robot_online != online:
        robot_online = online
        socketio.emit("robot_status", {"online": robot_online})


def has_admin_access(sid: str) -> bool:
    return current_admin_sid is None or current_admin_sid == sid

# ---------------- Robot State Stream ----------------
def stream_joint_states():
    while True:
        try:
            current_robot = get_robot()
            msg = current_robot.read("$AXIS_ACT")
            cart = current_robot.read("$POS_ACT")
            angles = parse_kuka_joints(msg)
            coords = parse_kuka_coords(cart)
            socketio.emit("joint_angles", angles)
            socketio.emit("cartesian_coords", coords)
            update_robot_status(True)
        except ConnectionError as exc:
            print("Robot stream connection lost:", exc)
            update_robot_status(False)
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
    print("robot status: ", robot_online)
    socketio.emit("robot_status", {"online": robot_online})
    broadcast_admin_state()

@socketio.on("start_stream")
def start_stream():
    socketio.start_background_task(stream_joint_states)


@socketio.on("disconnect")
def on_disconnect():
    global current_admin_sid, pending_admin_request
    sid = request.sid
    if sid == current_admin_sid:
        current_admin_sid = None
        pending_admin_request = None
        broadcast_admin_state()
    elif sid == pending_admin_request:
        pending_admin_request = None
        broadcast_admin_state()


@socketio.on("request_admin")
def request_admin():
    global current_admin_sid, pending_admin_request
    print("Admin access requested by", request.sid)
    sid = request.sid
    if current_admin_sid in (None, sid):
        current_admin_sid = sid
        pending_admin_request = None
        broadcast_admin_state()
        socketio.emit("admin_granted", to=sid)
    else:
        if pending_admin_request == sid:
            return
        pending_admin_request = sid
        socketio.emit("admin_relinquish_request", {"requester_sid": sid}, to=current_admin_sid)
        socketio.emit("admin_request_pending", to=sid)
        broadcast_admin_state()


@socketio.on("release_admin")
def release_admin():
    global current_admin_sid, pending_admin_request
    if request.sid != current_admin_sid:
        return
    current_admin_sid = None
    pending_admin_request = None
    broadcast_admin_state()
    socketio.emit("admin_released")


@socketio.on("admin_relinquish_response")
def admin_relinquish_response(data):
    global current_admin_sid, pending_admin_request
    if request.sid != current_admin_sid:
        return
    accept = data.get("accept") is True
    if accept and pending_admin_request:
        current_admin_sid = pending_admin_request
        pending_admin_request = None
        broadcast_admin_state()
        socketio.emit("admin_granted", to=current_admin_sid)
    else:
        if pending_admin_request:
            socketio.emit("admin_request_denied", to=pending_admin_request)
        pending_admin_request = None
        broadcast_admin_state()

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
    if not has_admin_access(request.sid):
        socketio.emit("admin_denied", {"message": "Claim admin to jog"}, to=request.sid)
        return

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
    if not has_admin_access(request.sid):
        socketio.emit("admin_denied", {"message": "Claim admin to jog"}, to=request.sid)
        return
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
        
# ---------------- Program Execution ----------------
@socketio.on("run_program_local")
def run_program_local():
    """
    data = [
      {X,Y,Z,A,B,C},
      {X,Y,Z,A,B,C},
      ...
    ]
    """
    
    if len(toolpath_segments) == 0:
        return
    
    for segment in toolpath_segments:
        torch_state = segment["torch_state"]
        points = segment["points"]
    
        batch_size = len(points)

        try:
            current_robot = get_robot()
            current_robot.write("gMode", 2)
            current_robot.write("gBatchSize", batch_size)

            for i, p in enumerate(points, start=1):
                kuka_pos = (
                    f"{{X {p[0]},Y {p[1]},Z {p[2]},"
                    f"A 0,B 0,C 0}}"
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
    socketio.run(app, host="0.0.0.0", port=4900, debug=True, use_reloader=True)
