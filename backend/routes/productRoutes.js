const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const upload = require("../middlewares/upload");
const { verifyUser, verifyAdmin } = require("../middlewares/authMiddleware");

router.post(
  "/",
  verifyAdmin,
  upload.single("image_data"),
  productController.createProduct
);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.put(
  "/:id",
  verifyAdmin,
  upload.single("image_data"),
  productController.updateProduct
);
router.delete("/:id", verifyAdmin, productController.deleteProduct);
router.get(
  "/calculate-discount/:productId",
  verifyUser,
  productController.calculatediscount
);
router.get("/top-selling", productController.getTopSellingProducts);

module.exports = router;
