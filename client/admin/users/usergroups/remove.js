'use strict';


N.wire.on(module.apiPath, function usergroup_remove(event) {
  var $elem  = $(event.currentTarget)
    , params = { _id: $elem.attr('data-usergroup-id') };

  N.io.rpc('admin.users.usergroups.remove', params, function (err) {
    if (err) {
      if (N.io.BAD_REQUEST === err.code) {
        // something non fatal error
        N.wire.emit('notify', err.data.common);
      } else {
        // no need for fatal errors notifications as it's done by io automagically
        N.logger.error(err);
      }
      return;
    }

    window.location = N.runtime.router.linkTo('admin.users.usergroups.index');
  });
});
