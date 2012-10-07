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

/**
 * class models.users.AuthLink#providers.AuthProvider
 *
 * Sub-document describe link info for specified provider
 * Note: some fields such as `pass` and `ext_id`,
 * could be optional for some providers
 **/

/*global nodeca*/


var mongoose = nodeca.components.mongoose;
var Schema = mongoose.Schema;

/* 3rd-paty modules */

var bcrypt = require('bcrypt');


////////////////////////////////////////////////////////////////////////////////


/**
 * new models.users.AuthLink()#providers.create() -> AuthProvider
 *
 * Create provider sub-document
 **/
var AuthProvider = module.exports.AuthProviders = new Schema({

  // Provider types. We plan to support:
  //
  // - `plain` - just email/password pair
  // - `yandex`, `facebook`, `vkontakte`, `twitter` - different oauth (not supported now)
  type:  { type: String, required: true },

  // Provider state
  // FIXME: define states (active/validating)
  state:    Number,

  // Email is mandatory to `email` provider
  // We also will require it everywhere, when possible (twitter don't have it)
  email:    String,  // user email

  // Password/Salt hash - for email provider only
  // Salt is stored right in hash string
  pass:     String,

  // For oauth providers only, external user id
  ext_id:   String,

  // metadata, if we like to extract extended info from oauth providers
  meta:     {}

});


/**
 * models.users.AuthLink#providers.AuthProvider#setPass(password) -> void
 * - password(String):  user password
 *
 * Generate password hash and put in property
 **/
AuthProvider.methods.setPass = function(password) {
  if (this.type !== 'plain') {
    return false;
  }
  this.pass = bcrypt.hashSync(password, 10);
};


/**
 * models.users.AuthLink#providers.AuthProvider#checkPass(password) -> Boolean
 * - password(String):  checked word
 *
 * Compare word with stored password
 **/
AuthProvider.methods.checkPass = function(password) {
  if (this.type !== 'plain') {
    return false;
  }
  return bcrypt.compareSync(password, this.pass);
};

//
// Subdocument indexes
//

// used in:
// - login by email
// - check that email is unique
AuthProvider.index({
  email: 1,
  provider: 1
});

// used in login via oauth
AuthProvider.index({
  ext_id: 1,
  provider: 1
});


/**
 *  new models.users.AuthLink()
 *
 *  Create new odm object
 **/
var AuthLink = module.exports.AuthLink = new Schema({
  user_id:            Schema.ObjectId,
  providers:          [ AuthProvider ]
}, { strict: true });

// used in:
// - login via nickname
// - extract auth info in other cases
AuthLink.index({
  user_id: 1
});


module.exports.__init__ = function __init__() {
  return mongoose.model('users.AuthLink', AuthLink);
};
