'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let ModeratorNote = new Schema({
    from:    Schema.Types.ObjectId,
    to:      Schema.Types.ObjectId,
    md:      String,
    html:    String,
    ts:      { type: Date, 'default': Date.now }
  }, {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Moderator's notes page - fetch notes
  ModeratorNote.index({ to: 1 });


  N.wire.on('init:models', function emit_init_ModeratorNote() {
    return N.wire.emit('init:models.' + collectionName, ModeratorNote);
  });

  N.wire.on('init:models.' + collectionName, function init_model_ModeratorNote(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
