"use strict";

/*global nodeca, _*/



// fetch and prepare users info
// fired after each controllers
// list of user id should be prepared in controller
nodeca.filters.after('', function inject_users(params, next) {
  if (this.data.users && this.data.users.length > 0) {
    var user_id_list = _.compact(_.uniq(this.data.users));

    var users = this.response.data.users = {};

    var User = nodeca.models.users.User;
    User.fitchByIdList(user_id_list, function(err, user_list){
      user_list.forEach(function(user){
        users[user._id] = {
          id          : user.id,
          nickname    : user.nickname,
        };
      });
      next(err);
    });
  }
  else {
    next();
  }
});
