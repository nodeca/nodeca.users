'use strict';


var _           = require('lodash');
var ko          = require('knockout');
var getFormData = require('nodeca.core/lib/client/get_form_data');


var CHECK_NICK_DELAY = 1000;


// Setup nick availability checks.
//
N.wire.on('navigate.done:' + module.apiPath, function bind_nick_check() {
  var $input   = $('#register_nick')
    , $control = $input.parents('.control-group:first')
    , $help    = $control.find('.help-block:first')
    , nick     = ko.observable('');

  nick.subscribe(function () {
    $control.removeClass('success').removeClass('error');
  });

  nick.subscribe(_.debounce(function (text) {
    if (text.length < 1) {
      return;
    }

    N.io.rpc('users.auth.check_nick', { nick: text }, function (err, response) {
      if (err) {
        return false;
      }

      $control
        .toggleClass('success', !response.data.error)
        .toggleClass('error', response.data.error);

      $help.text(response.data.message || t('nick_help'));
    });
  }, CHECK_NICK_DELAY));

  ko.applyBindings({ nick: nick }, $input.get(0));
});


// Send registration data to the server.
//
N.wire.on('users.auth.register', function register(event) {
  var $form = $(event.currentTarget);

  N.io.rpc('users.auth.register', getFormData($form), function (err, response) {
    if (err && N.io.CLIENT_ERROR === err.code) {
      // Update status/messages on all input fields.
      _.forEach($form.find('input'), function (input) {
        var $input   = $(input)
          , name     = $input.attr('name')
          , $control = $input.parents('.control-group:first')
          , $help    = $control.find('.help-block:first');

        $control.toggleClass('error', _.has(err.data, name));
        $help.text(err.data[name] || t(name + '_help'));
      });
      return;
    }

    if (err) {
      return false;
    }

    // Reload page in order to apply auto-login after the registration.
    window.location = response.data.redirect_url;
  });
});
