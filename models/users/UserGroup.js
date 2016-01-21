/**
 *  class models.users.UserGroup
 *
 *  Store usergroup settings
 **/


'use strict';


var Mongoose = require('mongoose');
var thenify  = require('thenify');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var UserGroup = new Schema({
    // User group name used in ACP and migrations.
    // Index not really needed, just protects from collisions.
    short_name   : { type: String, unique: true },

    // Can be deleted?
    // Groups like `admin`, `guests`, `members` are protected
    is_protected : { type: Boolean, 'default': false },

    // Parent group, all non-overriden settings will be inherited from it.
    parent_group : Schema.Types.ObjectId,

    // Settings storage. Used only in the UsergroupStore. Format:
    //
    //     settings:
    //       setting1_key:
    //         value: Mixed
    //         own:   Boolean
    //         force: Boolean
    //
    settings     : { type: Schema.Types.Mixed, 'default': {} }
  },
  {
    versionKey : false
  });


  UserGroup.statics.findIdByName = thenify.withCallback(function findIdByName(shortName, callback) {
    this.findOne({ short_name: shortName }, '_id', { lean: true }, function (err, group) {
      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback(new Error('Cannot find usergroup by short name "' + shortName + '"'));
        return;
      }

      callback(null, group._id);
    });
  });


  N.wire.on('init:models', function emit_init_UserGroup(__, callback) {
    N.wire.emit('init:models.' + collectionName, UserGroup, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UserGroup(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
