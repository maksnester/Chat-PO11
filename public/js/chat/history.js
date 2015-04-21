// окно истории сообщений
var historyModal;

$(document).on('ready', function() {
    historyModal = $('#historyModal');
    var historyContainer = $('tbody', '#history');

    $('#historyButton').on('click', function() {
        // очистить историю
        historyContainer.empty();
        // загрузить новую для текущей комнаты
        $.ajax({
            method: 'get',
            url: 'http://' + window.location.host + '/chat/rooms/' + roomsList.currentRoom._id + '/history',
            success: function (data) {
                var text = '';
                for (var i = data.length - 1; i >= 0; i--) {
                    text += '<tr><td>';
                    text += new Date(data[i].date).shortDate();
                    text += '</td><td>';
                    text += data[i].username;
                    text += '</td><td>';
                    text += getSafeString(data[i].message);
                    text += '</td></tr>';
                }
                historyContainer.append(text);
            },
            error: function (err, textStatus) {
                console.error(err);
                if (err.responseJSON.message && err.responseJSON.message.indexOf("Архив не найден") > 0) {
                    historyContainer.append("Для данной комнаты пока нет сообщений...");
                } else {
                    historyContainer.append(err.responseJSON.message || textStatus);
                }
            }
        });
        historyModal.modal('show');
    });
});
