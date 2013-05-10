'use strict';


N.wire.on('admin.users.usergroups.remove', function (event) {
  var $element = $(event.currentTarget)
    , _id      = $element.data('usergroupId');

  N.io.rpc('admin.users.usergroups.remove', { _id: _id }, function (err) {
    if (err) {
      N.wire.emit('notify', { type: 'error', message: t('error_remove') });
      return;
    }

    $element.parents('tr').remove();
  });
});
