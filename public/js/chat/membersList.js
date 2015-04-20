var membersList;

$(document).ready(function() {
    membersList = (function() {

        /**
         * Очищает выбранный список пользователей или оба списка.
         * @param list "onlineUsers" или "offlineUsers"
         */
        var clear = function(list) {
            var removeAll = function (list) {
                var elem = membersList.view[list][0];
                while (elem.firstChild) {
                    elem.removeChild(elem.firstChild);
                }
            };
            if (list === "onlineUsers" || list === "offlineUsers") {
                removeAll(list);
            } else {
                removeAll("onlineUsers");
                removeAll("offlineUsers");
            }
        };

        /**
         * Сохраняет список пользователей.
         * Отображает список пользователей в комнате в правом блоке.
         * @param chatMembers - объект с двумя полями-массивами: onlineUsers и offlineUsers
         */
        var update = function(chatMembers) {
            console.info("chatMembers: %o", chatMembers);
            if (chatMembers) {
                this.clear();
                if (chatMembers.onlineUsers && chatMembers.onlineUsers.length > 0) {
                    this.onlineUsers = chatMembers.onlineUsers;
                    this.view.onlineUsers.append(convertArrayToListItems(this.onlineUsers, 'hoverable'));
                }
                if (chatMembers.offlineUsers && chatMembers.offlineUsers.length > 0) {
                    this.offlineUsers = chatMembers.offlineUsers;
                    this.view.offlineUsers.append(convertArrayToListItems(this.offlineUsers, 'hoverable'));
                }
            } else {
                this.view.onlineUsers[0].innerHTML = "server error";
            }
        };

        /**
         * Обновляет список пользователей в модели и отображении.
         * @param username
         * @param isOnline
         */
        var setUserStatusOnline = function (username, isOnline) {
            // в membersList только пользователи текущей комнаты. В случае, если пользователь не из этой комнаты,
            // но его статус меняется на offline,
            // то делать ничего не нужно, т.к. список для другой комнаты будет получен при переходе.
            // Если пользователь входит в комнату и его не было в списке пользователей - добавить.

            // обновляем модель
            var source = isOnline ? this.offlineUsers : this.onlineUsers;
            var destination = isOnline ? this.onlineUsers : this.offlineUsers;

            // обновляем отображение
            var sourceView = isOnline ? this.view.offlineUsers : this.view.onlineUsers;
            var destinationView = isOnline ? this.view.onlineUsers : this.view.offlineUsers;

            var index = source.indexOf(username);
            if (index > -1) {
                destination.push(username);
                source.splice(index, 1);

                sourceView.find('li').filter(function() { return $.text([this]) === username; }).remove();
                destinationView.append('<li class="hoverable">' + username + '</li>');
            } else if (isOnline && destination.indexOf(username) < 0) {
                // пользователь новый и входит в комнату
                destination.push(username);
                destinationView.append('<li class="hoverable">' + username + '</li>');
            }
        };

        return {
            view: {
                onlineUsers: $('#online-users'),
                offlineUsers: $('#offline-users')
            },
            onlineUsers: [],
            offlineUsers: [],
            clear: clear,
            update: update,
            setUserStatusOnline: setUserStatusOnline
        }
    })();

    roomsList.view.controls.hide();
});
