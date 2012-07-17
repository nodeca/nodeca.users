"use strict";

/*global nodeca, _*/



// fetch and prepare users info
// fired after each controllers
// list of user id should be prepared in controller
nodeca.filters.after('', function inject_users(params, next) {
  if (_.isArray(this.data.users) && this.data.users.length > 0) {
    var user_id_list = _.compact(_.uniq(this.data.users));

    var users = this.response.data.users = {};

    var User = nodeca.models.users.User;

    var fields = {
      _id:1,
      id:1,
      nickname:1
    };

    User.where('_id').in(user_id_list).select(fields)
        .setOptions({ lean: true }).exec(function(err, user_list){
      user_list.forEach(function(user){
        users[user._id] = user;
      });
      next();
    });
  }
  else {
    next();
  }
});
