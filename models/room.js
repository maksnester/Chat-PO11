/**
 * Модель чат-комнаты.
 * Содержит _id и хранит список ссылок на своих пользователей.
 */

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

var DEFAULT_ROOM_ID;
/**
 * Ищет комнату, у которой поле special = 'default room'.
 * Если такой комнаты нет, то создаёт её.
 * @param callback - через колбэк возвращаем id комнаты
 */
schema.statics.getDefaultRoomId = function (callback) {
    if (DEFAULT_ROOM_ID) return callback(null, DEFAULT_ROOM_ID);
    var Room = this;
    Room.findOne({special: 'default room'}, '_id', function(err, room) {
        if (err) return callback(err);
        if (!room) {
            //создаём
            var defaultRoom = new Room({special: 'default room', roomName: 'all'});
            defaultRoom.save(function(err, room) {
                if (err || !room) return console.error("Error creating default room: %s.", err);
                DEFAULT_ROOM_ID = room._id;
                callback(null, room._id);
            });
        } else {
            Room._DEFAULT_ROOM_ID = room._id;
            callback(null, room._id);
        }
    });
};

/**
 * Добавляет логины пользователей в список
 * @param {Array} usernames
 * @param {ObjectId} roomId
 * @param callback (err, комната)
 */
schema.statics.addUsersToRoom = function (usernames, roomId, callback) {
    var Room = this;
    Room.findById(roomId, function (err, room) {
        if (err) return callback(err);
        if (!room) return callback(new Error("WARNING! Room not found!"));

        // добавляем тех, кого в комнате ещё нет
        var usersForAdd = usernames.filter(function(user) {
            return room.users.indexOf(user) < 0;
        });

        if (usersForAdd.length) {
            usersForAdd.forEach(function(username) {
                room.users.push(username);
            });

            room.save(function(err) {
                if (err) return callback(err);
                callback(null, room);
            });
        } else callback(null, room);
    });
};

module.exports.Room = mongoose.model('Room', schema);


