console.log("Quiz route is loaded!");
const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { getMoviesByGenre } = require("../utils/tmbd");

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
    console.log("Answers inserted");
  } catch (error) {
    console.error("Inserting answers failed:", error);
    return res.status(500).json({ error: "Could not insert quiz answers" });
  }

  const moodScores = {
  happy: 0,
  sad: 0,
  romantic: 0,
  scared: 0,
  excited: 0,
  thoughtful: 0
};

for (const item of answers) {
  const answer = item.answer.toLowerCase();

  if (answer === "forest") moodScores.thoughtful += 2;
  if (answer === "city") moodScores.excited += 2;
  if (answer === "space") moodScores.scared += 1;

  if (answer === "happy") moodScores.happy += 3;
  if (answer === "sad") moodScores.sad += 3;
  if (answer === "romantic") moodScores.romantic += 3;
  if (answer === "scared") moodScores.scared += 3;

  if (answer === "red") moodScores.excited += 2;
  if (answer === "blue") moodScores.sad += 2;
  if (answer === "pink") moodScores.romantic += 2;

  if (answer === "fast") moodScores.excited += 2;
  if (answer === "slow") moodScores.thoughtful += 1;
  if (answer === "chaotic") moodScores.scared += 1;
  if (answer === "steady") moodScores.happy += 1;

  if (answer === "beach") moodScores.happy += 2;
  if (answer === "sunny") moodScores.happy += 2;
  if (answer === "rainy") moodScores.sad += 2;
  if (answer === "cloudy") moodScores.thoughtful += 1;
  if (answer === "stormy") moodScores.scared += 2;

  if (answer === "black") moodScores.scared += 2;
  if (answer === "spicy") moodScores.excited += 2;
  if (answer === "sweet") moodScores.romantic += 2;
  if (answer === "savory") moodScores.sad += 1;
  if (answer === "cold") moodScores.scared += 1;
}

// Pick mood with highest score
const topMood = Object.keys(moodScores).reduce((a, b) =>
  moodScores[a] > moodScores[b] ? a : b
);

// Map mood to TMDb genre
const moodToGenre = {
  happy: 35,
  sad: 18,
  romantic: 10749,
  scared: 27,
  excited: 28,
  thoughtful: 99
};

const genreId = moodToGenre[topMood];

let movie;
try {
  const movies = await getMoviesByGenre(genreId);
  movie = movies[0];

  if (!movie) throw new Error("No movie returned from TMDb");

  console.log("🎬 Selected movie from TMDb:", movie);
} catch (error) {
  console.error("TMDb error:", error);
  return res.status(500).json({ error: "Could not fetch movie from TMDb" });
}
  try {
    await db.query(
      "UPDATE quizzes SET result_movie_id = $1 WHERE id = $2",
      [movie.id, quizId]
    );
    console.log("Linked movie to quiz");
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


