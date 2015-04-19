var crypto = require('crypto');
var async = require('async');
var util = require('util');
var utils = require('lib/utils');
var log = require('lib/log')(module);

var mongoose = require('lib/mongoose');
var Schema = mongoose.Schema;

var Room = require('models/room').Room;

var schema = new Schema({
    username: {
        type: String,
        unique: true,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    },
    rooms: [
        {
            _id: {
                type: Schema.Types.ObjectId,
                ref: 'Group'
            },
            roomName: {
                type: String,
                unique: true
            }
        }
    ]
});

schema.methods.encryptPassword = function (password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
};

schema.virtual('password')
    .set(function (password) {
        this._plainPassword = password;
        this.salt = Math.random() + '';
        this.hashedPassword = this.encryptPassword(password);
    })
    .get(function () {
        return this._plainPassword;
    });


schema.methods.checkPassword = function (password) {
    return this.encryptPassword(password) === this.hashedPassword;
};

schema.statics.authorize = function (username, password, callback) {
    var User = this;

    async.waterfall([
        function (callback) {
            User.findOne({username: username}, callback);
        },
        function (user, callback) {
            if (user) {
                if (user.checkPassword(password)) {
                    callback(null, user);
                } else {
                    callback(new AuthError("Пароль неверен"));
                }
            } else {
                var user = new User({username: username, password: password});
                user.save(function (err) {
                    if (err) return callback(err);
                    callback(null, user);
                });
            }
        }
    ], callback);
};

/**
 * Возвращает через callback список пользователей в комнате.
 * У пользователя комнаты могут быть названы по-своему.
 *
 * @param username
 * @param roomName - наименование комнаты у пользователя.
 * @param callback - используется для передачи списка пользователей
 */
schema.statics.getUsersInRoom = function (username, roomName, callback) {
    var User = this;
    User.findOne({"username": username}, function (err, user) {
        if (err) {
            return callback(err);
        }
        if (!user) {
            log.error("User %s not found.", username);
            return callback(new Error("User " + username + " not found."));
        }

        var room = user.rooms.filter(function (room) {
            return room.roomName === roomName;
        }).pop();

        if (!room) {
            log.error("Room %s not found in user %s", roomName, username);
            return callback(new Error("Room " + roomName + " not found in user " + username));
        }

        var roomId = room._id;
        Room.findById(roomId, 'users', function (err, result) {
            if (err) {
                log.error("Error while retrieving room %s from Rooms collection. Error: %s", roomName, err);
                return callback(err);
            }
            if (!result) {
                log.error("Room %s not found in Rooms collection", roomName);
                return callback(null, null);
            }

            callback(null, result.users);
        });
    });
};

/**
 * Получить по пользовательскому названию комнаты её id.
 * @param roomName пользовательское название комнаты
 * @param username
 * @param callback (ошибка, id комнаты)
 */
schema.statics.getRoomByNameInUser = function (roomName, username, callback) {
    var User = this;
    User.findOne({username: username}, 'rooms', function (err, user) {
        if (err) return callback(err);
        if (!user) return callback(new Error("User " + username + " not found."));

        var index = utils.indexOfObjByAttr(user.rooms, "roomName", roomName);
        if (index < 0) return callback(new Error("getRoomByNameInUser: Room " + roomName + " not found in user " + username));

        callback(null, user.rooms[index]._id);
    });
};

/**
 * Получить список комнат для пользователя и передать их через callback.
 * @param username
 * @param callback (ошибка, комнаты)
 */
schema.statics.getUserRooms = function (username, callback) {
    var User = this;
    User.findOne({username: username}, function (err, user) {
        if (err) return callback(err);
        if (!user) return callback(new Error("User " + username + " not found."));
        callback(null, user.rooms);
    });
};

/**
 * Устанавливает связи между пользователем и комнатой, добавляя имя пользователя в список комнаты,
 * а _id комнаты, в список комнат у пользователя.
 *
 * @param username
 * @param callback вызов с аргументом null означает, что комната нашлась, либо была добавлена.
 */
schema.statics.checkUserDefaultRoom = function (username, callback) {
    var User = this;
    Room.getDefaultRoomId(function(err, DEFAULT_ROOM_ID) {
        if (err) return callback(err);

        User.findOne({username: username}, function (err, user) {
            if (err) callback(err);
            if (!user) callback("User " + username + " not found.");

            var room = user.rooms.id(DEFAULT_ROOM_ID);

            if (!room) {
                user.rooms.push({_id: DEFAULT_ROOM_ID, roomName: 'all'});
                user.save(function (err, user) {
                    if (err) return callback(err);

                    Room.addUserToRoom(username, DEFAULT_ROOM_ID, function(err) {
                        if (err) return callback(err);
                        callback(null);
                    });

                });
            } else callback(null);
        });
    });
};

/**
 * В коллекции Users добавляет пользователю комнату в список с указанным именем
 * @param room
 * @param username
 * @param roomName
 * @param callback
 */
schema.statics.addRoomToUser = function (room, username, roomName, callback) {
    //not implemented yet
    callback("addRoomToUser is not implemented yet.");
};

module.exports.User = mongoose.model('User', schema);


function AuthError(message) {
    Error.apply(this, arguments);
    Error.captureStackTrace(this, AuthError);

    this.message = message;
}

util.inherits(AuthError, Error);

AuthError.prototype.name = 'AuthError';

exports.AuthError = AuthError;


