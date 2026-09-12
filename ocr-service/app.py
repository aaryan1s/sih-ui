"""
Legal Metrology Compliance System — Local OCR Service (PaddleOCR)

Pipeline position:
    product image → [this service: validate → preprocess → PaddleOCR] → JSON
    → frontend extraction layer (existing, untouched heuristics)
    → compliance engine (existing)

OCR answers only: "what text exists, where is it, how confident?"
It does NOT map text to declarations — that stays in the frontend
extraction layer so OCR can be swapped without touching business rules.

Run:
    cd ocr-service
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app:app --port 8100
"""

import io
import logging
import os
import tempfile

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-service")

MAX_UPLOAD_BYTES = int(os.environ.get("OCR_MAX_UPLOAD_BYTES", 12 * 1024 * 1024))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
# Working band for the detector: upscale small crops so tiny packaging text is
# legible; downscale huge photos to keep CPU inference reasonable.
MIN_SIDE = 960
MAX_SIDE = 2400
# Contrast lift applied only when the image measures flat — never degrade a
# healthy photo.
MIN_CONTRAST = 110.0
CONTRAST_FACTOR = 1.25

app = FastAPI(title="LM OCR Service", version="1.1.0")
# CORS: any localhost/127.0.0.1 port is allowed by default (the Vite dev
# server picks arbitrary free ports). Set OCR_CORS_ORIGINS to a comma-separated
# exact-origin list to lock this down in a shared environment.
# NOTE: Starlette's CORSMiddleware requires real values (no None) for these
# args — None raises TypeError on the first preflight/POST.
_cors_env = os.environ.get("OCR_CORS_ORIGINS", "")
_cors_common = {"allow_methods": ["POST", "GET"], "allow_headers": ["*"]}
if _cors_env.strip():
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in _cors_env.split(",") if o.strip()],
        **_cors_common,
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_origins=[],
        **_cors_common,
    )

# ---------------- PaddleOCR engine (lazy singleton) ----------------
# PP-OCRv5 mobile (det+rec): the smallest PaddleOCR models that keep strong
# accuracy on real-world photos (small text, rotated text, mixed layouts).
# Chosen over server variants for local CPU demo speed. Upgrade path: set
# OCR_PADDLE_VARIANT=server — no API change.
_PADDLE_LANG = os.environ.get("OCR_PADDLE_LANG", "en")
_PADDLE_VARIANT = os.environ.get("OCR_PADDLE_VARIANT", "mobile")
_PADDLE_USE_TEXTLINE = os.environ.get("OCR_PADDLE_USE_TEXTLINE", "false").lower() == "true"
_engine = None


def get_engine():
    global _engine
    if _engine is None:
        from paddleocr import PaddleOCR  # heavy import deferred until first request

        logger.info("Initializing PaddleOCR (PP-OCRv5 %s, lang=%s)…", _PADDLE_VARIANT, _PADDLE_LANG)
        try:
            _engine = PaddleOCR(
                lang=_PADDLE_LANG,
                ocr_version="PP-OCRv5",
                text_detection_model_name=f"PP-OCRv5_mobile_det",
                text_recognition_model_name=f"PP-OCRv5_mobile_rec",
                use_doc_orientation_classify=False,  # photos are upright; skip orientation model
                use_doc_unwarping=False,             # flat label photos; skip unwarp model
                use_textline_orientation=_PADDLE_USE_TEXTLINE,
            )
        except (TypeError, ValueError):
            # PaddleOCR < 3.x kwargs differ — minimal init (v5 is the default there anyway)
            logger.info("Falling back to minimal PaddleOCR init (older paddleocr version).")
            _engine = PaddleOCR(lang=_PADDLE_LANG, use_angle_cls=_PADDLE_USE_TEXTLINE)
        logger.info("PaddleOCR ready.")
    return _engine


# ---------------- preprocessing (modular, image-aware) ----------------

def preprocess(img: Image.Image):
    """Minimal, non-destructive preprocessing. Returns (image, scale, notes).

    `scale` maps preprocessed-pixel coordinates back to ORIGINAL image
    coordinates (original = preprocessed / scale).
    """
    notes = []
    orig_w, orig_h = img.size
    w, h = orig_w, orig_h

    # 1. Resize into the model's working band (keeps aspect ratio)
    scale = 1.0
    if min(w, h) < MIN_SIDE:
        scale = MIN_SIDE / min(w, h)
    elif max(w, h) > MAX_SIDE:
        scale = MAX_SIDE / max(w, h)
    if scale != 1.0:
        w, h = round(w * scale), round(h * scale)
        img = img.resize((w, h), Image.LANCZOS)
        notes.append(f"resized {orig_w}x{orig_h} -> {w}x{h}")

    # 2. Grayscale only when the label is near-monochrome; colour photos keep
    #    colour and get gentle sharpening instead (helps small packaging text
    #    without halos).
    g = ImageOps.grayscale(img)
    arr = np.asarray(g, dtype=np.float32)
    if float(arr.std()) < 28:  # low variance → colour carries little signal
        img = ImageOps.autocontrast(g, cutoff=1)
        notes.append("grayscale + autocontrast (low colour variance)")
    else:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.6, percent=68, threshold=2))
        notes.append("unsharp mask (small-text enhancement)")

    # 3. Contrast lift only when the (possibly sharpened) image measures flat
    arr = np.asarray(img.convert("L"), dtype=np.float32)
    if float(arr.std()) < MIN_CONTRAST:
        img = ImageEnhance.Contrast(img).enhance(CONTRAST_FACTOR)
        notes.append(f"contrast x{CONTRAST_FACTOR} (measured std {arr.std():.0f})")

    # adapt() divides preprocessed coords by this to recover ORIGINAL pixels
    return img, w / orig_w, notes


# ---------------- PaddleOCR result → app contract adapter ----------------

def adapt(result, scale: float) -> tuple:
    """
    PaddleOCR >= 3.x predict() returns [ { rec_texts, rec_scores, rec_polys } ].
    PaddleOCR legacy ocr() returns [[box, (text, score)], ...] per image.
    Both adapt to the app's word shape:
        { text, confidence (0–100, Paddle's actual score), bbox {x0,y0,x1,y1} }
    Bboxes are rescaled from preprocessed-image pixels back to ORIGINAL-image
    pixels (the frontend normalizes against the original dimensions).
    """
    words = []
    if isinstance(result, list) and result and isinstance(result[0], dict):
        page = result[0]
        texts = page.get("rec_texts") or []
        scores = page.get("rec_scores") or []
        polys = page.get("rec_polys") or page.get("rec_boxes") or []
        for text, score, poly in zip(texts, scores, polys):
            pts = np.asarray(poly, dtype=float).reshape(-1, 2) / scale
            x0, y0 = pts.min(axis=0)
            x1, y1 = pts.max(axis=0)
            words.append({
                "text": str(text),
                "confidence": round(float(score) * 100, 1),  # Paddle's actual score, 0–100
                "bbox": {"x0": float(x0), "y0": float(y0), "x1": float(x1), "y1": float(y1)},
            })
    else:
        # legacy format: [[box, (text, score)], ...]
        pages = result if result and isinstance(result[0], list) and result[0] and isinstance(result[0][0], list) else [result or []]
        for entry in pages[0]:
            box, (text, score) = entry
            xs = [float(p[0]) for p in box] / scale
            ys = [float(p[1]) for p in box] / scale
            words.append({
                "text": str(text),
                "confidence": round(float(score) * 100, 1),
                "bbox": {"x0": min(xs), "y0": min(ys), "x1": max(xs), "y1": max(ys)},
            })
    mean = sum(w["confidence"] for w in words) / len(words) if words else 0.0
    return words, mean


def run_ocr(engine, image_bytes: bytes):
    """Invoke PaddleOCR with a real file path (3.x predict() and legacy ocr()
    both expect file paths/ndarrays — raw bytes are not reliably accepted)."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name
        if hasattr(engine, "predict"):
            return engine.predict(tmp_path)
        return engine.ocr(tmp_path)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# ---------------- API ----------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "paddleocr",
        "model": f"PP-OCRv5 {_PADDLE_VARIANT} (det+rec)",
        "lang": _PADDLE_LANG,
        "engine_loaded": _engine is not None,
    }


@app.post("/ocr")
async def ocr(image: UploadFile = File(...)):
    # --- validate ---
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, detail=f"Unsupported image type: {image.content_type}. Use JPG, PNG or WebP.")
    data = await image.read()
    if not data:
        raise HTTPException(400, detail="Empty upload.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, detail=f"Image too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")

    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        raise HTTPException(422, detail="Corrupted or unreadable image.")

    img = ImageOps.exif_transpose(img)  # honour phone-camera EXIF rotation
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # --- preprocess (original untouched; this working copy feeds OCR only) ---
    processed, scale, notes = preprocess(img)

    # --- OCR ---
    try:
        engine = get_engine()
        buf = io.BytesIO()
        processed.save(buf, format="PNG")
        raw = run_ocr(engine, buf.getvalue())
    except Exception as exc:
        logger.exception("OCR failed")
        raise HTTPException(500, detail=f"OCR engine failure: {exc}")

    words, mean_conf = adapt(raw, scale)

    return {
        "success": True,
        "provider": "paddleocr-local",
        "image": {"width": img.size[0], "height": img.size[1]},  # ORIGINAL dimensions
        "preprocessing": notes,
        "results": words,
        "meanConfidence": round(mean_conf / 100, 4) if words else None,
        "rawText": "\n".join(w["text"] for w in words),
    }
