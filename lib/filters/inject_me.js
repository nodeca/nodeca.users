"use strict";

/*global nodeca, _*/


// put current user name to response
nodeca.filters.after('', {weight: 50}, function inject_me(params, next) {
  if (!!this.session.user_id && !!this.data['me']) {
    this.response.data.me = this.data.me._uname;
  }
  next();
});
