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
         * Ппользователя сервер узнаёт по сессии.
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

        return {
            currentRoom: null,
            rooms: [],
            view: $('#roomsList'),
            isCurrentRoomInList: isCurrentRoomInList,
            getRoomsList: getRoomsList,
            showRooms: showRooms,
            clear: clear
        }
    })();
});

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