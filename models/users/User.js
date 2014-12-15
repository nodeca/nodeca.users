'use strict';


var Mongoose      = require('mongoose');
var Schema        = Mongoose.Schema;
var xregexp       = require('xregexp').XRegExp;
var retricon      = require('retricon');
var configReader  = require('../../server/_lib/resize_parse');
var _             = require('lodash');
var async         = require('async');
var util          = require('util');

module.exports = function (N, collectionName) {

  var avatarConfig;

  var User = new Schema({
    // user-friendly id (autoincremented)
    hid            : Number,

    first_name     : String,
    last_name      : String,
    nick           : String,
    email          : String,
    usergroups     : [ Schema.Types.ObjectId ],
    joined_ts      : { type: Date, 'default': Date.now },
    joined_ip      : String,
    last_active_ts : { type: Date, 'default': Date.now },

    // false -> deleted accounts
    exists         : { type: Boolean, 'default': true },
    // true -> `hell banned` user
    hb             : { type: Boolean, 'default': false },

    locale         : String,
    name           : String,
    post_count     : { type: Number, 'default': 0 },

    avatar_id      : Schema.Types.ObjectId,

    // id of default avatar with identicon
    avatar_fallback: Schema.Types.ObjectId
  },
  {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Needed to fetch profile page
  User.index({ usergroups: 1 });

  // Needed to count users in group
  User.index({ usergroups: 1 });

  // Needed for nick search
  User.index({ nick: 1 });

  //////////////////////////////////////////////////////////////////////////////


  var NICK_RE = xregexp('^[\\p{L}\\d\\-_]{3,}$');


  /**
   *  models.users.User.validateNick(str) -> Boolean
   *  - str (String): String to validate.
   *
   *  Returns whenever or not `str` is a valid nickname:
   *
   *  - length equals or greater than 3
   *  - it consist of letters, numbers, dashes (-) and underscores (_) only.
   **/
  User.statics.validateNick = function validateNick(str) {
    return NICK_RE.test(str);
  };


  var PASSWORD_RE = xregexp('\\p{L}');


  /**
   *  models.users.User.validatePassword(str) -> Boolean
   *  - str (String): String to validate.
   *
   *  Returns whenever or not `str` is a valid password:
   *
   *  - length equals or greater than 8
   *  - has at least one number
   *  - has at least one letter
   **/
  User.statics.validatePassword = function validatePassword(str) {
    return 8 <= str.length && /\d/.test(str) && PASSWORD_RE.test(str);
  };


  // FIXME: make denormalisation customizeable
  //
  // Update full name, on dependencies change (nick /first name / last name)
  //
  User.pre('save', function (callback) {

    // skip, if nothing changed
    if (this.isModified('nick') || this.isModified('first_name') || this.isModified('last_name')) {
      if (!!this.first_name && !!this.last_name) {
        this.name = this.first_name + ' (' + this.nick + ') ' + this.last_name;
      }
      else {
        this.name = this.nick;
      }
    }

    callback();
  });


  // Creates UserExtra for new user
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    // this._id generates automatically before first pre('save') call
    var extra = new N.models.users.UserExtra({ user_id: this._id });

    extra.save(callback);
  });


  // Creates default album for new user
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    var album = new N.models.users.Album();
    album.default = true;
    // this._id generates automatically before first pre('save') call
    album.user_id = this._id;
    album.save(callback);
  });


  // Generate default avatar (identicon) by nick name.
  // Set 'avatar_default' to true.
  //
  User.methods.createIdenticon = function (callback) {
    var self = this;

    var sizes = avatarConfig.types[avatarConfig.extentions[0]].resize;
    var avatars = {};

    _.forEach(sizes, function (val, key) {
      var size = val.width || val.max_width;
      var style = _.clone(retricon.style.github);

      var halfTiles = ((style.tiles + 1) * 2);
      var halfTileSize = Math.floor(size / halfTiles);
      var borderExtra = (size - (halfTiles * halfTileSize)) / 2;

      style.pixelPadding = 0;
      style.imagePadding = halfTileSize + borderExtra;
      style.pixelSize = halfTileSize * 2;

      avatars[key] = retricon(self._id.toString(), style).toBuffer();
    });

    var origId = new Mongoose.Types.ObjectId();

    async.each(Object.keys(avatars), function (key, cb) {
      var opt = {
        contentType: 'image/png'
      };

      if (key === 'orig') {
        opt._id = origId;
      } else {
        opt.filename = origId + '_' + key;
      }

      N.models.core.File.put(avatars[key], opt, cb);
    }, function (err) {
      if (err) {
        callback(err);
        return;
      }

      self.avatar_fallback = origId;

      callback();
    });
  };


  // Creates default avatar if avatar_id isn't set
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    this.createIdenticon(callback);
  });


  // Set 'hid' for the new user. This hook should always be
  // the last one to avoid counter increment on error
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    var self = this;
    N.models.core.Increment.next('user', function(err, value) {
      if (err) {
        callback(err);
        return;
      }
      self.hid = value;
      callback();
    });
  });


  N.wire.on('init:models', function emit_init_User(__, callback) {
    // Read config
    try {
      avatarConfig = configReader(N.config.users.avatars);
    } catch (e) {
      callback(util.format('Error in avatars config: %s.', e.message));
      return;
    }

    N.wire.emit('init:models.' + collectionName, User, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_User(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
