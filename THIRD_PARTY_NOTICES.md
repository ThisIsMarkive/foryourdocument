# Third-party notices

HWPX Bridge's original adapter/installer code is MIT-licensed. Upstream applications, libraries and model weights retain their own licenses; this project's MIT license does not replace them.

Version 0.2.0 includes pinned Filee and kordoc source snapshots under plugins/hwpx-bridge/vendor and builds integrated components from them. The installer does not download the original Filee application release or the kordoc npm package. Source LICENSE/NOTICE files are retained. Runtime libraries, build toolchains, auxiliary tools and model weights remain separately licensed dependencies. Offline exports include the compiled components and their notices.

| Component | Version/source | License / notice location |
| --- | --- | --- |
| Filee | [KnifeLemon/Filee v2.4.0](https://github.com/KnifeLemon/Filee/tree/v2.4.0) | MIT; source `vendor/filee/LICENSE` and `THIRD-PARTY-NOTICES.md`; retained beside the internal converter |
| kordoc | [chrisryugj/kordoc](https://github.com/chrisryugj/kordoc), source 4.24.62 | MIT; source `vendor/kordoc/LICENSE`, `NOTICE`, `THIRD_PARTY`; runtime `npm/notices/kordoc/` |
| Node.js | [v24.22.1](https://nodejs.org/dist/v24.22.1/) | Node.js license and bundled library notices in `node/LICENSE` |
| MCP SDK and npm libraries | Exact versions/integrities in `package-lock.json` | Individual packages' license files and metadata |
| Tesseract | [UB Mannheim Windows build 5.4.0.20240606](https://github.com/UB-Mannheim/tesseract/releases/tag/v5.4.0.20240606) | Tesseract Apache-2.0; bundled libraries retain their own licenses |
| Tesseract language data | [tessdata_fast 4.1.0](https://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0) | Apache-2.0 |
| PP-OCR / Korean OCR model weights | Exact Hugging Face sources and hashes in `assets.json` | Original model cards/licenses; kordoc's `NOTICE` and `THIRD_PARTY` |
| Pix2Text MFD/MFR model weights | Exact sources and hashes in `assets.json` | Original model cards/licenses; kordoc's model notices |
| ONNX Runtime, sharp, PDFium and supporting packages | Pinned npm dependencies | Original package notices included in runtime |
| 7-Zip | Official pinned MSI 26.05 | `sevenzip/License.txt`; extracted as files without executing MSI actions |
| .NET SDK/runtime | Microsoft 10.0.403 / 10.0.14 | SDK notices retained in private toolchains; self-contained runtime notices included with the source-built converter |
| rhwp | Filee-pinned auxiliary executable 0.8.7 | Original release notices retained under `filee/engines/rhwp` |
| Microsoft Visual C++ runtime | Filee-pinned `vc14_runtime` package | Original package license metadata retained under `filee/notices/vcruntime`; runtime DLLs accompany the converter and rhwp |

Filee copyright: 2026 Myeonggu Kim (KnifeLemon) and Filee contributors.

kordoc copyright: 2026 chrisryugj.

Full upstream MIT notices are included under `plugins/hwpx-bridge/notices/`. Consult original distributions for their complete dependency notices. No affiliation with or endorsement by the upstream authors, OpenAI, or Anthropic is implied.

Unlike kordoc's npm package alone, an exported offline bundle includes downloaded model weights. Preserve their original notices when sharing it. In particular, kordoc's `THIRD_PARTY/pix2text.txt` notes that the MFD weights are marked MIT on Hugging Face but were trained using the Ultralytics YOLOv8 architecture, and asks commercial/closed-source users to review the upstream AGPL terms. This upstream notice is retained in the runtime. The source marketplace distributes source code and download definitions, not those weights.
