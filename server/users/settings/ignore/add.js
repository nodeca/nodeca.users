// Add a user to ignore list
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user:   { format: 'mongo', required: true },
    period: { type: 'number',  required: true, minumum: 0, maximum: 1000 },
    reason: { type: 'string',  required: true }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (!env.user_info.is_member) {
      return N.io.FORBIDDEN;
    }
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findOne({ _id: env.params.user }).lean(true);

    if (!env.data.user) {
      throw { code: N.io.CLIENT_ERROR, message: env.t('err_invalid_user') };
    }
  });


  // Check if user is trying to ignore herself
  //
  N.wire.on(apiPath, function prevent_ignoring_yourself(env) {
    if (String(env.user_info.user_id) === String(env.data.user._id)) {
      return { code: N.io.CLIENT_ERROR, message: env.t('err_cant_ignore_yourself') };
    }
  });


  // Stop people from ignoring moderators (because it has no effect anyway)
  //
  N.wire.on(apiPath, async function prevent_ignoring_moderators(env) {
    let cannot_be_ignored = await N.settings.get('cannot_be_ignored', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});

    if (cannot_be_ignored) {
      throw { code: N.io.CLIENT_ERROR, message: env.t('err_cant_ignore_moderators') };
    }
  });


  // Update ignore list
  //
  N.wire.on(apiPath, async function update_ignore_list(env) {
    let ignore = new N.models.users.Ignore();

    ignore.from = env.user_info.user_id;
    ignore.to   = env.data.user._id;

    if (env.params.reason.trim().length > 0) {
      ignore.reason = env.params.reason;
    }

    if (env.params.period > 0) {
      ignore.expire = new Date(Date.now() + env.params.period * 24 * 60 * 60 * 1000);
    }

    await N.models.users.Ignore.deleteOne({
      from: env.user_info.user_id,
      to:   env.data.user._id
    });

    await ignore.save();
  });
};
