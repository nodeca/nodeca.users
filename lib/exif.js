// Extract TIFF headers and orientation from raw data
//
// - rawHeader (Uint8Array) - head of JPEG file (max 256k), that can contain metadata
//
// return { header: Uint8Array, orientation: Number } or null on error
//

'use strict';


var data;


function getBytes(offset, length, littleEndian) {
  if (typeof littleEndian === 'undefined') {
    littleEndian = false;
  }

  var result = 0;
  var i;

  /* eslint no-bitwise: 0 */

  if (littleEndian) {
    for (i = offset + length - 1; i >= offset; i--) {
      result = result << 8 | data[i];
    }
  } else {
    for (i = offset; i < offset + length; i++) {
      result = result << 8 | data[i];
    }
  }

  return result;
}


function getUint16(offset, littleEndian) {
  return getBytes(offset, 2, littleEndian);
}


function getUint32(offset, littleEndian) {
  return getBytes(offset, 4, littleEndian);
}


function getExifOrientation(offset, max) {
  var dirStart, tagsCount, littleEndian, tagOffset, tagCode;
  var tiffStart = offset + 10;

  // Check for the ASCII code for "Exif" (0x45786966)
  if (getUint32(offset + 4) === 0x45786966) {

    if (tiffStart + 8 > max) {
      // Invalid segment size
      return null;
    }

    if (getUint16(offset + 8) !== 0) {
      // Missing byte alignment offset
      return null;
    }

    switch (getUint16(tiffStart)) {
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
    if (getUint16(tiffStart + 2, littleEndian) !== 0x002A) {
      // Missing TIFF marker
      return null;
    }

    dirStart = getUint32(tiffStart + 4, littleEndian);
    tagsCount = getUint16(dirStart, littleEndian);

    for (var i = 0; i < tagsCount; i++) {
      tagOffset = dirStart + 2 + 12 * i;
      tagCode = getUint16(tagOffset, littleEndian);

      // Orientation
      if (tagCode === 0x0112) {
        return getUint16(tagOffset + 8, littleEndian);
      }
    }
  }

  // Orientation not found
  return null;
}


function parseMetadata (rawHeader) {
  var offset = 2;
  var segmentLength, segmentMarker, orientation, max;

  data = rawHeader;

  // Max offset is (length - 4) because we try to read first 4 bytes
  // from every segment to extract marker and length.
  max = data.buffer.byteLength - 4;

  // Check for the JPEG signature (0xffd8)
  if (getUint16(0) !== 0xffd8) {
    // Not jpeg
    return null;
  }

  while (offset < max) {
    // APP or COM segment marker
    segmentMarker = getUint16(offset);

    // 0xffe0:0xffef - APP segments, 0xfffe - COM (comment) segment.
    // APP and COM segments always go first.
    if ((segmentMarker >= 0xffe0 && segmentMarker <= 0xffef) || segmentMarker === 0xfffe) {
      segmentLength = getUint16(offset + 2) + 2;
      if (offset + segmentLength > max) {
        // Invalid segment size
        return null;
      }

      // If EXIF segment - try to extract orientation.
      // There can be several EXIF segments, and some can be empty.
      // So, extract orientation only if not filled yet.
      if (segmentMarker === 0xffe1 && !orientation) {
        orientation = getExifOrientation(offset, offset + segmentLength);
      }

      offset += segmentLength;
    } else {
      break;
    }
  }

  if (offset <= 6) {
    // Bad header size
    return null;
  }

  return { orientation: orientation, header: data.subarray(0, offset) };
}

module.exports = parseMetadata;
