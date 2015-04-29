'use strict';

var input;
var messageContainer;
var form;
var onlineUsers;
var offlineUsers;
var autoscroll = true;
var mylogin;

var settings = {
    /*Количество показываемых последних прочитанных сообщений при переходе в комнату*/
    LAST_MESSAGES: 15
};

var deferredMessages = {
    /**
     * Выводит на экран все непрочитанные сообщения из комнаты roomId и помечает их прочитанными.
     * @param roomId
     */
    show: function (roomId) {
        if (!deferredMessages[roomId]) return;
        printMessages(deferredMessages[roomId]);

        // переводим отложенные сообщения в разряд прочитанных
        for (var i = 0; i < deferredMessages[roomId].length; i++) {
            var copy = {
                username: deferredMessages[roomId][i].username,
                message: deferredMessages[roomId][i].message
            };
            receivedMessages.addMessage(roomId, copy);
        }

        delete deferredMessages[roomId];
    },
    /**
     * Добавляет сообщение в список непрочитанных
     * @param roomId
     * @param message объект в формате {username: ..., message: ...}
     */
    addMessage: function (roomId, message) {
        if (!deferredMessages[roomId]) {
            deferredMessages[roomId] = [];
        }

        deferredMessages[roomId].push(message)
    }
}; // объект формата {roomId: [messages]}, где message = {username: ..., message: ...}

var receivedMessages = {
    /**
     * Добавляет сообщение в список полученных
     * @param roomId
     * @param message объект в формате {username: ..., message: ...}
     */
    addMessage: function (roomId, message) {
        // TODO можно сделать лимит хранения прочитанных сообщений и не пользоваться showLast
        if (!receivedMessages[roomId]) {
            receivedMessages[roomId] = [];
        }

        receivedMessages[roomId].push(message)
    },

    /**
     * Выводит на экран все полученные сообщения.
     * @param roomId
     */
    show: function (roomId) {
        if (!receivedMessages[roomId]) return;
        printMessages(receivedMessages[roomId]);
    },

    /**
     * Выводит на экран n последних полученных сообщений для комнаты с id = roomId
     * @param n
     * @param roomId
     */
    showLast: function (n, roomId) {
        var messages = receivedMessages[roomId];
        if (!messages) return;
        if (messages.length > n) {
            // только n последних
            printMessages(messages.slice(messages.length - n));
        } else if (messages.length) {
            // если сообщений < n, то печатать все что есть
            // TODO но сначала нужно посмотреть в истории сообщений, может удастся взять оттуда
            printMessages(messages);
        }
    }
}; // объект такого же формата, что и deferredMessages

$(document).ready(function() {
    // поле ввода сообщений
    input = $('#input');
    input[0].onkeydown = function(event) {
        if (event.keyCode === 13) {
            if (event.ctrlKey) {
                var pos = $(this).prop("selectionStart");
                this.value = [this.value.slice(0, pos), '\n', this.value.slice(pos)].join('')
            } else {
                sendMessage();
            }
            return false;
        }
    };

    // при наведении указателя мыши, перестаём автоматически скроллить сообщения
    messageContainer = $('#messages');
    messageContainer.mouseenter(function() {
        autoscroll = false;
    }).mouseleave(function() {
        autoscroll = true;
    });

    /**
     * Добавляет переданную строку к message контайнеру
     * @param str может быть строкой, содержащей html (как правило, является таковой)
     */
    messageContainer.addText = function (str) {
        str = linkify(str);
        messageContainer.append(str);
        if (autoscroll) {
            messageContainer[0].scrollTop = messageContainer[0].scrollHeight;
        }
    };

    mylogin = $('#login');
});

var socket = io.connect('', {
    reconnect: false
});

socket
    .on('message', function (username, message, roomId) {
        if (roomId === roomsList.currentRoom._id) {
            printMessage(username, message);
            receivedMessages.addMessage(roomId, {username: username, message: message});
        } else {
            //если комната неактивна и из неё пришло новое сообщение, сохраняем его в отложенные сообщения
            deferredMessages.addMessage(roomId, {username: username, message: message});

            //показываем, что пришло сообщение
            roomsList.showUnreadIndicator(roomId);
        }
    })
    .on('leave', function (username, roomList) {
        // событие надо обрабатывать только тогда, когда текущая комната среди тех, в которых есть этот пользователь
        if (roomsList.isCurrentRoomInList(roomList)) {
            setUserStatusOnline(username, false);
        }
    })
    .on('join', function (username, roomList) {
        if (!roomList.length) {
            // Если пользователь новый у него нет комнат и roomList пустой.
            roomList = ['all'];
        }
        if (roomsList.isCurrentRoomInList(roomList)) {

            setUserStatusOnline(username, true);
        }
    })
    .on('connect', function () {
        switchRoom(roomsList.currentRoom.roomName || "all");
        printStatus("соединение установлено");
        input.prop('disabled', false);
        roomsList.showRooms(function() {
            // TODO было бы неплохо исправить этот момент как-то...
            // здесь нужно вручную вызвать обновление текущей комнаты - список часто не успевает показаться до
            // обновления
            roomsList.updateCurrent(roomsList.currentRoom.roomName || "all");
        });
    })
    .on('updateMembersList', function(usersInRoom, roomId) {
        if (!roomId || roomId === roomsList.currentRoom._id) {
            membersList.update(usersInRoom);
        }
    })
    .on('invited', function (room) {
        // вызывается, когда пользователя кто-то пригласил в комнату room
        // комнату добавляем в список, а в чатик пишем сообщение от сервера
        roomsList.add(room._id, room.roomName);
        printServerMessage("<i>Вы были приглашены в комнату </i><b>" + room.roomName + "</b>");
    })
    .on('userLeave', function (username, roomId) {
        if (roomId === roomsList.currentRoom._id) {
            printServerMessage("<i>Пользователь <b>" + username + "</b> покинул комнату. </i>");
        }
    })
    .on('my login', function (username) {
        var login = mylogin[0].textContent || mylogin[0].innerText;
        if (!login) {
            mylogin.append(username);
        }
    })
    .on('disconnect', function () {
        printStatus("соединение потеряно");
        input.prop('disabled', true);
        membersList.clear();
        roomsList.clear();
        this.$emit('error');
    })
    .on('logout', function () {
        location.href = "/";
    })
    .on('error', function (reason) {
        if (reason == "handshake unauthorized") {
            printStatus("вы вышли из сайта");
        } else {
            setTimeout(function () {
                socket.socket.connect();
            }, 500);
        }
    });

function sendMessage() {
    var text = input.val();
    if (!text || !text.trim()) return;
    socket.emit('message', text, function () {
        var safeString = getSafeString(text);
        messageContainer.addText("<p><b>Я</b>: " + wrapWithClass(safeString, "mymsg") + "</p>");
        receivedMessages.addMessage(roomsList.currentRoom._id, {username: "Я", message: safeString});
    });

    input.val('');
    return false;
}

/**
 * Выводит на экран сообщение от пользователя username
 *
 * @param username
 * @param message
 */
function printMessage(username, message) {
    // регулярка убирает переносы строк (если их больше 2х подряд, заменяются на 2 переноса)
    // и так как переносы строк приходят в формате "\n", то они меняются на тег "br"
    var text = '<p>' + '<b>' + username + '</b>: ' + getSafeString(message) + '</p>';
    messageContainer.addText(text);
}

/**
 * Выводит на экран переданные сообщения.
 *
 * @param {Array} messages предполагается, что это массив объектов вида {username: login, message: msg}
 */
function printMessages(messages) {
    if (!(Array.isArray(messages) && messages.length)) {
        console.warn("printMessages: аргумент messages не является массивом. Messages = %o", messages);
        return;
    }

    var text = "";

    for (var i = 0; i < messages.length; i++) {
        text += "<p><b>";
        text += messages[i].username;
        text += "</b>: ";
        text += messages[i].message;
        text += "</p>"
    }

    messageContainer.addText(text);
}

/**
 * Чистит строку от большого количества переносов строк.
 * TODO сюда же стоит добавить удаление лишних html тегов. Например, скриптов.
 * @param str
 * @returns {string|string}
 */
function getSafeString(str) {
    return str.replace(/\n{3,}/g, '\n\n')
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, '<br>')
            .trim() || "";

}

function printStatus(status) {
    $('<p>').append($('<i>').text(status)).appendTo(messageContainer);
    if (autoscroll) {
        messageContainer[0].scrollTop = messageContainer[0].scrollHeight;
    }
}

function printServerMessage(message) {
    messageContainer.addText("<p><b>SERVER: </b>" + message + "</p>");
}

/**
 * Добавляет сообщение, что пользователь вошёл или вышел.
 * Меняет отображаемое состояние пользователя в списке пользователей.
 * @param username
 * @param isOnline
 */
function setUserStatusOnline (username, isOnline) {
    membersList.setUserStatusOnline(username, isOnline);

    var msg = isOnline ? " вошёл в чат." : " вышел из чата.";
    printStatus(username + msg);
}

/**
 * Оборачивает сообщение в тег span с указанным классом
 * @param text
 * @param classname - класс, либо список классов вида "класс1[ класс2][...]"
 * @returns {string}
 */
function wrapWithClass(text, classname) {
    return '<span class="' + classname + '">' + text + '</span>'
}

Date.prototype.shortDate = function() {
    var d = this.getDate();
    var m = this.getMonth() + 1;
    var y = this.getFullYear();

    d = (d > 9) ? d : "0" + d;
    m = (m > 9) ? m : "0" + m;

    return d + "." + m + "." + y;
};

function linkify(inputText) {
    var replacedText, replacePattern1, replacePattern2, replacePattern3;

    //URLs starting with http://, https://, or ftp://
    replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;\[\]]*[-A-Z0-9+&@#\/%=~_|\[\]])/gim;
    replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

    //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
    replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
    replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

    //Change email addresses to mailto:: links.
    replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
    replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

    return replacedText;
}

//Код, чтобы посылать сообщения автоматически
//Кодгда нужно остановить - в консоли пишем: clearInterval(autoMsg);
//var autoMsg = setInterval(function() {
//    input.val('Hello! Nice to meet you!\n' +
//              ' Test message with interval 1000. HOHOHOH!@# ASFN SALK:D JA:SLKD J MOTHERGU\n' +
//              'Msg random number: ' + Math.random() + '\n' +
//              'Current date: ' + new Date());
//    sendMessage();
//}, 2500);
