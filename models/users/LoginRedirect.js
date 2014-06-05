// Model for collect redirect url, to user can go back from login page to target page automatically
// Used capped collection. Don't need remove records
'use strict';

var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;

module.exports = function (N, collectionName) {

  var LoginRedirect = new Schema({
    'url'   : { 'type': String, 'required': true },
    // Not used directly. Just for information
    'date'  : { 'type': Date, 'required': true, 'default': Date.now }
  }, {
    versionKey: false,
    capped: 1048576 // 1 MB (~10000 records)
  });

  N.wire.on('init:models', function emit_init_GlobalSettings(__, callback) {
    N.wire.emit('init:models.' + collectionName, LoginRedirect, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_GlobalSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
