const express = require("express");
const router = express.Router();
const db = require("../db/client");

// Get all favorites for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT f.*, 
       CASE WHEN f.poster_path LIKE 'http%' 
            THEN f.poster_path 
            ELSE 'https://image.tmdb.org/t/p/w500' || f.poster_path 
       END as full_poster_url
       FROM favorites f 
       WHERE f.user_id = $1 
       ORDER BY f.created_at DESC`,
      [userId]
    );
    console.log(`📋 Found ${result.rows.length} favorites for user ${userId}`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching favorites:", err);
    res.status(500).json({ error: "Could not fetch favorites" });
  }
});

// Add a movie to favorites
router.post("/", async (req, res) => {
  const { user_id, movie_id, title, poster_path, overview, tmdb_id } = req.body;
  
  console.log("🎬 Adding to favorites:", { user_id, movie_id, title });
  
  if (!user_id || !movie_id || !title) {
    return res.status(400).json({ error: "Missing required fields: user_id, movie_id, title" });
  }

  try {
    // Check if already exists
    const existing = await db.query(
      "SELECT id FROM favorites WHERE user_id = $1 AND movie_id = $2",
      [user_id, movie_id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Movie already in favorites" });
    }

    const result = await db.query(
      `INSERT INTO favorites (user_id, movie_id, title, poster_path, overview, tmdb_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, movie_id, title, poster_path, overview, tmdb_id || movie_id]
    );
    
    console.log("✅ Added to favorites:", title);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding favorite:", err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: "Movie already in favorites" });
    } else {
      res.status(500).json({ error: "Could not add favorite" });
    }
  }
});

// Remove a movie from favorites
router.delete("/", async (req, res) => {
  const { user_id, movie_id } = req.body;
  
  console.log("🗑️ Removing from favorites:", { user_id, movie_id });
  
  if (!user_id || !movie_id) {
    return res.status(400).json({ error: "Missing required fields: user_id, movie_id" });
  }

  try {
    const result = await db.query(
      `DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2 RETURNING id`,
      [user_id, movie_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    console.log("✅ Removed from favorites");
    res.status(200).json({ message: "Favorite removed successfully" });
  } catch (err) {
    console.error("Error deleting favorite:", err);
    res.status(500).json({ error: "Could not delete favorite" });
  }
});

// Check if a movie is favorited by user
router.get("/check/:userId/:movieId", async (req, res) => {
  const { userId, movieId } = req.params;
  try {
    const result = await db.query(
      "SELECT id FROM favorites WHERE user_id = $1 AND movie_id = $2",
      [userId, movieId]
    );
    res.json({ isFavorited: result.rows.length > 0 });
  } catch (err) {
    console.error("Error checking favorite:", err);
    res.status(500).json({ error: "Could not check favorite status" });
  }
});

module.exports = router;