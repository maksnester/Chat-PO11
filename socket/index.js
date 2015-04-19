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

    var username = socket.handshake.user.get('username');
    __users[username] = {socket: socket}; // сохраняем сокет пользователя для дальнейших обращений

    //проверяем сперва, есть ли у пользователя комната по-умолчанию, если нет - добавить ему её и его в неё
    User.checkUserDefaultRoom(username, function(err) {
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
            User.getRoomByNameInUser(roomName, username, callback);
          },
          function(roomId, callback) {
            _roomId = roomId;
            socket.room = roomId;
            socket.join(roomId);
            User.getUsersInRoom(username, roomName, callback);
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
            User.getUserRooms(username, callback);
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
        User.getUserRooms(username, function(err, roomList) {
          if (err) log.error("getUserRoom: Ошибка: ", err);
          socket.broadcast.emit('leave', username, roomList);
        });
      });
    });
  });

  return io;
};
