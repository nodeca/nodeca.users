'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;

module.exports = function (N, collectionName) {

  var UserSettings = new Schema({
      user_id : Schema.Types.ObjectId
    },
    {
      versionKey: false,
      strict: false // allow additional fields
    });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Needed in user store
  UserSettings.index({ user_id: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_UserSettings() {
    return N.wire.emit('init:models.' + collectionName, UserSettings);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UserSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
