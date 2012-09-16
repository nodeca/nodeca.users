'use strict';


/**
 *  models
 **/

/**
 *  models.users
 **/


/**
 *  class models.users.AuthLink
 *
 *  Store links beetween user and auth providers.
 **/


/*global nodeca*/



var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;

var Crypto = require('crypto');
////////////////////////////////////////////////////////////////////////////////


/**
 *  new models.users.AuthLink()
 *
 *  Create new odm object
 **/
var AuthLink = module.exports.AuthLink = new mongoose.Schema({
  user_id:            Schema.ObjectId,
  provider:           String,                 // auth provider
  external_user_id:   String,                 // user id on provider servise
  email:              String,
  auth_data:          Schema.Types.Mixed      // some data from provider
}, { strict: true });


// hash(password, salt) -> String
// - password(string): user pasword
// - salt(string):     hash salt
var hash = function(password, salt) {
  return Crypto.createHmac('sha256', salt).update(password).digest('hex');
};


/**
 * models.users.AuthLink#setPass(password) -> void
 * - password(String):  user password
 *
 * Generate password hash and put in property
 **/
AuthLink.methods.setPass = function(password) {
  this.auth_data.pass = hash(password, password + this.user_id);
};


/**
 * models.users.AuthLink#checkPass(password) -> Boolean
 * - password(String):  checked word
 *
 * Compare word with stored password
 **/
AuthLink.methods.checkPass = function(password) {
  return this.auth_data.pass === hash(password, password + this.user_id);
};

module.exports.__init__ = function __init__() {
  return mongoose.model('users.AuthLink', AuthLink);
};
