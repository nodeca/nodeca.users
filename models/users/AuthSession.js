/**
 *  class models.users.AuthSession
 *
 *  User authentication record. Created after login.
 *  Contains redis session ref, login method and other info
 *  for security logs.
 **/

'use strict';


const Mongoose    = require('mongoose');
const Schema      = Mongoose.Schema;
const createToken = require('nodeca.core/lib/app/random_token');


module.exports = function (N, collectionName) {

  let AuthSession = new Schema({
    session_id:    { type: String, 'default': () => 'm' + createToken() },
    user:          Schema.Types.ObjectId,
    authprovider:  Schema.Types.ObjectId,
    first_ts:      { type: Date, 'default': Date.now }, // login time
    last_ts:       { type: Date, 'default': Date.now }, // last activity time
    logout_type:   { type: Number, 'default': 0 },
    user_agent:    String,
    ip:            String
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used for re-creating session when redis session is expired
  AuthSession.index({ session_id: 1 });

  // TODO: add indexes to display these records in user interface

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_AuthSession() {
    return N.wire.emit('init:models.' + collectionName, AuthSession);
  });


  N.wire.on('init:models.' + collectionName, function init_model_AuthSession(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
