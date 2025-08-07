console.log("Quiz route is loaded!");
const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { getMoviesByGenre } = require("../utils/tmbd");

router.post("/", async (req, res) => {
  console.log("Request body:", req.body); 
  const { user_id, answers } = req.body;

    if (!user_id || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid input: user_id and answers array required" });
  }



  let quizId;
  let movie;

  
  try {
    // Create a new quiz
    const quizResult = await db.query(
      "INSERT INTO quizzes (user_id) VALUES ($1) RETURNING id",
      [user_id]
    );
    quizId = quizResult.rows[0].id;
    console.log("✅ Created quiz ID:", quizId);

 
    //Insert each quiz answer
    for (const item of answers) {
      if (item.question && !item.answer) {
      await db.query(
        "INSERT INTO quiz_answers (quiz_id, question, answer) VALUES ($1, $2, $3)",
        [quizId, item.question, item.answer]
      );
    }
  }
    console.log("✅ Answers inserted");


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

  console.log("Mood scores:", moodScores);

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
console.log("🎭 Top mood:", topMood, "Scores:", moodScores);

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
console.log("Genre ID:", genreId);

// Try TMDB first
    if (genreId) {
      try {
        const movies = await getMoviesByGenre(genreId);
        if (movies && movies.length > 0) {
          movie = movies[Math.floor(Math.random() * Math.min(movies.length, 10))];
          movie.poster = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
          movie.source = "tmdb";
          console.log("🎬 Got movie from TMDB:", movie.title);
        }
      } catch (error) {
        console.error("⚠️ TMDB failed:", error.message);
      }
    }

    // Fallback to database
    if (!movie) {
      console.log("📚 Using database fallback");
      const fallbackResult = await db.query("SELECT * FROM movies ORDER BY RANDOM() LIMIT 1");
      if (fallbackResult.rows.length > 0) {
        movie = fallbackResult.rows[0];
        movie.source = "local";
      } else {
        return res.status(500).json({ error: "No movies available" });
      }
    }

    // Save result
    await db.query(
      "UPDATE quizzes SET result_movie_id = $1, movie_source = $2, result_data = $3 WHERE id = $4",
      [movie.id, movie.source, movie, quizId]
    );

    // Return normalized response
    const normalizedMovie = {
      id: movie.id,
      title: movie.title || movie.name || "Untitled",
      overview: movie.overview || "No description available.",
      poster: movie.poster || "https://via.placeholder.com/300x450?text=No+Poster",
      source: movie.source
    };

    res.json({ quiz_id: quizId, movie: normalizedMovie });

  } catch (error) {
    console.error("❌ Quiz creation failed:", error);
    res.status(500).json({ error: "Could not create quiz: " + error.message });
  }
});

// GET route (your existing code is mostly fine)
router.get("/:id", async (req, res) => {
  const quizId = req.params.id;

  try {
    const quizResult = await db.query("SELECT * FROM quizzes WHERE id = $1", [quizId]);
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const quiz = quizResult.rows[0];
    let movie;

    // Check if we have result_data (TMDB movie)
    if (quiz.result_data && typeof quiz.result_data === 'object') {
      // result_data is already an object (JSONB), no need to parse
      movie = quiz.result_data;
      console.log("✅ Found TMDB movie data:", movie.title);
    } else if (quiz.result_data && typeof quiz.result_data === 'string') {
      // If it's a string, try to parse it
      try {
        movie = JSON.parse(quiz.result_data);
        console.log("✅ Parsed TMDB movie data:", movie.title);
      } catch (parseError) {
        console.error("❌ Failed to parse result_data:", parseError);
        movie = null;
      }
    }

    // Fallback to local movies table
    if (!movie && quiz.result_movie_id) {
      console.log("🔄 Falling back to local movie ID:", quiz.result_movie_id);
      const movieResult = await db.query("SELECT * FROM movies WHERE id = $1", [
        quiz.result_movie_id
      ]);
      if (movieResult.rows.length > 0) {
        movie = movieResult.rows[0];
        movie.poster = movie.poster_url || movie.poster_path || "https://via.placeholder.com/300x450?text=No+Poster";
      }
    }

    // Ultimate fallback
    if (!movie) {
      console.log("🎲 Using random fallback movie");
      const fallbackResult = await db.query("SELECT * FROM movies ORDER BY RANDOM() LIMIT 1");
      if (fallbackResult.rows.length > 0) {
        movie = fallbackResult.rows[0];
        movie.poster = movie.poster_url || movie.poster_path || "https://via.placeholder.com/300x450?text=No+Poster";
      } else {
        return res.status(404).json({ message: "No movie results available" });
      }
    }

    // Normalize movie response
    const normalizedMovie = {
      id: movie.id,
      title: movie.title || movie.name || "Untitled",
      overview: movie.overview || "No description available.",
      poster: movie.poster || `https://image.tmdb.org/t/p/w500${movie.poster_path}` || "https://via.placeholder.com/300x450?text=No+Poster",
      source: quiz.movie_source || "local"
    };

    console.log("🎬 Sending normalized movie:", normalizedMovie.title);
    res.json({ quiz_id: quiz.id, movie: normalizedMovie });
  } catch (error) {
    console.error("❌ GET /quiz/:id failed:", error);
    res.status(500).json({ error: "Could not retrieve quiz result: " + error.message });
  }
});

module.exports = router;