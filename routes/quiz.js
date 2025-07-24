console.log("Quiz route is loaded!");
const express = require("express");
const router = express.Router();
const db = require("../db/client");

router.post("/", async (req, res) => {
  console.log("Request body:", req.body); 
  const { user_id, answers } = req.body;

  let quizId;

  
  try {
    // Create a new quiz
    const quizResult = await db.query(
      "INSERT INTO quizzes (user_id) VALUES ($1) RETURNING id",
      [user_id]
    );
    quizId = quizResult.rows[0].id;
    console.log("Created quiz ID:", quizId);
  } catch (error) {
    console.error("Quiz creation failed:", error);
    return res.status(500).json({ error: "Could not create quiz" });
  }
  try {
    //Insert each quiz answer
    for (const item of answers) {
      await db.query(
        "INSERT INTO quiz_answers (quiz_id, question, answer) VALUES ($1, $2, $3)",
        [quizId, item.question, item.answer]
      );
    }
    console.log("✅ Answers inserted");
  } catch (error) {
    console.error("Inserting answers failed:", error);
    return res.status(500).json({ error: "Could not insert quiz answers" });
  }

  let movie;
  try {
    const movieResult = await db.query("SELECT * FROM movies ORDER BY RANDOM() LIMIT 1");
    movie = movieResult.rows[0];
    console.log("🎬 Selected movie:", movie);
  } catch (error) {
    console.error("Selecting random movie failed:", error);
    return res.status(500).json({ error: "Could not get movie" });
  }

  try {
    await db.query(
      "UPDATE quizzes SET result_movie_id = $1 WHERE id = $2",
      [movie.id, quizId]
    );
    console.log("✅ Linked movie to quiz");
  } catch (error) {
    console.error("Updating quiz with movie failed:", error);
    return res.status(500).json({ error: "Could not update quiz with movie" });
  }

  res.json({ quiz_id: quizId, movie });
});

// GET /api/quiz/:id — Get quiz + movie result
router.get("/:id", async (req, res) => {
  const quizId = req.params.id;

  try {
    const quizResult = await db.query("SELECT * FROM quizzes WHERE id = $1", [quizId]);

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const quiz = quizResult.rows[0];

    const movieResult = await db.query(
      "SELECT * FROM movies WHERE id = $1",
      [quiz.result_movie_id]
    );

    if (movieResult.rows.length === 0) {
      return res.status(404).json({ message: "Movie not found" });
    }

    const movie = movieResult.rows[0];

    res.json({ quiz_id: quiz.id, movie });
  } catch (error) {
    console.error("Error fetching quiz result:", error);
    res.status(500).json({ error: "Server error while retrieving quiz result" });
  }
});


module.exports = router;


