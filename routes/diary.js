const express = require("express");
const router = express.Router();
const db = require("../db/client");

// Get all diary entries for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      "SELECT * FROM diary_entries WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    console.log(`📖 Found ${result.rows.length} diary entries for user ${userId}`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching diary entries:", err);
    res.status(500).json({ error: "Could not fetch diary entries" });
  }
});

// Add a new diary entry
router.post("/", async (req, res) => {
  const { user_id, movie_title, notes, rating } = req.body;
  
  console.log("📝 Adding diary entry:", { user_id, movie_title, rating });
  
  if (!user_id || !movie_title) {
    return res.status(400).json({ error: "Missing required fields: user_id, movie_title" });
  }

  try {
    const result = await db.query(
      "INSERT INTO diary_entries (user_id, movie_title, notes, rating) VALUES ($1, $2, $3, $4) RETURNING *",
      [user_id, movie_title, notes, rating]
    );
    
    console.log("✅ Added diary entry:", movie_title);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding diary entry:", err);
    res.status(500).json({ error: "Could not add diary entry" });
  }
});

// Delete a diary entry
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  
  try {
    const result = await db.query(
      "DELETE FROM diary_entries WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Diary entry not found" });
    }

    console.log("✅ Deleted diary entry");
    res.status(200).json({ message: "Diary entry deleted successfully" });
  } catch (err) {
    console.error("Error deleting diary entry:", err);
    res.status(500).json({ error: "Could not delete diary entry" });
  }
});

module.exports = router;