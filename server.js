const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

// Allows large HTML requests
app.use(express.json({ limit: "50mb" }));

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

app.post("/generate-pdf", async (req, res) => {
    let browser;

    try {
        const {
            html,
            fileName,
            pageSize,
            pageRotation,
            footerText,
            showFooter,
            showPageNumbers,
            footerRev
        } = req.body;

        if (!html) {
            return res.status(400).json({
                success: false,
                message: "No HTML provided"
            });
        }

        const allowedPageSizes = [
            "Letter",
            "Legal",
            "Tabloid",
            "Ledger",
            "A0",
            "A1",
            "A2",
            "A3",
            "A4",
            "A5",
            "A6"
        ];

        const selectedPageSize = allowedPageSizes.includes(pageSize)
            ? pageSize
            : "A4";

        const isLandscape =
            pageRotation === "landscape" ||
            pageRotation === "Landscape" ||
            pageRotation === true;

        const hasFooterText =
            typeof footerText === "string" &&
            footerText.trim() !== "";

        const hasFooterRev =
            typeof footerRev === "string" &&
            footerRev.trim() !== "";

        const shouldShowPageNumbers =
            showPageNumbers === true ||
            showPageNumbers === "true";

        const shouldShowFooter =
            showFooter === true ||
            showFooter === "true" ||
            hasFooterText ||
            hasFooterRev ||
            shouldShowPageNumbers;

        let footerParts = [];

        if (hasFooterText) {
            footerParts.push(escapeHtml(footerText.trim()));
        }

        if (shouldShowPageNumbers) {
            footerParts.push(`Page <span class="pageNumber"></span> of <span class="totalPages"></span>`);
        }

        if (hasFooterRev) {
            footerParts.push(`Rev ${escapeHtml(footerRev.trim())}`);
        }

        const footerTemplate = shouldShowFooter
            ? `
                <div style="
                    width: 100%;
                    font-size: 12px;
                    color: #4b5563;
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding-bottom: 4px;
                ">
                    ${footerParts.join(" | ")}
                </div>
            `
            : `<div></div>`;

        browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage"
            ]
        });

        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: "load"
        });

        await page.emulateMediaType("print");

        const pdfBuffer = await page.pdf({
            format: selectedPageSize,
            landscape: isLandscape,
            printBackground: true,
            preferCSSPageSize: true,

            displayHeaderFooter: shouldShowFooter,
            headerTemplate: `<div></div>`,
            footerTemplate,

            margin: {
                top: "0mm",
                right: "0mm",
                bottom: shouldShowFooter ? "15mm" : "0mm",
                left: "0mm"
            }
        });

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`PDF API running on port ${PORT}`);
});
