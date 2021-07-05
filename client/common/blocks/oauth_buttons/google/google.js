// Setup google login button listener

'use strict';


let pageParams;


N.wire.once('navigate.done:users.auth.login.show', function page_once() {

  // Set redirect action and redirect to provider
  //
  N.wire.on('common.blocks.oauth_buttons.google', function set_action(data) {
    let url = data.$this.data('url');
    let action = N.runtime.page_data.action;
    let path = 'users.auth.oauth.remember_action';

    let params = { action };
    if (pageParams?.redirect_id) {
      params.redirect_id = pageParams.redirect_id;
    }

    N.io.rpc(path, params).then(function save_action() {

      // Redirect to oauth provider
      window.location = url;
    });

  });
});


// Init page
//
N.wire.on('navigate.done:users.auth.login.show', function page_setup(data) {
  pageParams = data.params;
});
