#!/usr/bin/env python3
import socket
import threading
import time

ROBOT_IP = '172.31.1.147'
KVP_JOINT_COMMAND_VARIABLE = 'COM_E6AXIS'
KVP_LIN_COMMAND_VARIABLE = 'WAAM_POS'
KVP_ROBOT_POSITION_VARIABLE = '$POS_ACT'
KVP_PROGRAM_SPEED_VARIABLE = '$OV_PRO'
KVP_LINEAR_VELOCITY_VARIABLE = 'WAAM_VEL'
KVP_LINEAR_ACCELERATION_VARIABLE = 'WAAM_ACC'

SEND_DELAY = 0.8
ACCEPTABLE_ERROR = 0.01
KUKA_PORT = 7000
BUFFER_SIZE = 1024
MAX_RETRIES = 3
RETRY_DELAY = 1.0


class KUKA(object):

    def __init__(self, TCP_IP, port=KUKA_PORT, timeout=5.0):
        self.tcp_ip = TCP_IP
        self.port = port
        self.timeout = timeout
        self.sock = None
        self._lock = threading.Lock()
        self.connect()

    def connect(self):
        self.handle_disconnect()
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                sock = socket.create_connection((self.tcp_ip, self.port), timeout=self.timeout)
                sock.settimeout(self.timeout)
                self.sock = sock
                print(f"KUKA connected to {self.tcp_ip}:{self.port} (attempt {attempt})")
                return
            except (socket.error, OSError) as exc:
                print(f"KUKA connection attempt {attempt} failed", exc)
                time.sleep(RETRY_DELAY)
        self.error_list(1)

    def handle_disconnect(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        self.sock = None

    def ensure_connected(self):
        if self.sock is None:
            self.connect()

    def _build_message(self, var, val, msgID):
        msg = bytearray()
        temp = bytearray()
        if val != "":
            val = str(val)
            msg.append((len(val) & 0xff00) >> 8)
            msg.append((len(val) & 0x00ff))
            msg.extend(map(ord, val))
        temp.append(bool(val))
        temp.append(((len(var)) & 0xff00) >> 8)
        temp.append((len(var)) & 0x00ff)
        temp.extend(map(ord, var))
        msg = temp + msg
        del temp[:]
        temp.append((msgID & 0xff00) >> 8)
        temp.append(msgID & 0x00ff)
        temp.append((len(msg) & 0xff00) >> 8)
        temp.append((len(msg) & 0x00ff))
        return temp + msg

    def send(self, var, val, msgID):
        request = self._build_message(var, val, msgID)
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                with self._lock:
                    self.ensure_connected()
                    self.sock.sendall(request)
                    response = self.sock.recv(BUFFER_SIZE)
                    if not response:
                        raise ConnectionError("Empty response from KUKA")
                    return response
            except (socket.error, ConnectionError, OSError) as exc:
                print(f"KUKA send failed on attempt {attempt}", exc)
                self.handle_disconnect()
                if attempt == MAX_RETRIES:
                    raise ConnectionError("Failed to send message to KUKA") from exc
                time.sleep(RETRY_DELAY)

    def __get_var(self, msg):
        try:
            lsb = int(msg[5])
            msb = int(msg[6])
            lenValue = (lsb << 8 | msb)
            return str(msg[7: 7 + lenValue], 'utf-8')
        except Exception as exc:
            print("Failed to parse KUKA response", exc)
            self.error_list(2)

    def read(self, var, msgID=0):
        return self.__get_var(self.send(var, "", msgID))

    def write(self, var, val, msgID=0):
        if val == "":
            self.error_list(3)
        return self.__get_var(self.send(var, val, msgID))

    def disconnect(self):
        self.handle_disconnect()

    def error_list(self, ID):
        if ID == 1:
            msg = "Network Error (tcp_error): check the robot IP and ensure the KVP server is running."
            print(msg)
            self.handle_disconnect()
            raise ConnectionError(msg)
        elif ID == 2:
            msg = "Python Error when parsing KUKA response. Update to Python >= 3.8."
            print(msg)
            raise RuntimeError(msg)
        elif ID == 3:
            msg = "Error in write() statement: variable value is not defined."
            print(msg)
            raise ValueError(msg)


def format_joint_states(joint_states: list):
    if joint_states:
        a1 = joint_states[0]
        a2 = joint_states[1]
        a3 = joint_states[2]
        a4 = joint_states[3]
        a5 = joint_states[4]
        a6 = joint_states[5]

        formatted_joint_state = (
            "{E6AXIS: A1 " + f"{a1}," + " A2 " + f"{a2}," + " A3 " + f"{a3}," + " A4 " + f"{a4},"
            + " A5 " + f"{a5}," + " A6 " + f"{a6}," + " E1 0.0, E2 0.0, E3 0.0, E4 0.0, E5 0.0, E6 0.0}"
        )

        return formatted_joint_state

    else:
        print("No data")


def radians_to_degrees(joint_states: list):
    degrees_list = []

    for index, i in enumerate(joint_states):
        degrees_list.append(round(i * 57.2957795, 6))

    return degrees_list
