'use strict';
var log = require('lib/log')(module);
var config = require('config');
var connect = require('connect'); // npm i connect
var async = require('async');
var sessionStore = require('lib/sessionStore');
var HttpError = require('error').HttpError;
var User = require('models/user').User;
var Room = require('models/room').Room;
var Archive = require('models/archive').Archive;
var express = require('express');
var sanitizer = require('sanitizer');

function loadSession(sid, callback) {

    // sessionStore callback is not quite async-style!
    sessionStore.load(sid, function (err, session) {
        if (arguments.length == 0) {
            // no arguments => no session
            return callback(null, null);
        } else {
            return callback(null, session);
        }
    });

}

function loadUser(session, callback) {

    if (!session || !session.user) {
        console.log("Session is anonymous");
        return callback(null, null);
    }

    User.findById(session.user, function (err, user) {
        if (err) return callback(err);

        if (!user) {
            return callback(null, null);
        }
        callback(null, user);
    });

}

/**
 * Подготавливает объект с online и offline пользователями.
 *
 * @param usersInRoom список пользователей, которых проверяем
 * @param connectedUsers это объект, у которого ключи - имена пользователей. Пользователь online, если он в этом
 *     объекте.
 * @returns {Object} вида {onlineUsers: [...], offlineUsers: [...]}
 */
function splitUsersOnlineAndOffline(usersInRoom, connectedUsers) {
    var membersList = {onlineUsers: [], offlineUsers: []};
    usersInRoom.forEach(function (elem) {
        if (connectedUsers[elem]) {
            membersList.onlineUsers.push(elem);
        } else {
            membersList.offlineUsers.push(elem);
        }
    });

    return membersList;
}

module.exports = function (server) {
    var io = require('socket.io').listen(server);
    io.set('origins', '*:*');
    io.set('logger', log);

    io.set('authorization', function (handshake, callback) {
        async.waterfall([
            function (callback) {

                var secret = config.get('session:secret');
                var sessionKey = config.get('session:key');

                console.log(handshake.signedCookies); // undefined

                var cookieParser = express.cookieParser(secret);
                cookieParser(handshake, {}, function (err) {
                    if (err) return callback(err);

                    var sid = handshake.signedCookies[sessionKey]; // y handshake появилось поле 'signedCookies'

                    loadSession(sid, callback);
                });
            },
            function (session, callback) {

                if (!session) {
                    callback(new HttpError(401, "No session"));
                }

                handshake.session = session;
                loadUser(session, callback);
            },
            function (user, callback) {
                if (!user) {
                    callback(new HttpError(403, "Anonymous session may not connect"));
                }

                handshake.user = user;
                callback(null);
            }

        ], function (err) {
            if (!err) {
                return callback(null, true);
            }

            if (err instanceof HttpError) {
                return callback(null, false);
            }

            callback(err);
        });

    });

    io.sockets.on('session:reload', function (sid) {
        var clients = io.sockets.clients();

        clients.forEach(function (client) {
            if (client.handshake.session.id != sid) return;

            loadSession(sid, function (err, session) {
                if (err) {
                    client.emit("error", "server error");
                    client.disconnect();
                    return;
                }

                if (!session) {
                    client.emit("logout");
                    client.disconnect();
                    return;
                }

                client.handshake.session = session;
            });
        });
    });

    // пара значений {логин: socket}
    var connectedUsers = {};

    io.sockets.on('connection', function (socket) {

        var username = socket.handshake.user.get('username');
        connectedUsers[username] = {socket: socket}; // сохраняем сокет пользователя для дальнейших обращений

        console.log('connected socket. User %s', username);

        //проверяем сперва, есть ли у пользователя комната по-умолчанию, если нет - добавить ему её и его в неё
        User.checkUserDefaultRoom(username, function (err) {
            if (err) {
                console.error("Ошибка при проверке у пользователя комнаты по-умолчанию: " + err);
                socket.emit("error");
                return;
            }
            console.log("User %s. Комната по-умолчанию в порядке.", username);
        });

        //при подключении join во все комнаты, что есть у пользователя в списке
        //тут же посылаем во все комнаты, где есть этот юзер, что он пришёл
        User.getUserRooms(username, function (err, rooms) {
            if (err) return console.warn("Ошибка при получении комнат пользователя %s", username);
            if (!rooms || !rooms.length) {
                Room.getDefaultRoomId(function (err, roomId) {
                    socket.join(roomId);
                    socket.broadcast.emit('join', username, [{_id: roomId}]);
                });
            } else {
                rooms.forEach(function (room) {
                    socket.join(room._id);
                });
                socket.broadcast.emit('join', username, rooms);
            }
        });


        socket.on('switchRoom', function (roomName, clientCb) {
            console.log("Вызван switchRoom для пользователя %s", username);
            var _roomId;
            async.waterfall([
                //function (callback) {
                //    if (roomName === "all") User.checkUserDefaultRoom(username, callback);
                //    else callback(null);
                //},
                function (callback) {
                    //roomName - это пользовательское название комнаты. Получим из него _id комнаты
                    if (roomName === "all") {
                        Room.getDefaultRoomId(callback);
                    } else {
                        User.getRoomByNameInUser(roomName, username, callback);
                    }
                },
                function (roomId, callback) {
                    _roomId = roomId;
                    socket.room = roomId;
                    socket.join(roomId);
                    User.getUsersInRoom(username, roomName, callback);
                },
                function (usersInRoom, callback) {
                    //посылаем пользователю список людей в комнате, в которую он входит
                    //разделяем список на online и offline пользователей
                    var membersList = splitUsersOnlineAndOffline(usersInRoom, connectedUsers);
                    socket.emit('updateMembersList', membersList);
                    callback(null);

                }
            ], function (err) {
                if (err) {
                    console.error("При переходе в другую комнату возникли ошибки: ", err);
                }
                clientCb && clientCb(_roomId);
            });
        });

        socket.on('message', function (text, callback) {
            text = sanitizer.escape(text);
            // сохраняем в историю сообщений
            Archive.addMessage(socket.room, username, text);

            //сообщение идёт только в текущую комнату
            socket.broadcast.to(socket.room).emit('message', username, text, socket.room);

            callback && callback(); // если передан callback, то он вызывается на клиенте
        });

        socket.on('inviteUsers', function (data, callback) {
            console.info('on invite users');
            var invitedUsers = data.invitedUsers;
            var roomName = data.roomName;
            if (!invitedUsers || !roomName) return callback("Не указаны пользователи или комната для приглашения.");

            User.getRoomByNameInUser(roomName, username, function (err, roomId) {
                if (err) return callback(err);

                async.parallel([
                    function (cb) {
                        User.addRoomToUsers(roomId, roomName, invitedUsers, cb);
                    },
                    function (cb) {
                        Room.addUsersToRoom(invitedUsers, roomId, cb);
                    }
                ], function (err, result) {
                    // здесь result это массив
                    // result[0] = {username: roomName} - список приглашенных (с именем сохраненной комнаты),
                    // result[1] = {...} - комната
                    if (err) {
                        console.error("Invitation failed. Data %o. Error: %o", data, err);
                        return callback(err);
                    }
                    console.info('Success invitation! Последий колбэк получил результаты: %s', JSON.stringify(result, null, 2));

                    var users = result[0];
                    var room = result[1];

                    // тем кто онлайн, указываем, что их пригласили в комнату

                    //итерация по ключам объекта users, где хранятся пары {login: локальное имя комнаты}
                    for (var username in users) {
                        if (users.hasOwnProperty(username) && connectedUsers[username]) {
                            // online пользователи входят в комнату и им присылается событие, что их пригласили
                            // users[username] содержит локальное имя комнаты

                            connectedUsers[username].socket.join(room._id);
                            connectedUsers[username].socket.emit("invited", {_id: room._id, roomName: users[username]});
                            console.info("Пользователю %s отправлено приглашение.", username);
                        }
                    }

                    var usersList = splitUsersOnlineAndOffline(room.users, connectedUsers);

                    // при обновлении комнаты нужно указать какая комната обновляется и послать это всем, кто в комнате
                    io.sockets.in(room._id).emit('updateMembersList', usersList, room._id);
                    callback && callback(null);
                })
            });
        });

        socket.on('leaveRoom', function (roomName, callback) {
            User.leaveRoom(roomName, username, function (err, room) {
                if (err) {
                    console.error(err);
                    return callback(err);
                }
                if (room) {
                    socket.leave(room._id);

                    var usersList = splitUsersOnlineAndOffline(room.users, connectedUsers);
                    io.sockets.in(room._id).emit('updateMembersList', usersList, room._id);
                    io.sockets.in(room._id).emit('userLeave', username, room._id);
                }

                callback(null);
            });
        });

        socket.on('disconnect', function () {
            delete connectedUsers[username];
            User.getUserRooms(username, function (err, roomList) {
                if (err) console.error("getUserRoom: Ошибка: ", err);
                socket.broadcast.emit('leave', username, roomList);
            });
        });

        socket.emit('my login', username);
    });

    return io;
};
