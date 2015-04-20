'use strict';
var log = require('lib/log')(module);
var config = require('config');
var connect = require('connect'); // npm i connect
var async = require('async');
var sessionStore = require('lib/sessionStore');
var HttpError = require('error').HttpError;
var User = require('models/user').User;
var Room = require('models/room').Room;
var express = require('express');

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

    if (!session.user) {
        console.log("Session %s is anonymous", session.id);
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
 * @param __users это объект, у которого ключи - имена пользователей. Пользователь online, если он в этом объекте.
 * @returns {Object} вида {onlineUsers: [...], offlineUsers: [...]}
 */
function splitUsersOnlineAndOffline(usersInRoom, __users) {
    var membersList = {onlineUsers: [], offlineUsers: []};
    usersInRoom.forEach(function (elem) {
        if (__users[elem]) {
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

    var __users = {};

    io.sockets.on('connection', function (socket) {

        var username = socket.handshake.user.get('username');
        __users[username] = {socket: socket}; // сохраняем сокет пользователя для дальнейших обращений

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
        User.getUserRooms(username, function(err, rooms) {
            if (err) return console.warn("Ошибка при получении комнат пользователя %s", username);

            rooms.forEach(function(room) {
               socket.join(room._id);
            });
        });


        socket.on('switchRoom', function (roomName, clientCb) {
            console.log("Вызван switchRoom для пользователя %s", username);
            var _roomId;
            async.waterfall([
                function (callback) {
                    console.log("Zero of waterfall for user %s", username);
                    if (roomName === "all") User.checkUserDefaultRoom(username, callback);
                    else callback(null);
                },
                function (callback) {
                    console.log("First of waterfall for user %s", username);
                    //roomName - это пользовательское название комнаты. Получим из него _id комнаты
                    User.getRoomByNameInUser(roomName, username, callback);
                },
                function (roomId, callback) {
                    console.log("Second of waterfall for user %s", username);
                    _roomId = roomId;
                    socket.room = roomId;
                    socket.join(roomId);
                    User.getUsersInRoom(username, roomName, callback);
                },
                function (usersInRoom, callback) {
                    console.log("Third of waterfall for user %s", username);
                    //посылаем пользователю список людей в комнате, в которую он входит
                    //разделяем список на online и offline пользователей
                    console.info("usersInRoom: ", usersInRoom);

                    var membersList = splitUsersOnlineAndOffline(usersInRoom, __users);

                    console.info("membersList: ", membersList);
                    socket.emit('updateMembersList', membersList);
                    User.getUserRooms(username, callback);
                },
                function (roomList, callback) {
                    console.log("Fourth of waterfall for user %s", username);
                    //TODO здесь ошибка. Не нужно делать join при смене комнаты. Иначе при каждой смене в чате будет
                    // спам вида "user вошёл в чат" для всех, кто видит этого юзера в своей комнате
                    socket.broadcast.emit('join', username, roomList);
                    callback(null);
                }
            ], function (err) {
                if (err) {
                    console.error("При переходе в другую комнату возникли ошибки: ", err);
                }
                console.info("Waterfall завершен для пользователя %s", username);
                clientCb && clientCb(_roomId);
            });
        });

        // TODO когда пользователь создаёт комнату или приглашается в чью-либо:
        // TODO добавить пользователю комнату, а комнате -  пользователя. Это будут новые методы для сокета.

        socket.on('message', function (text, callback) {
            //сообщение идёт только в текущую комнату
            socket.broadcast.to(socket.room).emit('message', username, text);

            callback && callback(); // если передан callback, то он вызывается на клиенте
        });

        socket.on('inviteUsers', function (data, callback) {
            var invitedUsers = data.invitedUsers;
            var roomName = data.roomName;
            if (!invitedUsers || !roomName) callback("Не указаны пользователи или комната для приглашения.");

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
                    // здесь result это arr, arr[0] = {username: roomName} - список приглашенных (с именем сохраненной
                    // комнаты), arr[1] = {...} - комната
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
                        if (users.hasOwnProperty(username) && __users[username]) {
                            // online пользователи входят в комнату и им присылается событие, что их пригласили

                            __users[username].socket.join(room._id);
                            __users[username].socket.emit("invited", users[username]); // тут локальное имя комнаты
                            console.info("Пользователю %s отправлено приглашение.", username);
                        }
                    }

                    var usersList = splitUsersOnlineAndOffline(room.users, __users);

                    // при обновлении комнаты нужно указать какая комната обновляется и послать это всем, кто в комнате
                    io.sockets.in(room._id).emit('updateMembersList', usersList, room._id);
                    callback && callback(null);
                })
            });
        });

        socket.on('disconnect', function () {
            delete __users[username];
            User.getUserRooms(username, function (err, roomList) {
                if (err) console.error("getUserRoom: Ошибка: ", err);
                socket.broadcast.emit('leave', username, roomList);
            });
        });
    });

    return io;
};
