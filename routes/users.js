const express = require("express");
const router = express.Router();
const db = require("../db/client");



router.post("/", async (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    // Check if user exists
    const existingUser = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [username.trim()]
    );

    if (existingUser.rows.length > 0) {
      console.log("👤 Existing user found:", username);
      return res.json(existingUser.rows[0]);
    }

    // Create new user
    const result = await db.query(
      "INSERT INTO users (username) VALUES ($1) RETURNING *",
      [username.trim()]
    );
    console.log("✅ New user created:", username);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ User creation error:", error);
    res.status(500).json({ error: "Could not create user" });
  }
});

module.exports = router;