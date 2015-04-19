var roomsList;

$(document).ready(function() {
    roomsList = (function() {
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
        function getRoomsList (callback) {
            $.ajax({
                url: 'http://' + window.location.host + '/chat/rooms',
                method: 'get',
                success: function(data) {
                    roomsList.rooms = data;
                    callback(data);
                },
                error: function(jqXHR, textStatus) {
                    console.error(textStatus);
                    callback(null);
                }
            });
        }

        /**
         * Отображает на левой панели список комнат
         */
        function showRooms() {
            getRoomsList(function(result) {
                if (!result) return;

                var roomsNames = [];
                result.forEach(function(elem) {
                    roomsNames.push(elem.roomName);
                });
                roomsList.view.append(convertArrayToListItems(roomsNames, "hoverable"));
            });
        }

        /**
         * Очищает список комнат.
         */
        function clear() {
            this.rooms = [];
            this.view.empty();
        }

        /**
         * Добавляет комнату в список
         * @param roomName
         */
        function add(roomName) {
            this.rooms.push(roomName);
            this.view.append(convertArrayToListItems([roomName], "hoverable"));
        }

        return {
            rooms: [],
            view: $('#roomsList'),
            isCurrentRoomInList: isCurrentRoomInList,
            getRoomsList: getRoomsList,
            showRooms: showRooms,
            clear: clear,
            add: add
        }
    })();

    // с самого начала, текущая комната - all
    roomsList.currentRoom = {roomName: "all"};

    // добавление комнаты
    var newRoomForm = $('#newRoom').hide();
    newRoomForm.on("submit", onNewRoomSubmit);
    $('#addRoom').on('click', function() {
        newRoomForm.show();
    });
    $('.dismiss', newRoomForm).on("click", function() {
        newRoomForm.hide();
    });

    // переключение комнат
    $('#roomsList').on("click", function(event) {
        if (event.target.tagName.toLowerCase() === 'li') {
            var roomName = event.target.textContent || event.target.innerText;

            switchRoom(roomName);
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
                roomsList.add(roomName);
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
 * @param callback
 */
function switchRoom(roomName, callback) {
    socket.emit("switchRoom", roomName, function (roomId) {
        roomsList.currentRoom = {_id: roomId, roomName: roomName};
        membersList.showControls();
        callback && callback();
        //TODO здесь надо как-то подгрузить сообщения
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