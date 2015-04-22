/**
 * Данный middleware нужен для проверки у пользователя доступа к запрашиваемой комнате.
 * NB: Вызывать строго после checkAuth
 */

var HttpError = require('error').HttpError;
var Room = require('models/room').Room;
var User = require('models/user').User;

module.exports = function(req, res, next) {
    var roomId = req.params.roomId;
    var user = req.session.user;

    if (roomId && user) {
        User.findById(user, "rooms", function (err, user) {
            if (err) return next(new HttpError(500, err));
            if (!user) return next(new HttpError(404));

            var room = user.rooms.id(roomId);
            if (!room) {
                next(new HttpError(404)); // притворяемся, что не знаем такой комнаты вообще
            } else {
                next();
            }

        });
    } else next();
};