'use strict';
$(document).on("ready", function() {
    //TODO добавить валидацию пароля
    $(document.forms['login-form']).on('submit', function() {

        var form = $(this);

        if (form[0].username.value.length > 32) {
            $('.error', form).html('Длина логина не должна превышать 32 символов.');
            return false;
        }

        $('.error', form).html('');
        $(":submit", form).button("loading");

        $.ajax({
            url: "/login",
            method: "POST",
            data: form.serialize(),
            complete: function() {
                $(":submit", form).button("reset");
            },
            statusCode: {
                200: function() {
                    form.html("Вы вошли в сайт").addClass('alert-success');
                    window.location.href = "/chat";
                },
                403: function(jqXHR) {
                    var error = JSON.parse(jqXHR.responseText);
                    $('.error', form).html(error.message);
                }
            }
        });
        return false;
    });
});