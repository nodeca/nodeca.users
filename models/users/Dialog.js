'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  function set_content_type(name, value) {
    N.shared = N.shared || {};
    N.shared.content_type = N.shared.content_type || {};

    let duplicate = Object.entries(N.shared.content_type).find(([ , v ]) => v === value)?.[0];

    if (typeof duplicate !== 'undefined') {
      throw new Error(`Duplicate content type id=${value} for ${name} and ${duplicate}`);
    }

    N.shared.content_type[name] = value;
  }

  set_content_type('DIALOG', 7);

  let cache = {
    last_message : Schema.Types.ObjectId,
    last_user    : Schema.Types.ObjectId,
    last_ts      : Date,
    is_reply     : Boolean, // true if last message is sent by dialog owner
    preview      : String
  };

  let Dialog = new Schema({
    user         : Schema.Types.ObjectId, // copy owner's _id
    with         : Schema.Types.ObjectId, // opponent user _id

    cache,

    unread       : { type: Boolean, default: false },

    // set to `false` if dialog is deleted by the user,
    // it'll reset to `true` whenever a new message between two users is created
    exists       : { type: Boolean, default: true }
  }, {
    versionKey: false
  });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used in dialogs list page
  Dialog.index({ user: 1, exists: 1, 'cache.last_message': -1, _id: 1 });
  Dialog.index({ user: 1, exists: 1, 'cache.is_reply': 1, 'cache.last_message': -1, _id: 1 });

  // Used in DlgUnread to check unread dialogs
  Dialog.index({ user: 1, exists: 1, unread: 1, 'cache.last_message': -1 });

  // Used to remove all dialogs created by a user from ACP
  Dialog.index({ with: 1 });

  // Used to find dialog between users
  Dialog.index({ user: 1, with: 1 });

  /////////////////////////////////////////////////////////////////////////////

  N.wire.on('init:models', function emit_init_Dialog() {
    return N.wire.emit('init:models.' + collectionName, Dialog);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Dialog(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
