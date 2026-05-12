const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

// Allows large HTML requests
app.use(express.json({ limit: "50mb" }));

app.post("/generate-pdf", async (req, res) => {
    let browser;

    try {
        const { html, fileName } = req.body;

        // Validation
        if (!html) {
            return res.status(400).json({
                success: false,
                message: "No HTML provided"
            });
        }

        // Launch browser
        browser = await puppeteer.launch({
          headless: "new",
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
          ]
        });

        // Create page
        const page = await browser.newPage();

        // Load HTML
        await page.setContent(html, {
            waitUntil: "load"
        });
        
        await page.emulateMediaType("print");
        
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: "0mm",
                right: "0mm",
                bottom: "0mm",
                left: "0mm"
            }
        });

        // Return PDF
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName || "document.pdf"}"`
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`PDF API running on port ${PORT}`);
});
