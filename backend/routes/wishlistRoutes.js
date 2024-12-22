const express = require("express");
const router = express.Router();
const { verifyUser } = require("../middlewares/authMiddleware");
const wishlistController = require("../controllers/wishlistController");

router.post("/add", verifyUser, wishlistController.addToWishlist);

router.get("/", verifyUser, wishlistController.viewWishlist);

router.delete(
  "/remove/:productId",
  verifyUser,
  wishlistController.removeFromWishlist
);

module.exports = router;
