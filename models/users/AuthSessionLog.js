/**
 *  class models.users.AuthSessionLog
 *
 *  User authentication record log. An AuthSession record is moved here
 *  upon user logout.
 **/

'use strict';


const Mongoose    = require('mongoose');
const Schema      = Mongoose.Schema;
const createToken = require('nodeca.core/lib/app/random_token');


// Reason why this session was terminated
//
const logout_types = {
  //EXPIRED: 1, // timed out
  LOGOUT:  2, // user clicked logout button
  REVOKED: 3  // from another device
};


module.exports = function (N, collectionName) {

  let AuthSessionLog = new Schema({
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

  // TODO: add indexes to display these records in user interface

  //////////////////////////////////////////////////////////////////////////////

  AuthSessionLog.statics.logout_types = logout_types;


  N.wire.on('init:models', function emit_init_AuthSessionLog() {
    return N.wire.emit('init:models.' + collectionName, AuthSessionLog);
  });


  N.wire.on('init:models.' + collectionName, function init_model_AuthSessionLog(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
