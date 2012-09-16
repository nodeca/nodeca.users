'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.auth
 **/


/*global $, _, nodeca*/


/**
 *  client.common.auth.login($form, event)
 *
 *  send login request
 **/
module.exports.login = function ($form, event) {
  loadAssets('users', function () {
    var params = nodeca.client.common.form.getData($form);
    // FIXME validate data and strengthen password
    nodeca.server.users.auth.login.plain.exec(params, function (err) {
      console.dir(err);
      if (err) {
        $form.find('.text-error').removeClass('hidden').fadeIn();
        return;
      }
      window.location.reload();
    });
  });
  return false;
};

/**
 *  client.common.auth.register($form, event)
 *
 *  send registration data on server
 **/
module.exports.register = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);
  // FIXME validate data and strengthen password
  nodeca.client.common.history.navigateTo('users.auth.register.exec', params);
  return false;
};
