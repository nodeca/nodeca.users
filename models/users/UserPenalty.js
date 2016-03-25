'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let UserPenalty = new Schema({
    user_id: Schema.Types.ObjectId,
    expire: Date
  },
  {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  UserPenalty.index({ user_id: 1 });


  N.wire.on('init:models', function emit_init_UserPenalty() {
    return N.wire.emit('init:models.' + collectionName, UserPenalty);
  });

  N.wire.on('init:models.' + collectionName, function init_model_UserPenalty(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
