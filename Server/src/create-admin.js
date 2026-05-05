const bcrypt = require("bcryptjs");
const pool = require("./db");
require("dotenv").config();

async function createAdmin() {
  const args = process.argv.slice(2);
  const name     = args[0];
  const email    = args[1];
  const password = args[2];

  if (!name || !email || !password) {
    console.error("Usage: node src/create-admin.js <name> <email> <password>");
    console.error('Example: node src/create-admin.js "Ahmed" admin@eventmart.com MyPass123');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  try {
    const existing = await pool.query(
      "SELECT id, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.role === "admin") {
        console.log(`User ${email} is already an admin.`);
        process.exit(0);
      }
      // Promote existing user to admin
      await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
      console.log(`✓ Promoted existing user ${email} to admin.`);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      [name.trim(), email.trim().toLowerCase(), hash]
    );

    console.log(`✓ Admin user created: ${email}`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

createAdmin();
