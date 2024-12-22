const express = require("express");
const router = express.Router();
const abcController = require("../controllers/abcController");
const verifyAdmin = require("../middlewares/authAdmin");

// Route to get ABC analysis
router.get("/abc-analysis", verifyAdmin, abcController.getABCAnalysis);

module.exports = router;
