const express = require("express");
const router = express.Router();
const { verifyUser, verifyAdmin } = require("../middlewares/authMiddleware");

const recommendationsController = require("../controllers/recommendationsController");

// Route to get recommended products based on product ID
router.get(
  "/:id",
  verifyUser,
  recommendationsController.getRecommendedProducts
);
router.post("/", verifyUser , recommendationsController.getRecommendations);

module.exports = router;
