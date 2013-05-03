/**
 *  class models.users.UserGroup
 *
 *  Store usergroup settings
 **/


'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  /**
   *  new models.users.UserGroup()
   *
   *  Create new odm object
   **/
  var UserGroup = new Schema({
    // User group name used in ACP and migrations.
    short_name   : { type: String, unique: true }

    // Can by deleted or renamed?
  , is_protected : { type: Boolean, 'default': false }

    // Parent group, all non-overriden settings will be inherited from this.
  , parent_group : Schema.Types.ObjectId

    // Own settings of a group (i.e. not inherited). Used by the admin interface.
  , raw_settings : { type: Schema.Types.Mixed, 'default': {} }

    // Settings storage. Used only the the UsergroupStore.
  , settings     : { type: Schema.Types.Mixed, 'default': {} }
  });


  N.wire.on("init:models", function emit_init_UserGroup(__, callback) {
    N.wire.emit("init:models." + collectionName, UserGroup, callback);
  });

  N.wire.on("init:models." + collectionName, function init_model_UserGroup(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
