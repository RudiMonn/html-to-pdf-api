const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(express.json({ limit: "50mb" }));

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function isTruthy(value) {
    return value === true ||
        value === "true" ||
        value === "True" ||
        value === "YES" ||
        value === "Yes" ||
        value === "yes";
}

app.get("/temp/:fileName", (req, res) => {
    const filePath = path.join("/tmp", req.params.fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("PDF expired or not found");
    }

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${req.params.fileName}"`
    });

    res.sendFile(filePath);
});

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
            footerRev,
            returnBase64,
            returnTempUrl
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

        const shouldShowPageNumbers = isTruthy(showPageNumbers);

        const shouldShowFooter =
            isTruthy(showFooter) ||
            hasFooterText ||
            hasFooterRev ||
            shouldShowPageNumbers;

        const footerParts = [];

        if (hasFooterText) {
            footerParts.push(escapeHtml(footerText.trim()));
        }

        if (shouldShowPageNumbers) {
            footerParts.push(
                `Page <span class="pageNumber"></span> of <span class="totalPages"></span>`
            );
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

        const outputFileName = fileName || "document.pdf";

        if (isTruthy(returnBase64)) {
            const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

            return res.json({
                success: true,
                fileName: outputFileName,
                mimeType: "application/pdf",
                pdfBase64,
                pdfDataUri: `data:application/pdf;base64,${pdfBase64}`
            });
        }

        if (isTruthy(returnTempUrl)) {
            const tempFileName = `${crypto.randomUUID()}-${outputFileName}`;
            const filePath = path.join("/tmp", tempFileName);

            fs.writeFileSync(filePath, pdfBuffer);

            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted temporary PDF: ${tempFileName}`);
                    }
                } catch (deleteError) {
                    console.error("Failed to delete temporary PDF:", deleteError);
                }
            }, 5 * 60 * 1000);

            return res.json({
                success: true,
                fileName: outputFileName,
                pdfUrl: `${req.protocol}://${req.get("host")}/temp/${tempFileName}`,
                expiresInMinutes: 5
            });
        }

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${outputFileName}"`
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
