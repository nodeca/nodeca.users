/**
 *  class models.users.AuthSession
 *
 *  User authentication record. Created after login.
 *  Contains redis session ref, login method and other info
 *  for security logs.
 **/


'use strict';


var Mongoose    = require('mongoose');
var Schema      = Mongoose.Schema;
var createToken = require('nodeca.core/lib/app/random_token');


module.exports = function (N, collectionName) {

  var AuthSession = new Schema({
    session_id:   { type: String, 'default': createToken },
    user:         Schema.Types.ObjectId,
    authprovider: Schema.Types.ObjectId,
    ip:           String
  },
  {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used for re-creating session when redis session is expired
  AuthSession.index({ session_id: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_AuthSession() {
    return N.wire.emit('init:models.' + collectionName, AuthSession);
  });


  N.wire.on('init:models.' + collectionName, function init_model_AuthSession(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
