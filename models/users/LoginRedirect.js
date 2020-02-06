// Urls to redirect user after login

'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var LoginRedirect = new Schema({
    url:        String,
    session_id: String,

    // Allow use redirect only once
    used:       { type: Boolean, default: false }
  }, {
    versionKey: false,
    // 1 MB, ~10000 records
    capped: 1048576
  });


  N.wire.on('init:models', function emit_init_LoginRedirect() {
    return N.wire.emit('init:models.' + collectionName, LoginRedirect);
  });


  N.wire.on('init:models.' + collectionName, function init_model_LoginRedirect(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
