// Track nickname changes
//

'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let UserNickChange = new Schema({
    from:     Schema.Types.ObjectId,
    user:     Schema.Types.ObjectId,
    ts:       { type: Date, default: Date.now },
    old_nick: String,
    new_nick: String
  }, {
    versionKey: false
  });


  //////////////////////////////////////////////////////////////////////////////
  // Indexes

  UserNickChange.index({ user: 1 });


  N.wire.on('init:models', function emit_init_UserNickChange() {
    return N.wire.emit('init:models.' + collectionName, UserNickChange);
  });

  N.wire.on('init:models.' + collectionName, function init_model_UserNickChange(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
