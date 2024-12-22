const pool = require("../config/db");
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = decoded; // Attach decoded token to request
    next();
  });
};

const adminMiddleware = (req, res, next) => {
  pool.query(
    "SELECT role FROM users WHERE id = ?",
    [req.user.id],
    (error, results) => {
      if (error) {
        return res
          .status(500)
          .json({ message: "Database error", error: error.message });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = results[0];
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      next();
    }
  );
};
const ensureAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  } else {
    return res.status(401).json({ message: "Please log in" });
  }
};

const ensureAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied. Admins only" });
  }
};

const ensureUser = (req, res, next) => {
  if (req.session.user && req.session.user.role === "user") {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied. Users only" });
  }
};
const authenticateUser = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token)
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
};
const verifyUser = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Expecting "Bearer <token>"

  if (!token) {
    return res.status(403).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure it's a regular user and not an admin or unauthorized user
    if (decoded.role !== "user") {
      return res
        .status(403)
        .json({ error: "Access denied. Only users can access this route." });
    }

    req.user = decoded; // Add decoded user info to request object
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token. Access denied." });
  }
};
function verifyToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1]; // Expecting 'Bearer <token>'

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = decoded; // Attach user info to request (including id)
    next(); // Proceed to the next middleware or route handler
  });
}
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token." });
  }
};
module.exports = {
  authMiddleware,
  adminMiddleware,
  ensureAuthenticated,
  ensureAdmin,
  ensureUser,
  authenticateUser,
  verifyUser,
  verifyToken,
  verifyAdmin,
};
