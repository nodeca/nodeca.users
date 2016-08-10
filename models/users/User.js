'use strict';


var Mongoose      = require('mongoose');
var Schema        = Mongoose.Schema;
var xregexp       = require('xregexp');
var configReader  = require('../../server/_lib/resize_parse');


module.exports = function (N, collectionName) {

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

    // Profile data (contacts, location, etc.)
    //
    // Format is like this:
    // {
    //   jabber:       String,
    //   icq:          String,
    //   location:     [ Number, Number ],
    //   ... etc ...
    // }
    //
    about          : Schema.Types.Mixed
  },
  {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Needed to:
  //  - fetch profile page
  //  - count users in group
  User.index({ usergroups: 1 });

  // Needed for nick search
  // TODO: make case-insensitive index instead maybe?
  User.index({ nick: 1 });

  // Search by registration date
  User.index({ joined_ts: 1 });

  // For searching by custom fields
  if (N.config.users && N.config.users.about) {
    Object.keys(N.config.users.about).forEach(name => {
      let index = N.config.users.about[name].index;

      if (!index) return;

      switch (index) {
        case 'sparse':
          User.index({ ['about.' + name]: 1 }, { sparse: true });
          break;

        case true:
          User.index({ ['about.' + name]: 1 });
          break;

        default:
          throw `Unknown index value for users.about.${name}: "${index}", expected true or "sparse"`;
      }
    });
  }

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
    return str.length >= 8 && /\d/.test(str) && PASSWORD_RE.test(str);
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
      } else {
        this.name = this.nick;
      }
    }

    callback();
  });


  // Set `usergroups` for the new user if not defined
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    if (this.usergroups && this.usergroups.length) {
      callback();
      return;
    }

    var self = this;

    N.settings.get('registered_user_group')
      .then(registered_user_group => {
        self.usergroups = [ registered_user_group ];
      })
      .asCallback(callback);
  });


  // Creates UserExtra for new user
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    // this._id generates automatically before first pre('save') call
    let extra = new N.models.users.UserExtra({ user: this._id });

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
    album.user = this._id;
    album.save(callback);
  });


  // Set 'hid' for the new user. This hook should always be
  // the last one to avoid counter increment on error
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    if (this.hid) {
      // hid is already defined when this user was created, used in vbconvert;
      // it's caller responsibility to increase Increment accordingly
      callback();
      return;
    }

    var self = this;
    N.models.core.Increment.next('user', function (err, value) {
      if (err) {
        callback(err);
        return;
      }
      self.hid = value;
      callback();
    });
  });


  N.wire.on('init:models', function emit_init_User() {
    // Read config
    try {
      configReader(N.config.users.avatars);
    } catch (e) {
      throw `Error in avatars config: ${e.message}.`;
    }

    return N.wire.emit('init:models.' + collectionName, User);
  });


  N.wire.on('init:models.' + collectionName, function init_model_User(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
