'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let Infraction = new Schema({
    // Moderator _id
    from: Schema.Types.ObjectId,
    // Violator _id
    'for': Schema.Types.ObjectId,

    // Overquoting, offtopic, etc.
    type: String,
    // Required if type is `custom`
    reason: String,
    // Expire date
    expire: Date,
    points: Number,

    src_id: Schema.Types.ObjectId,
    // FORUM_POST, BLOG_ENTRY, etc.
    src_type: String,

    del_reason: String,
    del_by: Schema.ObjectId,
    exists: { type: Boolean, 'default': true }
  },
  {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  Infraction.index({ 'for': 1 });


  N.wire.on('init:models', function emit_init_Infraction() {
    return N.wire.emit('init:models.' + collectionName, Infraction);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Infraction(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
