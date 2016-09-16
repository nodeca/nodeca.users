
'use strict';

require('bootstrap-multiselect');


N.wire.on('navigate.done:admin.users.members.edit', function initialize_multiselect() {
  $('.user-edit-usergroup-select').multiselect({
    nonSelectedText: t('none_selected'),
    nSelectedText:   t('selected'),
    allSelectedText: t('all_selected'),
    buttonClass:     'btn btn-secondary user-edit-usergroup-select__btn',
    buttonWidth:     '100%',
    templates: {
      li: '<li><a tabindex="0" class="dropdown-item"><label></label></a></li>'
    }
  });
});


N.wire.before('admin.users.members.edit:submit', function get_usergroups(data) {
  data.fields.usergroups = data.$this.serializeArray()
                               .filter(obj => obj.name === 'usergroups')
                               .map(obj => obj.value);
});
