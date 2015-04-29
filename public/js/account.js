'use strict';
$(document).ready(function () {
    $('form', '#settings').on("submit", function () {
        alert("not implemented yet");
        return false;
    });
    $('form', '#profile').on("submit", function () {
        alert("not implemented yet");
        return false;
    });

    $('button.close').on("click", function (event) {
        console.log(event);
        alert("Delete files not implemented")
    });

    var filesContainer = $('ul', '#storageList');
    var closeButton = '<button class="close" type="button"><span aria-hidden="true">×</span></button>';
    getFiles(function(err, files) {
        if (err) {
            filesContainer.html('<li class="error">' + err.message + '</li>');
        }
        if (!files || !files.length) {
            filesContainer.html('<li class="error">Пока что у вас нет файлов</li>');
        } else {
            var htmlCode = "";
            var fileLink;
            for (var fileName in files[0]) {
                if (files[0].hasOwnProperty(fileName)) {
                    htmlCode += '<li><a href="';
                    htmlCode += files[0][fileName]; // ссылка
                    htmlCode += '">';
                    htmlCode += fileName;
                    htmlCode += '</a>';
                    htmlCode += closeButton;
                    htmlCode += '</li>';
                }
            }

            filesContainer.html(htmlCode);
        }
    });

    /**
     * Посылает ajax запрос к серверу.
     * @param callback (err, files)
     */
    function getFiles(callback) {
        $.ajax({
            url: 'http://' + window.location.host + '/uploads',
            success: function (res) {
                callback(null, res);
            },
            error: function (err) {
                console.error(err);
                callback(err);
            }
        });
    }
});