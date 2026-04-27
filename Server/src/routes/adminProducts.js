const express = require("express");
const multer = require("multer");
const path = require("path");
const { importProductFile } = require("../services/productImportService");
const { generateAutoDescription } = require("../lib/autoDescribe");

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

  // POST /api/admin/products/auto-describe
  // Bulk-generates descriptions for every product whose description is empty,
  // then persists them directly to the database.
  router.post("/auto-describe", async (_req, res) => {
    try {
      const { rows: products } = await pool.query(
        `SELECT id, name, category, subcategory, event_type, quality,
                quality_points, customizable, buy_enabled, rent_enabled,
                venue_type, tags
         FROM products
         WHERE TRIM(description) = '' AND active = true
         ORDER BY id ASC`
      );

      if (!products.length) {
        return res.json({ updated: 0, message: "All products already have descriptions." });
      }

      let updated = 0;
      const skipped = [];

      for (const product of products) {
        const description = generateAutoDescription(product);

        if (!description) {
          skipped.push(product.id);
          continue;
        }

        await pool.query(
          "UPDATE products SET description = $1, updated_at = NOW() WHERE id = $2",
          [description, product.id]
        );

        updated++;
      }

      return res.json({
        updated,
        skipped: skipped.length,
        message: `Auto-generated descriptions for ${updated} product${updated !== 1 ? "s" : ""}.`
      });
    } catch (error) {
      console.error("AUTO-DESCRIBE BULK ERROR:", error);
      return res.status(500).json({ error: "Failed to auto-generate descriptions." });
    }
  });

  // POST /api/admin/products/:id/auto-describe
  // Generates and saves a description for a single product by its numeric DB id.
  router.post("/:id/auto-describe", async (req, res) => {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid product ID." });
    }

    try {
      const { rows } = await pool.query(
        `SELECT id, name, category, subcategory, event_type, quality,
                quality_points, customizable, buy_enabled, rent_enabled,
                venue_type, tags
         FROM products
         WHERE id = $1
         LIMIT 1`,
        [productId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Product not found." });
      }

      const description = generateAutoDescription(rows[0]);

      if (!description) {
        return res.status(422).json({ error: "Not enough product data to generate a description." });
      }

      await pool.query(
        "UPDATE products SET description = $1, updated_at = NOW() WHERE id = $2",
        [description, productId]
      );

      return res.json({ description, message: "Description generated and saved." });
    } catch (error) {
      console.error("AUTO-DESCRIBE SINGLE ERROR:", error);
      return res.status(500).json({ error: "Failed to generate description." });
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
