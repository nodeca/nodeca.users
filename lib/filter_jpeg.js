
'use strict';

const filterExif  = require('./filter_exif');


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
const SEGMENT_BUFFER_DATA =  9; // buffer segment, process as exif
const IMAGE               = 10; // start reading image
const IMAGE_FF            = 11; // process possible segment inside image
const FINAL               = 12; // ignore the rest of the data


/* eslint-disable no-bitwise */
function JpegParser(options) {
  options = options || {};

  this.output = [];

  this._state = FILE_START;

  //
  // Parser options
  //

  // remove ICC profile (2-10 kB)
  this._removeICC        = options.removeICC;

  // `true` - remove Exif completely, `false` - filter it and remove thumbnail
  this._removeExif       = options.removeExif;

  // remove other meta data (XMP, Photoshop, etc.)
  this._filter           = options.filter;

  // remove JPEG COM segments
  this._removeComments   = options.removeComments;

  // remove the rest of the image (everything except metadata);
  // if it's `true`, output will be a series of segments, and NOT a valid jpeg
  this._removeImage      = options.removeImage;

  // when filtering Exif, remove all fields with size more than this;
  // useful data in Exif is stored as integers (<= 12 bytes), so setting it
  // higher will only filter out comments and vendor crap
  this._exifMaxEntrySize = options.exifMaxEntrySize || 100;

  // add a comment at the beginning of the JPEG
  // (it's added after JFIF, but before anything else)
  this._comment          = options.comment;

  // additional data (raw buffer) to add at the beginning of the file
  this._addMeta          = options.addMeta;

  // internal data
  this._Buffer           = null;
  this._markerCode       = 0;
  this._bytesLeft        = 0;
  this._segmentLength    = 0;
  this._app1buffer       = null;
  this._app1pos          = 0;
  this._bytesRead        = 0;
}


function toHex(number) {
  let n = number.toString(16).toUpperCase();

  for (let i = 2 - n.length; i > 0; i--) n = '0' + n;

  return '0x' + n;
}


// Perform a shallow copy of a buffer or typed array
//
function slice(buf, start, end) {
  if (buf.slice && buf.copy && buf.writeDoubleBE) {
    //
    // Looks like node.js buffer
    //
    // - we use buf.slice() in node.js buffers because
    //   buf.subarray() is not a buffer
    //
    // - we use buf.subarray() in uint8arrays because
    //   buf.slice() is not a shallow copy
    //
    return buf.slice(start, end);
  }

  return buf.subarray(start, end);
}


// Copy one buffer to another
//
function copy(src, dst, dst_offset) {
  if (src.length + dst_offset > dst.length) throw new Error('buffer is too small');

  if (src.copy) {
    src.copy(dst, dst_offset);
  } else {
    dst.set(src, dst_offset);
  }
}


JpegParser.prototype._error = function (message, code) {
  // double error?
  if (this._state === FINAL) return;

  let err = new Error(message);

  err.code = code;

  this._state = FINAL;
  this.onError(err);
};


/* eslint-disable max-depth */
JpegParser.prototype.push = function (data) {
  if (!this._Buffer) this._Buffer = data.constructor;

  var buf, di, i = 0;

  while (i < data.length) {
    let b = data[i];

    switch (this._state) {
      // start of the file, read signature (FF)
      case FILE_START:
        if (b !== 0xFF) {
          this._error('unknown file format', 'ENOTJPEG', i);
          return;
        }

        this._state = FILE_START_FF;
        i++;
        break;

      // start of the file, read signature (D8)
      case FILE_START_FF:
        if (b !== 0xD8) {
          this._error('unknown file format', 'ENOTJPEG', i);
          return;
        }

        if (!this._removeImage) {
          this.onData(new this._Buffer([ 0xFF, 0xD8 ]));
        }

        this._state = SEGMENT_START;
        i++;
        break;

      // start of a segment, expect to read FF
      case SEGMENT_START:
        if (this._markerCode === 0xDA) {
          // previous segment was SOS, so we should read image data instead
          this._state = IMAGE;
          break;
        }

        if (b !== 0xFF) {
          this._error('unexpected byte at segment start: ' + toHex(b) +
                      ' (offset ' + toHex(this._bytesRead + i) + ')',
                      'EBADDATA');
          return;
        }

        this._state = SEGMENT_MARKER;
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
            if (!this._removeImage) {
              this.onData(new this._Buffer([ 0xFF, 0xD9 ]));
            }

            this._state = FINAL;
            this.onEnd();
          } else {
            this._state = SEGMENT_LENGTH;
          }

          i++;
          break;
        }

        // the rest of the unreserved markers
        if (0xC0 <= b && b <= 0xFE) {
          this._markerCode = b;
          this._bytesLeft = 2;
          this._segmentLength = 0;
          this._state = SEGMENT_LENGTH;
          i++;
          break;
        }

        if (b === 0xFF) {
          // padding byte, skip it
          i++;
          break;
        }

        // unknown markers
        this._error('unknown marker: ' + toHex(b) +
                    ' (offset ' + toHex(this._bytesRead + i) + ')',
                    'EBADDATA');
        break;

      // read segment length (2 bytes total)
      case SEGMENT_LENGTH:
        while (this._bytesLeft > 0 && i < data.length) {
          this._segmentLength = this._segmentLength * 0x100 + data[i];
          this._bytesLeft--;
          i++;
        }

        if (this._bytesLeft <= 0) {
          if (this._comment !== null && typeof this._comment !== 'undefined' && this._markerCode !== 0xE0) {
            // insert comment field before any other markers (except APP0)
            //
            // (we can insert it anywhere, but JFIF segment being first
            // looks nicer in hexdump)
            //
            let enc;

            try {
              // poor man's utf8 encoding
              enc = unescape(encodeURIComponent(this._comment));
            } catch (err) {
              enc = this._comment;
            }

            buf = new this._Buffer(5 + enc.length);
            buf[0] = 0xFF;
            buf[1] = 0xFE;
            buf[2] = ((enc.length + 3) >>> 8) & 0xFF;
            buf[3] = (enc.length + 3) & 0xFF;

            /* eslint-disable no-loop-func */
            enc.split('').forEach((c, pos) => {
              buf[pos + 4] = c.charCodeAt(0) & 0xFF;
            });

            buf[buf.length - 1] = 0;

            this._comment = null;
            this.onData(buf);
          }

          if (this._addMeta && this._markerCode !== 0xE0) {
            this.onData(this._addMeta);
            this._addMeta = null;
          }

          if (this._markerCode === 0xE0) {
            // APP0, 14-byte JFIF header
            this._state = SEGMENT_PIPE;
          } else if (this._markerCode === 0xE1) {
            // APP1, Exif candidate
            this._state = this._filter && this._removeExif ?
                          SEGMENT_IGNORE : // ignore if we remove both
                          SEGMENT_BUFFER;
          } else if (this._markerCode === 0xE2) {
            // APP2, ICC_profile
            this._state = this._removeICC ?
                          SEGMENT_IGNORE :
                          SEGMENT_PIPE;
          } else if (this._markerCode > 0xE2 && this._markerCode < 0xF0) {
            // Photoshop metadata, etc.
            this._state = this._filter ?
                          SEGMENT_IGNORE :
                          SEGMENT_PIPE;
          } else if (this._markerCode === 0xFE) {
            // Comments
            this._state = this._removeComments ?
                          SEGMENT_IGNORE :
                          SEGMENT_PIPE;
          } else {
            // other valid headers
            this._state = this._removeImage ?
                          SEGMENT_IGNORE :
                          SEGMENT_PIPE;
          }

          this._bytesLeft = Math.max(this._segmentLength - 2, 0);
        }
        break;

      // read segment and ignore it
      case SEGMENT_IGNORE:
        di = Math.min(this._bytesLeft, data.length - i);
        i += di;
        this._bytesLeft -= di;

        if (this._bytesLeft <= 0) this._state = SEGMENT_START;
        break;

      // read segment and pass it into output
      case SEGMENT_PIPE:
        if (this._bytesLeft <= 0) {
          this._state = SEGMENT_START;
        } else {
          this._state = SEGMENT_PIPE_DATA;
        }

        buf = new this._Buffer(4);
        buf[0] = 0xFF;
        buf[1] = this._markerCode;
        buf[2] = ((this._bytesLeft + 2) >>> 8) & 0xFF;
        buf[3] = (this._bytesLeft + 2) & 0xFF;
        this.onData(buf);
        break;

      // read segment and pass it into output
      case SEGMENT_PIPE_DATA:
        di = Math.min(this._bytesLeft, data.length - i);
        this.onData(slice(data, i, i + di));

        i += di;
        this._bytesLeft -= di;

        if (this._bytesLeft <= 0) this._state = SEGMENT_START;
        break;

      // read segment and buffer it, process as exif
      case SEGMENT_BUFFER:
        this._app1buffer = new this._Buffer(this._bytesLeft);
        this._app1pos    = 0;

        this._state = SEGMENT_BUFFER_DATA;
        break;

      // read segment and buffer it, process as exif
      case SEGMENT_BUFFER_DATA:
        di = Math.min(this._bytesLeft, data.length - i);

        let buf_slice = slice(data, i, i + di);

        copy(buf_slice, this._app1buffer, this._app1pos);
        this._app1pos += buf_slice.length;

        i += di;
        this._bytesLeft -= di;

        if (this._bytesLeft <= 0) {
          let buf = this._app1buffer;
          this._app1buffer = null;

          if (this._markerCode === 0xE1 /* APP1 */ &&
              // compare with 'Exif\0\0'
              buf[0] === 0x45 && buf[1] === 0x78 && buf[2] === 0x69 &&
              buf[3] === 0x66 && buf[4] === 0x00 && buf[5] === 0x00) {

            // EXIF
            if (this._removeExif) {
              buf = null;
            } else {
              try {
                buf = filterExif(buf, {
                  exifMaxEntrySize: this._exifMaxEntrySize
                });
              } catch (err) {
                buf = null;

                // unexpected errors inside EXIF parser
                if (err.code && err.code !== 'EBADDATA') {
                  this.onError(err);
                  return;
                }
              }
            }
          } else {
            // not EXIF, maybe XMP
            /* eslint-disable no-lonely-if */
            if (this._filter === true) buf = null;
          }

          if (buf) {
            let buf2 = new this._Buffer(4);

            buf2[0] = 0xFF;
            buf2[1] = this._markerCode;
            buf2[2] = ((buf.length + 2) >>> 8) & 0xFF;
            buf2[3] = (buf.length + 2) & 0xFF;

            this.onData(buf2);
            this.onData(buf);
          }

          this._state = SEGMENT_START;
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

        if (!this._removeImage) {
          this.onData(slice(data, start, i));
        }

        if (i < data.length) {
          this._state = IMAGE_FF;
          i++;
        }
        break;

      // process possible segment inside image
      case IMAGE_FF:
        // 00 - escaped FF, D0-D7 - restart markers, FF - just padding
        if (b === 0x00 || (b >= 0xD0 && b < 0xD8) || b === 0xFF) {
          if (!this._removeImage) {
            this.onData(new this._Buffer([ 255, b ]));
          }

          this._state = (b === 0xFF ? IMAGE_FF : IMAGE);
          i++;
          break;
        }

        this._state = SEGMENT_MARKER;
        break;

      // ignore the rest of the data
      case FINAL:
        break;
    }
  }

  this._bytesRead += data.length;
};


JpegParser.prototype.end = function () {
  switch (this._state) {
    case FILE_START:
    case FILE_START_FF:
    case SEGMENT_IGNORE:
    case SEGMENT_PIPE:
    case SEGMENT_PIPE_DATA:
    case SEGMENT_BUFFER:
    case SEGMENT_BUFFER_DATA:
      // in those 6 states arbitrary data of a fixed length
      // is expected, and we didn't get any
      //
      this._error('unexpected end of file' +
                  ' (offset ' + toHex(this._bytesRead) + ')',
                  'EBADDATA');
      break;

    case FINAL:
      break;

    default:
      // otherwise just simulate EOI segment
      //
      this.push(new this._Buffer([ 0xFF, 0xD9 ]));
  }
};


JpegParser.prototype.onData = function (chunk) {
  this.output.push(chunk);
};


JpegParser.prototype.onEnd = function () {
};


JpegParser.prototype.onError = function (err) {
  throw err;
};


///////////////////////////////////////////////////////////////////////
// Exports
//
module.exports = function filter_jpeg(options) {
  return new JpegParser(options);
};
