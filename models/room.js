/**
 * Модель чат-комнаты.
 * Содержит _id и хранит список ссылок на своих пользователей.
 */
var mongoose = require('lib/mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    _id: Schema.Types.ObjectId,
    users: [{type: Schema.Types.ObjectId, ref: 'User'}]
});

exports.Group = mongoose.model('Group', schema);


