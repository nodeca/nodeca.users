'use strict';


/**
 *  models
 **/

/**
 *  models.users
 **/


/**
 *  class models.users.AuthData
 *
 *  Users auth data changelog
 **/

/*global nodeca*/



var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;
////////////////////////////////////////////////////////////////////////////////


/**
 *  new models.users.AuthChangeLog()
 *
 *  Create new odm object
 **/
var AuthChangeLog= new Schema({
  user_id: Schema.ObjectId,
  action: String,
  date: Date,
  ip:  String,
  data: Schema.Types.Mixed
});


module.exports.__init__ = function __init__() {
  return mongoose.model('users.AuthChangeLog', AuthChangeLog);
};
