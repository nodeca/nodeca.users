'use strict';


const Promise       = require('bluebird');
const Mongoose      = require('mongoose');
const Schema        = Mongoose.Schema;
const xregexp       = require('xregexp');
const zxcvbn        = require('zxcvbn');
const configReader  = require('../../server/_lib/resize_parse');


module.exports = function (N, collectionName) {

  var User = new Schema({
    // user-friendly id (autoincremented)
    hid            : Number,

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
    // true -> user has posted something on the site (post, message, comment, etc.)
    active         : { type: Boolean, 'default': false },

    locale         : String,
    name           : String,
    post_count     : { type: Number, 'default': 0 },
    avatar_id      : Schema.Types.ObjectId,

    // coordinates, either [ Number, Number ] or Null
    location       : Schema.Types.Mixed,

    // Profile data (contacts, location, etc.)
    //
    // Format is like this:
    // {
    //   jabber: String,
    //   icq:    String,
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


  /**
   *  models.users.User.validatePassword(str) -> Boolean
   *  - str (String): String to validate.
   *
   *  Returns whether or not `str` is a strong enough password
   **/
  User.statics.validatePassword = function validatePassword(str) {
    return zxcvbn(str).score >= 3;
  };


  // Set `name` equal to `nick` by default,
  // you can override it by adding a custom hook with altered behavior
  //
  User.pre('save', function (callback) {
    if (this.isModified('nick')) {
      this.name = this.nick;
    }

    callback();
  });

  // Here's an example how to change name formatting:
  //
  //N.wire.before('init:models.users.User', function init_extend_user_model(User) {
  //  User.add({ first_name: String, last_name: String });
  //
  //  User.pre('save', function (callback) {
  //    this.name = this.first_name + ' (' + this.nick + ') ' + this.last_name;
  //  });
  //
  //  callback();
  //});

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


  // Clean up settings on user deletion (not deleting any actual content)
  //
  User.pre('remove', function (callback) {
    var self = this;

    Promise.coroutine(function* () {

      yield N.models.users.Album.remove({ user: self._id });
      yield N.models.users.AnnounceHideMark.remove({ user: self._id });
      yield N.models.users.AuthLink.remove({ user: self._id });
      yield N.models.users.Ignore.remove({ from: self._id });
      yield N.models.users.Ignore.remove({ to: self._id });
      yield N.models.users.Subscription.remove({ user: self._id });
      yield N.models.users.UserExtra.remove({ user: self._id });
      yield N.models.users.UserPenalty.remove({ user: self._id });
      yield N.models.users.UserSettings.remove({ user: self._id });
      yield N.models.users.TokenLogin.remove({ user: self._id });
      yield N.models.users.TokenResetPassword.remove({ user: self._id });

    })().asCallback(callback);
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
