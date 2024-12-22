const express = require("express");
const {
  getProductSalesReport,
  getSalesOverTime,
} = require("../controllers/reportController");
const verifyAdmin = require("../middlewares/authAdmin");

const router = express.Router();

// Route to get product sales report
router.get("/product-sales", verifyAdmin, getProductSalesReport);

// Route to get sales data over time
router.get("/sales-over-time", verifyAdmin, getSalesOverTime);

module.exports = router;
