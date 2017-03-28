/**
 *  class models.users.UserGroup
 *
 *  Store usergroup settings
 **/
'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;
const memoize  = require('promise-memoize');


module.exports = function (N, collectionName) {

  let UserGroup = new Schema({
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
    //         force: Boolean
    //
    settings     : { type: Schema.Types.Mixed, 'default': {} }
  }, {
    versionKey : false
  });


  UserGroup.statics.findIdByName = memoize(function findIdByName(shortName) {
    return N.models.users.UserGroup.findOne({ short_name: shortName })
      .select('_id')
      .lean(true)
      .then(group => {
        if (!group) throw new Error(`Cannot find usergroup by short name "${shortName}"`);
        return group._id;
      });
  }, { maxAge: 60000 });


  N.wire.on('init:models', function emit_init_UserGroup() {
    return N.wire.emit('init:models.' + collectionName, UserGroup);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UserGroup(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
