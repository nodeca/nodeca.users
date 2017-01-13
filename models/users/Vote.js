'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var Vote = new Schema({

    // User who created vote
    from: Schema.ObjectId,

    // Content owner
    to: Schema.ObjectId,

    // Content id
    'for': Schema.ObjectId,

    // N.shared.content_type (FORUM_POST, BLOG_ENTRY, ...)
    type: Number,

    // Hell banned
    hb: { type: Boolean, 'default': false },

    // Vote value
    value: Number,

    // Backup for deleted content
    backup: Number
  }, {
    versionKey: false
  });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used on:
  //
  // - item votes/votes_hb count update (forum posts)
  // - user own votes fetch, how he voted (forum posts)
  //
  Vote.index({ 'for': 1, from: 1 });

  // used to remove votes from admin interface
  Vote.index({ from: 1 });

  /////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_Vote() {
    return N.wire.emit('init:models.' + collectionName, Vote);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Vote(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
