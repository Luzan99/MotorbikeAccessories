// config/db.js
const mysql = require("mysql2");
const dotenv = require("dotenv");

dotenv.config();

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // This line ensures the `mysql2` client uses the correct authentication
  authPlugins: {
    mysql_native_password: () => mysql.authPlugins.mysql_native_password,
  },
});

module.exports = pool;
