"""Create a labelled 2-page reference without altering source.pdf.

Usage: python3 source-tools/make-reference-pdf.py
Requires PyMuPDF and reportlab. The original PDF is page 1, unchanged.
Page 2 enlarges two vector regions of that same PDF. It adds no dimensions.
The page-2 crop positions are presentation metadata, not CAD measurements.
"""
from pathlib import Path
from io import BytesIO
import fitz
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

BASE = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 841.8898, 595.2756

def text(c, x, y, value, size=11, color="#343638", bold=False):
    c.setFillColor(HexColor(color))
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, HEIGHT-y, value)

buffer = BytesIO()
c = canvas.Canvas(buffer, pagesize=(WIDTH, HEIGHT), invariant=1)
text(c, 40, 42, "ANNORA / SOURCE DETAIL REFERENCE", 10, "#696969", True)
text(c, 40, 76, "SK08 shaft support", 25, bold=True)
text(c, 40, 100, "Enlarged source views - source snapshot c4c72a71 - package edition 1", 11)
text(c, 40, 135, "Shaft bore and mounting footprint", 12, bold=True)
text(c, 463, 135, "Cross-bore and support thickness", 12, bold=True)
c.setStrokeColor(HexColor("#D5D5D5"))
c.setLineWidth(0.5)
c.line(40, HEIGHT-147, WIDTH-40, HEIGHT-147)
c.line(434, HEIGHT-159, 434, HEIGHT-486)
c.line(40, HEIGHT-500, WIDTH-40, HEIGHT-500)
text(c, 40, 519, "REFERENCE ONLY / NOT A MANUFACTURING RELEASE", 10, "#7B293A", True)
text(c, 40, 538, "Source PDF is unreviewed draftwright output. General tolerance and some chamfer annotations are missing.", 10)
text(c, 40, 554, "Views are enlarged from source page 1. Not to scale. No dimensions, tolerances or engineering revision added.", 10)
text(c, 40, 577, "SK08 by hasecilu / FreeCAD library / CC BY 3.0. Enlarged layout by Annora. Source PDF preserved separately.", 9, "#696969")
text(c, WIDTH-66, 42, "2 / 2", 10, "#696969")
c.save()

source = fitz.open(BASE/'source.pdf')
out = fitz.open()
out.insert_pdf(source)
header = fitz.open(stream=buffer.getvalue(), filetype='pdf')
out.insert_pdf(header)
page = out[1]
page.show_pdf_page(fitz.Rect(40, 160, 412, 485), source, 0,
                   clip=fitz.Rect(70, 320, 295, 535), keep_proportion=True)
page.show_pdf_page(fitz.Rect(475, 160, 770, 485), source, 0,
                   clip=fitz.Rect(350, 325, 469, 520), keep_proportion=True)
out.set_metadata({'title':'SK08 shaft support - original and enlarged source reference',
                  'author':'hasecilu; source drawing by draftwright; enlarged layout by Annora',
                  'subject':'Two-page source-derived reference. Unreviewed. Not a manufacturing release.',
                  'creator':'Annora source-preserving PDF preparation',
                  'creationDate':'D:20261101000000Z'})
out.save(BASE/'reference.pdf', garbage=4, deflate=True, no_new_id=True)
print('Created reference.pdf with', len(out), 'pages; source.pdf unchanged.')
