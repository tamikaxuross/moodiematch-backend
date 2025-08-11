console.log("Quiz route is loaded!");
const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { getMoviesByGenre, getMovieDetails } = require("../utils/tmbd");

// Content filtering function
const isAppropriateContent = (movie) => {
  // Check if movie is not adult content (this is the main filter)
  if (movie.adult) return false;
  
  // Filter out adult/pornographic content based on keywords
  const adultKeywords = [
    'porn', 'sex', 'erotic', 'nude', 'naked', 'xxx', 'adult', 
    'playboy', 'strip', 'escort', 'prostitute', 'brothel'
  ];
  
  const title = movie.title ? movie.title.toLowerCase() : '';
  const overview = movie.overview ? movie.overview.toLowerCase() : '';
  
  // Check for adult content keywords
  const hasAdultContent = adultKeywords.some(word => 
    title.includes(word) || overview.includes(word)
  );
  
  if (hasAdultContent) return false;
  
  // Allow horror movies but filter out extremely graphic ones
  // Only filter if it's both horror AND has extremely graphic content
  if (movie.genre_ids && movie.genre_ids.includes(27)) { // Horror genre
    const extremeWords = ['torture', 'mutilation', 'cannibal', 'necro'];
    const hasExtremeContent = extremeWords.some(word => 
      title.includes(word) || overview.includes(word)
    );
    if (hasExtremeContent) return false;
  }
  
  return true;
};

// Enhanced movie processing with genre names
const processMovie = async (movie) => {
  const genreMap = {
    28: "Action", 35: "Comedy", 18: "Drama", 27: "Horror", 53: "Thriller",
    10749: "Romance", 878: "Sci-Fi", 14: "Fantasy", 12: "Adventure",
    16: "Animation", 80: "Crime", 99: "Documentary", 10751: "Family",
    36: "History", 10402: "Music", 9648: "Mystery", 10770: "TV Movie", 37: "Western"
  };

  let processedMovie = {
    id: movie.id,
    title: movie.title || movie.name || "Untitled",
    overview: movie.overview || "A captivating story that will keep you entertained from start to finish.",
    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    vote_average: movie.vote_average || 0,
    release_date: movie.release_date,
    genres: movie.genre_ids ? movie.genre_ids.map(id => genreMap[id]).filter(Boolean) : []
  };

  // Try to get more detailed info if we have an ID
  if (movie.id) {
    try {
      const detailedMovie = await getMovieDetails(movie.id);
      if (detailedMovie) {
        processedMovie.overview = detailedMovie.overview || processedMovie.overview;
        if (detailedMovie.genres) {
          processedMovie.genres = detailedMovie.genres.map(g => g.name);
        }
      }
    } catch (error) {
      console.log("Could not fetch detailed info for movie:", movie.title);
    }
  }

  return processedMovie;
};

router.post("/", async (req, res) => {
  console.log("Request body:", req.body); 
  const { user_id, answers } = req.body;

  if (!user_id || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid input: user_id and answers array required" });
  }

  let quizId;
  let movies = [];

  try {
    // Create a new quiz
    const quizResult = await db.query(
      "INSERT INTO quizzes (user_id) VALUES ($1) RETURNING id",
      [user_id]
    );
    quizId = quizResult.rows[0].id;
    console.log("✅ Created quiz ID:", quizId);

    // Insert each quiz answer
    for (const item of answers) {
      if (item.question && item.answer) {
        await db.query(
          "INSERT INTO quiz_answers (quiz_id, question, answer) VALUES ($1, $2, $3)",
          [quizId, item.question, item.answer]
        );
      }
    }
    console.log("✅ Answers inserted");

    // Calculate mood scores
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
      if (answer === "scared") moodScores.scared += 3; // Restored full scoring for horror

      if (answer === "red") moodScores.excited += 2;
      if (answer === "blue") moodScores.sad += 2;
      if (answer === "pink") moodScores.romantic += 2;

      if (answer === "fast") moodScores.excited += 2;
      if (answer === "slow") moodScores.thoughtful += 1;
      if (answer === "chaotic") moodScores.scared += 1; // Allow some scary elements
      if (answer === "steady") moodScores.happy += 1;

      if (answer === "beach") moodScores.happy += 2;
      if (answer === "sunny") moodScores.happy += 2;
      if (answer === "rainy") moodScores.sad += 2;
      if (answer === "cloudy") moodScores.thoughtful += 1;
      if (answer === "stormy") moodScores.scared += 2; // Restored scary scoring

      if (answer === "black") moodScores.scared += 2; // Restored scary scoring
      if (answer === "spicy") moodScores.excited += 2;
      if (answer === "sweet") moodScores.romantic += 2;
      if (answer === "savory") moodScores.sad += 1;
      if (answer === "cold") moodScores.scared += 1; // Allow some scary elements
    }

    console.log("🎭 Mood scores:", moodScores);

    // Get top 2-3 moods for variety
    const sortedMoods = Object.entries(moodScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    console.log("🎯 Top moods:", sortedMoods);

    // Map mood to TMDb genre (including horror but filtering adult content)
    const moodToGenre = {
      happy: [35, 10751, 16], // Comedy, Family, Animation
      sad: [18, 10402], // Drama, Music
      romantic: [10749, 35], // Romance, Comedy
      scared: [27, 53], // Horror, Thriller (allowed now)
      excited: [28, 12], // Action, Adventure
      thoughtful: [99, 36, 18] // Documentary, History, Drama
    };

    // Try to get movies from multiple genres
    for (const [mood, score] of sortedMoods) {
      if (score > 0 && movies.length < 6) {
        const genreIds = moodToGenre[mood] || [35]; // Default to comedy
        
        for (const genreId of genreIds) {
          try {
            const genreMovies = await getMoviesByGenre(genreId);
            if (genreMovies && genreMovies.length > 0) {
              // Filter for appropriate content
              const appropriateMovies = genreMovies
                .filter(isAppropriateContent)
                .slice(0, 4); // Get top 4 appropriate movies
              
              // Process and add movies
              for (const movie of appropriateMovies) {
                if (movies.length < 6) {
                  const processedMovie = await processMovie(movie);
                  movies.push(processedMovie);
                }
              }
            }
          } catch (error) {
            console.error("⚠️ Error fetching movies for genre:", genreId, error.message);
          }
        }
      }
    }

    // Remove duplicates based on title
    movies = movies.filter((movie, index, self) => 
      index === self.findIndex(m => m.title === movie.title)
    );

    // Limit to 6 movies maximum
    movies = movies.slice(0, 6);

    // Fallback to database if we don't have enough movies
    if (movies.length === 0) {
      console.log("📚 Using database fallback");
      const fallbackResult = await db.query("SELECT * FROM movies ORDER BY RANDOM() LIMIT 3");
      if (fallbackResult.rows.length > 0) {
        movies = fallbackResult.rows.map(movie => ({
          id: movie.id,
          title: movie.title,
          overview: movie.overview || "A great movie recommendation for you.",
          poster: movie.poster_url || movie.poster_path || null,
          source: "local",
          genres: ["Drama"], // Default genre
          vote_average: 7.0,
          release_date: "2020-01-01"
        }));
      } else {
        return res.status(500).json({ error: "No movies available" });
      }
    }

    // Save results (save first movie as main result for compatibility)
    await db.query(
      "UPDATE quizzes SET result_movie_id = $1, movie_source = $2, result_data = $3 WHERE id = $4",
      [movies[0].id, "tmdb", JSON.stringify(movies), quizId]
    );

    console.log(`🎬 Returning ${movies.length} movies`);
    res.json({ quiz_id: quizId, movies: movies });

  } catch (error) {
    console.error("❌ Quiz creation failed:", error);
    res.status(500).json({ error: "Could not create quiz: " + error.message });
  }
});

// Updated GET route to handle multiple movies
router.get("/:id", async (req, res) => {
  const quizId = req.params.id;

  try {
    const quizResult = await db.query("SELECT * FROM quizzes WHERE id = $1", [quizId]);
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const quiz = quizResult.rows[0];
    let movies = [];

    // Check if we have result_data with multiple movies
    if (quiz.result_data && typeof quiz.result_data === 'object') {
      if (Array.isArray(quiz.result_data)) {
        movies = quiz.result_data;
      } else {
        movies = [quiz.result_data];
      }
      console.log(`✅ Found ${movies.length} movies in result_data`);
    } else if (quiz.result_data && typeof quiz.result_data === 'string') {
      try {
        const parsedData = JSON.parse(quiz.result_data);
        movies = Array.isArray(parsedData) ? parsedData : [parsedData];
        console.log(`✅ Parsed ${movies.length} movies from string data`);
      } catch (parseError) {
        console.error("❌ Failed to parse result_data:", parseError);
      }
    }

    // Fallback to single movie from database
    if (movies.length === 0 && quiz.result_movie_id) {
      console.log("🔄 Falling back to single movie");
      const movieResult = await db.query("SELECT * FROM movies WHERE id = $1", [quiz.result_movie_id]);
      if (movieResult.rows.length > 0) {
        const movie = movieResult.rows[0];
        movies = [{
          id: movie.id,
          title: movie.title,
          overview: movie.overview || "A great movie recommendation.",
          poster: movie.poster_url || movie.poster_path || null,
          genres: ["Drama"],
          vote_average: 7.0,
          release_date: "2020-01-01"
        }];
      }
    }

    // Ultimate fallback
    if (movies.length === 0) {
      console.log("🎲 Using random fallback movies");
      const fallbackResult = await db.query("SELECT * FROM movies ORDER BY RANDOM() LIMIT 3");
      if (fallbackResult.rows.length > 0) {
        movies = fallbackResult.rows.map(movie => ({
          id: movie.id,
          title: movie.title,
          overview: movie.overview || "A wonderful film to enjoy.",
          poster: movie.poster_url || movie.poster_path || null,
          genres: ["Entertainment"],
          vote_average: 7.0,
          release_date: "2020-01-01"
        }));
      } else {
        return res.status(404).json({ message: "No movie results available" });
      }
    }

    console.log(`🎬 Sending ${movies.length} movies to frontend`);
    res.json({ quiz_id: quiz.id, movies: movies });
  } catch (error) {
    console.error("❌ GET /quiz/:id failed:", error);
    res.status(500).json({ error: "Could not retrieve quiz result: " + error.message });
  }
});

module.exports = router;  