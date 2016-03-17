
'use strict';


function error(message, code) {
  let err = new Error(message);

  err.code = code;

  return err;
}


/* eslint-disable no-bitwise */
function Exif(data) {
  this.data = data;

  let sig = String.fromCharCode.apply(null, data.subarray(0, 4));

  if (sig !== 'II\x2A\0' && sig !== 'MM\0\x2A') {
    throw error('invalid TIFF signature', 'EBADDATA');
  }

  this.big_endian = (sig[0] === 'M');
}


Exif.prototype.readUInt16 = function (buffer, offset) {
  if (offset + 2 > buffer.length) throw error('unexpected EOF', 'EBADDATA');

  return this.big_endian ?
         buffer[offset] * 0x100 + buffer[offset + 1] :
         buffer[offset] + buffer[offset + 1] * 0x100;
};


Exif.prototype.readUInt32 = function (buffer, offset) {
  if (offset + 4 > buffer.length) throw error('unexpected EOF', 'EBADDATA');

  return this.big_endian ?
         buffer[offset] * 0x1000000 + buffer[offset + 1] * 0x10000 + buffer[offset + 2] * 0x100 + buffer[offset + 3] :
         buffer[offset] + buffer[offset + 1] * 0x100 + buffer[offset + 2] * 0x10000 + buffer[offset + 3] * 0x1000000;
};


Exif.prototype.writeUInt16 = function (buffer, data, offset) {
  // this could happen if TIFF is hand-crafted to be smaller than sum of its entries,
  // and we wrongly allocate a smaller buffer than necessary
  if (offset + 2 > buffer.length) throw error('TIFF data is too large', 'EBADDATA');

  if (this.big_endian) {
    buffer[offset]     = (data >>> 8) & 0xFF;
    buffer[offset + 1] = data & 0xFF;
  } else {
    buffer[offset]     = data & 0xFF;
    buffer[offset + 1] = (data >>> 8) & 0xFF;
  }
};


Exif.prototype.writeUInt32 = function (buffer, data, offset) {
  // this could happen if TIFF is hand-crafted to be smaller than sum of its entries,
  // and we wrongly allocate a smaller buffer than necessary
  if (offset + 4 > buffer.length) throw error('TIFF data is too large', 'EBADDATA');

  if (this.big_endian) {
    buffer[offset]     = (data >>> 24) & 0xFF;
    buffer[offset + 1] = (data >>> 16) & 0xFF;
    buffer[offset + 2] = (data >>> 8) & 0xFF;
    buffer[offset + 3] = data & 0xFF;
  } else {
    buffer[offset]     = data & 0xFF;
    buffer[offset + 1] = (data >>> 8) & 0xFF;
    buffer[offset + 2] = (data >>> 16) & 0xFF;
    buffer[offset + 3] = (data >>> 24) & 0xFF;
  }
};


// Filter exif data and write it into a buffer
//
// - options: Object
//   - maxEntrySize: Number
//   - onIFDEntry: Function
// - out: Uint8Array - a buffer to write exif to
//
// `maxEntrySize` meaning: when filtering Exif, remove all fields with size
// more than `maxEntrySize`. Note that most useful data in Exif is stored as
// integers (<= 12 bytes), so setting it higher will only filter out comments
// and vendor crap (default: 100 bytes)
//
// `onIFDEntry` is called on each entry inside IFD (think about Exif being
// an array of IFDs, and IFD being an array of entries). You may return `false`
// to filter out said element from Exif.
//
// `onIFDEntry` function signature:
//
//  - ifd: Number
//    - 0x0000 for IFD0
//    - 0x0001 for IFD1 (not currently supported)
//    - 0x8825 for GPSIFD
//    - 0x8769 for ExifIFD
//    - 0xA005 for InteropIFD
//
//  - entry: Object - the contents of the IFD entry
//    - tag:   Number - data tag
//    - type:  Number - data type (short, double, ascii, etc., see details in TIFF spec)
//    - count: Number - an amount of items in buffer (see details in TIFF spec)
//    - value: Buffer - data buffer (use this.readUint16 or this.readUint32 to read from there)
//
// Example:
//
// ```js
// onIFDEntry: function readOrientation(ifd, entry) {
//   if (ifd === 0 && entry.tag === 0x112 && entry.type === 3) {
//     console.log('Orientation =', this.readUInt16(entry.value, 0));
//   }
// }
// ```
//
Exif.prototype.filter = function (options, out) {
  let maxSize = options && options.maxEntrySize ? options.maxEntrySize : 100;

  /* eslint-disable func-style */
  const filter_entry = sectionName => entry => {
    if (options && options.onIFDEntry) {
      if (options.onIFDEntry.call(this, sectionName, entry) === false) {
        return false;
      }
    }

    return entry.value.length <= maxSize;
  };

  this.output = {
    buf: out,
    length: 0
  };

  let offset = 0;

  // copy signature (it's already checked on init)
  this.output.buf[0] = this.data[0];
  this.output.buf[1] = this.data[1];
  this.output.buf[2] = this.data[2];
  this.output.buf[3] = this.data[3];
  this.output.length += 4;

  this.writeUInt32(this.output.buf, 8, this.output.length);
  this.output.length += 4;

  offset = this.readUInt32(this.data, 4);

  // We only do read IFD0 here, IFD1 is ignored
  // because we don't need to preserve thumbnails
  //
  let t = this.processIFDSection(offset, filter_entry(0));

  t.entries.forEach(entry => {
    //                ExifIFD                 GPSIFD                interopIFD
    if (entry.tag === 0x8769 || entry.tag === 0x8825 || entry.tag === 0xA005) {
      if (entry.type === 4) {
        this.writeUInt32(this.output.buf, this.output.length, entry.written_offset + 8);

        let off = this.readUInt32(entry.value, 0);

        this.processIFDSection(off, filter_entry(entry.tag));
      }
    }
  });

  // we wrote more data than we allocated buffer for,
  // this could happen if TIFF is hand-crafted to be smaller than sum of its entries
  //
  if (this.output.length > this.output.buf.length) {
    throw error('TIFF data is too large', 'EBADDATA');
  }

  return this.output.length;
};


Exif.prototype.readIFDEntry = function (offset) {
  let tag   = this.readUInt16(this.data, offset);
  let type  = this.readUInt16(this.data, offset + 2);
  let count = this.readUInt32(this.data, offset + 4);
  let unit_length;

  switch (type) {
    case 1: // byte
    case 2: // ascii
    case 6: // sbyte
    case 7: // undefined
      unit_length = 1;
      break;

    case 3: // short
    case 8: // sshort
      unit_length = 2;
      break;

    case 4:  // long
    case 9:  // slong
    case 11: // float
      unit_length = 4;
      break;

    case 5:  // rational
    case 10: // srational
    case 12: // double
      unit_length = 8;
      break;

    default:
      // unknown type, skipping
      return;
  }

  let value;
  let length = unit_length * count;

  if (length <= 4) {
    value = this.data.subarray(offset + 8, offset + 12);

    if (value.length < 4) throw error('unexpected EOF', 'EBADDATA');
  } else {
    let offv = this.readUInt32(this.data, offset + 8);

    value = this.data.subarray(offv, offv + length);

    if (value.length < length) throw error('unexpected EOF', 'EBADDATA');
  }

  return { tag, type, count, value };
};


Exif.prototype.processIFDSection = function (offset, filter) {
  let entries_to_write = [];
  let entries_count = this.readUInt16(this.data, offset);

  offset += 2;

  for (let i = 0; i < entries_count; i++) {
    let entry = this.readIFDEntry(offset + i * 12);

    if (!entry) continue;
    if (!filter(entry)) continue;

    entries_to_write.push(entry);
  }

  this.writeUInt16(this.output.buf, entries_to_write.length, this.output.length);
  this.output.length += 2;

  let written_ifb_offset = this.output.length;

  entries_to_write.forEach(entry => {
    entry.written_offset = this.output.length;

    this.writeUInt16(this.output.buf, entry.tag, this.output.length);
    this.writeUInt16(this.output.buf, entry.type, this.output.length + 2);
    this.writeUInt32(this.output.buf, entry.count, this.output.length + 4);

    if (entry.value.length <= 4) {
      if (entry.value.length + this.output.length + 8 > this.output.buf.length) {
        throw error('TIFF data is too large', 'EBADDATA');
      }

      this.output.buf.set(entry.value, this.output.length + 8);
    }

    this.output.length += 12;
  });

  this.writeUInt32(this.output.buf, 0, this.output.length);
  this.output.length += 4;

  entries_to_write.forEach((entry, i) => {
    if (entry.value.length > 4) {
      this.writeUInt32(this.output.buf, this.output.length, written_ifb_offset + i * 12 + 8);

      if (entry.value.length + this.output.length > this.output.buf.length) {
        throw error('TIFF data is too large', 'EBADDATA');
      }

      this.output.buf.set(entry.value, this.output.length);

      this.output.length += entry.value.length;

      if (this.output.length % 2) {
        // ensure that everything is at word boundary
        this.output.buf[this.output.length] = 0xFF;
        this.output.length++;
      }
    }
  });

  return {
    entries:  entries_to_write,
    next_ifb: this.readUInt32(this.data, offset + entries_count * 12)
  };
};


module.exports = function filter_exif(data, options) {
  if (String.fromCharCode.apply(null, data.subarray(0, 6)) !== 'Exif\0\0') {
    throw error('invalid Exif signature', 'ENOTEXIF');
  }

  // Create buffer of the same length as input.
  //
  // This is good enough for most of the cases, but will throw
  // if exif is packed (referencing the same data multiple times)
  //
  let output  = new data.constructor(data.length);
  let exif    = new Exif(data.subarray(6));

  'Exif\0\0'.split('').forEach((c, pos) => {
    output[pos] = c.charCodeAt(0);
  });

  // Write filtered exif into output at position 6,
  // it's built around the fact that subarray copy is shallow
  //
  let length = exif.filter(options, output.subarray(6));

  return new data.constructor(output.subarray(0, length + 6));
};
