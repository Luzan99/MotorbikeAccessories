const db = require("../config/db");

exports.getNotifications = (req, res) => {
  const userId = req.user.id; // Extract user ID from token

  const getNotificationsQuery =
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC";

  db.query(getNotificationsQuery, [userId], (err, notifications) => {
    if (err)
      return res.status(500).json({ error: "Failed to fetch notifications" });
    res.status(200).json({ notifications });
  });
};
exports.markNotificationAsRead = (req, res) => {
  const { notificationId } = req.params;

  const markAsReadQuery =
    "UPDATE notifications SET read_status = 'read' WHERE id = ?";
  db.query(markAsReadQuery, [notificationId], (err) => {
    if (err)
      return res.status(500).json({ error: "Failed to update notification" });
    res.status(200).json({ message: "Notification marked as read" });
  });
};
