

'use strict';

const Pikaday = require('pikaday');

let picker1, picker2;


N.wire.on('navigate.done:admin.users.members.search', function initialize_datepicker() {
  let cldr          = N.runtime.t('l10n.cldr').dates.calendars.gregorian;
  let months        = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ].map(key =>
                        cldr.months['stand-alone'].wide[key]);
  let weekdays      = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ].map(key =>
                        cldr.days['stand-alone'].wide[key]);
  let weekdaysShort = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ].map(key =>
                        cldr.days['stand-alone'].abbreviated[key]);

  picker1 = new Pikaday({
    field:     $('.members-search__reg-date-from')[0],
    yearRange: [ 2000, new Date().getFullYear() ],
    i18n:      { months, weekdays, weekdaysShort }
  });

  picker2 = new Pikaday({
    field:     $('.members-search__reg-date-to')[0],
    yearRange: [ 2000, new Date().getFullYear() ],
    i18n:      { months, weekdays, weekdaysShort }
  });
});


N.wire.on('navigate.exit:admin.users.members.search', function teardown_datepicker() {
  if (picker1) {
    picker1.destroy();
    picker1 = null;
  }

  if (picker2) {
    picker2.destroy();
    picker2 = null;
  }
});
