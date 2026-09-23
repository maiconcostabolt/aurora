const path = require("path");
const { chromium } = require("playwright");

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
    });
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const source = `file://${path.resolve(__dirname, "vehicle_report_v114_qa.html")}`;
    await page.goto(source, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
        path: path.resolve(__dirname, "vehicle_report_v119_qa.pdf"),
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" }
    });
    await browser.close();
})();
