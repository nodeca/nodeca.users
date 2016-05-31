'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let Ignore = new Schema({
    // user who is ignoring messages
    from:   Schema.Types.ObjectId,

    // user whose messages are ignored
    to:     Schema.Types.ObjectId,

    // reason for ignore (optional)
    reason: String,

    // creation date
    ts: { type: Date, 'default': Date.now },

    // expiration date
    expire: Date
  },
  {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes


  // check if a user ignores another user
  Ignore.index({ from: 1, to: 1 });

  // clean up expired ignores
  Ignore.index({ expire: 1 });


  N.wire.on('init:models', function emit_init_Ignore() {
    return N.wire.emit('init:models.' + collectionName, Ignore);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Ignore(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
