import threading
import time

class JogProducer:
    def __init__(self, robot):
        self.robot = robot
        self.running = False
        self.axis = None
        self.dir = 0
        self.step = 2      # mm or deg
        self.period = 0.03  # seconds (≈33 Hz)
        self.max_buf = 20

    def start(self, axis, direction):
        self.axis = axis
        self.dir = direction
        self.running = True
        threading.Thread(target=self._run, daemon=True).start()

    def stop(self):
        self.running = False

    def _run(self):
        buf_count=0
        while self.running:
            try:
                # buf_count = int(self.robot.read("gBufCount"))
                print(buf_count)
                if buf_count < self.max_buf:
                    idx = buf_count + 1
                    pos = self._make_rel_pos()
                    print(pos)

                    self.robot.write(f"gJogBuf[{idx}]", pos)
                    self.robot.write("gBufCount", idx)
                    buf_count=buf_count+1
                    
                time.sleep(self.period)

            except Exception as e:
                print("Jog producer error:", e)
                time.sleep(0.1)

    def _make_rel_pos(self):
        dx = dy = dz = da = db = dc  = 0
        axes = {
            "X": "X", "Y": "Y", "Z": "Z",
            "A": "A", "B": "B", "C": "C"
        }

        if self.axis not in axes:
            return "{X 0,Y 0,Z 0,A 0,B 0,C 0}"

        value = self.dir * self.step
        return f"{{X 0,Y 0,Z {value},A 0,B 0,C 0}}"
