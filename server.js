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
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        });

        // Create page
        const page = await browser.newPage();

        // Load HTML
        await page.setContent(html, {
            waitUntil: "networkidle0"
        });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "10mm",
                right: "10mm",
                bottom: "10mm",
                left: "10mm"
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
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`PDF API running on port ${PORT}`);
});