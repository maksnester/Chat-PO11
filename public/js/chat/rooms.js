var roomsList;
var inviteForm;

$(document).ready(function () {
    roomsList = (function () {
        /**
         * Ищет текущую комнату пользователя в указанном списке. Проверка по _id комнаты.
         * @param {Object} [roomList] если отсутствует, то очистятся оба списка
         * @returns {boolean}
         */
        function isCurrentRoomInList(roomList) {
            var i = roomList.length;
            while (i--) {
                if (roomList[i]._id === roomsList.currentRoom._id) return true;
            }
            return false;
        }

        /**
         * Получает список комнат текущего пользователя.
         * Пользователя сервер узнаёт по сессии.
         * @param callback
         */
        function getRoomsList(callback) {
            $.ajax({
                url: 'http://' + window.location.host + '/chat/rooms',
                method: 'get',
                success: function (data) {
                    roomsList.rooms = data;
                    callback(data);
                },
                error: function (jqXHR, textStatus) {
                    console.error(textStatus);
                    callback(null);
                }
            });
        }

        /**
         * Отображает на левой панели список комнат
         * @param [callback]
         */
        function showRooms(callback) {
            getRoomsList(function (result) {
                if (!result) return;

                var roomsNames = [];
                result.forEach(function (elem) {
                    roomsNames.push(elem.roomName);
                });
                roomsList.view.list.append(convertArrayToListItems(roomsNames, "hoverable"));

                callback && callback();
            });
        }

        /**
         * Очищает список комнат.
         */
        function clear() {
            // но при этом текущая комната не очищается =|
            roomsList.rooms = [];
            roomsList.view.list.empty();
        }

        /**
         * Добавляет комнату в список
         * @param roomId
         * @param roomName
         */
        function add(roomId, roomName) {
            roomsList.rooms.push({_id: roomId, roomName: roomName});
            roomsList.view.list.append(convertArrayToListItems([roomName], "hoverable"));
        }

        /**
         * Устанавливает новую комнату в качестве текущей.
         * Подсвечивает текущую комнату в списке комнат.
         *
         * @param roomName
         * @param [roomId]
         */
        function updateCurrent(roomName, roomId) {

            //модель
            roomsList.currentRoom.roomName = roomName;
            if (roomId) roomsList.currentRoom._id = roomId;

            //представление

            if (roomsList.view.current && roomsList.view.current.length > 0) {
                //снять старый класс
                roomsList.view.current.removeClass('current-room');
            }

            // найти в ul элемент с названием комнаты === roomName и установить класс
            var newCurrent = getRoomSelector(roomName);
            if (newCurrent) {
                newCurrent.addClass('current-room');
                roomsList.view.current = newCurrent;
            }
        }

        /**
         * Если текущая комната не all, то показать кнопки "пригласить/исключить пользователей"
         */
        function showControls() {
            if (roomsList.currentRoom.roomName !== 'all') {
                roomsList.view.controls.show();
            } else {
                roomsList.view.controls.hide();
            }
        }

        var indicator = '<span class="glyphicon glyphicon-comment"></span>';

        /**
         * Показывает (скрывает) в списке комнат индикатор новых сообщений для комнаты с id===roomId
         * @param roomId
         * @param {boolean} [show] если true или не указан - показать, если false - скрыть
         */
        function showUnreadIndicator(roomId, show) {

            var roomName = findRoomNameById(roomId);
            if (show === undefined) show = true;
            showUnreadIndicatorByName(roomName, show);
        }

        /**
         * Показывает (скрывает) в списке комнат индикатор новых сообщений для комнаты roomName
         * @param roomName
         * @param {boolean} show если true - показать, если false - скрыть
         */
        function showUnreadIndicatorByName(roomName, show) {
            var roomSelector = getRoomSelector(roomName);
            if (roomSelector) {
                if (show) {
                    if (roomSelector[0].lastChild.outerHTML !== indicator)
                        roomSelector.append(indicator);
                } else {
                    roomSelector[0].removeChild(roomSelector[0].lastChild);
                }
            }
        }

        /**
         * Ищет имя комнаты по заданному roomId
         *
         * @param roomId
         * @returns {String} null - если комната не найдена
         */
        function findRoomNameById(roomId) {
            var roomName = roomsList.rooms.filter(function(room) {return room._id === roomId}).pop().roomName;
            if (!roomName) {
                console.warn("Room with id %s not found in roomsList.", roomId);
                return null;
            }

            return roomName;
        }

        /**
         * Ищет в списке комнат на странице комнату с указанным именем.
         *
         * @param roomName
         * @returns {*|jQuery} селектор найденной комнаты или null, если комнаты нет в списке
         */
        function getRoomSelector(roomName) {
            var selector =  $('li', roomsList.view.list).filter(function () {
                return $.text([this]) === roomName;
            });

            if (!selector.length) {
                console.warn("getRoomSelector: Комната %s не найдена в списке комнат.", roomName);
                return null;
            }
            return selector;
        }

        /**
         * Удаляет комнату из модели и представления.
         * @param roomName
         */
        function removeRoom(roomName) {
            var selector = getRoomSelector(roomName);
            if (selector) selector.remove();
            var index = 0;
            while (index < roomsList.rooms.length) {
                if (roomsList.rooms[index].roomName === roomName) {

                    // и сообщения из этой комнаты выбрасываем
                    if (receivedMessages[roomsList.rooms[index]._id]) {
                        delete receivedMessages[roomsList.rooms[index]._id];
                    }

                    // удаляем саму комнату
                    roomsList.rooms.splice(index,1);
                    console.info("Room %s removed", roomName);
                    break;
                }
                index++;
            }
        }

        return {
            rooms: [],
            view: {
                list: $('#roomsList'),
                controls: $('#room-controls')
            },
            updateCurrent: updateCurrent,
            isCurrentRoomInList: isCurrentRoomInList,
            getRoomsList: getRoomsList,
            showRooms: showRooms,
            clear: clear,
            add: add,
            showControls: showControls,
            showUnreadIndicator: showUnreadIndicator,
            showUnreadIndicatorByName: showUnreadIndicatorByName,
            removeRoom: removeRoom
        }
    })();

    // с самого начала, текущая комната - all
    roomsList.currentRoom = {roomName: "all"};

    // добавление комнаты
    var newRoomForm = $('#newRoom').hide();
    newRoomForm.on("submit", onNewRoomSubmit);
    $('#addRoom').on('click', function () {
        newRoomForm.show();
    });
    $('.dismiss', newRoomForm).on("click", function () {
        newRoomForm.hide();
    });

    // переключение комнат
    $('#roomsList').on("click", function (event) {
        if (event.target.tagName.toLowerCase() === 'li') {
            var roomName = event.target.textContent || event.target.innerText;
            switchRoom(roomName);
        }
    });

    // управление пользователями в комнате

    // приглашение пользователей
    inviteForm = $('#inviteModal');
    $('#invite', roomsList.view.controls).on("click", function () {
        $('#invitedUsers', inviteForm).empty(); // список пользователей в форме приглашения
        inviteForm.modal('show');
        getAllUsers(function (err, users) {
            if (err) return console.error(err);
            //идём по всем пользователям и создаём с ними options
            //юзернеймы пришли в формате [{username: "vasya"},...]
            console.info("Список пользователей получен.");
            if (users && users.length) {
                users.forEach(function(user, index) {
                    users[index] = user.username;
                });
                var resultStr = '<option>' + users.join('</option><option>') + '</option>';
                $('#invitedUsers', inviteForm).append(resultStr);
            }
        });
    });
    $('#invitedUsers', inviteForm).mousedown(function (e) {
        e.preventDefault();
        var scroll = this.scrollTop;
        e.target.selected = !e.target.selected;
        this.scrollTop = scroll;
        $(this).focus();
    }).mousemove(function (e) {
        e.preventDefault();
    });

    inviteForm.on("submit", function (event) {
        event.preventDefault();
        var selectedUsers = [].filter.call($('select', inviteForm)[0].options, function(opt) {return opt.selected === true;});
        selectedUsers.forEach(function(elem, index) {
           selectedUsers[index] = elem.textContent || elem.innerText;
        });

        if (!selectedUsers.length) return;

        var data = {
            roomName: roomsList.currentRoom.roomName,
            invitedUsers: selectedUsers
        };
        socket.emit("inviteUsers", data, function (err) {
            if (err) {
                console.error(err);
                return;
            }

            inviteForm.modal('hide');
        });
    });

    // TODO если появится функционал по выкидыванию пользователей из комнаты создателем комнаты, то заменить кнопку на "Исключить пользователей"
    // покинуть комнату
    $('#leaveRoom', roomsList.view.controls).on("click", function () {
        var roomName = roomsList.currentRoom.roomName;
        if (confirm("Вы действительно хотите покинуть комнату " + roomName + "?")) {
            // запрос на выход из комнаты
            socket.emit("leaveRoom", roomName, function(err) {
                if (err) return console.error(err);
                // если успех - удалить комнату из списка и все сообщения из комнаты
                roomsList.removeRoom(roomName);
                switchRoom("all");
            });
        }
    });




    /**
     * Функция, выполняющаяся при сохранении новой группы (отправка формы #newRoom)
     * @param event
     */
    function onNewRoomSubmit(event) {
        event.preventDefault();
        $('.error', newRoomForm).html('');

        // обрабатываем создание новой комнаты. Посылаем запрос серверу.
        $.ajax({
            url: 'http://' + window.location.host + '/chat/rooms/new',
            method: 'post',
            data: {
                roomName: this.roomName.value
            },
            success: function (data) {
                var roomName = data.roomName;
                roomsList.add(data._id, roomName);
                switchRoom(roomName);

                // показать кнопки управления пользвоателями, если текущая комната не all


                // убрать форму ввода
                newRoomForm.hide();
                newRoomForm[0].roomName.value = '';
            },
            error: function (jqXHR, textStatus) {
                console.error(jqXHR);
                $('.error', newRoomForm).html(jqXHR.responseJSON.message || textStatus);
            }
        });
    }
});

/**
 * Делает указанную комнату текущей. Сокет эмитирует событие switchRoom
 * @param roomName
 * @param [callback]
 */
function switchRoom(roomName, callback) {
    console.info('called switchRoom');
    messageContainer.empty();
    socket.emit("switchRoom", roomName, function (roomId) {
        console.info('switchRoom callback executes.');
        roomsList.updateCurrent(roomName, roomId);
        roomsList.showControls();

        if (deferredMessages[roomId]) {
            roomsList.showUnreadIndicator(roomId, false);
            receivedMessages.showLast(settings.LAST_MESSAGES, roomId);
            deferredMessages.show(roomId);
        } else {
            receivedMessages.showLast(settings.LAST_MESSAGES, roomId);
        }

        callback && callback();
    });
}

/**
 * Преобразовывает элементы массива в строку, содержащую html список li
 * @param array
 * @param classNames - устанавливает классы для элементов списка
 */
function convertArrayToListItems(array, classNames) {
    if (!Array.isArray(array)) {
        array = [array];
    }
    return '<li class="' + classNames + '">' + array.join('</li><li class="' + classNames + '">') + '</li>';
}

/**
 * Получить с сервера список всех логинов.
 * @param callback
 */
function getAllUsers(callback) {
    $.ajax({
        method: 'get',
        url: 'http://' + window.location.host + '/chat/users',
        success: function (data) {
            callback(null, data);
        },
        error: function (error) {
            console.error(error);
            callback(error);
        }
    });
}