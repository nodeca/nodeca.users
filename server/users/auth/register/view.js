"use strict";

/*global nodeca, _*/


// fields can be fetched from session, if oauth provider give them
var profile_in_fields = [
  'email',
  'first_name',
  'last_name',
  'nick'
];

var params_schema = [
];
nodeca.validate(params_schema);


/**
 * users.auth.register.view(params, callback) -> Void
 *
 * Render registration form
 **/
module.exports = function (params, next) {
  var env = this;
  var data = env.response.data;
  
  data.head.title = env.helpers.t('users.auth.reg_form.title');

  data.predefined = {};
  if (this.session.auth_data) {
    // set predefined data from session
    data.predefined = _.pick(this.session.auth_data, profile_in_fields);
  }

  next();
};
