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
         * @param [callback]
         */
        function showRooms(callback) {
            getRoomsList(function(result) {
                if (!result) return;

                var roomsNames = [];
                result.forEach(function(elem) {
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
         * @param roomName
         */
        function add(roomName) {
            roomsList.rooms.push(roomName);
            roomsList.view.list.append(convertArrayToListItems([roomName], "hoverable"));
        }

        /**
         * Устанавливает новую комнату в качестве текущей.
         * Подсвечивает текущую комнату в списке комнат.
         *
         * @param roomName
         * @param [roomId]
         */
        function updateCurrent (roomName, roomId) {

            //модель
            roomsList.currentRoom.roomName = roomName;
            if (roomId) roomsList.currentRoom._id = roomId;

            //представление

            if (roomsList.view.current && roomsList.view.current.length > 0) {
                //снять старый класс
                roomsList.view.current.removeClass('current-room');
            }

            // найти в ul элемент с названием комнаты === roomName и установить класс
            var newCurrent = $('li').filter(function() { return $.text([this]) === roomName; });
            newCurrent.addClass('current-room');

            roomsList.view.current = newCurrent;
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
            showControls: showControls
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

    // управление пользователями в комнате





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
 * @param [callback]
 */
function switchRoom(roomName, callback) {
    socket.emit("switchRoom", roomName, function (roomId) {
        roomsList.updateCurrent(roomName, roomId);
        roomsList.showControls();
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