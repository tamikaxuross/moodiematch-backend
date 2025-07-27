const axios = require('axios');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getMoviesByGenre(genreId) {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        with_genres: genreId,
        sort_by: 'popularity.desc',
        language: 'en-US',
        page: 1,
      },
    });

    return response.data.results;
  } catch (error) {
    console.error("TMDb API error:", error.response?.data || error.message);
    throw new Error("Failed to fetch movies from TMDb");
  }
}

module.exports = { getMoviesByGenre };
