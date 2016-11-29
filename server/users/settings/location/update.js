// Save user location
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    latitude:  { type: 'number', minimum: -90,  maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 }
  });


  // Check permissions
  //
  N.wire.before(apiPath, function* check_permissions(env) {
    if (env.user_info.is_guest) {
      throw N.io.FORBIDDEN;
    }

    let can_edit_profile = yield env.extras.settings.fetch('can_edit_profile');

    if (!can_edit_profile) {
      throw N.io.FORBIDDEN;
    }
  });


  // Fetch current user
  //
  N.wire.before(apiPath, function* fetch_user(env) {
    env.data.user = yield N.models.users.User.findById(env.user_info.user_id);

    if (!env.data.user) throw N.io.NOT_FOUND;
  });


  // Save location
  //
  N.wire.on(apiPath, function* save_location(env) {
    env.data.user.location = [ env.params.longitude, env.params.latitude ];

    yield env.data.user.save();

    // trigger location name resolution with priority,
    // so user will see their own location name on other pages quicker
    N.models.users.User.resolveLocation(env.data.user._id, env.user_info.locale);
  });
};
