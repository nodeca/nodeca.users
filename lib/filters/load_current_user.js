"use strict";

/*global nodeca, _*/


// fetch current user info
// fired before each controllers
nodeca.filters.before('', {weight: -50}, function fetch_me(params, next) {
  var env = this;
  var UserModel;

  // Guest Null object
  var guest = {
    '_uname': '',
    'locale': nodeca.config.locales['default']
  };
  
  if (!env.session.user_id) {
    env.data.me = guest;
    next();
    return;
  }

  UserModel = nodeca.models.users.User;
    
  UserModel
      .findOne({ '_id': env.session.user_id })
      .select(_.keys(guest).join(' '))
      .setOptions({ lean: true }).exec(function(err, user){
    if (err) {
      next(err);
      return;
    }
    // user in session, but db does not know this user
    if (!user) {
      env.data.me = guest;
    }
    else {
      env.data.me = user;
    }
    next();
  });
});


var me_out_fields = [
  '_uname'
];

// put current user info to response data
nodeca.filters.after('', {weight: 50}, function inject_current_user_info(params, next) {
  if (!!this.session.user_id && !!this.data['me']) {
    this.response.data.me = _.pick(this.data.me, me_out_fields);
  }
  next();
});
