const express = require("express");
const router = express.Router();
const salesPredictionController = require("../controllers/salesPredictionController");
const verifyAdmin = require("../middlewares/authAdmin");

// Route for Simple Moving Average (SMA) Prediction
router.get(
  "/predict-sales-sma",
  verifyAdmin,
  salesPredictionController.predictSalesUsingSMA
);

router.get(
  "/predict-sales-ema",
  verifyAdmin,
  salesPredictionController.predictSalesUsingEMA
);

router.get(
  "/predict-sales-linear-regression",
  verifyAdmin,
  salesPredictionController.predictSalesUsingLinearRegression
);

module.exports = router;
