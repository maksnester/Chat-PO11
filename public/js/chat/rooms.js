var currentRoom;

/**
 * Ищет текущую комнату пользователя в указанном списке. Проверка по _id комнаты.
 * @param {Object} [roomList] если отсутствует, то очистятся оба списка
 * @returns {boolean}
 */
function isCurrentRoomInList(roomList) {
    var i = roomList.length;
    while (i--) {
        if (roomList[i]._id === currentRoom._id) return true;
    }
    return false;
}