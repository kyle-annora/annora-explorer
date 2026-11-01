"""Build an explicitly fictional PDF edition for the source-version workflow.

Run with Python, PyMuPDF and reportlab. The source geometry and original source.pdf
are unchanged. This file rearranges the source views and adds a customer review
note; it makes no claim to a manufacturer-issued engineering revision.
"""
from pathlib import Path
from io import BytesIO
import fitz
from reportlab.pdfgen import canvas

BASE = Path(__file__).resolve().parents[1]
W, H = 841.8898, 595.2756
buffer = BytesIO()
c = canvas.Canvas(buffer, pagesize=(W, H), invariant=1)
def text(x, y, value, size=11, bold=False):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.setFillColorRGB(.15,.15,.15)
    c.drawString(x, H-y, value)
text(36, 34, "ANNORA / FICTIONAL DOCUMENT EDITION B", 11, True)
text(36, 68, "SK08 shaft support - revised discussion sheet", 22, True)
text(36, 91, "Rearranged source views. Same STEP model. No new dimensions or engineering approval.", 11)
text(36, 128, "01 / Support thickness", 12, True)
text(444, 128, "02 / Shaft bore - review requested", 12, True)
c.setStrokeColorRGB(.8,.8,.8)
c.line(36, H-143, W-36, H-143)
c.line(421, H-156, 421, H-462)
c.line(36, H-477, W-36, H-477)
text(36, 502, "CUSTOMER NOTE / Confirm the bore inspection scope before quotation v2.", 11, True)
text(36, 525, "Demonstration document revision only. Geometry, fit and tolerances remain subject to engineering review.", 10)
text(36, 548, "Source: SK08 by hasecilu / FreeCAD library / CC BY 3.0. Drawing source preserved on page 1.", 10)
text(36, 572, "Not to scale. Layout by Annora. Use this file to practice importing and confirming a new association.", 9)
c.save()
source = fitz.open(BASE / "source.pdf")
out = fitz.open(); out.insert_pdf(source)
header = fitz.open(stream=buffer.getvalue(), filetype="pdf"); out.insert_pdf(header)
page = out[1]
page.show_pdf_page(fitz.Rect(48, 156, 380, 462), source, 0, clip=fitz.Rect(350, 325, 469, 520), keep_proportion=True)
page.show_pdf_page(fitz.Rect(444, 156, 795, 462), source, 0, clip=fitz.Rect(70, 320, 295, 535), keep_proportion=True)
out.set_metadata({"title":"SK08 - fictional document edition B", "author":"hasecilu; draftwright; Annora layout", "subject":"Demonstration only. Same model, rearranged source drawing and customer review note.", "creationDate":"D:20261101000000Z"})
out.save(BASE / "demo-revision-b.pdf", garbage=4, deflate=True, no_new_id=True)
print("Created demo-revision-b.pdf; original sources unchanged.")
