'use strict';

var input;
var messageContainer;
var form;
var autoscroll = true;

$(document).ready(function() {
    messageContainer = $('#messages');

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
        //TODO разная логика для новых сообщений из ативной и неактивных комнат
        //если комната неактивна и из неё пришло новое сообщение, сохраняем его в отложенные сообщения
        //показываем, что пришло сообщение
        //при переключении комнаты:
        // * очистить счетчик новых сообщений
        // * показать отложенные сообщения
        printMessage("<b>" + username + "</b>: " + message);
    })
//TODO если пользователь есть в текущей комнате, то надо обновить его статус в списке справа
    .on('leave', function (username) {
        setUserStatusOnline(username, false);
    })
    .on('join', function (username) {
        setUserStatusOnline(username, false);
    })
    .on('connect', function () {
        printStatus("соединение установлено");
        input.prop('disabled', false);
    })
    .on('disconnect', function () {
        printStatus("соединение потеряно");
        input.prop('disabled', true);
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
    socket.emit('message', text, function () {
        printMessage(wrapWithClass('<b>Я: </b> ' + text, "mymsg"));
    });

    input.val('');
    return false;
}

function wrapWithClass(text, classname) {
    return '<span class="' + classname + '">' + text + '</span>'
}

function printStatus(status) {
    $('<p>').append($('<i>').text(status)).appendTo(messageContainer);
    if (autoscroll) {
        messageContainer[0].scrollTop = messageContainer[0].scrollHeight;
    }
}

function printMessage(text) {
    text = '<p>' + text.replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>').trim() + '</p>';
    $(messageContainer).append(text);
    if (autoscroll) {
        messageContainer[0].scrollTop = messageContainer[0].scrollHeight;
    }
}

function setUserStatusOnline(username, isOnline) {
    //TODO обновить статус пользователя в правом блоке чата
    console.log("User %o - online: %o.", username, isOnline);

    var msg = isOnline ? " вошёл в чат." : " вышел из чата.";
    printStatus(username + msg);
}

//Код, чтобы посылать сообщения автоматически
//Кодгда нужно остановить - в консоли пишем: clearInterval(autoMsg);
//var autoMsg = setInterval(function() {
//    input.val('Hello! Nice to meet you!\n' +
//              ' Test message with interval 1000. HOHOHOH!@# ASFN SALK:D JA:SLKD J MOTHERGU\n' +
//              'Msg random number: ' + Math.random() + '\n' +
//              'Current date: ' + new Date());
//    sendMessage();
//}, 1000);