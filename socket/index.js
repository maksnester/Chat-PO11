'use strict';
var log = require('lib/log')(module);
var config = require('config');
var connect = require('connect'); // npm i connect
var async = require('async');
var sessionStore = require('lib/sessionStore');
var utils = require('lib/utils');
var HttpError = require('error').HttpError;
var User = require('models/user').User;
var Room = require('models/room').Room;
var express = require('express');

function loadSession(sid, callback) {

  // sessionStore callback is not quite async-style!
  sessionStore.load(sid, function(err, session) {
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
    log.debug("Session %s is anonymous", session.id);
    return callback(null, null);
  }

  User.findById(session.user, function(err, user) {
    if (err) return callback(err);

    if (!user) {
      return callback(null, null);
    }
    callback(null, user);
  });

}

/**
 * Возвращает через callback список пользователей в комнате.
 * У пользователя комнаты могут быть названы по-своему.
 *
 * @param username
 * @param roomName - наименование комнаты у пользователя.
 * @param callback - используется для передачи списка пользователей
 */
function getUsersInRoom(username, roomName, callback) {
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
}

/**
 * Получить по пользовательскому названию комнаты её id.
 * @param roomName пользовательское название комнаты
 * @param username
 * @param callback (ошибка, id комнаты)
 */
function getRoomByNameInUser(roomName, username, callback) {
  User.findOne({username: username}, 'rooms', function (err, user) {
    if (err) return callback(err);
    if (!user) return callback(new Error("User " + username + " not found."));
    
    var index = utils.indexOfObjByAttr(user.rooms, "roomName", roomName);
    if (index < 0) return callback(new Error("getRoomByNameInUser: Room " + roomName + " not found in user " + username));
    
    callback(null, user.rooms[index]._id);
  });
}

var DEFAULT_ROOM_ID;
getDefaultRoomId(function(id) {DEFAULT_ROOM_ID = id;});

/**
 * Устанавливает связи между пользователем и комнатой, добавляя имя пользователя в список комнаты,
 * а _id комнаты, в список комнат у пользователя.
 *
 * @param username
 * @param callback
 */
function checkUserDefaultRoom(username, callback) {
  User.findOne({username: username}, function (err, user) {
    if (err) callback(err);
    if (!user) callback("User " + username + " not found.");

    var room = user.rooms.id(DEFAULT_ROOM_ID);

    if (!room) {
      user.rooms.push({_id: DEFAULT_ROOM_ID, roomName: 'all'});
      user.save(function (err, user) {
        if (err) return callback(err);

        addUserToRoom(username, DEFAULT_ROOM_ID, function(err) {
          if (err) return callback(err);
          callback(null);
        });

      });
    } else callback();
  });
}

/**
 * В коллекции Rooms добавляет логин пользователя в список
 * @param username
 * @param {ObjectId} roomId
 * @param callback
 */
function addUserToRoom(username, roomId, callback) {
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
}

/**
 * В коллекции Users добавляет пользователю комнату в список с указанным именем
 * @param room
 * @param username
 * @param roomName
 * @param callback
 */
function addRoomToUser(room, username, roomName, callback) {

}

/**
 * Ищет комнату, у которой поле special = 'default room'.
 * Если такой комнаты нет, то создаёт её.
 * @param callback - через колбэк возвращаем id комнаты
 */
function getDefaultRoomId(callback) {
  Room.findOne({special: 'default room'}, '_id', function(err, room) {
    if (err) return log.error(err);
    if (!room) {
      //создаём
      var defaultRoom = new Room({special: 'default room', roomName: 'all'});
      defaultRoom.save(function(err, room) {
        if (err || !room) return log.error("Error creating default room: %s.", err);
        callback(room._id);
      });
    } else {
      callback(room._id);
    }
  });
}

/**
 * Получить список комнат для пользователя и передать их через callback.
 * @param username
 * @param callback (ошибка, комнаты)
 */
function getUserRooms(username, callback) {
  User.findOne({username: username}, function (err, user) {
    if (err) return callback(err);
    if (!user) return callback(new Error("User " + username + " not found."));
    callback(null, user.rooms);
  });
}

module.exports = function(server) {
  var io = require('socket.io').listen(server);
  io.set('origins', '*:*');
  io.set('logger', log);

  io.set('authorization', function(handshake, callback) {
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
      function(session, callback) {

        if (!session) {
          callback(new HttpError(401, "No session"));
        }

        handshake.session = session;
        loadUser(session, callback);
      },
      function(user, callback) {
        if (!user) {
          callback(new HttpError(403, "Anonymous session may not connect"));
        }

        handshake.user = user;
        callback(null);
      }

    ], function(err) {
      if (!err) {
        return callback(null, true);
      }

      if (err instanceof HttpError) {
        return callback(null, false);
      }

      callback(err);
    });

  });

  io.sockets.on('session:reload', function(sid) {
    var clients = io.sockets.clients();

    clients.forEach(function(client) {
      if (client.handshake.session.id != sid) return;

      loadSession(sid, function(err, session) {
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

  io.sockets.on('connection', function(socket) {

    /**
     * Что такое группа? Группа - это просто название комнаты. Вернее, ID комнаты.
     *
     * Как добавить пользователя в группу? Послать запрос, содержащий имя добавляемого пользователя.
     * Сервер обработает запрос: найдет пользователя, возьмёт его сокет, укажет сокету пользователя, что он
     * теперь добавлен в группу и будет получать от неё сообщения: socket.join('roomId');
     *
     * Если пользователь вышел - ничего никуда не посылаем. Но ведётся история сообщений для каждой группы.
     * Все сообщения для всех комнат сохраняются в БД. Формат такой:
     *                                          {room: ObjectId, messages: [{user: String, message: String}]}
     *
     * Пользователь получает сообщения со всех комнат, но как их просматривать - решается на клиенте.
     *
     * Для индикации текущей комнаты используется socket.room = 'roomId'
     *
     * Комната имеет идентификатор. Привязка к комнате особого имени хринтся у пользователя (БД).
     */

    var username = socket.handshake.user.get('username');
    __users[username] = {socket: socket}; // сохраняем сокет пользователя для дальнейших обращений

    //проверяем сперва, есть ли у пользователя комната по-умолчанию, если нет - добавить ему её и его в неё
    checkUserDefaultRoom(username, function(err) {
      if (err) {
        log.error("Ошибка при проверке у пользователя комнаты по-умолчанию: " + err);
        socket.emit("error");
        return;
      }

      //TODO понадобится join во все комнаты, что есть у пользователя в списке

      socket.on('switchRoom', function (roomName, clientCb) {
        var _roomId;
        async.waterfall([
          function (callback) {
            //roomName - это пользовательское название комнаты. Получим из него _id комнаты
            getRoomByNameInUser(roomName, username, callback);
          },
          function(roomId, callback) {
            _roomId = roomId;
            socket.room = roomId;
            socket.join(roomId);
            getUsersInRoom(username, roomName, callback);
          },
          function(usersInRoom, callback) {
            //посылаем пользователю список людей в комнате, в которую он входит
            //разделяем список на online и offline пользователей
            var membersList = {onlineUsers: [], offlineUsers: []};
            usersInRoom.forEach(function(elem) {
              if (__users[elem]) {
                membersList.onlineUsers.push(elem);
              } else {
                membersList.offlineUsers.push(elem);
              }
            });
            socket.emit('updateMembersList', membersList);
            getUserRooms(username, callback);
          },
          function (roomList, callback) {
            //TODO здесь ошибка. Не нужно делать join при смене комнаты. Иначе при каждой смене в чате будет спам вида "user вошёл в чат" для всех, кто видит этого юзера в своей комнате
            socket.broadcast.emit('join', username, roomList);
            callback(null);
          }
        ], function(err) {
          if (err) {
            log.error("При переходе в другую комнату возникли ошибки: ", err);
          }
          clientCb && clientCb(_roomId);
        });
      });

      // TODO когда пользователь создаёт комнату или приглашается в чью-либо:
      // TODO добавить пользователю комнату, а комнате -  пользователя. Это будут новые методы для сокета.

      socket.on('message', function(text, callback) {
        //сообщение идёт только в текущую комнату
        socket.broadcast.to(socket.room).emit('message', username, text);

        callback && callback(); // если передан callback, то он вызывается на клиенте
      });

      socket.on('disconnect', function() {
        delete __users[username];
        getUserRooms(username, function(err, roomList) {
          if (err) log.error("getUserRoom: Ошибка: ", err);
          socket.broadcast.emit('leave', username, roomList);
        });
      });
    });
  });

  return io;
};
