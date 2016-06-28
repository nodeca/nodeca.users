// Popup dialog to add infraction
//
// Out:
//
// - type (String) - overquoting, offtopic, etc., `` (empty string) if custom infraction
// - expire (Number) - expire days
// - points (Number) - points count for infraction
// - reason (String) - reason text
//
'use strict';


const _ = require('lodash');


let categories;
let $dialog;
let params;
let result;


N.wire.once(module.apiPath, function init_handlers() {

  // Prepare types by categories
  //
  let types = '$$ JSON.stringify((N.config.users.infractions || {}).types || {}) $$';

  types = _.mapValues(types, (type, name) => _.defaults(type, { category_key: '', name, priority: 10 }));

  categories = _(types)
    .map('category_key')
    .uniq()
    .map(category_key => {
      let cat = {
        name: category_key,
        types: _(_.values(types)).filter({ category_key }).sortBy('priority').value()
      };

      cat.priority = _.map(cat.types, 'priority').reduce((a, b) => a + b);

      return cat;
    })
    .sortBy('priority')
    .value();


  // Submit button handler
  //
  N.wire.on(module.apiPath + ':submit', function submit_add_infraction_dlg(data) {
    let valid = true;
    let $type_group = $('.add-infraction-type');
    let $reason_group = $('.add-infraction-reason');
    let $expire_group = $('.add-infraction-expire');
    let $points_group = $('.add-infraction-points');

    if (!data.fields.type) {
      $type_group.addClass('has-danger');
      valid = false;
    } else {
      $type_group.removeClass('has-danger');
    }

    if (!data.fields.reason && data.fields.type === 'custom') {
      $reason_group.addClass('has-danger');
      valid = false;
    } else {
      $reason_group.removeClass('has-danger');
    }

    if (data.fields.expire === '') {
      $expire_group.addClass('has-danger');
      valid = false;
    } else {
      $expire_group.removeClass('has-danger');
    }

    if (data.fields.points === '') {
      $points_group.addClass('has-danger');
      valid = false;
    } else {
      $points_group.removeClass('has-danger');
    }

    if (!valid) return;

    params.type = data.fields.type;
    params.expire = +data.fields.expire;
    params.points = +data.fields.points;
    params.reason = data.fields.reason;

    result = params;
    $dialog.modal('hide');
  });


  // Select infraction type
  //
  N.wire.on(module.apiPath + ':select_type', function select_infraction_type(data) {
    let type_name = data.$this.val();
    let $reason = $('.add-infraction-reason__input');

    if (!type_name || type_name === 'custom') {
      $reason
        .prop('disabled', false)
        .val('');
      return;
    }

    $reason
      .prop('disabled', true)
      .val(t('@users.infractions.types.' + type_name));
    $('.add-infraction-points__input').val(types[type_name].points);
    $('.add-infraction-expire__input').val(types[type_name].expire_days);
    $('.add-infraction-points__checkbox').prop('checked', types[type_name].points === 0);
    $('.add-infraction-expire__checkbox').prop('checked', types[type_name].expire_days === -1);
  });


  // Set points none
  //
  N.wire.on(module.apiPath + ':set_points_none', function set_points_none(data) {
    if (data.$this.is(':checked')) {
      $('.add-infraction-points__input').val(0);
    }
  });


  // Set expire never
  //
  N.wire.on(module.apiPath + ':set_expire_never', function set_expire_never(data) {
    if (data.$this.is(':checked')) {
      $('.add-infraction-expire__input').val(-1);
    }
  });


  // Uncheck points checkbox
  //
  N.wire.on(module.apiPath + ':change_points', function change_points(data) {
    $('.add-infraction-points__checkbox').prop('checked', +data.$this.val() === 0);
  });


  // Uncheck expire checkbox
  //
  N.wire.on(module.apiPath + ':change_expire', function change_expire(data) {
    $('.add-infraction-expire__checkbox').prop('checked', +data.$this.val() === -1);
  });


  // Close dialog on sudden page exit (if user click back button in browser)
  //
  N.wire.on('navigate.exit', function teardown_page() {
    if ($dialog) {
      $dialog.modal('hide');
    }
  });
});


// Init dialog
//
N.wire.on(module.apiPath, function show_add_infraction_dlg(options) {
  params = options;
  $dialog = $(N.runtime.render(module.apiPath, _.assign({ apiPath: module.apiPath, categories }, params)));

  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('shown.bs.modal', () => {
        $dialog.find('.btn-secondary').focus();
      })
      .on('hidden.bs.modal', () => {
        // When dialog closes - remove it from body and free resources
        $dialog.remove();
        $dialog = null;
        params = null;

        if (result) resolve();
        else reject('CANCELED');

        result = null;
      })
      .modal('show');
  });
});
