/**
 * Модель чат-комнаты.
 * Содержит _id и хранит список ссылок на своих пользователей.
 */

//TODO Убрать special - это костыль, чтобы создавать группу по-умолчанию.

var mongoose = require('lib/mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    special: {
        type: String,
        unique: true
    },
    users: [String]
});

exports.Room = mongoose.model('Room', schema);


