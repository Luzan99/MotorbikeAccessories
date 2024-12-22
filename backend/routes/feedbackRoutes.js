const express = require("express");
const {
  submitFeedback,
  getFeedbacks,
} = require("../controllers/feedbackController");
const router = express.Router();
const { verifyUser } = require("../middlewares/authMiddleware");

router.post("/feedback", verifyUser, submitFeedback);
router.get("/feedback", getFeedbacks);

module.exports = router;
