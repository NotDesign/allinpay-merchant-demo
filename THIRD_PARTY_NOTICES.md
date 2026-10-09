# Local OCR runtime notices
Runtime files are assembled by `npm run setup` from package-lock.json. Models and workers are served from this website; customer files are processed in the browser.

- PDF.js / Mozilla (`pdfjs-dist` 6.3.289): Apache-2.0. License copied to vendor/pdfjs-dist.LICENSE. https://github.com/mozilla/pdf.js
- Tesseract.js 7.0.0 and Tesseract.js Core: Apache-2.0. Licenses included under vendor/. https://github.com/naptha/tesseract.js
- English and Traditional Chinese trained data: Tesseract tessdata, Apache-2.0. https://github.com/tesseract-ocr/tessdata_best
- The `@tesseract.js-data/eng` and `@tesseract.js-data/chi_tra` distribution packages (1.0.0) identify their wrapper license as MIT; package notices and metadata are copied beside the model assets. https://github.com/naptha/tessdata

Figma image assets originate from the user-provided AllinPay design. This demo is not distributed as an independently licensed design kit.
