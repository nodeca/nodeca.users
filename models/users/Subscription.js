'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var types = {
    WATCHING: 1,
    TRACKING: 2,
    NORMAL: 3,
    MUTED: 4
  };

  types.LIST_SUBSCRIBED = [ types.TRACKING, types.WATCHING ];


  var Subscription = new Schema({

    // Subscriber
    user_id: Schema.ObjectId,

    // Content id
    to: Schema.ObjectId,

    // Content type
    to_type: Number,

    // Subscription type
    type: Number
  }, {
    versionKey: false
  });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used to check user subscription to:
  //
  // - forum topic
  // - forum section
  //
  Subscription.index({ user_id: 1, to: 1 });

  // Used in tracker
  //
  Subscription.index({ user_id: 1, type: 1 });

  /////////////////////////////////////////////////////////////////////////////


  // Export types
  //
  Subscription.statics.types = types;


  // Export content types
  //
  Subscription.statics.to_types = {};


  N.wire.on('init:models', function emit_init_Subscription() {
    return N.wire.emit('init:models.' + collectionName, Subscription);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Subscription(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
