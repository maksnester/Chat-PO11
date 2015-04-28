var User = require('models/user').User;
var HttpError = require('error').HttpError;
var AuthError = require('models/user').AuthError;
var async = require('async');

exports.get = function(req, res) {
  res.render('login');
};

var forbiddenLogins = ['я', 'server', 'admin'];

exports.post = function(req, res, next) {
  //TODO добавить валидацию пароля
  var username = req.body.username;
  var password = req.body.password;

  if (!username || !password ||
      forbiddenLogins.indexOf(username.toLowerCase()) > -1 || username !== username.replace(/[^A-zА-яЁё\d\s-]/g, '')
  ) {
    return next(new HttpError(403, "Некорректные данные логина или пароля."));
  } else if (username.length > 32) {
    return next(new HttpError(403, "Слишком длинный логин. Максимальная длина = 32 символам."));
  }

  User.authorize(username, password, function(err, user) {
    if (err) {
      if (err instanceof AuthError) {
        return next(new HttpError(403, err.message));
      } else {
        return next(err);
      }
    }

    req.session.user = user._id;
    res.send({});

  });

};