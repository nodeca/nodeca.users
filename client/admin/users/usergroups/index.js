'use strict';


N.wire.before('admin.users.usergroups.destroy', function confirm_delete_usergroup(event, callback) {
  N.wire.emit(
    'admin.core.blocks.confirm',
    t('delete_confirm', { group_name: $(event.target).data('usergroupName') }),
    callback
  );
});


N.wire.on('admin.users.usergroups.destroy', function delete_usergroup(event) {
  var $element = $(event.target)
    , _id      = $element.data('usergroupId');

  N.io.rpc('admin.users.usergroups.destroy', { _id: _id }, function (err) {
    if (err) {
      return false;
    }

    $element.parents('tr').remove();
  });
});
