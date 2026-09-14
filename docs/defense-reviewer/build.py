"""Append Part 5 (part5-codebase.html) to BalotaChain_Defense_Reviewer.pdf.

Pages 1 to 21 are copied untouched. The new pages are printed by Edge headless,
then given the original's running header ("BalotaChain Thesis Defense Reviewer",
"Page N") at the positions measured from the original, and appended.

    py -3.14 build.py <original.pdf> <out.pdf>
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HERE = Path(__file__).resolve().parent
GREY = (0x80 / 255,) * 3
# Measured on the original (all pages): 8 pt grey title at x=55.1, "Page " in
# 8 pt grey ending where a 9.5 pt black number ends at x=557.1, baseline y=44.
BASELINE, LEFT, RIGHT = 44.0, 55.1, 557.1
FORBIDDEN = ["\u2014", "\u2013", "\u2192"]  # em dash, en dash, arrow: the reviewer uses none


def render(html_path: Path, pdf_path: Path) -> None:
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
                        f"--user-data-dir={profile}", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf_path}", html_path.as_uri()],
                       check=True, capture_output=True, timeout=120)
    if not pdf_path.exists():
        sys.exit("Edge produced no PDF")


def stamp(page: "pymupdf.Page", number: int) -> None:
    font = pymupdf.Font("helv")
    page.insert_text((LEFT, BASELINE), "BalotaChain Thesis Defense Reviewer", fontsize=8, fontname="helv", color=GREY)
    num = str(number)
    num_w = font.text_length(num, fontsize=9.5)
    label_w = font.text_length("Page ", fontsize=8)
    page.insert_text((RIGHT - num_w, BASELINE), num, fontsize=9.5, fontname="helv", color=(0, 0, 0))
    page.insert_text((RIGHT - num_w - label_w, BASELINE), "Page ", fontsize=8, fontname="helv", color=GREY)


def main() -> None:
    original, out = Path(sys.argv[1]), Path(sys.argv[2])
    html = HERE / "part5-codebase.html"
    text = html.read_text(encoding="utf-8")
    bad = [c for c in FORBIDDEN if c in text]
    if bad:
        sys.exit(f"part5-codebase.html contains forbidden characters: {bad}")

    part5_pdf = out.with_name("part5.pdf")
    render(html, part5_pdf)

    doc = pymupdf.open(original)
    first_new = doc.page_count + 1
    part5 = pymupdf.open(part5_pdf)
    for i, page in enumerate(part5):
        stamp(page, first_new + i)
    doc.insert_pdf(part5)
    doc.save(out, garbage=3, deflate=True)
    print(f"{out}: {doc.page_count} pages ({part5.page_count} new, from page {first_new})")


if __name__ == "__main__":
    main()
