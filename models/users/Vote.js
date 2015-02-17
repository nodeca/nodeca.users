'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var values = {
    UP: 1,
    DOWN: -1,
    NONE: 0
  };


  var types = {
    FORUM_POST: 1
  };


  var Vote = new Schema({

    // User who created vote
    from: Schema.ObjectId,

    // Content id
    to: Schema.ObjectId,

    // Content owner
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
  Vote.index({ to: 1, from: 1 });

  /////////////////////////////////////////////////////////////////////////////


  // Export values
  //
  Vote.statics.values = values;


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
