// Store timestamps needed to quickly check if user has any unread dialogs
//
// We store two timestamps for each user:
// a. time when user last visited dialog list
// b. time when last incoming message was sent
//
// Show that user has unread dialogs if a < b
//

'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let DlgUnread = new Schema({
    user:      Schema.Types.ObjectId,

    // time when last incoming message was received
    last:      Date,

    // time when user last visited dialogs
    last_read: Date
  }, {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  DlgUnread.index({ user: 1 });

  // Determine whether user has any unread dialogs since last time she
  // visited dialog page.
  //
  DlgUnread.statics.get = async function get_unread_state(user) {
    let unread = await N.models.users.DlgUnread.findOne({ user }).lean(true);

    // if this record does not exist, assume that all messages have been read:
    //   - either user has no messages
    //   - or all messages are imported from somewhere (seed, convertor)
    if (!unread) return false;

    return unread.last > unread.last_read;
  };


  // Method called whenever a new incoming message is created for a user
  //
  DlgUnread.statics.set_last = async function set_last(user) {
    await N.models.users.DlgUnread.updateOne(
      { user },
      {
        $setOnInsert: {
          last_read: new Date(0)
        },
        $set: {
          last: new Date()
        }
      },
      { upsert: true }
    );

    N.live.emit(`private.member.${user}.unread_dialogs`, { unread: true });
  };


  // Method called whenever user sees a dialog list
  // (+ edge case when user sees a message from a direct link)
  //
  DlgUnread.statics.set_last_read = async function set_last_read(user) {
    await N.models.users.DlgUnread.updateOne(
      { user },
      {
        $setOnInsert: {
          last: new Date(0)
        },
        $set: {
          last_read: new Date()
        }
      },
      { upsert: true }
    );

    N.live.emit(`private.member.${user}.unread_dialogs`, { unread: false });
  };


  N.wire.on('init:models', function emit_init_DlgUnread() {
    return N.wire.emit('init:models.' + collectionName, DlgUnread);
  });

  N.wire.on('init:models.' + collectionName, function init_model_DlgUnread(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
