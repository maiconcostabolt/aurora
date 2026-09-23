#!/usr/bin/env python3
"""Generate HTML/PDF/PNG proof for Premium vehicle inspection report (TESTE 1)."""

from __future__ import annotations

import base64
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[4]
HARNESS = ROOT / "core" / "reporting" / "premium" / "proof" / "premium_integration_proof.html"
OUT_ROOT = ROOT / "AUDITORIAS" / "PREMIUM_REPORT_TEST1"


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


def _start_http_server() -> tuple[ThreadingHTTPServer, str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _QuietHandler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    host, port = server.server_address
    return server, f"http://{host}:{port}/"


def render_pdf_pages_to_png(
    playwright,
    pdf_path: Path,
    out_dir: Path,
    prefix: str = "premium_pdf_page",
) -> int:
    pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 900, "height": 1300})
    page.goto("about:blank")
    page.add_script_tag(url="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js")
    page.wait_for_function("() => typeof pdfjsLib !== 'undefined'")
    rendered = page.evaluate(
        """async (pdfBase64) => {
            const raw = atob(pdfBase64);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
            const pages = [];
            for (let index = 1; index <= pdf.numPages; index += 1) {
                const pdfPage = await pdf.getPage(index);
                const viewport = pdfPage.getViewport({ scale: 1.35 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await pdfPage.render({ canvasContext: context, viewport }).promise;
                pages.push(canvas.toDataURL("image/png"));
            }
            return { pageCount: pdf.numPages, pages };
        }""",
        pdf_b64,
    )
    browser.close()

    page_count = int((rendered or {}).get("pageCount") or 0)
    for index, data_url in enumerate((rendered or {}).get("pages") or [], start=1):
        png_path = out_dir / f"{prefix}_{index:02d}.png"
        header, encoded = data_url.split(",", 1)
        png_path.write_bytes(base64.b64decode(encoded))
    return page_count


def main() -> int:
    if not HARNESS.exists():
        print(f"Missing harness: {HARNESS}", file=sys.stderr)
        return 1

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    os.chdir(ROOT)
    server, base_url = _start_http_server()

    harness_rel = HARNESS.relative_to(ROOT).as_posix()
    url = f"{base_url}{harness_rel}"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 980, "height": 1400})
        page.goto(url, wait_until="networkidle")
        page.wait_for_function(
            "() => window.__AURORA_PREMIUM_PROOF__ && !window.__AURORA_PREMIUM_PROOF__.error",
            timeout=120000,
        )

        proof = page.evaluate("() => window.__AURORA_PREMIUM_PROOF__")
        if proof.get("error"):
            print(proof["error"], file=sys.stderr)
            browser.close()
            server.shutdown()
            return 1

        standalone_html = page.evaluate(
            """async () => {
                const proof = window.AURORA_PREMIUM_PROOF.buildPremiumProofCase();
                const renderer = new PremiumReportRenderer({
                    companyProvider: () => proof.built.identity,
                    cssHref: "../../core/reporting/premium/styles/premium_report.css"
                });
                return renderer.renderStandaloneDocument(proof.report);
            }"""
        )

        html_path = OUT_ROOT / "premium_report_test1.html"
        html_path.write_text(standalone_html, encoding="utf-8")

        page_screenshots = []
        pages = page.locator("[data-premium-scaler] .a4-page")
        page_count_dom = pages.count()
        for index in range(page_count_dom):
            shot_path = OUT_ROOT / f"premium_html_page_{index + 1:02d}.png"
            pages.nth(index).screenshot(path=str(shot_path))
            page_screenshots.append(shot_path.name)

        pdf_page = browser.new_page()
        pdf_page.goto(html_path.as_uri(), wait_until="networkidle")
        pdf_page.wait_for_timeout(800)
        pdf_page.emulate_media(media="print")
        pdf_path = OUT_ROOT / "premium_report_test1.pdf"
        pdf_page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        pdf_page.close()

        pdf_png_count = render_pdf_pages_to_png(playwright, pdf_path, OUT_ROOT)
        browser.close()

    summary = {
        "template": "premium",
        "reportId": proof.get("reportId"),
        "pageCountDom": page_count_dom,
        "pageCountProof": proof.get("pageCount"),
        "pageCountPdfPng": pdf_png_count,
        "photoAudit": proof.get("photoAudit"),
        "signature": proof.get("signature"),
        "legacy": proof.get("legacy"),
        "artifacts": {
            "html": str(html_path.relative_to(ROOT)),
            "pdf": str(pdf_path.relative_to(ROOT)),
            "htmlScreenshots": page_screenshots,
            "pdfScreenshotsPrefix": "premium_pdf_page_",
        },
        "checks": {
            "photosNoCrop": bool((proof.get("photoAudit") or {}).get("allContain")),
            "signaturePresent": bool((proof.get("signature") or {}).get("present")),
            "legacyRenderOk": bool((proof.get("legacy") or {}).get("renderOk")),
        },
    }

    summary_path = OUT_ROOT / "premium_report_test1_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    server.shutdown()
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
