/**
 * Модель чат-комнаты.
 * Содержит _id и хранит список ссылок на своих пользователей.
 */

//TODO Убрать special - это костыль, чтобы создавать группу по-умолчанию.

var mongoose = require('lib/mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    special: {
        type: String,
        unique: true,
        sparse: true
    },
    roomName: String,
    users: [String]
});

/**
 * Ищет комнату, у которой поле special = 'default room'.
 * Если такой комнаты нет, то создаёт её.
 * @param callback - через колбэк возвращаем id комнаты
 */
schema.statics.getDefaultRoomId = function (callback) {
    if (this._DEFAULT_ROOM_ID) return callback(null, this._DEFAULT_ROOM_ID);
    var Room = this;
    Room.findOne({special: 'default room'}, '_id', function(err, room) {
        if (err) return callback(err);
        if (!room) {
            //создаём
            var defaultRoom = new Room({special: 'default room', roomName: 'all'});
            defaultRoom.save(function(err, room) {
                if (err || !room) return log.error("Error creating default room: %s.", err);
                Room._DEFAULT_ROOM_ID = room._id;
                callback(null, room._id);
            });
        } else {
            Room._DEFAULT_ROOM_ID = room._id;
            callback(null, room._id);
        }
    });
};

/**
 * Добавляет логин пользователя в список
 * @param username
 * @param {ObjectId} roomId
 * @param callback
 */
schema.statics.addUserToRoom = function (username, roomId, callback) {
    var Room = this;
    Room.findById(roomId, function (err, room) {
        if (err) return callback(err);
        if (!room) return callback(new Error("WARNING! Room not found!"));

        var foundUser = room.users.filter(function(user) {
            return user === username;
        }).pop();

        if (!foundUser) {
            room.users.push(username);
            room.save(function(err, room) {
                if (err) log.error(err);
                callback(null);
            });
        } else callback(null);
    });
};

module.exports.Room = mongoose.model('Room', schema);


