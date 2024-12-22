// routes/fsnRoutes.js
const express = require("express");
const { getFSNAnalysis } = require("../controllers/fsnController");
const router = express.Router();
const { verifyUser, verifyAdmin } = require("../middlewares/authMiddleware");

// Route to get FSN analysis
router.get("/fsn-analysis", verifyAdmin, getFSNAnalysis);

module.exports = router;
