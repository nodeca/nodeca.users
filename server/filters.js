"use strict";

/*global nodeca*/

var User = nodeca.models.users.User;


// fetch and prepare users info
// fired befor each controllers
// list of user id should be prepared in controller
nodeca.filters.after('', function (params, next) {
  if (this.data.users && this.data.users.length > 0) {
    var user_id_list = _.compact(_.uniq(this.data.users));

    var users = this.response.data.users = {};

    User.fitchByIdList(user_id_list, function(err, user_list){
      user_list.forEach(function(user){
        users[user._id] = {
          id          : user.id,
          login       : user.login,
        };
      });
      next(err);
    });
  }
  else {
    next();
  }
});
