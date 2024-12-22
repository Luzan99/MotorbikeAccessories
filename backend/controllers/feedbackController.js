const db = require("../config/db");

// Add feedback
exports.submitFeedback = (req, res) => {
  const { message, rating } = req.body;
  const userId = req.user.id; // Extracted from the token in the middleware

  const query =
    "INSERT INTO feedback (user_id, message, rating, created_at) VALUES (?, ?, ?, NOW())";
  const values = [userId, message, rating];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error("Error inserting feedback:", err);
      return res
        .status(500)
        .json({ message: "An error occurred while submitting feedback." });
    }
    res.status(201).json({ message: "Feedback submitted successfully." });
  });
};

// Get all feedback
exports.getFeedbacks = (req, res) => {
  const query = `
        SELECT feedback.id, feedback.message, feedback.rating, feedback.created_at, users.name AS user_name
        FROM feedback
        JOIN users ON feedback.user_id = users.id
        ORDER BY feedback.created_at DESC
    `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error retrieving feedback:", err);
      return res
        .status(500)
        .json({ message: "An error occurred while fetching feedback." });
    }
    res.status(200).json(results);
  });
};
