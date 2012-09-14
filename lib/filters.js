"use strict";

/*global nodeca, _*/


var users_in_fields = [
  '_id',
  'id',
  '_uname',
  '_uname_short'
];


// fetch and prepare users info
// fired after each controllers
// list of user id should be prepared in controller
nodeca.filters.after('', {weight: 50}, function inject_users(params, next) {
  var env = this,
      user_id_list, result, UserModel;

  if (_.isArray(this.data.users) && this.data.users.length > 0) {

    // There can be some garbage:
    // - empty ids (just because we push data without checks)
    // - duplicated ids(the same users from different objects)
    //
    // We remove dummy elements, let mongo filter unique values,
    // because it's more fast.
    user_id_list = _.compact(this.data.users);

    env.extras.puncher.start('Users join', { count: user_id_list.length });

    result = this.response.data.users = {};

// uncomment to imitate empty users (to check template & speed)
//    env.extras.puncher.stop();
//    return next();

    UserModel = nodeca.models.users.User;
    
    UserModel
        .where('_id').in(user_id_list)
        .select(users_in_fields.join(' '))
        .setOptions({ lean: true }).exec(function(err, user_list){

      user_list.forEach(function(user){
        // only registered users can see full name
        if (env.session.guest) {
          user._uname = user._uname_short;
        }
        result[user._id] = user;
      });

      env.extras.puncher.stop();
      
      next();
    });
  }
  else {
    next();
  }
});

// get from session user name and put in response data
//
nodeca.filters.after('', { weight: 100 }, function profile_info(params, callback) {
  this.response.data.profile = null;
  if (!!this.session.profile) {
    this.response.data.profile = this.session.profile['_uname'];
  }
  callback();
});
