const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
require("dotenv").config();
const postsRoutes = require("./routes/posts");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/user");
const app = express();

//DATABASE CONNECTION ESTABLISHMENT
mongoose
	.connect(process.env.DB_CONNECTION)
	.then(() => {
		console.log("Connected to database");
	})
	.catch((e) => {
		console.log("Connection failed");
	});

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

//CORS
app.use((req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept, Authorization"
	);
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, PATCH, PUT, DELETE, OPTIONS"
	);
	next();
});

app.use(postsRoutes);
app.use(usersRoutes);
app.use(authRoutes);

module.exports = app;
