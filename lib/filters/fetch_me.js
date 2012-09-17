"use strict";

/*global nodeca, _*/


// fetch and prepare users info
// fired after each controllers
// list of user id should be prepared in controller
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
    // something realy bad, user in session, but db does not know this user
    if (!user) {
      next({statusCode: 500, message: 'user id not found'});
      return;
    }
    env.data.me = user;
    next();
  });
});



