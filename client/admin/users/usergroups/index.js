'use strict';


N.wire.on('admin.users.usergroups.destroy', function (event) {
  var $element = $(event.currentTarget)
    , _id      = $element.data('usergroupId');

  if (window.confirm(t('destroy_confirm', { group_name: $element.data('usergroupName') }))) {
    N.io.rpc('admin.users.usergroups.destroy', { _id: _id }, function (err) {
      if (err) {
        N.wire.emit('notify', { type: 'error', message: t('error_destroy') });
        return;
      }

      $element.parents('tr').remove();
    });
  }
});
