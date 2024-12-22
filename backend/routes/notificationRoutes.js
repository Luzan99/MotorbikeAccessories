const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markNotificationAsRead,
} = require("../controllers/notificationController");
const { verifyUser } = require("../middlewares/authMiddleware");

router.get("/", verifyUser, getNotifications);
router.patch("/:notificationId/read", verifyUser, markNotificationAsRead);

module.exports = router;
