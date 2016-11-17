
'use strict';

let map;
let marker;


// Create a marker if it does not exist, set its position
//
function set_marker_position(lat, lng) {
  const leaflet = require('leaflet').noConflict();

  if (!map) return;

  if (marker) {
    marker.setLatLng({ lat, lng });
    return;
  }

  // copied from leaflet.Icon.Default.prototype.options with icon urls replaced
  let icon = leaflet.icon({
    iconUrl:       '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-icon.png")) $$',
    iconRetinaUrl: '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-icon-2x.png")) $$',
    shadowUrl:     '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-shadow.png")) $$',
    iconSize:      [ 25, 41 ],
    iconAnchor:    [ 12, 41 ],
    popupAnchor:   [ 1, -34 ],
    tooltipAnchor: [ 16, -28 ],
    shadowSize:    [ 41, 41 ]
  });

  marker = leaflet.marker([], { icon, draggable: true });

  marker.setLatLng({ lat, lng });
  marker.addTo(map);
  $('.user-settings-location__submit').prop('disabled', false);
}


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.leaflet');
});


N.wire.on('navigate.done:' + module.apiPath, function initialize_map() {
  const leaflet = require('leaflet').noConflict();

  let container = $('.user-settings-location__map');

  map = leaflet.map(container[0]);

  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  }).addTo(map);

  if (N.runtime.page_data.location) {
    set_marker_position(
      N.runtime.page_data.location[0],
      N.runtime.page_data.location[1]
    );

    map.setView(N.runtime.page_data.location, 10);
  } else {
    // adjust position and zoom to fit the entire map in viewport
    map.setView([ 20, 0 ], container.width() > 600 ? 2 : 1);
  }

  map.on('click', e => set_marker_position(e.latlng.lat, e.latlng.lng));
});


// Save marker position on the server when user clicks "save" button
//
N.wire.on(module.apiPath + ':save', function save_marker() {
  if (!marker) return;

  let latlng = marker.getLatLng();

  N.io.rpc('users.settings.location.update', {
    // normalize lng into [ -180, 180 ] range, lat should be correct as is
    latitude:  latlng.lat,
    longitude: latlng.lng > 0 ?
               ((latlng.lng + 180) % 360) - 180 :
               ((latlng.lng - 180) % 360) + 180
  }).then(() =>
    N.wire.emit('notify', {
      type: 'info',
      message: t('saved')
    })
  ).catch(err => N.wire.emit('error', err));
});


N.wire.on('navigate.exit:users.settings.location', function teardown_map() {
  if (marker) {
    marker.remove();
    marker = null;
  }

  if (map) {
    map.remove();
    map = null;
  }
});
