

'use strict';

let picker;

N.wire.on('navigate.preload:users.settings.about', function load_deps(preload) {
  preload.push('vendor.pikaday');
});


N.wire.on('navigate.done:users.settings.about', function initialize_datepicker() {
  const Pikaday = require('pikaday');

  let container = $('.user-settings-about-birthday');

  if (!container.length) return;

  let cldr          = N.runtime.t('l10n.cldr').dates.calendars.gregorian;
  let months        = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ].map(key =>
                        cldr.months['stand-alone'].wide[key]);
  let weekdays      = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ].map(key =>
                        cldr.days['stand-alone'].wide[key]);
  let weekdaysShort = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ].map(key =>
                        cldr.days['stand-alone'].abbreviated[key]);

  picker = new Pikaday({
    field:     container[0],
    yearRange: [ 1900, new Date().getFullYear() ],
    i18n:      { months, weekdays, weekdaysShort },
    onSelect:  date => {
      // pikaday returns date in local TZ, but toISOString returns date in UTC,
      // so we need to cancel out timezone offset
      date = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
      container.find('input').val(date.toISOString().slice(0, 10));
      container.find('input').trigger('change');
    }
  });
});


N.wire.on('navigate.exit:users.settings.about', function teardown_datepicker() {
  if (picker) {
    picker.destroy();
    picker = null;
  }
});
