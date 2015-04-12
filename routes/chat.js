var log = require('lib/log')(module);
var User = require('models/user').User;

exports.get = function(req, res) {
  res.render('chat');
};

exports.getUserRooms = function(req, res, next) {
  var userId = req.session.user;

  User.findById(userId, "rooms", function (err, result) {
    if (err) {
      log.error(err);
      res.status(500);
      return res.send(err);
    }
    if (!result) {
      res.status(400);
      return res.end();
    }

    res.send(result.rooms);
  });
};