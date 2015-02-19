'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var types = {
    FORUM_POST: 1
  };


  var Vote = new Schema({

    // User who created vote
    from: Schema.ObjectId,

    // Content owner
    to: Schema.ObjectId,

    // Content id
    for: Schema.ObjectId,

    // Content type
    type: Number,

    // Vote value
    value: Number,

    // Backup for deleted content
    backup: Number
  }, {
    versionKey: false
  });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Content list
  Vote.index({ for: 1, from: 1 });

  /////////////////////////////////////////////////////////////////////////////


  // Export types
  //
  Vote.statics.types = types;


  N.wire.on('init:models', function emit_init_Vote(__, callback) {
    N.wire.emit('init:models.' + collectionName, Vote, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Vote(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
