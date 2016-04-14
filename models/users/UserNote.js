'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let UserNote = new Schema({
    from:    Schema.Types.ObjectId,
    to:      Schema.Types.ObjectId,
    md:      String,
    html:    String,
    version: Number
  },
  {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  // used to find a specific note
  UserNote.index({ to: 1, from: 1 });


  N.wire.on('init:models', function emit_init_UserNote() {
    return N.wire.emit('init:models.' + collectionName, UserNote);
  });

  N.wire.on('init:models.' + collectionName, function init_model_UserNote(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
