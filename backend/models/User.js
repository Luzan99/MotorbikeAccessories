const pool = require("../config/db");
const { getAllUsers } = require("../controllers/adminController");

module.exports = {
  findOne: (email, callback) => {
    pool.query("SELECT * FROM users WHERE email = ?", [email], callback);
  },
  findById: (id, callback) => {
    pool.query("SELECT * FROM users WHERE id = ?", [id], callback);
  },
  create: (user, callback) => {
    pool.query("INSERT INTO users SET ?", user, callback);
  },
  update: (id, updateData, callback) => {
    pool.query("UPDATE users SET ? WHERE id = ?", [updateData, id], callback);
  },
  delete: (id, callback) => {
    pool.query("DELETE FROM users WHERE id = ?", [id], callback);
  },
  getAllUsers: (callback) => {
    pool.query("SELECT id, name, email FROM users", (err, results) => {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },
};
