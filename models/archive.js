/**
 * Модель для храниния истории сообщений.
 * Сообщения сгруппированы по комнатам.
 * Объект сообщения содержит Логин отправителя, дату и текст.
*/
var mongoose = require('lib/mongoose');
var Schema = mongoose.Schema;

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

schema.virtual('group').get(function() { return this._id;});

exports.Group = mongoose.model('Archive', schema);


