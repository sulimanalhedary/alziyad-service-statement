const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const html = req.body && req.body.html;
  const requestedName = (req.body && req.body.filename) || "bayan-service.pdf";

  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "بيانات البيان غير مكتملة." });
  }

  // Prevent unexpectedly huge requests.
  if (Buffer.byteLength(html, "utf8") > 4 * 1024 * 1024) {
    return res.status(413).json({ error: "حجم البيان أكبر من الحد المسموح." });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" }
    });

    const safeAsciiName = "bayan-service.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeAsciiName}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    console.error("PDF generation failed:", err);
    return res.status(500).json({ error: "تعذر إنشاء PDF على الخادم. تحقق من نشر وظيفة PDF." });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
};
