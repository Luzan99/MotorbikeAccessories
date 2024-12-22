const jwt = require("jsonwebtoken");

const authenticateAdmin = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });

    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error("Token authentication error:", err);
    return res.status(403).json({ message: "Failed to authenticate token" });
  }
};

module.exports = { authenticateAdmin };

const adminMiddleware = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Extract the token from the Authorization header
  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (decoded.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can perform this action" });
    }
    req.userId = decoded.id; // Optional: store user ID if needed
    next();
  });
};
module.exports = { adminMiddleware };
