
'use strict';

let map;


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.leaflet');
});


N.wire.on('navigate.done:' + module.apiPath, function initialize_map() {
  const leaflet = require('leaflet').noConflict();

  map = leaflet.map($('.user-settings-location__map')[0]).setView([ 20, 0 ], 2);

  leaflet.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  }).addTo(map);
});


N.wire.on('navigate.exit:users.settings.location', function teardown_map() {
  if (map) {
    map.remove();
    map = null;
  }
});
