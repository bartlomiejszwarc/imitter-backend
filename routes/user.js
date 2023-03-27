const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user');
const multer = require('multer');
const {expressjwt: jwtcheck} = require('express-jwt');
const {default: mongoose} = require('mongoose');
const Post = require('../models/post');

//FOR IMAGE UPLOAD
const MIME_TYPE_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, '../images');
  },
  filename: (req, file, callback) => {
    const name = file.originalname.toLowerCase().split(' ').join('-');
    const extension = MIME_TYPE_MAP[file.mimetype];
    callback(null, name + '-' + Date.now() + '.' + extension);
  },
});

//CHECKING AUTH
const checkIfAuthenticated = jwtcheck({
  secret: 'secret_this_should_be_longer',
  algorithms: ['HS256'],
});

//FUNCTION THAT COMPARES INSTANCE AUTHOR AND GIVEN USER, FOR EXAMPLE
const checkUser = function (instance, user, res) {
  if (instance !== user) {
    return false;
  } else {
    return true;
  }
};

//GETTING USER'S DATA BY ID
router.get('/userdata/:userId', (req, res, next) => {
  if (req.params.userId) {
    User.findById(req.params.userId)
      .then((userdata) => {
        res.status(200).json({
          message: 'User found.',
          userdata: userdata,
        });
      })
      .catch((e) => {
        res.status(404).json({
          message: 'User not found.',
        });
      });
  }
});

router.get('/profile/:username', (req, res, next) => {
  User.findOne({username: req.params.username}).then((userdata) => {
    if (userdata) {
      return res.status(200).json({
        message: 'User found.',
        userdata: userdata,
      });
    } else {
      return res.status(404).json({
        message: 'User not found.',
      });
    }
  });
});

//UPDATING USER DATA
router.put('/api/users/:id', checkIfAuthenticated, (req, res, next) => {
  if (checkUser(req.params.id, req.body.id)) {
    User.findOneAndUpdate(
      {_id: req.params.id},
      {
        $set: {
          displayName: req.body.displayName,
          bio: req.body.bio,
          location: req.body.location,
        },
      },
      function (err, response) {
        Post.updateMany({'author._id': req.params.id}, {'author.displayName': req.body.displayName})
          .exec()
          .then(
            res.status(200).json({
              message: 'User data updated',
            })
          );
      }
    );
  } else {
    res.status(401).json({
      message: 'Unauthorized',
    });
  }
});

module.exports = router;
