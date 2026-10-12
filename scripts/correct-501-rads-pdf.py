"""Correct the author-approved Heat typo without reflowing the source layout.

Requires PyMuPDF. Pass an input PDF and a different output path.
"""
import sys
from pathlib import Path
import pymupdf

source, destination = map(Path, sys.argv[1:3])
if source.resolve() == destination.resolve():
    raise ValueError('Use a separate output path.')
document = pymupdf.open(source)
font = Path(__file__).resolve().parent.parent / 'public/systems/501-rads/fonts/VT323-Regular.ttf'
changes = 0
for page in document:
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if 'luck points' not in span['text']:
                    continue
                if 'Fan the Hammer' not in span['text']:
                    raise ValueError('Unexpected luck-points reference; review before editing.')
                rect = pymupdf.Rect(span['bbox'])
                rect.y0 += 0.2
                rect.y1 -= 0.2
                page.add_redact_annot(rect, fill=(1, 1, 1), cross_out=False)
                page.apply_redactions(images=0, graphics=0)
                page.insert_text(span['origin'], span['text'].replace('luck points', 'Heat'), fontname='CorrectedVT323', fontfile=str(font), fontsize=span['size'])
                changes += 1
if changes != 1:
    raise ValueError(f'Expected one correction, found {changes}.')
document.save(destination, garbage=4, deflate=True)
document.close()
print('Corrected Fan the Hammer to 2 Heat; layout and page count preserved.')
