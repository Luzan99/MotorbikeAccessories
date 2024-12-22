const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const reportRoutes = require("./routes/reportRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const salesPredictionRoutes = require("./routes/salesPredictionRoutes");
const abcRoutes = require("./routes/abcRoutes");
const fsnRoutes = require("./routes/fsnRoutes");

const { verifyToken, verifyAdmin } = require("./middlewares/authMiddleware");

const path = require("path");

dotenv.config();

const app = express();

// MySQL session store
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Session middleware
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 3600000, // 1 hour
      httpOnly: true, // Ensure cookie is inaccessible via JavaScript
      secure: false,
      sameSite: "lax", // Set to true if using HTTPS
    },
  })
);

// CORS Middleware
app.use(
  cors({
    origin: "http://localhost:3000", // Allow your frontend's origin
    credentials: true,
    methods: "POST, GET, OPTIONS, PUT, DELETE,PATCH",
    allowedHeaders: "Content-Type, Authorization",
  })
);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes); // Avoid duplicate auth route
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/admin/reports", reportRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", abcRoutes);
app.use("/api/sales", salesPredictionRoutes);
app.use("/api", fsnRoutes);

app.get("/protected-route", verifyToken, (req, res) => {
  // Access user ID from the request
  const userId = req.user.id;
  res.json({ message: `User ID is ${userId}` });
});

// Health check route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
