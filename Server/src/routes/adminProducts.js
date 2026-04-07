const express = require("express");
const multer = require("multer");
const path = require("path");
const { importProductFile } = require("../services/productImportService");

const upload = multer({
  limits: {
    fileSize: 12 * 1024 * 1024
  },
  storage: multer.memoryStorage()
});

function parseBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function createAdminProductsRouter({ pool }) {
  const router = express.Router();

  router.get("/import-template", (_req, res) => {
    const templatePath = path.resolve(__dirname, "../../imports/sample-products.csv");
    return res.download(templatePath, "sample-products.csv");
  });

  router.post("/import", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "Attach a CSV or XLSX file to import products." });
      }

      const summary = await importProductFile(pool, {
        buffer: file.buffer,
        dryRun: parseBoolean(req.body?.dryRun),
        fileName: file.originalname
      });

      return res.json(summary);
    } catch (error) {
      const message = String(error?.message || "Unable to import products.");
      const status = /supported|empty|sheet|rows/i.test(message) ? 400 : 500;

      return res.status(status).json({
        error: status === 400 ? message : "Unable to import products right now.",
        details: status === 400 ? undefined : message
      });
    }
  });

  router.use((error, _req, res, next) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "Import files must be 12 MB or smaller."
      });
    }

    return next(error);
  });

  return router;
}

module.exports = createAdminProductsRouter;
