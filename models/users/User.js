'use strict';


const Mongoose      = require('mongoose');
const Schema        = Mongoose.Schema;
const unhomoglyph   = require('unhomoglyph');
const zxcvbn        = require('zxcvbn');
const configReader  = require('../../server/_lib/resize_parse');


module.exports = function (N, collectionName) {

  var User = new Schema({
    // user-friendly id (autoincremented)
    hid            : Number,

    nick           : String,

    // unhomoglyphed version of the nick, only used during registration
    // to check that user doesn't register similarly looking nickname
    nick_normalized    : String,

    // lowercased (not unhomoglyphed) version of the nick
    nick_normalized_lc : String,

    email          : String,
    usergroups     : [ Schema.Types.ObjectId ],
    joined_ts      : { type: Date, default: Date.now },
    joined_ip      : String,
    last_active_ts : { type: Date, default: Date.now },

    // false -> deleted accounts
    exists         : { type: Boolean, default: true },
    // true -> `hell banned` user
    hb             : { type: Boolean, default: false },
    // true -> user has posted something on the site (post, message, comment, etc.)
    active         : { type: Boolean, default: false },

    locale         : String,
    name           : String,
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
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Needed to:
  //  - fetch profile page
  //  - count users in group
  User.index({ usergroups: 1 });

  // Find user by hid
  User.index({ hid: 1 });

  // Needed for nick search
  User.index({ nick: 1 });

  // Nick search in ACP, autocompletion in ACP and dialogs
  User.index({ nick_normalized_lc: 1 });

  // Homoglyph check during registration
  User.index({ nick_normalized: 1 });

  // Search by registration date
  User.index({ joined_ts: 1 });

  // Find user by email (login by email)
  User.index({ email: 1 });

  // For searching by custom fields
  if (N.config.users?.about) {
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


  var NICK_RE = /(?=.{3,20})^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u;


  /**
   *  models.users.User.validateNick(str) -> Boolean
   *  - str (String): String to validate.
   *
   *  Returns whenever or not `str` is a valid nickname:
   *
   *  - length equals to or greater than 2
   *  - it consist of letters, numbers, dashes (-) and underscores (_) only,
   *    where dashes and underscores can only be in the middle of the nick
   *    and sequences of more than one of these are not allowed.
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


  /**
   *  models.users.User.similarExists(nick) -> Boolean
   *   - nick (String): Nickname to check.
   *
   *  Returns whether nicknames exist that either:
   *   - written in a different case (ADMIN vs admin)
   *   - visually similar (ADMIN vs ADM1N)
   **/
  User.statics.similarExists = async function similarExists(nick) {
    let user;

    // check for same nick in different case (admin vs ADMIN)
    user = await N.models.users.User
                        .findOne({ nick_normalized_lc: nick.toLowerCase() })
                        .select('_id')
                        .lean(true);

    if (user) return true;

    // check for similarly looking nick (ADMIN vs ADMlN)
    user = await N.models.users.User
                        .findOne({ nick_normalized: unhomoglyph(nick) })
                        .select('_id')
                        .lean(true);

    if (user) return true;

    return false;
  };


  /**
   *  models.users.User.resolveLocation(user_id, locale)
   *
   *  Resolve name for user location with 5 second delay used for deduplication
   **/
  User.statics.resolveLocation = async function resolveLocation(user_id, locale) {
    await N.redis.zadd('geo:member', Date.now(), String(user_id) + ':' + locale);

    N.queue.geo_member_location_process().postpone();
  };


  // List of important property names (changes should be logged for those)
  //
  User.statics.trackable = [
    'nick',
    'usergroups',
    'email',
    'about.birthday',
    'hb'
  ];

  if (N.config.users?.about) {
    for (let name of Object.keys(N.config.users.about)) {
      User.statics.trackable.push('about.' + name);
    }
  }


  // Set `name` equal to `nick` by default,
  // you can override it by adding a custom hook with altered behavior
  //
  User.pre('save', function () {
    if (this.isModified('nick')) {
      this.name = this.nick;
    }
  });


  // Here's an example how to change name formatting:
  //
  //N.wire.before('init:models.users.User', function init_extend_user_model(User) {
  //  User.add({ first_name: String, last_name: String });
  //
  //  User.pre('save', function () {
  //    this.name = this.first_name + ' (' + this.nick + ') ' + this.last_name;
  //  });
  //});


  // Set normalized nick
  //
  User.pre('save', function () {
    if (this.isModified('nick')) {
      //
      // Use two different fields for homoglyph check and lowercase,
      // because unhomoglyphing doesn't work with lowercase:
      //
      //  - unhomoglyph then lowercase: `admin` and `ADMIN` are different
      //  - lowercase then unhomoglyph: `ADMIN` and `ADMlN` are different
      //
      this.nick_normalized    = unhomoglyph(this.nick);
      this.nick_normalized_lc = this.nick.toLowerCase();
    }
  });


  // Set `usergroups` for the new user if not defined
  //
  User.pre('save', async function () {
    if (!this.isNew) return;
    if (this.usergroups?.length) return;

    let registered_user_group = await N.settings.get('registered_user_group');

    this.usergroups = [ registered_user_group ];
  });


  // Creates UserExtra for new user
  //
  User.pre('save', function () {
    if (!this.isNew) return;

    // this._id generates automatically before first pre('save') call
    let extra = new N.models.users.UserExtra({ user: this._id });

    return extra.save();
  });


  // Creates default album for new user
  //
  User.pre('save', function () {
    if (!this.isNew) return;

    let album = new N.models.users.Album();
    album.default = true;
    // this._id generates automatically before first pre('save') call
    album.user = this._id;
    return album.save();
  });


  // Set 'hid' for the new user. This hook should always be
  // the last one to avoid counter increment on error
  //
  User.pre('save', async function () {
    if (!this.isNew) return;

    // hid is already defined when this user was created, used in vbconvert;
    // it's caller responsibility to increase Increment accordingly
    if (this.hid) return;

    this.hid = await N.models.core.Increment.next('user');
  });


  async function onRemoveCleanup(id) {
    await N.models.users.Album.deleteMany({ user: id });
    await N.models.users.AnnounceHideMark.deleteMany({ user: id });
    await N.models.users.AuthProvider.deleteMany({ user: id });
    await N.models.users.Ignore.deleteMany({ from: id });
    await N.models.users.Ignore.deleteMany({ to: id });
    await N.models.users.Subscription.deleteMany({ user: id });
    await N.models.users.Bookmark.deleteMany({ user: id });
    await N.models.users.UserExtra.deleteMany({ user: id });
    await N.models.users.UserPenalty.deleteMany({ user: id });
    await N.models.users.UserSettings.deleteMany({ user: id });
    await N.models.users.AuthSession.deleteMany({ user: id });
    await N.models.users.TokenResetPassword.deleteMany({ user: id });
  }

  // Clean up settings on user deletion (not deleting any actual content)
  //
  User.pre('remove', function () {
    return onRemoveCleanup(this._id);
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
