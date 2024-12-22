// userController.js
const db = require("../config/db"); // Your database connection
const multer = require("multer");
const path = require("path");
const fs = require("fs");
// Define storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/"); // Normalize the path

    // Check if 'uploads' directory exists; create it if not
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename based on the current timestamp
    cb(null, Date.now() + path.extname(file.originalname)); // e.g., 1733153607987.jpg
  },
});

const upload = multer({ storage }); // Multer upload instance

// Function to format the profile image (base64 encoding)
const formatUserProfile = (user) => {
  return {
    ...user,
    image: user.image ? Buffer.from(user.image).toString("base64") : null,
  };
};

// Get user profile
exports.getUserProfile = (req, res) => {
  const userId = req.user.id; // Assuming user ID is set by authentication middleware
  const query =
    "SELECT name, email, date_of_birth, country, description, image FROM users WHERE id = ?";

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length > 0) {
      const user = results[0];
      const formattedUser = formatUserProfile(user);
      res.json(formattedUser);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });
};

const bcrypt = require("bcryptjs"); // For password hashing
const moment = require("moment"); // For date manipulation

exports.updateUserProfile = [
  upload.single("image"), // Use multer to handle image uploads
  (req, res) => {
    const userId = req.user.id;
    const {
      name,
      email,
      country,
      date_of_birth,
      description,
      oldPassword,
      newPassword,
    } = req.body;
    let image = req.file ? req.file.path : null;

    // Ensure required fields are present
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    // Ensure the user is over 18
    if (date_of_birth && moment().diff(moment(date_of_birth), "years") < 18) {
      return res
        .status(400)
        .json({ message: "User must be at least 18 years old" });
    }

    // Fetch existing password and image if no new image is provided
    const fetchUserQuery = `SELECT password, image FROM users WHERE id = ?`;
    db.query(fetchUserQuery, [userId], (fetchErr, fetchResults) => {
      if (fetchErr) {
        console.error("Error fetching user data:", fetchErr);
        return res
          .status(500)
          .json({ message: "An error occurred while updating profile" });
      }

      if (fetchResults.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: storedPassword, image: existingImage } =
        fetchResults[0];

      // If old password is provided, verify it
      if (oldPassword) {
        bcrypt.compare(oldPassword, storedPassword, (compareErr, isMatch) => {
          if (compareErr) {
            console.error("Error comparing passwords:", compareErr);
            return res
              .status(500)
              .json({ message: "Error validating password" });
          }

          if (!isMatch) {
            return res
              .status(400)
              .json({ message: "Old password is incorrect" });
          }

          // If new password is provided, hash it
          let hashedPassword = storedPassword; // Default to the old password if no new password is provided
          if (newPassword) {
            bcrypt.hash(newPassword, 10, (hashErr, hash) => {
              if (hashErr) {
                console.error("Error hashing new password:", hashErr);
                return res
                  .status(500)
                  .json({ message: "Error updating password" });
              }
              hashedPassword = hash; // Set the hashed new password
              updateProfileData(hashedPassword);
            });
          } else {
            // If no new password, just update other fields
            updateProfileData(hashedPassword);
          }
        });
      } else {
        // If no old password is provided, just update other fields
        updateProfileData(storedPassword);
      }

      function updateProfileData(hashedPassword) {
        // Use existing image if no new image is provided
        if (!image && existingImage) {
          image = existingImage;
        }

        const updateQuery = `
          UPDATE users
          SET name = ?, email = ?, image = ?, country = ?, date_of_birth = ?, description = ?, password = ?, updated_at = NOW()
          WHERE id = ?
        `;

        db.query(
          updateQuery,
          [
            name,
            email,
            image,
            country,
            date_of_birth,
            description,
            hashedPassword,
            userId,
          ],
          (updateErr, updateResults) => {
            if (updateErr) {
              console.error("Error updating user profile:", updateErr);
              return res.status(500).json({
                message: "An error occurred while updating user profile",
              });
            }

            if (updateResults.affectedRows === 0) {
              return res.status(404).json({ message: "User not found" });
            }

            return res
              .status(200)
              .json({ message: "Profile updated successfully" });
          }
        );
      }
    });
  },
];
