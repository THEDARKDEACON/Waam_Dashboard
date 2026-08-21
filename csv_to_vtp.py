#!/usr/bin/env python3
import csv
import math
import sys
from datetime import datetime
from pathlib import Path


def _num(s):
    try:
        v = float(s)
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


def _iso_seconds(s):
    if not s or not str(s).strip():
        return None
    text = str(s).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text).timestamp()
    except ValueError:
        return None


def _row_time_s(row):
    t = _iso_seconds(row.get("timestamp"))
    if t is not None:
        return t
    t = _num(row.get("Time_S"))
    if t is not None:
        return t
    return _num(row.get("Time(S)"))


def main():
    if len(sys.argv) < 2:
        print("usage: python3 csv_to_vtp.py input.csv [output.vtp]")
        sys.exit(1)

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".vtp")

    with src.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)

    pts, extras, times = [], [], []
    skip = {"X", "Y", "Z"}
    scalar_names = None
    for row in rows:
        x, y, z = _num(row.get("X")), _num(row.get("Y")), _num(row.get("Z"))
        if x is None or y is None or z is None:
            continue
        if scalar_names is None:
            scalar_names = [k for k in fields if k not in skip and _num(row.get(k)) is not None]
        pts.append((x, y, z))
        extras.append([_num(row.get(k)) if _num(row.get(k)) is not None else 0.0 for k in scalar_names])
        times.append(_row_time_s(row))

    n = len(pts)
    if n == 0:
        print("no rows with numeric X,Y,Z")
        sys.exit(1)

    t0 = next((t for t in times if t is not None), 0.0)
    time_s = [(t - t0) if t is not None else float(i) for i, t in enumerate(times)]

    dt_s = [0.0] * n
    speed_mm_s = [0.0] * n
    dwell_s = [0.0] * n
    for i in range(1, n):
        dt = time_s[i] - time_s[i - 1]
        if dt <= 0:
            dt = 1e-6
        x0, y0, z0 = pts[i - 1]
        x1, y1, z1 = pts[i]
        ds = math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2)
        dt_s[i] = dt
        speed_mm_s[i] = ds / dt
        dwell_s[i] = dt

    dwell_s[0] = dt_s[1] if n > 1 else 0.0
    dt_s[0] = dwell_s[0]
    speed_mm_s[0] = speed_mm_s[1] if n > 1 else 0.0

    derived = {
        "Time_rel_s": time_s,
        "dt_s": dt_s,
        "Speed_mm_s": speed_mm_s,
        "Dwell_s": dwell_s,
    }
    existing = set(scalar_names)
    for name, col in derived.items():
        if name not in existing:
            scalar_names.append(name)
            existing.add(name)
            for i, row in enumerate(extras):
                row.append(col[i])

    def floats(vals):
        return " ".join(f"{v:.9g}" for v in vals)

    xyz = []
    for x, y, z in pts:
        xyz.extend((x, y, z))

    chunks = [
        '<?xml version="1.0"?>',
        '<VTKFile type="PolyData" version="1.0" byte_order="LittleEndian">',
        "  <PolyData>",
        f'    <Piece NumberOfPoints="{n}" NumberOfVerts="{n}" NumberOfLines="{1 if n >= 2 else 0}">',
        "      <Points>",
        f'        <DataArray type="Float64" NumberOfComponents="3" format="ascii">{floats(xyz)}</DataArray>',
        "      </Points>",
        "      <Verts>",
        f'        <DataArray type="Int32" Name="connectivity" format="ascii">{" ".join(map(str, range(n)))}</DataArray>',
        f'        <DataArray type="Int32" Name="offsets" format="ascii">{" ".join(str(i) for i in range(1, n + 1))}</DataArray>',
        "      </Verts>",
    ]
    if n >= 2:
        chunks += [
            "      <Lines>",
            f'        <DataArray type="Int32" Name="connectivity" format="ascii">{" ".join(map(str, range(n)))}</DataArray>',
            f'        <DataArray type="Int32" Name="offsets" format="ascii">{n}</DataArray>',
            "      </Lines>",
        ]
    chunks.append("      <PointData>")
    for i, name in enumerate(scalar_names):
        col = [row[i] for row in extras]
        safe = name.replace("(", "_").replace(")", "").replace(" ", "_")
        chunks.append(
            f'        <DataArray type="Float64" Name="{safe}" format="ascii">{floats(col)}</DataArray>'
        )
    chunks += [
        "      </PointData>",
        "    </Piece>",
        "  </PolyData>",
        "</VTKFile>",
        "",
    ]
    dst.write_text("\n".join(chunks), encoding="utf-8")
    print(f"{n} points → {dst}")
    print("color by Dwell_s (high = lingered) or Speed_mm_s (low = lingered); Time_rel_s is sequence")


if __name__ == "__main__":
    main()
