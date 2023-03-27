const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user');
const multer = require('multer');
const { expressjwt: jwtcheck } = require('express-jwt');
const { default: mongoose } = require('mongoose');
const Post = require('../models/post');

const MIME_TYPE_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};
const checkIfAuthenticated = jwtcheck({
  secret: 'secret_this_should_be_longer',
  algorithms: ['HS256'],
});

//STORAGE FOR IMAGES
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
const checkUser = function (instance, user, res) {
  if (instance !== user) {
    return false;
  } else {
    return true;
  }
};

//REGISTER USER
router.post(
  '/signup',
  multer({ storage: storage }).single('profilePicture'),
  async (req, res, next) => {
    bcrypt.hash(req.body.password, 10).then(async hash => {
      const user = new User({
        username: req.body.username,
        password: hash,
        displayName: req.body.displayName,
        profilePicture: req.body.profilePicture,
        joinDate: req.body.joinDate,
      });

      await user
        .save()
        .then(result => {
          res.status(201).json({
            message: 'User created successfully.',
            result: result,
          });
        })
        .catch(error => {
          res.status(500).json({
            error: 'Cannot create user. Username already taken.',
          });
        });
    });
  }
);

//LOGIN USER
router.post('/login', (req, res, next) => {
  let getUser;
  User.findOne({ username: req.body.username })
    .then(user => {
      if (!user) {
        return res.status(401).json({
          message:
            '!user Sign in failed. Check your credentials and try again.',
        });
      }
      getUser = user;
      return bcrypt.compare(req.body.password, user.password);
    })
    .then(result => {
      if (!result) {
        return res.status(401).json({
          message:
            '!result Sign in failed. Check your credentials and try again.',
        });
      }
      const token = jwt.sign({}, 'secret_this_should_be_longer', {
        expiresIn: '1h',
        subject: JSON.stringify(getUser._id.valueOf()),
      });

      res.status(200).json({
        token: token,
        expiresIn: '1h',
        message: 'Token created.',
      });
    })
    .catch(err => {
      return res.status(401).json({
        message: 'Catch Sign in failed. Check your credentials and try again.',
      });
    });
});

router.get('/me/:accessToken', (req, res, next) => {
  const decodedToken = jwt.decode(
    req.params.accessToken,
    'secret_this_should_be_longer'
  );
  if (decodedToken) {
    res.status(200).json({
      userData: decodedToken.sub,
    });
  } else {
    res.status(401).json({
      message: 'Unauthorized',
      userData: null,
    });
  }
});

module.exports = router;
