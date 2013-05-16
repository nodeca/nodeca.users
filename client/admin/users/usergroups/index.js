'use strict';


N.wire.on('admin.users.usergroups.destroy', function (event) {
  var $element = $(event.currentTarget)
    , _id      = $element.data('usergroupId');

  if (window.confirm(t('delete_confirm', { group_name: $element.data('usergroupName') }))) {
    N.io.rpc('admin.users.usergroups.destroy', { _id: _id }, function (err) {
      if (err) {
        return false;
      }

      $element.parents('tr').remove();
    });
  }
});
