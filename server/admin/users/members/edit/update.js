// Update user profile
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  let validate_params = {
    user_hid:   { type: 'integer', minimum: 1, required: true },
    nick:       { type: 'string', required: true },
    usergroups: { type: 'array', items: { format: 'mongo' }, uniqueItems: true, required: true },
    email:      { type: 'string', required: true },
    birthday:   { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2})?$', required: true },
    hb:         { type: 'string', required: false }
  };

  if (N.config.users && N.config.users.about) {
    for (let name of Object.keys(N.config.users.about)) {
      validate_params[name] = { type: 'string', required: true };
    }
  }

  N.validate(apiPath, {
    properties: validate_params,
    additionalProperties: true
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function* fetch_user_by_hid(env) {
    env.data.user = yield N.models.users.User.findOne({ hid: env.params.user_hid }).lean(false);

    if (!env.data.user) throw N.io.NOT_FOUND;
  });


  // Validate profile fields and copy valid ones to env.data.about
  //
  N.wire.before(apiPath, function* update_user(env) {
    // change profile fields
    env.data.user.about = {};

    env.data.user.markModified('about');

    if (env.params.birthday) {
      let date = new Date(env.params.birthday);

      if (!isNaN(date)) _.set(env.data.user, 'about.birthday', date);
    }

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        if (env.params[name]) {
          _.set(env.data.user, 'about.' + name, env.params[name]);
        }
      }
    }

    // validate usergroups
    let all_usergroups = _.keyBy(yield N.models.users.UserGroup.find().select('_id').lean(true), '_id');

    env.data.user.usergroups = env.params.usergroups.filter(id => all_usergroups[id]);

    // update nick
    if (env.data.user.nick !== env.params.nick) {
      env.data.user.nick = env.params.nick;
    }

    // change email in authlinks
    if (env.data.user.email !== env.params.email) {
      env.data.user.email = env.params.email;

      let authLink = yield N.models.users.AuthLink.findOne()
                               .where('user').equals(env.data.user._id)
                               .where('type').equals('plain')
                               .where('exists').equals(true)
                               .lean(false);

      if (authLink) {
        authLink.email = env.params.email;
        yield authLink.save();
      }
    }

    env.data.user.hb = !!env.params.hb;
  });


  // Save user
  //
  N.wire.on(apiPath, function save_user(env) {
    if (_.isEmpty(env.data.user.about)) {
      /* eslint-disable no-undefined */
      env.data.user.about = undefined;
    }

    return env.data.user.save();
  });
};
