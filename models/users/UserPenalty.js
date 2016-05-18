'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let UserPenalty = new Schema({
    user:   Schema.Types.ObjectId,
    type:   String, // penalty action type (`to_violators`)
    expire: Date
  },
  {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used in internal methods:
  //
  // - users.infraction.to_banned
  // - users.infraction.to_violators
  //
  UserPenalty.index({ user: 1 });

  // Used in `invalidate_penalties` job
  UserPenalty.index({ expire: 1 });


  N.wire.on('init:models', function emit_init_UserPenalty() {
    return N.wire.emit('init:models.' + collectionName, UserPenalty);
  });

  N.wire.on('init:models.' + collectionName, function init_model_UserPenalty(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
