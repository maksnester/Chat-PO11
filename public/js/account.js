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

    var filesContainer = $('ul', '#storageList');

    // кнопка удаления файла
    $('ul').on("click", function (event) {
        if (event.target.parentNode.tagName === "BUTTON") {
            var li = event.target.parentNode.parentNode;
            var filename = li.textContent || li.innerText;
            filename = filename.slice(0, filename.length - 1); // отрезать крестик. Он тоже попадает в textContent
            $.ajax({
                url: 'http://' + window.location.host + '/uploads/' + filename,
                method: 'delete',
                success: function () {
                    console.info('Файл успешно %o успешно удалён', filename);
                },
                error: function (err) {
                    console.error('При удалении файла %o произошла ошибка: %o', filename, err);
                }
            });

            $(li).fadeOut(500, function() {
                $(this).remove();
                if (!filesContainer.children().length) {
                    filesContainer.html('У вас пока нет файлов.');
                }
            });
        }
    });


    var closeButton = '<button class="close" type="button"><span aria-hidden="true">×</span></button>';
    getFiles(function (err, files) {
        if (err) {
            filesContainer.html('При получении данных произошла ошибка: ' + err.message);
        }
        if (!files || !files.length) {
            filesContainer.html('У вас пока нет файлов.');
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