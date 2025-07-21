const express = require("express");
const router = express.Router();
const db = require("../db/client");

router.post("/", async (req, res) => {
  const { username } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO users (username) VALUES ($1) RETURNING *",
      [username]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
