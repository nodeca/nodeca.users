/*eslint-disable no-bitwise*/

// EXIF reader
//
// - file
// - callback({ header: Uint8Array, orientation: Number }), null on error
//

'use strict';


function getBytes(data, offset, length, littleEndian) {
  if (littleEndian === undefined) {
    littleEndian = false;
  }

  var result = 0;
  var i;

  if (littleEndian) {
    for (i = offset + length; i >= offset; i--) {
      result = result << 8 | data[i];
    }
  } else {
    for (i = offset; i < offset + length; i++) {
      result = result << 8 | data[i];
    }
  }

  return result;
}


function getExifOrientation(data, offset, length) {
  var tiffOffset = offset + 10;
  var littleEndian;
  var dirOffset;
  var tagsNumber;

  // Check for the ASCII code for "Exif" (0x45786966)
  if (getBytes(data, offset + 4, 4) === 0x45786966) {

    if (tiffOffset + 8 > length) {
      // Invalid segment size
      return null;
    }

    if (data[offset + 8] !== 0x00 || data[offset + 9] !== 0x00) {
      // Missing byte alignment offset
      return null;
    }

    switch (getBytes(data, tiffOffset, 2)) {
      case 0x4949:
        littleEndian = true;
        break;
      case 0x4D4D:
        littleEndian = false;
        break;
      default:
        // Invalid byte alignment marker
        return null;
    }

    // Check for the TIFF tag marker (0x002A)
    if (getBytes(data, tiffOffset + 2, 2, littleEndian) !== 0x002A) {
      //Missing TIFF marker
      return null;
    }

    dirOffset = getBytes(data, tiffOffset + 4, 4, littleEndian);

    tagsNumber = getBytes(data, dirOffset, 2, littleEndian);

    for (var i = 0; i < tagsNumber; i++) {
      var tagOffset = dirOffset + 2 + 12 * i;
      var tag = getBytes(data, tagOffset, 2, littleEndian);

      // Orientation
      if (tag === 0x0112) {
        return getBytes(data, tagOffset + 8, 2, littleEndian);
      }
    }
  }

  // Orientation not found
  return null;
}


function parseMetaData (file, callback) {
  var fileReader = new FileReader();
  var maxMetaDataSize = 262144; // 256 KiB

  fileReader.onload = function(e) {
    var data = new Uint8Array(e.target.result);
    var offset = 2;
    var maxOffset = data.buffer.byteLength - 4;
    var markerLength, markerBytes;
    maxOffset = maxOffset > maxMetaDataSize ? maxMetaDataSize : maxOffset;
    var orientation;

    // Check for the JPEG marker (0xffd8)
    if (getBytes(data, 0, 2) !== 0xffd8) {
      // Not jpeg
      callback(null);
      return;
    }

    while (offset < maxOffset) {
      markerBytes = getBytes(data, offset, 2);

      if ((markerBytes >= 0xffe0 && markerBytes <= 0xffef) || markerBytes === 0xfffe) {
        markerLength = getBytes(data, offset + 2, 2) + 2;
        if (offset + markerLength > maxOffset) {
          // Invalid segment size
          callback(null);
          return;
        }

        // EXIF
        if (markerBytes === 0xffe1 && !orientation) {
          orientation = getExifOrientation(data, offset, markerLength);
        }

        offset += markerLength;
      } else {
        break;
      }
    }

    if (offset <= 6) {
      // Bad header size
      callback(null);
      return;
    }

    callback({ orientation: orientation, header: data.subarray(0, offset) });
  };

  fileReader.readAsArrayBuffer(file);
}

module.exports = parseMetaData;
