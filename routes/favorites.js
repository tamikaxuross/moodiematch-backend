const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all favorites for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      "SELECT * FROM favorites WHERE user_id = $1",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch favorites" });
  }
});

// Add a new favorite
router.post("/", async (req, res) => {
  const { user_id, movie_id, title, poster_path } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO favorites (user_id, movie_id, title, poster_path)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, movie_id, title, poster_path]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Could not add favorite" });
  }
});

// Remove a favorite
router.delete("/", async (req, res) => {
  const { user_id, movie_id } = req.body;
  try {
    await db.query(
      `DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2`,
      [user_id, movie_id]
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Could not delete favorite" });
  }
});

module.exports = router;
