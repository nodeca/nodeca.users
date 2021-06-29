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
  let types = '$$ JSON.stringify(N.config.users.infractions?.types || {}) $$';

  types = _.mapValues(types, (type, name) => _.defaults(type, { category_key: '', name, priority: 10 }));

  categories = _(types)
    .map('category_key')
    .uniq()
    .map(category_key => {
      let cat = {
        name: category_key,
        types: _(_.values(types)).filter({ category_key }).sortBy('priority').value()
      };

      cat.priority = cat.types.map(x => x.priority).reduce((a, b) => a + b);

      return cat;
    })
    .sortBy('priority')
    .value();


  // Submit button handler
  //
  N.wire.on(module.apiPath + ':submit', function submit_add_infraction_dlg(data) {
    let valid = true;
    let $type = $('.add-infraction-type__input');
    let $reason = $('.add-infraction-reason__input');
    let $expire = $('.add-infraction-expire__input');
    let $points = $('.add-infraction-points__input');

    if (!data.fields.type) {
      $type.addClass('is-invalid');
      valid = false;
    } else {
      $type.removeClass('is-invalid');
    }

    if (!data.fields.reason && data.fields.type === 'custom') {
      $reason.addClass('is-invalid');
      valid = false;
    } else {
      $reason.removeClass('is-invalid');
    }

    if (data.fields.expire === '') {
      $expire.addClass('is-invalid');
      valid = false;
    } else {
      $expire.removeClass('is-invalid');
    }

    if (data.fields.points === '') {
      $points.addClass('is-invalid');
      valid = false;
    } else {
      $points.removeClass('is-invalid');
    }

    if (!valid) return;

    params.type = data.fields.type;
    params.points = +data.fields.points;
    params.reason = data.fields.reason;

    if (data.fields.expire) {
      params.expire = +data.fields.expire;
    } else {
      params.expire = -1;
    }

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
    $('.add-infraction-expire__input')
      .prop('disabled', types[type_name].expire_days === -1)
      .val(types[type_name].expire_days);

    $('.add-infraction-expire__checkbox').prop('checked', types[type_name].expire_days === -1);
  });


  // Set expire never
  //
  N.wire.on(module.apiPath + ':set_expire_never', function set_expire_never(data) {
    if (data.$this.is(':checked')) {
      $('.add-infraction-expire__input')
        .prop('disabled', true)
        .val(-1);
    } else {
      $('.add-infraction-expire__input')
        .prop('disabled', false)
        .val(30);
    }
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
  $dialog = $(N.runtime.render(module.apiPath, Object.assign({ apiPath: module.apiPath, categories }, params)));

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
