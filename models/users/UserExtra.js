'use strict';


const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let UserExtra = new Schema(
    {
      user: Schema.Types.ObjectId,

      media_size: { type: Number, 'default': 0 }
    },
    {
      versionKey: false
    }
  );

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  UserExtra.index({ user: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_UserExtra() {
    return N.wire.emit('init:models.' + collectionName, UserExtra);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UserExtra(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
