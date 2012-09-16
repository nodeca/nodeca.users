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


/*global $, _, nodeca, window*/

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
  loadAssets('users', function () {
    var params = nodeca.client.common.form.getData($form);
    // FIXME validate data and strengthen password
    nodeca.server.users.auth.register.exec(params, function(err, request){
      if (err) {
        if (err.statusCode === 401) {
          //FIXME duplicate email err
        }
        else {
          //FIXME parse error message and set errors by field
        }
        return;
      }
      loadAssets('users', function () {
        $form.replaceWith(
          nodeca.client.common.render('users.auth.register.success')
        ).fadeIn();
      });
    });
  });
  return false;
};
