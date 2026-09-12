# Local OCR Service — PaddleOCR

Local, ₹0, no-API-key OCR for the Legal Metrology Compliance System.
Replaces Tesseract.js as the primary engine behind the existing extraction
contract (text + confidence + bounding boxes). The frontend never runs the
model — React talks to this service over HTTP.

## One-time setup

```bash
cd ocr-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Model weights (PP-OCRv5 mobile det+rec) download automatically on first use
and are cached in `~/.paddlex` / `~/.paddleocr` — no manual download.

## Run

Preferred — from the repo root (starts the frontend together with this
service, bootstrapping the venv automatically on first run). The service is
owned by a Vite plugin: it starts with the dev server, restarts itself if it
ever dies, and stops when the dev server stops:

```bash
npm run dev
```

Service only, kept alive until Ctrl+C:

```bash
npm run ocr
```

Manual alternative:

```bash
cd ocr-service && source .venv/bin/activate
uvicorn app:app --port 8100
```

Then set:

```
VITE_OCR_ENDPOINT=http://localhost:8100/ocr
```

in `.env.local` (copy from `.env.example`). Without this variable the app
falls back to the previous in-browser Tesseract provider.

## API

### `GET /health`

```json
{ "status": "ok", "engine": "paddleocr", "model": "PP-OCRv5 mobile (det+rec)", "engine_loaded": false }
```

### `POST /ocr`

`multipart/form-data` with field `image` (JPG / PNG / WebP, ≤ 12 MB).

```json
{
  "success": true,
  "provider": "paddleocr-local",
  "image": { "width": 1200, "height": 1600 },
  "preprocessing": ["resized 600x800 -> 960x1280", "unsharp mask (small-text enhancement)"],
  "results": [
    { "text": "MRP ₹ 120.00", "confidence": 96.3, "bbox": { "x0": 40, "y0": 900, "x1": 320, "y1": 940 } }
  ],
  "meanConfidence": 0.91,
  "rawText": "MRP ₹ 120.00\nNet Qty 500 g"
}
```

Bounding boxes are in ORIGINAL image pixels (they are rescaled out of the
preprocessing resize). Confidence is PaddleOCR's actual recognition score on
a 0–100 scale — never invented.

Errors: `413` too large, `415` unsupported type, `422` corrupted image,
`500` engine failure — each with a human-readable `detail`.

## Configuration (env vars)

| Variable | Default | Purpose |
|---|---|---|
| `OCR_PADDLE_LANG` | `en` | PaddleOCR language code |
| `OCR_PADDLE_VARIANT` | `mobile` | `mobile` (fast, default) or `server` (higher accuracy) |
| `OCR_PADDLE_USE_TEXTLINE` | `false` | Enable textline-orientation model (rotated text) |
| `OCR_MAX_UPLOAD_BYTES` | `12582912` | Upload limit |
| `OCR_CORS_ORIGINS` | localhost dev ports | Allowed browser origins |

## Engine choice

PP-OCRv5 **mobile** det+rec: the smallest PaddleOCR models that keep strong
accuracy on real-world packaging photos (small text, mixed layouts, slight
rotation) while staying fast on CPU for a local demo. `OCR_PADDLE_VARIANT=server`
switches to the server-grade models with zero API changes.

## Model boundary

This service is deliberately the only component that knows which OCR engine is
used. Replacing PaddleOCR with a custom/finetuned model later means editing
`app.py` only — the JSON contract, extraction layer, compliance engine,
workflow, database, and reports are engine-agnostic.
