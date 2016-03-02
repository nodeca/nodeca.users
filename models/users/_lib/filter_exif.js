
'use strict';


function error(message, code) {
  let err = new Error(message);

  err.code = code;

  return err;
}


function Exif(data) {
  this.data = data;

  this.output = {
    buf: new Buffer(data.length),
    length: 0
  };

  let sig = data.toString('binary', 0, 4);

  if (sig !== 'II\x2A\0' && sig !== 'MM\0\x2A') {
    throw error('invalid TIFF signature', 'EBADDATA');
  }

  this.big_endian = (sig[0] === 'M');
}


Exif.prototype.readUInt16 = function (buffer, offset) {
  if (offset + 2 > buffer.length) throw error('unexpected EOF', 'EBADDATA');

  return this.big_endian ?
         buffer.readUInt16BE(offset) :
         buffer.readUInt16LE(offset);
};


Exif.prototype.readUInt32 = function (buffer, offset) {
  if (offset + 4 > buffer.length) throw error('unexpected EOF', 'EBADDATA');

  return this.big_endian ?
         buffer.readUInt32BE(offset) :
         buffer.readUInt32LE(offset);
};


Exif.prototype.writeUInt16 = function (buffer, data, offset) {
  // this could happen if TIFF is hand-crafted to be smaller than sum of its entries,
  // and we wrongly allocate a smaller buffer than necessary
  if (offset + 2 > buffer.length) throw error('TIFF data is too large', 'EBADDATA');

  return this.big_endian ?
         buffer.writeUInt16BE(data, offset) :
         buffer.writeUInt16LE(data, offset);
};


Exif.prototype.writeUInt32 = function (buffer, data, offset) {
  // this could happen if TIFF is hand-crafted to be smaller than sum of its entries,
  // and we wrongly allocate a smaller buffer than necessary
  if (offset + 4 > buffer.length) throw error('TIFF data is too large', 'EBADDATA');

  return this.big_endian ?
         buffer.writeUInt32BE(data, offset) :
         buffer.writeUInt32LE(data, offset);
};


Exif.prototype.filter = function (maxSize) {
  let offset = 0;

  // copy signature (it's already checked on init)
  this.data.copy(this.output.buf, 0, 0, 4);
  this.output.length += 4;

  this.writeUInt32(this.output.buf, 8, this.output.length);
  this.output.length += 4;

  offset = this.readUInt32(this.data, 4);

  // We only do read IFD0 here, IFD1 is ignored
  // because we don't need to preserve thumbnails
  //
  let t = this.processIFDSection(offset, maxSize);

  t.entries.forEach(entry => {
    //                ExifIFD                 GPSIFD                interopIFD
    if (entry.tag === 0x8769 || entry.tag === 0x8825 || entry.tag === 0xA005) {
      if (entry.type === 4) {
        this.writeUInt32(this.output.buf, this.output.length, entry.written_offset + 8);

        let off = this.readUInt32(entry.value, 0);

        this.processIFDSection(off, maxSize);
      }
    }
  });

  // we wrote more data than we allocated buffer for,
  // this could happen if TIFF is hand-crafted to be smaller than sum of its entries
  //
  if (this.output.length > this.output.buf.length) {
    throw error('TIFF data is too large', 'EBADDATA');
  }

  return this.output.buf.slice(0, this.output.length);
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
    value = this.data.slice(offset + 8, offset + 12);

    if (value.length < 4) throw error('unexpected EOF', 'EBADDATA');
  } else {
    let offv = this.readUInt32(this.data, offset + 8);

    value = this.data.slice(offv, offv + length);

    if (value.length < length) throw error('unexpected EOF', 'EBADDATA');
  }

  return { tag, type, count, value };
};


Exif.prototype.processIFDSection = function (offset, limit) {
  let entries_to_write = [];
  let entries_count = this.readUInt16(this.data, offset);

  offset += 2;

  for (let i = 0; i < entries_count; i++) {
    let entry = this.readIFDEntry(offset + i * 12);

    if (!entry) continue;
    if (entry.value.length > limit) continue;

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
      entry.value.copy(this.output.buf, this.output.length + 8);
    }

    this.output.length += 12;
  });

  this.writeUInt32(this.output.buf, 0, this.output.length);
  this.output.length += 4;

  entries_to_write.forEach((entry, i) => {
    if (entry.value.length > 4) {
      this.writeUInt32(this.output.buf, this.output.length, written_ifb_offset + i * 12 + 8);

      entry.value.copy(this.output.buf, this.output.length);

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
  if (data.toString('binary', 0, 6) !== 'Exif\0\0') {
    throw error('invalid Exif signature', 'ENOTEXIF');
  }

  let exif    = new Exif(data.slice(6));
  let maxSize = options && options.exifMaxEntrySize ? options.exifMaxEntrySize : Infinity;
  let output  = exif.filter(maxSize);

  return Buffer.concat([ new Buffer('Exif\0\0', 'binary'), output ]);
};
