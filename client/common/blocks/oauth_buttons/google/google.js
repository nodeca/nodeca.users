// Setup google login button listener

'use strict';


var _ = require('lodash');


var pageParams;


var init = _.once(function () {

  // Set redirect action and redirect to provider
  //
  N.wire.on('common.blocks.oauth_buttons.google', function set_action(data) {
    var url = data.$this.data('url');
    var action = N.runtime.page_data.action;
    var path = 'users.auth.oauth.remember_action';

    var params = { action };
    if (pageParams && pageParams.redirect_id) {
      params.redirect_id = pageParams.redirect_id;
    }

    N.io.rpc(path, params).done(function save_action() {

      // Redirect to oauth provider
      window.location = url;
    });

  });
});


// Init page
//
N.wire.on(
  [
    'navigate.done:users.auth.login.show',
    'navigate.done:users.auth.login.show'
  ],
  function page_setup(data) {
    pageParams = data.params;
    init(data);
  }
);
