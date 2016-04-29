'use strict';


const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let UserSettings = new Schema({
      user : Schema.Types.ObjectId
    },
    {
      versionKey: false,
      strict: false // allow additional fields
    });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Needed in user store
  UserSettings.index({ user: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_UserSettings() {
    return N.wire.emit('init:models.' + collectionName, UserSettings);
  });


  N.wire.on('init:models.' + collectionName, function init_model_UserSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
