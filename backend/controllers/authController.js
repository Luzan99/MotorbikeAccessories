const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const pool = require("../config/db");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Register user
exports.register = (req, res) => {
  const { name, email, password } = req.body;

  // Basic validations
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (password.length < 4) {
    return res
      .status(400)
      .json({ message: "Password must be at least 4 characters long" });
  }

  // Check if user already exists
  pool.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error("Error finding user:", err);
      return res
        .status(500)
        .json({ message: "An error occurred. Please try again later." });
    }

    if (results.length > 0) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Hash the password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error("Error hashing password:", err);
        return res
          .status(500)
          .json({ message: "An error occurred. Please try again later." });
      }

      // Insert new user into the database
      pool.query(
        "INSERT INTO users (name, email, password, role, is_approved) VALUES (?, ?, ?, 'user', false)",
        [name, email, hashedPassword],
        (err, results) => {
          if (err) {
            console.error("Error inserting user:", err);
            return res
              .status(500)
              .json({ message: "An error occurred. Please try again later." });
          }

          // Optionally generate a JWT token (if required immediately upon registration)
          const token = jwt.sign(
            { userId: results.insertId, role: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
          );

          res.status(201).json({
            message:
              "User registered successfully. Waiting for admin approval.",
            user: { id: results.insertId, name, email },
            token,
          });
        }
      );
    });
  });
};
// Login user
exports.login = (req, res) => {
  const { email, password } = req.body;

  // Basic validations
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  // Find user by email
  pool.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error("Error finding user:", err);
      return res
        .status(500)
        .json({ message: "An error occurred. Please try again later." });
    }

    // Check if user exists
    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = results[0];

    // Check if the user is approved
    if (user.role === "user" && !user.is_approved) {
      return res.status(403).json({ message: "User not approved by admin" });
    }

    // Check if the password matches
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("Error comparing passwords:", err);
        return res
          .status(500)
          .json({ message: "An error occurred. Please try again later." });
      }

      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      // Save user info in session
      req.session.user = {
        id: user.id,
        role: user.role,
      };
      // Send response with token
      res.json({ token, role: user.role });
    });
  });
};

exports.session = (req, res) => {
  //   if (req.session.user) {
  //     res.json({
  //       isAuthenticated: true,
  //       user: req.session.user, // You can return id, role, etc.
  //     });
  //   } else {
  //     res.status(401).json({
  //       isAuthenticated: false,
  //       message: "User not authenticated",
  //     });
  //   }
  // };
  if (req.session && req.session.user) {
    res.json({ user: req.session.user }); // Return session user data
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
};
// Logout route
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to log out" });
    }
    res.clearCookie("connect.sid"); // Replace with your session cookie name if different
    res.status(200).json({ message: "Logged out successfully" });
  });
};

//Forgot password
exports.forgotPassword = (req, res) => {
  const { email } = req.body;

  pool.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err || results.length === 0) {
      return res
        .status(404)
        .json({ message: "User with this email not found" });
    }

    const user = results[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    pool.query(
      "UPDATE users SET reset_token = ? WHERE id = ?",
      [token, user.id],
      (updateErr) => {
        if (updateErr) {
          return res
            .status(500)
            .json({ message: "Failed to update reset token in database" });
        }

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject: "Password Reset Request",
          text: `Please use the following link to reset your password: http://localhost:3000/reset-password/${token}`,
        };

        transporter.sendMail(mailOptions, (error) => {
          if (error) {
            return res
              .status(500)
              .json({ message: "Failed to send reset email" });
          }
          res.status(200).json({ message: "Reset link sent to your email" });
        });
      }
    );
  });
};

//Reset Password
exports.resetPassword = (req, res) => {
  const { token, newPassword } = req.body;

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Update the password in the database
    pool.query(
      "UPDATE users SET password = ?, reset_token = NULL WHERE id = ?",
      [hashedPassword, decoded.id],
      (err) => {
        if (err) {
          return res.status(500).json({ message: "Error updating password" });
        }
        res.status(200).json({ message: "Password reset successful" });
      }
    );
  });
};
