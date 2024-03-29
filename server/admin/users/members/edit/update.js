// Update user profile
//
'use strict';

const _             = require('lodash');
const parse_options = require('nodeca.users/server/users/mod_notes/_parse_options');


function md_escape(text) {
  // punctuation character set is the same as in markdown-it `text` rule
  return text.replace(/([\n!#$%&*+\-:<=>@[\\\]^_`{}~])/g, '\\$1'); //`
}


module.exports = function (N, apiPath) {

  let validate_params = {
    user_hid:   { type: 'integer', minimum: 1, required: true },
    nick:       { type: 'string' },
    usergroups: { type: 'array', items: { format: 'mongo' }, uniqueItems: true },
    email:      { type: 'string' },
    hb:         { type: 'string' }
  };

  if (N.config.users?.about) {
    for (let name of Object.keys(N.config.users.about)) {
      validate_params[name] = { type: 'string' };
    }
  }

  N.validate(apiPath, {
    properties: validate_params,
    additionalProperties: true
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, async function fetch_user_by_hid(env) {
    env.data.user = await N.models.users.User.findOne({ hid: env.params.user_hid }).lean(false);

    if (!env.data.user) throw N.io.NOT_FOUND;

    // save a copy of the user to check modified fields later,
    // and get original values for logging purposes
    env.data.original_user = env.data.user.toObject();
  });


  // Check nick formatting and uniqueness
  //
  N.wire.before(apiPath, async function check_nick(env) {
    if (typeof env.params.nick !== 'undefined' && env.params.nick !== env.data.user.nick) {
      if (!N.models.users.User.validateNick(env.params.nick)) {
        throw {
          code: N.io.CLIENT_ERROR,
          message: env.t('err_invalid_nick')
        };
      } else if (await N.models.users.User.similarExists(env.params.nick)) {
        throw {
          code: N.io.CLIENT_ERROR,
          message: env.t('err_busy_nick')
        };
      }
    }
  });


  // Check email uniqueness
  //
  N.wire.before(apiPath, async function check_email(env) {
    if (typeof env.params.email !== 'undefined' && env.params.email !== env.data.user.email) {
      if (await N.models.users.AuthProvider.similarEmailExists(env.params.email)) {
        throw {
          code: N.io.CLIENT_ERROR,
          message: env.t('err_busy_email')
        };
      }
    }
  });


  // Normalize form data, build user model to save
  //
  N.wire.before(apiPath, async function prepare_user(env) {
    env.data.user.markModified('about');

    // process custom fields
    if (N.config.users?.about) {
      for (let name of Object.keys(N.config.users.about)) {
        // Only change fields if:
        //  - field is present in input (form may be submitted partially)
        //  - field is different from stored value (falsy values considered equal)
        if (typeof env.params[name] !== 'undefined' &&
            (env.params[name] || '') !== (env.data.user.about?.[name] || '')) {

          /* eslint-disable max-depth */
          if (env.params[name]) {
            env.data.user.about = env.data.user.about || {};
            env.data.user.about[name] = env.params[name];
          } else {
            // if it's empty, remove it from database
            delete env.data.user.about?.[name];
          }
        }
      }
    }

    // validate usergroups
    if (typeof env.params.usergroups !== 'undefined') {
      let all_usergroups = _.keyBy(await N.models.users.UserGroup.find().select('_id').lean(true), '_id');

      env.data.user.usergroups = env.params.usergroups.filter(id => all_usergroups[id]);
    }

    // update nick
    if (typeof env.params.nick !== 'undefined' && env.params.nick !== env.data.user.nick) {
      env.data.user.nick = env.params.nick;
    }

    // change email in authproviders
    if (typeof env.params.email !== 'undefined' && env.params.email !== env.data.user.email) {
      env.data.user.email = env.params.email;
    }

    if (typeof env.params.hb !== 'undefined') {
      env.data.user.hb = !!env.params.hb;
    }
  });


  // Save user and log changes to moderator notes
  //
  N.wire.on(apiPath, async function save_user(env) {
    if (env.data.user.isModified('email')) {
      // disable all email authproviders
      // (authprovider for new email will be created on next login)
      await N.models.users.AuthProvider.updateMany(
        { user: env.data.user._id, type: 'email' },
        { $set: { exists: false } }
      );

      // replace email in plain authprovider
      let authProvider = await N.models.users.AuthProvider.findOne()
                                   .where('user').equals(env.data.user._id)
                                   .where('type').equals('plain')
                                   .where('exists').equals(true)
                                   .lean(false);

      if (authProvider) {
        authProvider.email = env.data.user.email;
        await authProvider.save();
      }
    }

    env.data.saved_user = await env.data.user.save();
  });


  // Log this change in moderator notes;
  // we need to wait until all 'post' hooks in User model are resolved
  // to get correct values here
  //
  N.wire.after(apiPath, async function save_log_in_moderator_notes(env) {
    let log = []; // array of [ localized_field, old_value_str, new_value_str ]

    for (let path of N.models.users.User.trackable) {
      let old_value = _.get(env.data.original_user, path);
      let new_value = _.get(env.data.saved_user, path);
      let old_value_str;
      let new_value_str;

      // compare stringified values to account for
      // Arrays (usergroups)
      if (JSON.stringify(old_value || '') === JSON.stringify(new_value || '')) {
        continue;
      }

      if (path === 'usergroups') {
        let ids = _.uniq([].concat(old_value.map(String)).concat(new_value.map(String)));
        let usergroups_by_id = _.keyBy(
          await N.models.users.UserGroup.find()
                    .where('_id').in(ids)
                    .select('_id short_name')
                    .sort('_id')
                    .lean(true),
          '_id'
        );

        old_value_str = old_value.map(id => usergroups_by_id[id]?.short_name).join(', ');
        new_value_str = new_value.map(id => usergroups_by_id[id]?.short_name).join(', ');
      }

      // format booleans (hellbanned)
      if (typeof old_value === 'boolean' || typeof new_value === 'boolean') {
        /* eslint-disable max-depth */
        if (typeof old_value === 'boolean' || !old_value) old_value_str = env.t(old_value ? 'yes' : 'no');
        if (typeof new_value === 'boolean' || !new_value) new_value_str = env.t(new_value ? 'yes' : 'no');
      }

      // default formatters (strings)
      if (typeof old_value_str === 'undefined') {
        old_value_str = old_value ? md_escape(String(old_value)) : '""';
      }

      if (typeof new_value_str === 'undefined') {
        new_value_str = new_value ? md_escape(String(new_value)) : '""';
      }

      let name = path.replace(/^.*\./, '');

      // localization is stored in two places:
      //  - @admin.users.about.* for custom fields (skype, etc.)
      //  - locally for the rest
      let localized_name;

      if (env.t.exists(name)) {
        localized_name = env.t(name);
      } else if (env.t.exists('@admin.users.about.' + name)) {
        localized_name = env.t('@admin.users.about.' + name);
      } else {
        // fallback, shouldn't happen
        localized_name = name;
      }

      log.push([ localized_name, old_value_str, new_value_str ]);
    }

    if (log.length) {
      let md_text = env.t('mod_note_text', {
        admin_nick: env.user_info.user_name,
        admin_link: N.router.linkTo('users.member', { user_hid: env.user_info.user_hid })
      }) +
                    '\n\n' +
                    log.map(([ field, old_value, new_value ]) =>
                      ` - ${field}: ${old_value} → ${new_value}`
                    ).join('\n');

      let parse_result = await N.parser.md2html({
        text:        md_text,
        options:     parse_options,
        user_info:   env.user_info
      });

      let bot = await N.models.users.User.findOne()
                          .where('hid').equals(N.config.bots.default_bot_hid)
                          .lean(true);

      let note = new N.models.users.ModeratorNote({
        from: bot._id,
        to:   env.data.user._id,
        md:   env.params.txt,
        html: parse_result.html
      });

      await note.save();
    }
  });


  // Record nickname change in a separate collection if it happened
  //
  N.wire.after(apiPath, async function save_nick_change(env) {
    if (env.data.original_user.nick === env.data.saved_user.nick) return;

    await new N.models.users.UserNickChange({
      from:     env.user_info.user_id,
      user:     env.data.user._id,
      old_nick: env.data.original_user.nick,
      new_nick: env.data.saved_user.nick
    }).save();
  });
};
