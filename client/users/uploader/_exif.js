// EXIF reader

'use strict';

// Get string from dataView
//
function getStringFromDataView(dataView, start, length) {
  var outstr = '';

  for (var i = start; i < start + length; i++) {
    outstr += String.fromCharCode(dataView.getUint8(i));
  }

  return outstr;
}


// Read EXIF tag
//
function readTagValue(dataView, entryOffset, tiffStart, bigEnd) {
  var type = dataView.getUint16(entryOffset + 2, !bigEnd),
    numValues = dataView.getUint32(entryOffset + 4, !bigEnd),
    valueOffset = dataView.getUint32(entryOffset + 8, !bigEnd) + tiffStart,
    offset,
    vals, val, n,
    numerator, denominator;

  switch (type) {
    case 1: // byte, 8-bit unsigned int
    case 7: // undefined, 8-bit byte, value depending on field
      if (numValues === 1) {
        return dataView.getUint8(entryOffset + 8, !bigEnd);
      }

      offset = numValues > 4 ? valueOffset : (entryOffset + 8);
      vals = [];
      for (n = 0; n < numValues; n++) {
        vals[n] = dataView.getUint8(offset + n);
      }
      return vals;

    case 2: // ascii, 8-bit byte
      offset = numValues > 4 ? valueOffset : (entryOffset + 8);
      return getStringFromDataView(dataView, offset, numValues - 1);

    case 3: // short, 16 bit int
      if (numValues === 1) {
        return dataView.getUint16(entryOffset + 8, !bigEnd);
      }

      offset = numValues > 2 ? valueOffset : (entryOffset + 8);
      vals = [];
      for (n = 0; n < numValues; n++) {
        vals[n] = dataView.getUint16(offset + 2 * n, !bigEnd);
      }
      return vals;

    case 4: // long, 32 bit int
      if (numValues === 1) {
        return dataView.getUint32(entryOffset + 8, !bigEnd);
      }

      vals = [];
      for (n = 0; n < numValues; n++) {
        vals[n] = dataView.getUint32(valueOffset + 4 * n, !bigEnd);
      }
      return vals;

    case 5:    // rational = two long values, first is numerator, second is denominator
      if (numValues === 1) {
        numerator = dataView.getUint32(valueOffset, !bigEnd);
        denominator = dataView.getUint32(valueOffset + 4, !bigEnd);
        val = Number(numerator / denominator);
        val.numerator = numerator;
        val.denominator = denominator;
        return val;
      }

      vals = [];
      for (n = 0; n < numValues; n++) {
        numerator = dataView.getUint32(valueOffset + 8 * n, !bigEnd);
        denominator = dataView.getUint32(valueOffset + 4 + 8 * n, !bigEnd);
        vals[n] = Number(numerator / denominator);
        vals[n].numerator = numerator;
        vals[n].denominator = denominator;
      }
      return vals;

    case 9: // slong, 32 bit signed int
      if (numValues === 1) {
        return dataView.getInt32(entryOffset + 8, !bigEnd);
      }

      vals = [];
      for (n = 0; n < numValues; n++) {
        vals[n] = dataView.getInt32(valueOffset + 4 * n, !bigEnd);
      }
      return vals;

    case 10: // signed rational, two slongs, first is numerator, second is denominator
      if (numValues === 1) {
        return dataView.getInt32(valueOffset, !bigEnd) / dataView.getInt32(valueOffset + 4, !bigEnd);
      }

      vals = [];
      for (n = 0; n < numValues; n++) {
        vals[n] = dataView.getInt32(valueOffset + 8 * n, !bigEnd) / dataView.getInt32(valueOffset + 4 + 8 * n, !bigEnd);
      }
      return vals;

    default:
  }
}


// Read exif from file
//
module.exports = function readExif(file, callback) {
  var fileReader = new FileReader();

  fileReader.onload = function(e) {

    var data = e.target.result;
    var dataView = new DataView(data);

    if ((dataView.getUint8(0) !== 0xFF) || (dataView.getUint8(1) !== 0xD8)) {
      // console.log('Not a valid JPEG');
      callback();
      return;
    }

    var offset = 2, length = data.byteLength, marker;

    while (offset < length) {

      if (dataView.getUint8(offset) !== 0xFF) {
        // console.log('Not a valid marker');
        callback();
        return;
      }

      marker = dataView.getUint8(offset + 1);

      if (marker !== 0xE1) {
        offset += 2 + dataView.getUint16(offset + 2);
        continue;
      }

      if (getStringFromDataView(dataView, offset + 4, 4) !== 'Exif') {
        callback();
        return;
      }

      var tiffOffset = offset + 10;
      var bigEnd;
      if (dataView.getUint16(tiffOffset) === 0x4949 && dataView.getUint16(tiffOffset + 2) === 0x2A00) {
        // little-endian
        bigEnd = false;
        //console.log('le');
      } else if (dataView.getUint16(tiffOffset) === 0x4D4D && dataView.getUint16(tiffOffset + 2) === 0x002A) {
        // big-endian
        bigEnd = true;
      } else {
        callback();
        return;
      }

      var firstIFDOffset = dataView.getUint32(tiffOffset + 4, !bigEnd);
      if (firstIFDOffset < 0x00000008) {
        // Not valid TIFF data! (First offset less than 8)
        callback();
        return;
      }

      var entries = dataView.getUint16(tiffOffset + firstIFDOffset, !bigEnd);
      var entryOffset;

      var tags;

      for (var i = 0; i < entries; i++) {
        entryOffset = (tiffOffset + firstIFDOffset) + i * 12 + 2;
        // http://ru.wikipedia.org/wiki/TIFF

        // Orientation
        if (0x0112 === dataView.getUint16(entryOffset, !bigEnd)) {
          var orientation = readTagValue(dataView, entryOffset, tiffOffset, bigEnd);
          // http://www.daveperrett.com/articles/2012/07/28/exif-orientation-handling-is-a-ghetto/
          tags = { orientation: orientation };
        }
      }

      callback(tags);
      return;


    }
  };

  fileReader.readAsArrayBuffer(file);
};
