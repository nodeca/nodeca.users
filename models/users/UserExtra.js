'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;

module.exports = function (N, collectionName) {

  var UserExtra = new Schema(
    {
      user_id: Schema.Types.ObjectId,

      media_size: { type: Number, 'default': 0 }
    },
    {
      versionKey: false
    }
  );

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  UserExtra.index({ user_id: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_UserExtra(__, callback) {
    N.wire.emit('init:models.' + collectionName, UserExtra, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UserExtra(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
