'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;

var statuses = require('../../server/users/_lib/statuses.js');

module.exports = function (N, collectionName) {

  var Comment = new Schema({

        user_id         : Schema.ObjectId
      , media_id        : Schema.ObjectId
      , to              : Schema.ObjectId
      , created_at      : { type: Date, required: true, 'default': function () { return new Date(); } }
      , ip              : String  // ip address
      , text            : { type: String, required: true
      // Comment status (normal, deleted, hellbanned)
      , st              : { type: Number, required: true }}

    },
    {
      versionKey : false
    });

  // Indexes
  ////////////////////////////////////////////////////////////////////////////////

  //Set comments ids
  Comment.index({
    media_id   : 1,
    st         : 1,
    created_at : -1
  });

  N.wire.on('init:models', function emit_init_Post(__, callback) {
    N.wire.emit('init:models.' + collectionName, Comment, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Post(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
