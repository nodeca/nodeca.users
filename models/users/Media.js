// Model for file page (comments, file usage...)
'use strict';

var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;

module.exports = function (N, collectionName) {

  var Media = new Schema({
    'file_id'     : { 'type': Schema.Types.ObjectId, 'index': true },
    'user_id'     : Schema.Types.ObjectId,
    'album_id'    : { 'type': Schema.Types.ObjectId, 'index': true },
    'created_at'  : Date,
    'description' : String
  }, {
    versionKey: false
  });

  N.wire.on('init:models', function emit_init_GlobalSettings(__, callback) {
    N.wire.emit('init:models.' + collectionName, Media, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_GlobalSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
