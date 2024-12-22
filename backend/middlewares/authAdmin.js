const jwt = require("jsonwebtoken");

const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken;

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access forbidden: Admins only." });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Authentication failed!" });
  }
};

module.exports = verifyAdmin;
