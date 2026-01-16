#!/usr/bin/env python3
import socket
from collections import deque
import time
import numpy
import math


ROBOT_IP = '172.31.1.147'
KVP_JOINT_COMMAND_VARIABLE = 'COM_E6AXIS'
KVP_LIN_COMMAND_VARIABLE = 'WAAM_POS'
KVP_ROBOT_POSITION_VARIABLE = '$POS_ACT'
KVP_PROGRAM_SPEED_VARIABLE = '$OV_PRO' # Percentage of maximum speed
KVP_LINEAR_VELOCITY_VARIABLE = 'WAAM_VEL'
KVP_LINEAR_ACCELERATION_VARIABLE = 'WAAM_ACC'

SEND_DELAY = 0.8 # seconds
ACCEPTABLE_ERROR = 0.01 # mm

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)		# Initializing client connection

  
class KUKA(object):

    def __init__(self, TCP_IP):
        try: 
            client.connect((TCP_IP, 7000))                      # Open socket. kukavarproxy actively listens on TCP port 7000
        except: 
            self.error_list(1)


    def send (self, var, val, msgID):
        """
        kukavarproxy message format is 
        msg ID in HEX                       2 bytes
        msg length in HEX                   2 bytes
        read (0) or write (1)               1 byte
        variable name length in HEX         2 bytes
        variable name in ASCII              # bytes
        variable value length in HEX        2 bytes
        variable value in ASCII             # bytes
        """
        try:
            msg = bytearray()
            temp = bytearray()
            if val != "":
                val = str(val)
                msg.append((len(val) & 0xff00) >> 8)            # MSB of variable value length
                msg.append((len(val) & 0x00ff))                 # LSB of variable value length
                msg.extend(map(ord, val))                       # Variable value in ASCII
            temp.append(bool(val))                              # Read (0) or Write (1)
            temp.append(((len(var)) & 0xff00) >> 8)             # MSB of variable name length
            temp.append((len(var)) & 0x00ff)                    # LSB of variable name length
            temp.extend(map(ord, var))                          # Variable name in ASCII 
            msg = temp + msg
            del temp[:]
            temp.append((msgID & 0xff00) >> 8)                  # MSB of message ID
            temp.append(msgID & 0x00ff)                         # LSB of message ID
            temp.append((len(msg) & 0xff00) >> 8)               # MSB of message length
            temp.append((len(msg) & 0x00ff))                    # LSB of message length
            msg = temp + msg
        except :
            self.error_list(2)
        try:
            client.send(msg)
            return  client.recv(1024)                           # Return response with buffer size of 1024 bytes
        except :
            self.error_list(1)


    def __get_var(self, msg):
        """
        kukavarproxy response format is 
        msg ID in HEX                       2 bytes
        msg length in HEX                   2 bytes
        read (0) or write (1)               1 byte
        variable value length in HEX        2 bytes
        variable value in ASCII             # bytes
        Not sure if the following bytes contain the client number, or they're just check bytes. I'll check later.
        """
        try:
            lsb = int( msg[5])
            msb = int( msg[6])
            lenValue = (lsb <<8 | msb)
            return str(msg [7: 7+lenValue],'utf-8')  

        except:
            self.error_list(2)

    def read (self, var, msgID=0):
        try:
            return self.__get_var(self.send(var,"",msgID))  
        except :
            self.error_list(2)


    def write (self, var, val, msgID=0):
        try:
            if val != (""): return self.__get_var(self.send(var,val,msgID))
            else: raise self.error_list(3)
        except :
            self.error_list(2)


    def disconnect (self):
            # CLose socket
            client.close()


    def error_list (self, ID):
        if ID == 1:
            print ("Network Error (tcp_error)")
            print ("    Check your KRC's IP address on the network, and make sure the KVP Server is running.")
            # self.disconnect()
            # raise ConnectionError("Failed to connect to robot \n Check the network you are on")
        elif ID == 2:
            print ("Python Error.")
            print ("    Update your python version >= 3.8.x.")
            # self.disconnect()
            # raise SystemExit
        elif ID == 3:
            print ("Error in write() statement.")
            print ("    Variable value is not defined.")
    


def format_joint_states(joint_states: list):
    
    if joint_states:
        a1 = joint_states[0]
        a2 = joint_states[1]
        a3 = joint_states[2]
        a4 = joint_states[3]
        a5 = joint_states[4]
        a6 = joint_states[5]
        
        formatted_joint_state = "{E6AXIS: A1 " + f"{a1}," + " A2 " + f"{a2}," + " A3 "+f"{a3}," + " A4 " + f"{a4}," + " A5 " + f"{a5}," + " A6 " + f"{a6}," + " E1 0.0, E2 0.0, E3 0.0, E4 0.0, E5 0.0, E6 0.0}"
        
        return formatted_joint_state

    else:
        print("No data")



def radians_to_degrees(joint_states: list):
    degrees_list = []
    
    for index, i in enumerate(joint_states):
        degrees_list.append(round(i * 57.2957795, 6))
        
    return degrees_list



#robot = KUKA(ROBOT_IP)

#while True:
#     print(robot.read("$AXIS_ACT"))
    

        
