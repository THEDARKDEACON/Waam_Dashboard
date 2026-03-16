from typing import List, Dict, Tuple

from gcode_cleaner import GCodeCleaner
from g_k_transpiler_clean import TunedTranspiler, HEADER_DAT
from visualize_toolpath import extract_toolpath_segments_from_text


def clean_gcode_text(raw_gcode: str) -> Tuple[List[str], str, Dict[str, int]]:
    """
    Run the cleaner on raw G-code text and return the parsed lines, the joined text,
    and the cleaning statistics.
    """
    lines = raw_gcode.splitlines(keepends=True)
    cleaner = GCodeCleaner()
    cleaned_lines = cleaner.clean(
        lines,
        remove_duplicates=True,
        remove_zero_moves=True,
        remove_redundant_g92=True,
        min_move_distance=0.001
    )
    cleaned_text = ''.join(cleaned_lines)
    return cleaned_lines, cleaned_text, dict(cleaner.stats)


def transpile_cleaned_gcode(cleaned_lines: List[str], program_name: str = "WAAM_PART") -> Tuple[str, str]:
    """
    Parse cleaned G-code into KRL and DAT strings using the tuned transpiler.
    """
    transpiler = TunedTranspiler()
    transpiler.parse_gcode(cleaned_lines)
    src_content = transpiler.generate_krl(program_name=program_name)
    dat_content = HEADER_DAT.format(program_name=program_name)
    return src_content, dat_content


def clean_and_transpile(raw_gcode: str, program_name: str = "WAAM_PART") -> Dict[str, str]:
    """
    Full pipeline: clean raw G-code, transpile it, and return the resulting strings.
    """
    cleaned_lines, cleaned_text, stats = clean_gcode_text(raw_gcode)
    src_content, dat_content = transpile_cleaned_gcode(cleaned_lines, program_name=program_name)
    segments = extract_toolpath_segments_from_text(src_content)
    return {
        "cleaned_gcode": cleaned_text,
        "src": src_content,
        "dat": dat_content,
        "program_name": program_name,
        "stats": stats,
        "segments": segments
    }
