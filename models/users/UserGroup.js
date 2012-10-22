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
 *  Store usergroup settings
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
    // user group name used in ACP and migrations
    short_name        : String

    // parent group, all none overriden settings
    //will be inherited from parent
  , parent            : Schema.Types.ObjectId

    // can by deleted?
  , protected         : { type: Boolean, default: false }

    // belong to only this group settings (overriden)
  , raw_settings      : { type: Schema.Types.Mixed, default: {}}

    // result setting(considering inherited and defaults)
    // Note: only store can write to this property
  , settings          : { type: Schema.Types.Mixed, default: {}}
});

module.exports.__init__ = function __init__() {
  return mongoose.model('users.UserGroup', UserGroup);
};
