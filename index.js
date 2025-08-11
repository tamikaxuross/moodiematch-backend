require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "https://moodiematch-frontend.onrender.com"],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log("Received:", req.method, req.originalUrl);
  next();
});

const userRoutes = require("./routes/users");
const quizRoutes = require("./routes/quiz");
const favoritesRoutes = require("./routes/favorites");

app.use("/api/users", userRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/favorites", favoritesRoutes)
//const favoritesRoutes = require("./routes/favorites");
//app.use("/api/favorites", favoritesRoutes);


app.get("/", (req, res) => {
  res.send("MoodieMatch backend is running ");
});



app.get("/api/ping", (req, res) => {
  res.json({ message: "pong from Express + Postgres" });
});

const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

