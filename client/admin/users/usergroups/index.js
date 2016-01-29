'use strict';


N.wire.before('admin.users.usergroups.destroy', function confirm_delete_usergroup(data, callback) {
  N.wire.emit(
    'admin.core.blocks.confirm',
    t('delete_confirm', { group_name: data.$this.data('usergroupName') }),
    callback
  );
});


N.wire.on('admin.users.usergroups.destroy', function delete_usergroup(data) {
  N.io.rpc('admin.users.usergroups.destroy', { _id: data.$this.data('usergroupId') }).then(function () {
    data.$this.parents('tr').remove();
  });
});
