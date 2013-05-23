'use strict';


var _           = require('lodash');
var ko          = require('knockout');
var getFormData = require('nodeca.core/lib/client/get_form_data');


var CHECK_NICK_DELAY = 500;


// Setup nick availability checks.
//
N.wire.on('navigate.done:' + module.apiPath, function bind_nick_check() {
  var $input   = $('#register_nick')
    , $control = $input.parents('.control-group')
    , $help    = $control.find('.help-block')
    , nick     = ko.observable('');

  nick.subscribe(function () {
    $control.removeClass('success').removeClass('error');
  });

  ko.computed(function () {
    var text = nick();

    if (text.length < 1) {
      return;
    }

    N.io.rpc('users.auth.check_nick', { nick: text }, function (err, response) {
      if (err) {
        return false;
      }

      if (response.data.nick_is_free) {
        $control.removeClass('error').addClass('success');
        $help.text(t('free_nick'));
      } else {
        $control.removeClass('success').addClass('error');
        $help.text(t('busy_nick'));
      }
    });
  }).extend({ throttle: CHECK_NICK_DELAY });

  ko.applyBindings({ nick: nick }, $input.get(0));
});


// Send registration data to the server.
//
N.wire.on('users.auth.register', function register(event) {
  var $form = $(event.currentTarget);

  $('.control-group').removeClass('error');

  N.io.rpc('users.auth.register', getFormData($form), function (err, response) {
    if (err && N.io.CLIENT_ERROR === err.code) {
      _.forEach(err.data, function (message, name) {
        var $input = $form.find('input[name="' + name + '"]');

        $input.parents('.control-group').addClass('error');

        if (message) {
          $input.siblings('.help-block').text(N.runtime.t(message));
        }
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
