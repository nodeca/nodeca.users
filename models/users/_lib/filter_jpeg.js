
'use strict';


const _          = require('lodash');
const Transform  = require('readable-stream').Transform;
const inherits   = require('util').inherits;
const filterExif = require('./filter_exif');


///////////////////////////////////////////////////////////////////////
// JPEG parser
//

// Parser states
//
const FILE_START          =  0; // start of the file, read signature (FF)
const FILE_START_FF       =  1; // start of the file, read signature (D8)
const SEGMENT_START       =  2; // start of a segment, expect to read FF
const SEGMENT_MARKER      =  3; // read marker ID
const SEGMENT_LENGTH      =  4; // read segment length (2 bytes total)
const SEGMENT_IGNORE      =  5; // read segment and ignore it
const SEGMENT_PIPE        =  6; // read segment and pass it into output
const SEGMENT_PIPE_DATA   =  7; // read segment and pass it into output (data)
const SEGMENT_BUFFER      =  8; // buffer segment, process as exif
const IMAGE               =  9; // start reading image
const IMAGE_FF            = 10; // process possible segment inside image
const FINAL               = 11; // ignore the rest of the data


function JpegParser(options) {
  options = options || {};

  Transform.call(this);

  this.state = FILE_START;

  // parser options
  this.removeICC        = options.removeICC;
  this.removeExif       = options.removeExif;
  this.filter           = options.filter;
  this.exifMaxEntrySize = options.exifMaxEntrySize || 100;
  this.comment          = options.comment;

  // internal data
  this._markerCode     = 0;
  this._bytesLeft      = 0;
  this._segmentLength  = 0;
  this._buffers        = [];
  this._bytesRead      = 0;
}


inherits(JpegParser, Transform);


function toHex(number) {
  return '0x' + _.padStart(number.toString(16), 2, '0').toUpperCase();
}


JpegParser.prototype._error = function (message, code) {
  let err = new Error(message);

  err.code = code;

  this.state = FINAL;

  return err;
};


/* eslint-disable max-depth */
JpegParser.prototype._transform = function (data, encoding, callback) {
  var buf, di, i = 0;

  while (i < data.length) {
    let b = data[i];

    switch (this.state) {
      // start of the file, read signature (FF)
      case FILE_START:
        if (b !== 0xFF) {
          callback(this._error('unknown file format', 'ENOTJPEG', i));
          return;
        }

        this.state = FILE_START_FF;
        i++;
        break;

      // start of the file, read signature (D8)
      case FILE_START_FF:
        if (b !== 0xD8) {
          callback(this._error('unknown file format', 'ENOTJPEG', i));
          return;
        }

        this.push(new Buffer([ 0xFF, 0xD8 ]));
        this.state = SEGMENT_START;
        i++;
        break;

      // start of a segment, expect to read FF
      case SEGMENT_START:
        if (this._markerCode === 0xDA) {
          // previous segment was SOS, so we should read image data instead
          this.state = IMAGE;
          break;
        }

        if (b !== 0xFF) {
          callback(this._error('unexpected byte at segment start: ' + toHex(b) +
                               ' (offset ' + toHex(this._bytesRead + i) + ')',
                               'EBADDATA'));
          return;
        }

        this.state = SEGMENT_MARKER;
        i++;
        break;

      // read marker ID
      case SEGMENT_MARKER:
        // standalone markers, according to JPEG 1992,
        // http://www.w3.org/Graphics/JPEG/itu-t81.pdf, see Table B.1
        if ((0xD0 <= b && b <= 0xD9) || b === 0x01) {
          this._markerCode = b;
          this._bytesLeft = 0;
          this._segmentLength = 0;

          if (this._markerCode === 0xD9 /* EOI */) {
            this.push(new Buffer([ 0xFF, 0xD9 ]));
            this.state = FINAL;
          } else {
            this.state = SEGMENT_LENGTH;
          }

          i++;
          break;
        }

        // the rest of the unreserved markers
        if (0xC0 <= b && b <= 0xFE) {
          this._markerCode = b;
          this._bytesLeft = 2;
          this._segmentLength = 0;
          this.state = SEGMENT_LENGTH;
          i++;
          break;
        }

        if (b === 0xFF) {
          // padding byte, skip it
          i++;
          break;
        }

        // unknown markers
        callback(this._error('unknown marker: ' + toHex(b) +
                             ' (offset ' + toHex(this._bytesRead + i) + ')',
                             'EBADDATA'));
        break;

      // read segment length (2 bytes total)
      case SEGMENT_LENGTH:
        while (this._bytesLeft > 0 && i < data.length) {
          this._segmentLength = this._segmentLength * 0x100 + data[i];
          this._bytesLeft--;
          i++;
        }

        if (this._bytesLeft <= 0) {
          if (this.comment !== null && typeof this.comment !== 'undefined' && this._markerCode !== 0xE0) {
            // insert comment field before any other markers (except APP0)
            //
            // (we can insert it anywhere, but JFIF segment being first
            // looks nicer in hexdump)
            //
            let comment = new Buffer(this.comment);

            buf = new Buffer(5 + comment.length);
            buf[0] = 0xFF;
            buf[1] = 0xFE;
            buf.writeUInt16BE(comment.length + 3, 2);
            comment.copy(buf, 4);
            buf[buf.length - 1] = 0;

            this.comment = null;
            this.push(buf);
          }

          if (this._markerCode === 0xE0) {
            // APP0, 14-byte JFIF header
            this.state = SEGMENT_PIPE;
          } else if (this._markerCode === 0xE1) {
            // APP1, Exif candidate
            this.state = SEGMENT_BUFFER;
          } else if (this._markerCode === 0xE2) {
            // APP2, ICC_profile
            this.state = this.removeICC ?
                         SEGMENT_IGNORE :
                         SEGMENT_PIPE;
          } else if (this._markerCode > 0xE2 && this._markerCode < 0xF0) {
            // Photoshop metadata, etc.
            this.state = this.filter ?
                         SEGMENT_IGNORE :
                         SEGMENT_PIPE;
          } else {
            // other valid headers
            this.state = SEGMENT_PIPE;
          }

          this._bytesLeft = Math.max(this._segmentLength - 2, 0);
        }
        break;

      // read segment and ignore it
      case SEGMENT_IGNORE:
        di = Math.min(this._bytesLeft, data.length - i);
        i += di;
        this._bytesLeft -= di;

        if (this._bytesLeft <= 0) this.state = SEGMENT_START;
        break;

      // read segment and pass it into output
      case SEGMENT_PIPE:
        if (this._bytesLeft <= 0) {
          this.state = SEGMENT_START;
        } else {
          this.state = SEGMENT_PIPE_DATA;
        }

        buf = new Buffer(4);
        buf[0] = 0xFF;
        buf[1] = this._markerCode;
        buf.writeUInt16BE(this._bytesLeft + 2, 2);
        this.push(buf);
        break;

      // read segment and pass it into output
      case SEGMENT_PIPE_DATA:
        di = Math.min(this._bytesLeft, data.length - i);
        this.push(data.slice(i, i + di));

        i += di;
        this._bytesLeft -= di;

        if (this._bytesLeft <= 0) this.state = SEGMENT_START;
        break;

      // read segment and buffer it, process as exif
      case SEGMENT_BUFFER:
        di = Math.min(this._bytesLeft, data.length - i);

        this._buffers.push(data.slice(i, i + di));

        i += di;
        this._bytesLeft -= di;

        if (this._bytesLeft <= 0) {
          let buf = Buffer.concat(this._buffers);
          this._buffers = [];

          if (this._markerCode === 0xE1 /* APP1 */ &&
              buf.toString('binary', 0, 6) === 'Exif\0\0') {

            // EXIF
            if (this.removeExif) {
              buf = null;
            } else {
              try {
                buf = filterExif(buf, {
                  exifMaxEntrySize: this.exifMaxEntrySize
                });
              } catch (err) {
                buf = null;

                // unexpected errors inside EXIF parser
                if (err.code && err.code !== 'EBADDATA') this.emit('error', err);
              }
            }
          } else {
            // not EXIF, maybe XMP
            /* eslint-disable no-lonely-if */
            if (this.filter === true) buf = null;
          }

          if (buf) {
            let buf2 = new Buffer(4);

            buf2[0] = 0xFF;
            buf2[1] = this._markerCode;
            buf2.writeUInt16BE(buf.length + 2, 2);

            this.push(buf2);
            this.push(buf);
          }

          this._buffers = [];
          this.state = SEGMENT_START;
        }
        break;

      // read image until we get FF
      case IMAGE:
        let start = i;

        while (i < data.length) {
          if (data[i] === 0xFF) {
            if (i + 1 < data.length) {
              b = data[i + 1];

              // skip FF and restart markers
              if (b === 0x00 || b >= 0xD0 && b < 0xD8) {
                i += 2;
                continue;
              }
            }

            break;
          }

          i++;
        }

        this.push(data.slice(start, i));

        if (i < data.length) {
          this.state = IMAGE_FF;
          i++;
        }
        break;

      // process possible segment inside image
      case IMAGE_FF:
        // 00 - escaped FF, D0-D7 - restart markers
        if (b === 0x00 || b >= 0xD0 && b < 0xD8) {
          this.push(new Buffer([ 255, b ]));
          this.state = IMAGE;
          i++;
          break;
        }

        // padded FF
        if (b === 0xFF) {
          this.push(new Buffer([ 255, b ]));
          this.state = IMAGE_FF;
          i++;
          break;
        }

        this.state = SEGMENT_MARKER;
        break;

      // ignore the rest of the data
      case FINAL:
        break;
    }
  }

  this._bytesRead += data.length;

  callback();
};


JpegParser.prototype._flush = function (callback) {
  switch (this.state) {
    case SEGMENT_IGNORE:
    case SEGMENT_PIPE:
    case SEGMENT_PIPE_DATA:
    case SEGMENT_BUFFER:
      // in those 6 states arbitrary data of a fixed length
      // is expected, and we didn't get any
      //
      callback(this._error('unexpected end of file' +
                           ' (offset ' + toHex(this._bytesRead) + ')',
                           'EBADDATA'));
      break;

    case FINAL:
      callback();
      break;

    default:
      // otherwise just simulate EOI segment
      //
      this.write(new Buffer([ 0xFF, 0xD9 ]), null, function (err) {
        this._flush_buf();
        callback(err);
      });
  }
};


///////////////////////////////////////////////////////////////////////
// Exports
//
module.exports = function filter_jpeg(options) {
  return new JpegParser(options);
};
