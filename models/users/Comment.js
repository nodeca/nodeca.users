// Comments for user media

'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;

// Comment statuses
var statuses = require('../../server/users/_lib/statuses.js');


module.exports = function (N, collectionName) {

  var Comment = new Schema({

    user_id         : Schema.ObjectId,
    media_id        : Schema.ObjectId,
    to              : Schema.ObjectId,
    created_at      : { type: Date, 'default': Date.now },
    ip              : String,
    text            : String,
    // Comment status (visible, deleted, hellbanned)
    st              : Number,
  },
  {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Media page, fetch comments
  Comment.index({
    media_id   : 1,
    st         : 1,
    created_at : -1
  });


  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_Comment(__, callback) {
    N.wire.emit('init:models.' + collectionName, Comment, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Comment(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });

  // Hide hellbanned info for regular users for security reasons.
  // This method works with raw object.
  //
  // options:
  //
  // - `keep_statuses` (boolean) - when false, set st = VISIBLE. Default - false.
  Comment.statics.sanitize = function sanitize(comment, options) {
    options = options || {};

    if (comment.st !== statuses.comment.HB) {
      return;
    }
    if (!options.keep_statuses) {
      comment.st = statuses.comment.VISIBLE;
    }
  };
};
