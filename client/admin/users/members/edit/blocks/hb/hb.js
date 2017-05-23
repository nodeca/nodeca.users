
'use strict';

// Make sure that hb field is always present in this form,
// true => 'on', false => ''
//
// It's not there by default unless checked, and server won't change
// any fields that aren't present in input.
//
N.wire.before('admin.users.members.edit:submit', function get_hb(data) {
  data.fields.hb = data.fields.hb || '';
});
