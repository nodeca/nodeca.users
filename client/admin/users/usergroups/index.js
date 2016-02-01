'use strict';


N.wire.before('admin.users.usergroups.destroy', function confirm_delete_usergroup(data) {
  let message = t('delete_confirm', { group_name: data.$this.data('usergroupName') });

  return N.wire.emit('admin.core.blocks.confirm', message);
});


N.wire.on('admin.users.usergroups.destroy', function delete_usergroup(data) {
  return N.io.rpc('admin.users.usergroups.destroy', { _id: data.$this.data('usergroupId') }).then(() => {
    data.$this.parents('tr').remove();
  });
});
