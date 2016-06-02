'use strict';


// Remove a user from ignore list
//
N.wire.on(module.apiPath + ':remove', function remove_ignore(data) {
  let user = data.$this.data('user-id');

  return N.io.rpc('users.settings.ignore.remove', { user })
             .then(() => N.wire.emit('navigate.reload'));
});
