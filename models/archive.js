/**
 * Модель для храниния истории сообщений.
 * Сообщения сгруппированы по комнатам.
 * Объект сообщения содержит Логин отправителя, дату и текст.
 */
var mongoose = require('lib/mongoose');
var Schema = mongoose.Schema;
var async = require('async');

var schema = new Schema({
    _id: {
        type: Schema.Types.ObjectId,
        ref: 'Group'
    },
    messages: [
        {
            username: String,
            message: String,
            date: {
                type: Date,
                default: Date.now
            }
        }
    ]
});

schema.virtual('group').get(function () {
    return this._id;
});

// объект хранит найденные архивы для добавления сообщений
var fastAccess = {};

schema.statics.addMessage = function (roomId, username, message) {
    var Archive = this;

    async.waterfall([
        function checkFastAccess(callback) {
            if (fastAccess[roomId]) {
                callback(null, fastAccess[roomId]);
            } else {
                // к этой комнате пока не обращались - вытащить её и сохранить
                Archive.findById(roomId, function (err, archive) {
                    if (err) return callback(err);

                    if (!archive) {
                        archive = new Archive({_id: roomId, messages: []});
                        archive.save(function(err, archive) {
                            if (err) return callback(err);

                            fastAccess[roomId] = archive;
                            callback(null, fastAccess[roomId]);
                        })
                    } else {
                        fastAccess[roomId] = archive;
                        callback(null, fastAccess[roomId]);
                    }
                });
            }
        },
        function addMessage(archive, callback) {
            archive.messages.push({
                username: username,
                message: message
            });
            archive.save(callback);
        }
    ], function (err) {
        if (err) {
            console.error("Ошибка при добавлении сообщения %s в архив %s", message, roomId);
        }
    });
};

// TODO сделать ограниченную выдачу по N сообщений, т.к. сообщений может быть очень много.
/**
 * Передаёт через callback все сообщения для комнаты roomId.
 * @param roomId
 * @param callback
 */
schema.statics.getMessages = function (roomId, callback) {
    var Archive = this;
    Archive.findById(roomId, function(err, archive) {
        if (err) {
            console.error("При получении сообщений для комнаты %s произошла ошибка: %j", roomId, err);
            return callback(err);
        }
        if (!archive) {
            console.error("Для комнаты %j не существует архива сообщений.", roomId);
            return callback("Архив не найден.");
        }

        callback(null, archive.messages);
    });
};

exports.Archive = mongoose.model('Archive', schema);


