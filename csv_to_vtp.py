#!/usr/bin/env python3
import csv
import math
import sys
from pathlib import Path


def _num(s):
    try:
        v = float(s)
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


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

    pts, extras = [], []
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

    n = len(pts)
    if n == 0:
        print("no rows with numeric X,Y,Z")
        sys.exit(1)

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
        chunks.append(
            f'        <DataArray type="Float64" Name="{name}" format="ascii">{floats(col)}</DataArray>'
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


if __name__ == "__main__":
    main()
