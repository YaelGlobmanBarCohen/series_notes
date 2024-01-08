import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";

const app = express();
const port = 3000;
const SOLT_ROUNDS = 10;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();

async function getSeries(){
  let series = await db.query("select * from series")
  return series.rows;
}

// app.get("/", async (req, res) => {
//   const series = await getSeries();
//   console.log("the items are: " + series);
//   res.render("index.ejs", {
//     seriesList: series,
//     listTitle: "Series I Watched"
//   });
// });

app.get("/", function(req, res){
  res.render("home.ejs");
});

app.get("/login", function(req, res){
  res.render("login.ejs", {
    password: "Password"
  });
});

app.get("/register", function(req, res){
  res.render("register.ejs", {
    verifyEmail: "Email address",
    verifyPassword: "Verify Password"
  });
});

app.get("/logout", function(req, res){
  res.render("home.ejs");
});

// TODO yael- complite this
app.post("/login", async function(req, res){
  let username = req.body.username;
  let password = req.body.password;
  let hashPass;
  try {
    const result = await db.query("SELECT hashed_password FROM users WHERE email = $1", [username]);
  
    if (result.rows.length > 0) {
      hashPass = result.rows[0].hashed_password;
      console.log("Hashed Password:", hashPass);
    } else {
      console.log("User not found with the specified email.");
    }
  } catch (error) {
    console.error("Error executing query:", error.message);
  }
  bcrypt.compare(password, hashPass).then(async function(result) {
    console.log(result);
    if (result == true){
      const series = await getSeries();
      res.render("index.ejs", {
        seriesList: series,
        listTitle: "Series I Watched"
      });
    } else{
      res.render("login.ejs", {
        password: "Wrong password, please try again"
      });
    }
  });
});

app.post("/register", async function(req, res){
  let username = req.body.username;
  let password = req.body.password;
  let verifyPassword = req.body.verifyPassword;
  if(password != verifyPassword){
    res.render("register.ejs", {
      verifyEmail: "Email address",
      verifyPassword: "Passwords are not identical, please try again"
    });    
  } else if(getUserId(username).data != undefined){
    res.render("register.ejs", {
      verifyEmail: "User name already exists, please try another one",
      verifyPassword: "Verify Password"
    });    
  } else{
    bcrypt.hash(password, SOLT_ROUNDS).then(async function(hash) {
      await db.query("insert into users (email, password) values ($1, $2)", [username, hash]);
    });  
    const series = await getSeries();
    res.render("index.ejs", {
      seriesList: series,
      listTitle: "Series I Watched"
    });
  }
});

app.post("/add", async (req, res) => {
  const title = capitalizeWords(req.body.newSerie);
  const season = req.body.season;
  const episod = req.body.episod;
  const notes = req.body.notes;
  const showPicture = getSeriePicture(title);

  try {
    await db.query("insert into series (title, last_season, last_episode, note, picture) values ($1, $2, $3, $4, $5)", [title, season, episod, notes, showPicture]);
    } catch(err){
    console.log(err);
  }

  res.redirect("/");
});

app.post("/edit", async(req, res) => {
  const id = req.body.updatedSerieId;
  const oldTitle = req.body.oldSerieTitle;
  const newTitle = req.body.updatedSerieTitle;
  const newSeason = req.body.updatedSeason;
  const newEpisode = req.body.updatedEpisode;
  const newNote = req.body.updatedNote;
  
  if(oldTitle != newTitle){
    const showPicture = getSeriePicture(newTitle);
    const updateQuery = `UPDATE series SET title = $1, last_season = $2, last_episode = $3, note = $4, picture = $5 WHERE id = $6;`;
  
    try {
      await db.query(updateQuery, [newTitle, newSeason, newEpisode, newNote, showPicture, id]);
      console.log('Series updated successfully.');
    } catch (error) {
      console.error('Error updating series:', error);
    }
  } else{
    const updateQuery = `UPDATE series SET last_season = $1, last_episode = $2, note = $3 WHERE id = $4;`;
  
    try {
      await db.query(updateQuery, [newSeason, newEpisode, newNote, id]);
      console.log('Series updated successfully.');
    } catch (error) {
      console.error('Error updating series:', error);
    }
  }
  res.redirect("/");

});

app.post("/delete", async (req, res) => {
  console.log("get to delete func, id: " + serieIdToDelete);
  const deleteQuery = `DELETE FROM series WHERE id = $1;`;
  
  try {
    await db.query(deleteQuery, [serieIdToDelete]);
    console.log('Series deleted successfully.');
  } catch (error) {
    console.error('Error deleting series:', error);
  }
  res.redirect("/");
});

function capitalizeWords(inputString) {
  return inputString.replace(/\b\w/g, function(match) {
    return match.toUpperCase();
  });
}

async function getSeriePicture(serieName){
  const options = {
    method: 'GET',
    url: 'https://utelly-tv-shows-and-movies-availability-v1.p.rapidapi.com/lookup',
    params: {
      term: serieName
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
    }
  };

  let showPicture = '';
  try {
    const response = await axios.request(options);
    let data = response.data;

    if (response.status >= 200 && response.status < 300) {
      const foundPicture = data.results.find((obj) => obj.picture != null);
      showPicture = foundPicture.picture;
      console.log("The picture: " + showPicture);
      return showPicture;
    } else {
      console.error('Error response:', response.status, data);
  
      throw new Error('Error in HTTP request');
    }
  } catch (err) {
    console.log("An error occurred:", err.message);
  }
  return showPicture;
}

async function getUserId(email){
  let userId = await db.query("select id from users where email = $1", [email]);
  return userId;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
