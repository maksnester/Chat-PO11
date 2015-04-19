'use strict';

var input;
var messageContainer;
var form;
var onlineUsers;
var offlineUsers;
var autoscroll = true;

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
});

var socket = io.connect('', {
    reconnect: false
});

socket
    .on('message', function (username, message) {
        //TODO разная логика для новых сообщений из активной и неактивных комнат
        //если комната неактивна и из неё пришло новое сообщение, сохраняем его в отложенные сообщения
        //показываем, что пришло сообщение
        //при переключении комнаты:
        // * очистить счетчик новых сообщений
        // * показать отложенные сообщения
        printMessage("<b>" + username + "</b>: " + message);
    })
    .on('leave', function (username, roomList) {
        // событие надо обрабатывать только тогда, когда текущая комната среди тех, в которых есть этот пользователь
        if (roomsList.isCurrentRoomInList(roomList)) {
            setUserStatusOnline(username, false);
        }
    })
    .on('join', function (username, roomList) {
        if (roomsList.isCurrentRoomInList(roomList)) {
            setUserStatusOnline(username, true);
        }
    })
    .on('connect', function () {
        printStatus("соединение установлено");
        switchRoom(roomsList.currentRoom.roomName || "all");
        input.prop('disabled', false);
        roomsList.showRooms(function() {
            // здесь нужно вручную вызвать обновление текущей комнаты - список часто не успевает показаться до обновления
            roomsList.updateCurrent(roomsList.currentRoom.roomName || "all");
        });
    })
    .on('updateMembersList', function(usersInRoom) {
        membersList.update(usersInRoom);
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
        printMessage(wrapWithClass('<b>Я: </b> ' + text, "mymsg"));
    });

    input.val('');
    return false;
}

function printMessage(text) {
    // регулярка убирает переносы строк (если их больше 2х подряд, заменяются на 2 переноса)
    // и так как переносы строк приходят в формате "\n", то они меняются на тег "br"
    text = '<p>' + text.replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>').trim() + '</p>';
    $(messageContainer).append(text);
    if (autoscroll) {
        messageContainer[0].scrollTop = messageContainer[0].scrollHeight;
    }
}

function printStatus(status) {
    $('<p>').append($('<i>').text(status)).appendTo(messageContainer);
    if (autoscroll) {
        messageContainer[0].scrollTop = messageContainer[0].scrollHeight;
    }
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

//Код, чтобы посылать сообщения автоматически
//Кодгда нужно остановить - в консоли пишем: clearInterval(autoMsg);
//var autoMsg = setInterval(function() {
//    input.val('Hello! Nice to meet you!\n' +
//              ' Test message with interval 1000. HOHOHOH!@# ASFN SALK:D JA:SLKD J MOTHERGU\n' +
//              'Msg random number: ' + Math.random() + '\n' +
//              'Current date: ' + new Date());
//    sendMessage();
//}, 2500);