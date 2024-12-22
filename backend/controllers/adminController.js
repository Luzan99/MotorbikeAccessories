const pool = require("../config/db");

exports.getUsers = (req, res) => {
  pool.query(
    "SELECT id, name, email, is_approved FROM users",
    (error, results) => {
      if (error) {
        return res
          .status(500)
          .json({ message: "Server error", error: error.message });
      }
      res.json(results);
    }
  );
};

exports.approveUser = (req, res) => {
  const { userId } = req.body;

  // First, check if the user exists
  pool.query(
    "SELECT id FROM users WHERE id = ?",
    [userId],
    (error, results) => {
      if (error) {
        return res
          .status(500)
          .json({ message: "Server error", error: error.message });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user's approval status
      pool.query(
        "UPDATE users SET is_approved = ? WHERE id = ?",
        [true, userId],
        (error) => {
          if (error) {
            return res
              .status(500)
              .json({ message: "Server error", error: error.message });
          }
          res.json({ message: "User approved successfully" });
        }
      );
    }
  );
};
exports.getDashboardData = (req, res) => {
  const queries = {
    totalUsers: "SELECT COUNT(*) AS count FROM users",
    admins: "SELECT COUNT(*) AS count FROM users WHERE role='admin'",
    regularUsers: "SELECT COUNT(*) AS count FROM users WHERE role='user'",
    approvedUsers: "SELECT COUNT(*) AS count FROM users WHERE is_approved=1",
    notApprovedUsers: "SELECT COUNT(*) AS count FROM users WHERE is_approved=0",
    products: "SELECT COUNT(*) AS count FROM products",
    categories: "SELECT COUNT(DISTINCT category) AS count FROM products",
    totalOrders: "SELECT COUNT(*) AS count FROM orders",
    completedOrders:
      "SELECT COUNT(*) AS count FROM orders WHERE status='completed'",
    pendingOrders:
      "SELECT COUNT(*) AS count FROM orders WHERE status='pending'",
    shippedOrders:
      "SELECT COUNT(*) AS count FROM orders WHERE shipping_status='shipped'",
    pendingShippingOrders:
      "SELECT COUNT(*) AS count FROM orders WHERE shipping_status='not yet'",
    reviews: "SELECT COUNT(*) AS count FROM feedback ",
  };

  const results = {};
  const queryKeys = Object.keys(queries);
  let remaining = queryKeys.length;

  queryKeys.forEach((key) => {
    pool.query(queries[key], (err, result) => {
      if (err) {
        res.status(500).json({ error: "Database query failed" });
        return;
      }

      results[key] = result[0].count;
      remaining--;

      if (remaining === 0) {
        res.json(results);
      }
    });
  });
};
