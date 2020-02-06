'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;

module.exports = function (N, collectionName) {

  let Bookmark = new Schema({
    // user who created this bookmark
    user: Schema.ObjectId,

    // content id
    src: Schema.ObjectId,

    // N.shared.content_type (FORUM_POST, BLOG_ENTRY, ...)
    src_type: Number,

    // last known information regarding whether or not this bookmark source
    // was publicly visible (not guaranteed to be accurate, lazily updated)
    public: { type: Boolean, default: true }
  }, {
    versionKey : false
  });

  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // - find user bookmarks for bookmark page
  // - find/count user bookmarks for profile widget
  //
  Bookmark.index({ user: 1, _id: 1, public: -1 });

  // - add/remove/count bookmark for a specific post
  Bookmark.index({ src: 1, user: 1 });


  N.wire.on('init:models', function emit_init_Bookmark() {
    return N.wire.emit('init:models.' + collectionName, Bookmark);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Bookmark(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
