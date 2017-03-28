// List of announces closed by users

'use strict';


const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let AnnounceHideMark = new Schema({
    user:  Schema.Types.ObjectId,

    // hash like { announceid: Date }, where date is a timestamp of when
    // announce should re-appear
    hide:  Schema.Types.Mixed,

    // time when this document was last updated
    ts:    Date
  }, {
    versionKey: false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  AnnounceHideMark.index({ user: 1 });


  N.wire.on('init:models', function emit_init_AnnounceHideMark() {
    return N.wire.emit('init:models.' + collectionName, AnnounceHideMark);
  });

  N.wire.on('init:models.' + collectionName, function init_model_AnnounceHideMark(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
