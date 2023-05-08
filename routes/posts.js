const express = require("express");
const { expressjwt: jwt } = require("express-jwt");
const mongoose = require("mongoose");
const Post = require("../models/post");
const checkAuth = require("../middleware/check-auth");

const checkIfAuthenticated = jwt({
	secret: process.env.SECRET,
	algorithms: ["HS256"],
});

const router = express.Router();
const multer = require("multer");

const MIME_TYPE_MAP = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
};

const storage = multer.diskStorage({
	destination: (req, file, callback) => {
		callback(null, "../images");
	},
	filename: (req, file, callback) => {
		const name = file.originalname.toLowerCase().split(" ").join("-");
		const extension = MIME_TYPE_MAP[file.mimetype];
		callback(null, name + "-" + Date.now() + "." + extension);
	},
});

//POST
router.post(
	"/api/posts",
	checkIfAuthenticated,
	multer({ storage: storage }).single("image"),
	async (req, res, next) => {
		const post = new Post({
			id: new mongoose.Types.ObjectId(),
			text: req.body.text,
			date: req.body.date,
			imageUrl: req.body.image,
			author: req.body.author,
			likesCounter: req.body.likesCounter,
		});
		await post.save();
		res.status(201).json({
			message: "Post added successfully",
		});
	}
);

//FETCHING DATA
router.get("/api/posts", checkIfAuthenticated, (req, res, next) => {
	Post.find({ allowDiskUse: true })
		.sort({ date: -1 })
		.then((documents) => {
			res.status(200).json({
				message: "Post fetched succesfully!",
				posts: documents,
			});
		});
});

//FETCHING USER'S POST FOR USER'S PROFILE
router.get("/users/:id/posts", checkIfAuthenticated, (req, res, next) => {
	var userPosts = Post.find({ "author._id": req.params.id });
	userPosts
		.sort("-date")
		.exec()
		.then((documents) => {
			res.status(200).json({
				message: "Users posts fetched succesfully.",
				posts: documents,
			});
		})
		.catch(function (err) {
			res.status(404).json({
				message: "User not found.",
			});
		});
});
//FETCHING USER'S LIKED POSTS FOR USER'S PROFILE
router.get("/users/:id/likes", checkIfAuthenticated, (req, res, next) => {
	Post.find({ likedByIdArray: { $in: req.params.id } })
		.sort("-date")
		.then((likedPosts) => {
			res.status(200).json({
				posts: likedPosts,
			});
		});
});

const checkUser = function (instance, user, res) {
	if (instance !== user) {
		return false;
	} else {
		return true;
	}
};
//DELETING POST
router.delete(
	"/api/posts/:id",
	checkIfAuthenticated,
	async (req, res, next) => {
		const postToBeDeleted = await Post.findById({ _id: req.params.id });
		const postAuthorId = postToBeDeleted.author._id.valueOf();
		const userId = req.body.userId;
		if (checkUser(postAuthorId, userId)) {
			postToBeDeleted.delete().then(() => {
				res.status(200).json({
					message: "Post deleted successfully. User authorized.",
				});
			});
		} else {
			res.status(401).json({
				message: "User unauthorized.",
			});
		}
	}
);

//GETTING POST DETAILS
router.get("/api/posts/:id", async (req, res, next) => {
	await Post.findById({ _id: req.params.id }).then((document) => {
		res.status(200).json({
			message: "Post found",
			post: document,
		});
	});
});

//UPDATING POST REPLIES ARRAY
router.put("/api/posts/:id/replies", async (req, res, next) => {
	Post.findOneAndUpdate(
		{ _id: req.params.id },
		{
			$push: { replies: [req.body] },
		}
	).then((document) => {
		res.status(200).json({
			post: document,
			message: "Reply added successfully. User authorized.",
		});
	});
});

//UPDATING POST LIKES COUNT
router.put("/api/posts/:id", checkIfAuthenticated, (req, res, next) => {
	Post.find(
		{ _id: req.params.id, likedByIdArray: { $in: req.body.userId } },
		async function (err, result) {
			if (result.length > 0) {
				//DECREASING LIKES COUNTER - $pullAll and $inc together in one curly
				await Post.findOneAndUpdate(
					{ _id: req.params.id },
					{
						$pullAll: { likedByIdArray: [req.body.userId] },
						$inc: { likesCounter: -1 },
					}
				).then((result) => {});
				res.status(200).json({ message: "Post updated" });
			} else {
				//INCREASING LIKES COUNTER - $push and $inc together in one curly
				await Post.findOneAndUpdate(
					{ _id: req.params.id },
					{
						$push: { likedByIdArray: [req.body.userId] },
						$inc: { likesCounter: 1 },
					}
				).then((result) => {});
				res.status(200).json({ message: "Post updated" });
			}
		}
	);
});

module.exports = router;
