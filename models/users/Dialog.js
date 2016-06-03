'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let cache = {
    last_message : Schema.Types.ObjectId,
    last_user    : Schema.Types.ObjectId,
    last_ts      : Date,
    preview      : String
  };

  let Dialog = new Schema({
      common_id    : Schema.Types.ObjectId, // common _id between personal copies of dialogue

      title        : String,
      user         : Schema.Types.ObjectId, // copy owner's _id
      to           : Schema.Types.ObjectId, // opponent user _id

      cache,

      unread       : { type: Number, 'default': 0 }, // number of messages unread by owner
      exists       : { type: Boolean, 'default': true }
    },
    {
      versionKey: false
    });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used in dialogs list page
  Dialog.index({ user: 1, exists: 1, 'cache.last_message': -1, _id: 1 });

  // Used to find opponent's dialog copy in:
  //
  // - dialogs list
  // - reply
  //
  Dialog.index({ common_id: 1 });

  /////////////////////////////////////////////////////////////////////////////

  N.wire.on('init:models', function emit_init_Dialog() {
    return N.wire.emit('init:models.' + collectionName, Dialog);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Dialog(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
