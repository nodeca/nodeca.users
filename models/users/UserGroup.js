"use strict";


/**
 *  models
 **/

/**
 *  models.users
 **/


/**
 *  class models.users.UserGroup
 *
 *  Store links beetween user and auth providers.
 **/

/*global nodeca*/

var mongoose = nodeca.components.mongoose;
var Schema = mongoose.Schema;


/**
 *  new models.users.UserGroup()
 *
 *  Create new odm object
 **/
var UserGroup = module.exports.UserGroup = new Schema({
    _id               : { type: String, unique: true }
  , items             : { type: Schema.Types.Mixed, default: {}}
}, {_id: false});

module.exports.__init__ = function __init__() {
  return mongoose.model('users.UserGroup', UserGroup);
};
