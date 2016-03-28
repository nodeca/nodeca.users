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

    ts: { type: Date, 'default': Date.now },

    del_reason: String,
    del_by: Schema.ObjectId,
    exists: { type: Boolean, 'default': true }
  },
  {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used on member page to get all user's infractions
  Infraction.index({ 'for': 1, exists: 1 });

  // Used on forum in posts list
  Infraction.index({ src_id: 1, exists: 1 });


  Infraction.pre('save', function (next) {
    // Pass `isNew` flag to post hook. https://github.com/Automattic/mongoose/issues/1474
    this.wasNew = this.isNew;
    next();
  });


  // Emit event after add for:
  //
  // - apply automatic rules
  // - add hooks for concrete infractions types
  //
  Infraction.post('save', function (infraction) {
    if (infraction.wasNew) {
      N.wire.emit('internal:users.infraction', infraction).catch(err => N.logger.error(err));
    }
  });


  N.wire.on('init:models', function emit_init_Infraction() {
    return N.wire.emit('init:models.' + collectionName, Infraction);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Infraction(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
