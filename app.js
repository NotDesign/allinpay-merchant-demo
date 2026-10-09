//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.OpenCC = {}));
})(this, (function (exports) { 'use strict';

  /**
   * 字典，範例："a alpha|b beta" 或 [["a", "alpha"], ["b", "beta"]]
   * @typedef {string|string[][]} DictLike
   */

  /**
   * 字典群組
   * @typedef {DictLike[]} DictGroup
   */

  /**
   * 地區設定資料
   * @typedef {object} LocalePreset
   * @property {object.<string, DictGroup>} from
   * @property {object.<string, DictGroup>} to
   */

  /**
   * Trie 樹。
   */
   class Trie {
    // 使用 Map 實作 Trie 樹
    // Trie 的每個節點為一個 Map 物件
    // key 為 code point，value 為子節點（也是一個 Map）。
    // 如果 Map 物件有 trie_val 屬性，則該屬性為值字串，代表替換的字詞。

    constructor() {
      this.map = new Map();
    }

    /**
     * 將一項資料加入字典樹
     * @param {string} s 要匹配的字串
     * @param {string} v 若匹配成功，則替換為此字串
     */
    addWord(s, v) {
      let { map } = this;
      for (const c of s) {
        const cp = c.codePointAt(0);
        const nextMap = map.get(cp);
        if (nextMap == null) {
          const tmp = new Map();
          map.set(cp, tmp);
          map = tmp;
        } else {
          map = nextMap;
        }
      }
      map.trie_val = v;
    }

    /**
       * 讀取字典資料
       * @param {DictLike} d 字典
       */
    loadDict(d) {
      if (typeof d === 'string') {
        d = d.split('|');
        for (const line of d) {
          const [l, r] = line.split(' ');
          this.addWord(l, r);
        }
      } else {
        for (let arr of d) {
          const [l, r] = arr;
          this.addWord(l, r);
        }
      }
    }

    /**
     * 讀取多個字典資料
     * @param {DictLike[]} arr 字典
     */
    loadDictGroup(arr) {
      arr.forEach(d => {
        this.loadDict(d);
      });
    }

    /**
     * 根據字典樹中的資料轉換字串。
     * @param {string} s 要轉換的字串
     */
    convert(s) {
      const t = this.map;
      const n = s.length, arr = [];
      let orig_i;
      for (let i = 0; i < n;) {
        let t_curr = t, k = 0, v;
        for (let j = i; j < n;) {
          const x = s.codePointAt(j);
          j += x > 0xffff ? 2 : 1;

          const t_next = t_curr.get(x);
          if (typeof t_next === 'undefined') {
            break;
          }
          t_curr = t_next;

          const v_curr = t_curr.trie_val;
          if (typeof v_curr !== 'undefined') {
            k = j;
            v = v_curr;
          }
        }
        if (k > 0) { // 有替代
          if (orig_i !== null) {
            arr.push(s.slice(orig_i, i));
            orig_i = null;
          }
          arr.push(v);
          i = k;
        } else { // 無替代
          if (orig_i === null) {
            orig_i = i;
          }
          i += s.codePointAt(i) > 0xffff ? 2 : 1;
        }
      }
      if (orig_i !== null) {
        arr.push(s.slice(orig_i, n));
      }
      return arr.join('');
    }
  }

  /**
   * Create a OpenCC converter
   * @param  {...DictGroup} dictGroup
   * @returns The converter that performs the conversion.
   */
  function ConverterFactory(...dictGroups) {
    const trieArr = dictGroups.map(grp => {
      const t = new Trie();
      t.loadDictGroup(grp);
      return t;
    });
    /**
     * The converter that performs the conversion.
     * @param {string} s The string to be converted.
     * @returns {string} The converted string.
     */
    function convert(s) {
      return trieArr.reduce((res, t) => {
        return t.convert(res);
      }, s);
    }
    return convert;
  }

  /**
   * Build Converter function with locale data
   * @param {LocalePreset} localePreset
   * @returns Converter function
   */
  function ConverterBuilder(localePreset) {
    return function Converter(options) {
      let dictGroups = [];
      ['from', 'to'].forEach(type => {
        if (typeof options[type] !== 'string') {
          throw new Error('Please provide the `' + type + '` option');
        }
        if (options[type] !== 't') {
          dictGroups.push(localePreset[type][options[type]]);
        }
      });
      return ConverterFactory.apply(null, dictGroups);
    }
  }

  /**
   * Create a custom converter.
   * @param {string[][]} dict The dictionary to be used for conversion.
   * @returns The converter that performs the conversion.
   */
  function CustomConverter(dict) {
    return ConverterFactory([dict]);
  }

  /**
   * Create a HTML page converter.
   * @param {(s: string) => string} converter The converter that performs the conversion.
   * @param {HTMLElement} rootNode The root node for recursive conversions.
   * @param {string} fromLangTag The lang tag to be converted.
   * @param {string} toLangTag The lang tag of the conversion result.
   * @returns The HTML page converter.
   */
  function HTMLConverter(converter, rootNode, fromLangTag, toLangTag) {
    /**
     * Perform the conversion on the page.
     */
    function convert() {
      function inner(currentNode, langMatched) {
        /* class list 包含 ignore-opencc 的元素會跳過後續的轉換 */
        if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.classList.contains('ignore-opencc')) return;

        if (currentNode.lang === fromLangTag) {
          langMatched = true;
          currentNode.shouldChangeLang = true; // 記住 lang 屬性被修改了，以便恢復
          currentNode.lang = toLangTag;
        } else if (currentNode.lang && currentNode.lang.length) {
          langMatched = false;
        }

        if (langMatched) {
          /* Do not convert these elements */
          if (currentNode.tagName === 'SCRIPT') return;
          if (currentNode.tagName === 'STYLE') return;

          /* 處理特殊屬性 */
          if (currentNode.tagName === 'META' && currentNode.name === 'description') {
            if (currentNode.originalContent == null) {
              currentNode.originalContent = currentNode.content;
            }
            currentNode.content = converter(currentNode.originalContent);
          } else if (currentNode.tagName === 'META' && currentNode.name === 'keywords') {
            if (currentNode.originalContent == null) {
              currentNode.originalContent = currentNode.content;
            }
            currentNode.content = converter(currentNode.originalContent);
          } else if (currentNode.tagName === 'IMG') {
            if (currentNode.originalAlt == null) {
              currentNode.originalAlt = currentNode.alt;
            }
            currentNode.alt = converter(currentNode.originalAlt);
          } else if (currentNode.tagName === 'INPUT' && currentNode.type === 'button') {
            if (currentNode.originalValue == null) {
              currentNode.originalValue = currentNode.value;
            }
            currentNode.value = converter(currentNode.originalValue);
          }
        }

        for (const node of currentNode.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && langMatched) {
            if (node.originalString == null) {
              node.originalString = node.nodeValue; // 存儲原始字串，以便恢復
            }
            node.nodeValue = converter(node.originalString);
          } else {
            inner(node, langMatched);
          }
        }
      }
      inner(rootNode, false);
    }

    /**
     * Restore the page to the state before the conversion.
     */
    function restore() {
      function inner(currentNode) {
        /* class list 包含 ignore-opencc 的元素會跳過後續的轉換 */
        if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.classList.contains('ignore-opencc')) return;

        if (currentNode.shouldChangeLang) {
          currentNode.lang = fromLangTag;
        }

        if (currentNode.originalString !== undefined) {
          currentNode.nodeValue = currentNode.originalString;
        }

        /* 處理特殊屬性 */
        if (currentNode.tagName === 'META' && currentNode.name === 'description') {
          if (currentNode.originalContent !== undefined) {
            currentNode.content = currentNode.originalContent;
          }
        } else if (currentNode.tagName === 'META' && currentNode.name === 'keywords') {
          if (currentNode.originalContent !== undefined) {
            currentNode.content = currentNode.originalContent;
          }
        } else if (currentNode.tagName === 'IMG') {
          if (currentNode.originalAlt !== undefined) {
            currentNode.alt = currentNode.originalAlt;
          }
        } else if (currentNode.tagName === 'INPUT' && currentNode.type === 'button') {
          if (currentNode.originalValue !== undefined) {
            currentNode.value = currentNode.originalValue;
          }
        }

        for (const node of currentNode.childNodes) {
          inner(node);
        }
      }
      inner(rootNode);
    }

    return { convert, restore };
  }

  var HKVariantsRev = "偽 僞|兑 兌|卧 臥|叁 叄|台 臺|吃 喫|唇 脣|啟 啓|囱 囪|媪 媼|媯 嬀|悦 悅|愠 慍|户 戶|抬 擡|捝 挩|揾 搵|敍 敘|敚 敓|枱 檯|枴 柺|棁 梲|榅 榲|氲 氳|涚 涗|温 溫|溈 潙|潀 潨|濕 溼|灶 竈|為 爲|煴 熅|痴 癡|皂 皁|眾 衆|秘 祕|税 稅|稜 棱|粧 妝|粽 糉|糭 糉|緼 縕|缽 鉢|脱 脫|腽 膃|葱 蔥|蒀 蒕|蒍 蔿|藴 蘊|蜕 蛻|衞 衛|衹 只|説 說|踴 踊|輼 轀|醖 醞|針 鍼|鈎 鉤|鋭 銳|閲 閱|鰛 鰮";

  var HKVariantsRevPhrases = "一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|七星巖 七星巖|世胄 世胄|介胄 介冑|傅巖 傅巖|免胄 免冑|冠胄 冠冑|千巖競秀 千巖競秀|千巖萬壑 千巖萬壑|千巖萬谷 千巖萬谷|口吃 口吃|台山 台山|台州 台州|台州地區 台州地區|台州市 台州市|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|名胄 名胄|國胄 國胄|圍巖 圍巖|地胄 地胄|壓胄子 壓冑子|士胄 士胄|大巖桐 大巖桐|天台女 天台女|天台宗 天台宗|天台山 天台山|天台縣 天台縣|天潢貴胄 天潢貴胄|奇巖 奇巖|寶胄 寶胄|小巖洞 小巖洞|岫巖縣 岫巖縣|峯巖 峯巖|嵌巖 嵌巖|巉巖 巉巖|巖壁 巖壁|巖居 巖居|巖居穴處 巖居穴處|巖居谷飲 巖居谷飲|巖岸 巖岸|巖巉 巖巉|巖巖 巖巖|巖徼 巖徼|巖手縣 巖手縣|巖村 巖村|巖洞 巖洞|巖流圈 巖流圈|巖牆 巖牆|巖牆之下 巖牆之下|巖畫 巖畫|巖穴 巖穴|巖穴之士 巖穴之士|巖薔薇 巖薔薇|巖邑 巖邑|巖郎 巖郎|巖阻 巖阻|巖陛 巖陛|帝胄 帝胄|幽巖 幽巖|幽棲巖谷 幽棲巖谷|張口 張口|懸巖 懸巖|懸巖峭壁 懸巖峭壁|懸胄 懸冑|攀巖 攀巖|支胄 支胄|教胄 教胄|景胄 景胄|望胄 望胄|末胄 末胄|村胄 村胄|枕巖漱流 枕巖漱流|枝胄 枝胄|氏胄 氏胄|洪胄 洪胄|浙江天台縣 浙江天台縣|清胄 清胄|灰巖殘丘 灰巖殘丘|玄胄 玄胄|甲胄 甲冑|甲胄魚類 甲冑魚類|皇胄 皇胄|石灰巖洞 石灰巖洞|神胄 神胄|簪纓世胄 簪纓世胄|系胄 系胄|紅巖 紅巖|絕巖 絕巖|緒胄 緒胄|纂胄 纂胄|胃口 胃口|胄嗣 胄嗣|胄子 胄子|胄序 胄序|胄族 胄族|胄甲 冑甲|胄監 胄監|胄科 冑科|胄緒 胄緒|胄胤 胄胤|胄裔 胄裔|胄裔繁衍 胄裔繁衍|胄閥 胄閥|胡雪巖 胡雪巖|胤胄 胤胄|苗胄 苗胄|英胄 英胄|華胄 華胄|血胄 血胄|裔胄 裔胄|訓胄 訓胄|試胄 試胄|豪門貴胄 豪門貴胄|貝胄 貝冑|貴胄 貴胄|賢胄 賢胄|蹇吃 蹇吃|躬擐甲胄 躬擐甲冑|遐胄 遐胄|遙胄 遙胄|遙遙華胄 遙遙華胄|遠胄 遠胄|遺胄 遺胄|鄧艾吃 鄧艾吃|重巖疊嶂 重巖疊嶂|金胄 金胄|鎧胄 鎧冑|鑿巖 鑿巖|門胄 門胄|開口 開口|雲巖區 雲巖區|非層巖 非層巖|韓侂胄 韓侂冑|飮胄 飮冑|骨巖巖 骨巖巖|高胄 高胄|魚胄 魚冑|鮮胄 鮮胄|鴻胄 鴻胄|黃巖區 黃巖區|黃巖島 黃巖島|黃炎貴胄 黃炎貴胄|齒胄 齒胄|龍巖 龍巖|龍巖市 龍巖市|龍巖村 龍巖村|龍胄 龍胄";

  var from_hk = [HKVariantsRev, HKVariantsRevPhrases];

  var TWVariantsRev = "偽 僞|參 蔘|吃 喫|唇 脣|啟 啓|媯 嬀|嫻 嫺|峰 峯|床 牀|抬 擡|汙 污|洩 泄|溈 潙|潀 潨|灶 竈|為 爲|痴 癡|痺 痹|皂 皁|眾 衆|睪 睾|秘 祕|稜 棱|簷 檐|粽 糉|缽 鉢|群 羣|著 着|蒍 蔿|裡 裏|踴 踊|韁 繮|顎 齶|鯰 鮎|麵 麪";

  var TWVariantsRevPhrases = "一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|凶事 凶事|凶信 凶信|凶兆 凶兆|凶吉 凶吉|凶地 凶地|凶多吉少 凶多吉少|凶宅 凶宅|凶年 凶年|凶德 凶德|凶怪 凶怪|凶日 凶日|凶服 凶服|凶歲 凶歲|凶死 凶死|凶氣 凶氣|凶煞 凶煞|凶燄 凶燄|凶神 凶神|凶禮 凶禮|凶耗 凶耗|凶肆 凶肆|凶荒 凶荒|凶訊 凶訊|凶豎 凶豎|凶身 凶身|凶逆 凶逆|凶門 凶門|口吃 口吃|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|合著 合著|吉凶 吉凶|名著 名著|四凶 四凶|大凶 大凶|巨著 巨著|張口 張口|昭著 昭著|歲凶 歲凶|胃口 胃口|著作 著作|著名 著名|著式 著式|著志 著志|著於 著於|著書 著書|著白 著白|著稱 著稱|著者 著者|著述 著述|著錄 著錄|蹇吃 蹇吃|逢凶 逢凶|避凶 避凶|鄧艾吃 鄧艾吃|鉅著 鉅著|開口 開口|閔凶 閔凶|顯著 顯著";

  var from_tw = [TWVariantsRev, TWVariantsRevPhrases];

  var TWPhrasesRev = "PN接面 PN結|SQL隱碼攻擊 SQL注入|三極體 三極管|下拉選單 下拉列表|丟擲 拋出|中介軟體 中間件|串列埠 串口|主機板 主板|主開機記錄 主引導記錄|乙太網 以太網|乳酪 奶酪|二極體 二極管|互動 交互|互動式 交互式|亞塞拜然 阿塞拜疆|人工智慧 人工智能|介面 接口|介面卡 適配器|代碼 代碼|伺服器 服務器|佇列 隊列|位元 比特|位元率 比特率|位元組 字節|位元速率 碼率|位址 地址|位址列 地址欄|低級 低級|低階 低級|作業系統 操作系統|使用者 用戶|使用者名稱 用戶名|來電轉駁 呼叫轉移|例項 實例|信號 信號|偵錯 調試|偵錯程式 調試器|傅立葉 傅里葉|傳送 發送|傷心小棧 紅心大戰|價效比 性價比|優先順序 優先級|儲存 保存|元件 組件|光碟 光盤|光碟機 光驅|克羅埃西亞 克羅地亞|入口網站 門戶網站|內建 內置|內碼表 代碼頁|全域性 全局|全形 全角|全球資訊網 萬維網|冰棒 冰棍|冷盤 涼菜|函式 函數|函數語言程式設計 函數式編程|刀鋒伺服器 刀片服務器|分割槽 分區|分散式 分佈式|分時多工 時分複用|分時多重進接 時分多址|分碼多重進接 碼分多址|分空間多重進接 空分多址|分頻多工 頻分複用|分頻多重進接 頻分多址|列印 打印|列支敦斯登 列支敦士登|列舉 枚舉|前處理器 預處理器|剪下 剪切|剪貼簿 剪貼板|副檔名 擴展名|加彭 加蓬|匯入 導入|匯出 導出|匯流排 總線|區域性 局部|區域網 局域網|千里達及托巴哥 特立尼達和多巴哥|半形 半角|卡達 卡塔爾|印表機 打印機|厄利垂亞 厄立特里亞|厄瓜多 厄瓜多爾|原始檔 源文件|原始碼 原代碼|原生代碼 本地代碼|參數列 參數表|取樣 採樣|取樣率 採樣率|叢集 集羣|史瓦濟蘭 斯威士蘭|吉布地 吉布堤|吉里巴斯 基里巴斯|名稱空間 命名空間|吐瓦魯 圖瓦盧|向量 矢量|呼叫 調用|命令列 命令行|咖哩 咖喱|哈薩克 哈薩克斯坦|哥斯大黎加 哥斯達黎加|啟用 激活|喫茶小舖 喫茶小舖|喬治亞 格魯吉亞|單核心 宏內核|回撥 回調|圖示 圖標|土庫曼 土庫曼斯坦|地址 地址|坦尚尼亞 坦桑尼亞|型別 類型|埠 端口|執行 運行|執行緒 線程|執行長 首席執行官|堆疊 堆棧|場效電晶體 場效應管|塑膠 塑料|塔吉克 塔吉克斯坦|塞席爾 塞舌爾|塞普勒斯 塞浦路斯|壁紙 壁紙|夏農 香農|外來鍵 外鍵|外掛 插件|外接 外置|多型 多態|多執行緒 多線程|多工 多任務|多明尼加 多米尼加|太空梭 航天飛機|奈及利亞 尼日利亞|奈米 納米|子音 輔音|字串 字符串|字元 字符|字型 字體|字型檔 字庫|字尾 後綴|字符集 字符集|字首 前綴|存取 訪問|存檔 存盤|安地卡及巴布達 安提瓜和巴布達|宏都拉斯 洪都拉斯|宕機 死機|定址 尋址|宣告 聲明|實例 實例|實體地址 物理地址|實體記憶體 物理內存|寬頻 寬帶|寮國 老撾|專案 項目|對映 映射|對話方塊 對話框|對象 對象|尚比亞 贊比亞|尤拉 歐拉|尼日 尼日爾|巢狀 嵌套|工作列 任務欄|工作管理員 任務管理器|巨集 宏|巴布亞紐幾內亞 巴布亞新幾內亞|巴貝多 巴巴多斯|布吉納法索 布基納法索|布林 布爾|帛琉 帕勞|平行計算 並行計算|幾內亞比索 幾內亞比紹|序列 串行|序號產生器 註冊機|建構函式 構造函數|建立 創建|引數 參數|彙編 彙編|影印 複印|影片 視頻|影象 圖像|後設資料 元數據|循環 循環|微控制器 單片機|快取 緩存|快取記憶體 高速緩存|快捷半導體 仙童半導體|快閃記憶體 閃存|感測 傳感|截圖 截屏|打開 打開|批次 批量|技術長 首席技術官|指令式程式設計 命令式編程|指令碼 腳本|指標 指針|捲軸 滾動條|掃描器 掃描儀|排程 調度|控制代碼 句柄|控制元件 控件|搜尋 搜索|摺積 捲積|撥出 呼出|擴充套件 擴展|擴音 免提|擷取 截取|攜帶型 便攜式|支持者 支持者|支援 支持|效能 性能|整合 集成|數位 數字|數位印刷 數字印刷|數位電子 數字電子|數位電路 數字電路|數字 數字|數據機 調製解調器|文件 文檔|文字 文本|文書處理 文字處理|斯洛維尼亞 斯洛文尼亞|新增 添加|映象 鏡像|映象管 顯像管|時脈頻率 時鐘頻率|晶片 芯片|智慧 智能|智慧財產權 知識產權|暫存器 寄存器|最佳化 優化|有失真壓縮 有損壓縮|李彥宏 李彥宏|查德 乍得|查詢 查找|核心 內核|格瑞那達 格林納達|桌上型 桌面型|桌上型電腦 臺式機|桌布 壁紙|標頭檔案 頭文件|模擬 仿真|模組 模塊|模里西斯 毛里求斯|機率 幾率|檔名 文件名|檔案 文件|檢視 查看|欄位 字段|正規化 範式|正規表示式 正則表達式|母音 元音|比特幣 比特幣|氣泡排序 冒泡排序|永珍 萬象|永續性 持久性|汶萊 文萊|沙烏地阿拉伯 沙特阿拉伯|泡麵 方便麪|波士尼亞赫塞哥維納 波斯尼亞黑塞哥維那|波札那 博茨瓦納|波長分波多工 波分複用|海內存知己 海內存知己|消息 消息|游標 光標|溢位 溢出|滑鼠 鼠標|演算法 算法|烏茲別克 烏茲別克斯坦|無失真壓縮 無損壓縮|燒錄 刻錄|營運長 首席運營官|片語 詞組|物件 對象|物件導向 面向對象|狀態列 狀態欄|獅子山 塞拉利昂|瓜地馬拉 危地馬拉|甘比亞 岡比亞|畫素 像素|登入 登錄|登出 註銷|登錄檔 註冊表|盧安達 盧旺達|目的碼 目標代碼|直譯器 解釋器|相容 兼容|相簿 圖庫|真實模式 實模式|矽 硅|砈 砹|破圖 花屏|硬碟 硬盤|硬體 硬件|碟片 盤片|磁碟 磁盤|磁碟機代號 盤符|磁軌 磁道|社區 社區|社羣 社區|程序 進程|程序不正義 程序不正義|程序導向 面向過程|程序式程式設計 過程式編程|程序正義 程序正義|程式 程序|程式碼 代碼|程式設計 編程|程式設計師 程序員|程式語言 編程語言|稽覈 審覈|積體電路 集成電路|空氣清淨機 空氣淨化器|空間多工 空分複用|突尼西亞 突尼斯|簡報 演示文稿|簡訊 短信|簽帳金融卡 借記卡|粘貼 粘貼|紐西蘭 新西蘭|純喫茶 純喫茶|索羅門羣島 所羅門羣島|索馬利亞 索馬里|終端使用者 最終用戶|組合語言 彙編語言|組譯 彙編|結束通話 掛斷|維德角 佛得角|網咖 網吧|網絡卡 網卡|網路 網絡|網路上的芳鄰 網上鄰居|網際網路 互聯網|線上 在線|縮圖 縮略圖|縮排 縮進|繫結 綁定|義大利 意大利|聖克里斯多福及尼維斯 聖基茨和尼維斯|聖文森及格瑞那丁 聖文森特和格林納丁斯|聖露西亞 聖盧西亞|聖馬利諾 聖馬力諾|聯結器 連接器|聯絡 聯繫|肯亞 肯尼亞|腳踏車 自行車|膝上型電腦 筆記本電腦|自動旋轉螢幕 自動轉屏|茅利塔尼亞 毛里塔尼亞|莫三比克 莫桑比克|菜單 菜單|萬用字元 通配符|萬那杜 瓦努阿圖|葉門 也門|葛摩 科摩羅|蒲隆地 布隆迪|蓋亞那 圭亞那|藍色畫面 藍屏|藍芽 藍牙|蘇利南 蘇里南|虛擬函式 虛函數|虛擬機器 虛擬機|虛擬碼 僞代碼|螢幕 屏幕|行內函數 內聯函數|行動式 便攜式|行動硬碟 移動硬盤|行動網路 移動網絡|行動資料 移動資料|行動通訊 移動通信|行動電話 移動電話|衣索比亞 埃塞俄比亞|表示式 表達式|裝置 設備|複製 拷貝|覈取按鈕 複選按鈕|覈取方塊 複選框|視窗 窗口|視覺化 可視化|視訊 視頻|視訊會議 視頻會議|視訊記憶體 顯存|視訊通話 視頻通話|解析度 分辨率|解構函式 析構函數|解除安裝 卸載|觸控 觸摸|觸控式螢幕 觸摸屏|計程車 出租車|訊息 消息|訊號 信號|訊雜比 信噪比|記憶體 內存|訪問 訪問|設定 設置|許可權 權限|調色盤 調色板|調變 調制|諾魯 瑙魯|識別符號 標識符|變數 變量|象牙海岸 科特迪瓦|貝南 貝寧|貝里斯 伯利茲|貼上 粘貼|資料 數據|資料來源 數據源|資料倉儲 數據倉庫|資料包 數據報|資料夾 文件夾|資料庫 數據庫|資料探勘 數據挖掘|資訊 信息|資訊保安 信息安全|資訊理論 信息論|資訊科技 信息技術|資訊長 首席信息官|賓士 奔馳|賴比瑞亞 利比里亞|賴索托 萊索托|超程式設計 元編程|跳脫字元 轉義字符|軟碟機 軟驅|軟體 軟件|載入 加載|載入程式 引導程序|辛巴威 津巴布韋|迦納 加納|迴圈 循環|透過 通過|通訊 通信|通話卡 通訊卡|通話記錄 聯繫歷史|通過 通過|通道 信道|速食麵 方便麪|連結 鏈接|連結串列 鏈表|連線 連接|進位制 進制|進程 進程|進階 高端|運算元 操作數|運算子 操作符|運算式 表達式|過載 重載|遞迴 遞歸|遠端 遠程|遮蔽 屏蔽|選單 菜單|邏輯閘 邏輯門|那杜 溫納圖萬|部落格 博客|都會網路 城域網|醯 酰|釋出 發佈|重新命名 重命名|重新整理 刷新|重灌 重裝|金氧半導體 金屬氧化物半導體|金鑰 密鑰|鈽 鈈|鉲 鐦|鉳 錇|鋂 鎇|錄影 錄像|錼 鎿|鍅 鈁|鎝 鍀|鎦 鑥|鐳射 激光|鑀 鎄|開啟 打開|閘流體 晶閘管|閘道器 網關|閘電路 門電路|關聯式資料庫 關係數據庫|防寫 寫保護|防毒 殺毒|阿拉伯聯合大公國 阿拉伯聯合酋長國|陣列 數組|除錯 調試|隨身碟 U盤|雜湊 哈希|離線 脫機|雲端儲存 雲存儲|雲端計算 雲計算|電晶體 晶體管|電腦保安 計算機安全|電腦科學 計算機科學|非同步 異步|韌體 固件|音效卡 聲卡|音訊 音頻|頁尾 頁腳|頁首 頁眉|預設 缺省|預設值 默認值|頻寬 帶寬|類别範本 類模板|類比 模擬|類比電子 模擬電子|類比電路 模擬電路|顯示卡 顯卡|飛航模式 飛行模式|馬利共和國 馬里共和國|馬爾地夫 馬爾代夫|駭客 黑客|高效能運算 高性能計算|高畫質 高清|高空彈跳 蹦極|高級 高級|高階 高端|黃宏 黃宏|點選 點擊|點陣圖 位圖";

  var from_twp = [TWVariantsRev, TWVariantsRevPhrases, TWPhrasesRev];

  var JPVariantsRev = "万 萬|与 與|両 兩|乗 乘|乱 亂|亀 龜|争 爭|亘 亙|亜 亞|仏 佛|仮 假|会 會|伝 傳|体 體|価 價|倹 儉|偽 僞|児 兒|党 黨|内 內|円 圓|写 寫|処 處|刹 剎|剣 劍|剤 劑|剰 剩|励 勵|労 勞|効 效|勅 敕|勧 勸|勲 勳|匀 勻|区 區|医 醫|単 單|却 卻|厠 廁|厳 嚴|参 參|双 雙|収 收|叙 敘|号 號|呉 吳|呪 咒|唇 脣|唖 啞|営 營|嘘 噓|嘱 囑|噛 嚙|団 團|囲 圍|図 圖|国 國|圏 圈|圧 壓|堕 墮|塁 壘|塩 鹽|増 增|壊 壞|壌 壤|壮 壯|声 聲|壱 壹|売 賣|変 變|奥 奧|奨 奬|嬢 孃|学 學|宝 寶|実 實|寛 寬|寝 寢|対 對|寿 壽|専 專|将 將|尽 盡|届 屆|属 屬|岳 嶽|峡 峽|峰 峯|巌 巖|巣 巢|巻 卷|帯 帶|帰 歸|庁 廳|広 廣|床 牀|廃 廢|弁 瓣|弐 貳|弥 彌|弯 彎|弾 彈|当 當|彦 彥|径 徑|従 從|御 禦|徳 德|徴 徵|応 應|恋 戀|恒 恆|恵 惠|悦 悅|悩 惱|悪 惡|惨 慘|懐 懷|戦 戰|戯 戲|戸 戶|戻 戾|払 拂|抜 拔|択 擇|担 擔|拝 拜|拠 據|拡 擴|挙 舉|挟 挾|挿 插|捜 搜|掲 揭|掴 摑|掻 搔|揺 搖|摂 攝|撃 擊|撹 攪|数 數|斉 齊|斎 齋|断 斷|旧 舊|昼 晝|晋 晉|晩 晚|暁 曉|暦 曆|曁 暨|曽 曾|条 條|来 來|枢 樞|査 查|栄 榮|桜 櫻|桝 枡|桟 棧|検 檢|楡 榆|楼 樓|楽 樂|様 樣|権 權|横 橫|欧 歐|歓 歡|歩 步|歯 齒|歳 歲|歴 歷|残 殘|殴 毆|殻 殼|毎 每|気 氣|汚 污|没 沒|沢 澤|沪 濾|浄 淨|浅 淺|浜 濱|涙 淚|涛 濤|渇 渴|済 濟|渉 涉|渋 澀|渓 溪|温 溫|湾 灣|湿 溼|満 滿|溌 潑|滝 瀧|滞 滯|潜 潛|瀬 瀨|灯 燈|炉 爐|点 點|為 爲|焔 焰|焼 燒|煙 菸|犠 犧|状 狀|独 獨|狭 狹|猟 獵|猫 貓|献 獻|獣 獸|産 產|画 畫|畳 疊|疏 疎|痩 瘦|痴 癡|痺 痹|発 發|皐 皋|盗 盜|県 縣|砕 碎|礼 禮|祷 禱|禄 祿|禅 禪|秘 祕|称 稱|税 稅|稜 棱|稲 稻|穂 穗|穏 穩|穣 穰|窃 竊|竃 竈|竜 龍|粋 粹|粛 肅|粧 妝|粽 糉|経 經|絵 繪|絶 絕|継 繼|続 續|総 總|緑 綠|緒 緖|縁 緣|縄 繩|縦 縱|繊 纖|繋 繫|繍 繡|群 羣|聡 聰|聴 聽|胆 膽|脚 腳|脱 脫|脳 腦|臓 臟|舎 舍|舗 鋪|芦 蘆|芸 藝|茎 莖|茘 荔|荘 莊|莱 萊|葱 蔥|蒋 蔣|蔵 藏|薫 薰|薬 藥|虚 虛|虫 蟲|蚕 蠶|蛍 螢|蛮 蠻|蝋 蠟|装 裝|覇 霸|覚 覺|覧 覽|観 觀|触 觸|訳 譯|証 證|誉 譽|説 說|読 讀|謡 謠|譲 讓|豊 豐|賛 贊|贋 贗|践 踐|転 轉|軽 輕|輌 輛|辞 辭|辺 邊|逓 遞|遅 遲|遙 遥|郷 鄉|酔 醉|醋 酢|醗 醱|醤 醬|醸 釀|釈 釋|鉄 鐵|鉱 鑛|銭 錢|鋳 鑄|錬 鍊|録 錄|関 關|閲 閱|闘 鬥|陥 陷|険 險|随 隨|隠 隱|雑 雜|霊 靈|静 靜|頴 穎|頼 賴|顔 顏|顕 顯|駅 驛|駆 驅|騒 騷|験 驗|髄 髓|髪 髮|鴎 鷗|鶏 雞|鹸 鹼|麦 麥|麹 麴|麺 麪|黄 黃|黒 黑|黙 默|鼈 鱉|齢 齡";

  var JPShinjitaiCharacters = "両 兩|弁 辨|欠 缺|糸 絲|芸 藝|浜 濱";

  var JPShinjitaiPhrases = "一獲千金 一攫千金|丁寧 叮嚀|丁重 鄭重|三差路 三叉路|世論 輿論|亜鈴 啞鈴|交差 交叉|供宴 饗宴|俊馬 駿馬|保塁 堡壘|個条書 箇条書|偏平 扁平|停泊 碇泊|優俊 優駿|先兵 尖兵|先鋭 尖鋭|共役 共軛|冗舌 饒舌|凶器 兇器|削岩 鑿岩|包丁 庖丁|包帯 繃帯|区画 區劃|厳然 儼然|友宜 友誼|反乱 叛乱|収集 蒐集|叙情 抒情|台頭 擡頭|合弁 合辦|喜遊曲 嬉遊曲|嘆願 歎願|回転 廻転|回遊 回游|奉持 捧持|委縮 萎縮|展転 輾轉|希少 稀少|幻惑 眩惑|広範 廣汎|広野 曠野|廃虚 廢墟|建坪率 建蔽率|弁当 辨當|弁膜 瓣膜|弁護 辯護|弁髪 辮髮|弦歌 絃歌|恩義 恩誼|意向 意嚮|慰謝料 慰藉料|憶断 臆断|憶病 臆病|戦没 戰歿|扇情 煽情|手帳 手帖|技量 伎倆|抜粋 抜萃|披歴 披瀝|抵触 牴触|抽選 抽籤|拘引 勾引|拠出 醵出|拠金 醵金|掘削 掘鑿|控除 扣除|援護 掩護|放棄 抛棄|散水 撒水|敬謙 敬虔|敷延 敷衍|断固 断乎|族生 簇生|昇叙 陞敘|暖房 煖房|暗唱 暗誦|暗夜 闇夜|暴露 曝露|枯渇 涸渇|格好 恰好|格幅 恰幅|棄損 毀損|模索 摸索|橋頭保 橋頭堡|欠缺 欠缺|死体 屍體|殿部 臀部|母指 拇指|気迫 気魄|決別 訣別|決壊 決潰|沈殿 沈澱|油送船 油槽船|波乱 波瀾|注釈 註釋|洗浄 洗滌|活発 活潑|浸透 滲透|浸食 浸蝕|消却 銷卻|混然 渾然|湾曲 彎曲|溶接 熔接|漁労 漁撈|漂然 飄然|激高 激昂|火炎 火焰|焦燥 焦躁|班点 斑点|留飲 溜飲|略奪 掠奪|疎通 疏通|発酵 醱酵|白亜 白堊|相克 相剋|知恵 智慧|破棄 破毀|確固 確乎|禁固 禁錮|符丁 符牒|粉装 扮装|紫班 紫斑|終息 終熄|総合 綜合|編集 編輯|義援 義捐|耕運機 耕耘機|肝心 肝腎|肩甲骨 肩胛骨|背徳 悖德|脈拍 脈搏|膨張 膨脹|芳純 芳醇|英知 叡智|蒸留 蒸溜|薫蒸 燻蒸|薫製 燻製|衣装 衣裳|衰退 衰退|裕然 悠然|補佐 輔佐|訓戒 訓誡|試練 試煉|詭弁 詭辯|講和 媾和|象眼 象嵌|貫録 貫禄|買弁 買辦|賛辞 讚辭|踏襲 蹈襲|車両 車輛|転倒 顛倒|輪郭 輪廓|退色 褪色|途絶 杜絶|連係 連繫|連合 聯合|選考 銓衡|酢酸 醋酸|野卑 野鄙|鉱石 礦石|間欠 間歇|関数 函數|防御 防禦|険阻 嶮岨|障壁 牆壁|障害 障礙|隠滅 湮滅|集落 聚落|雇用 雇傭|風諭 諷喩|飛語 蜚語|香典 香奠|骨格 骨骼|高進 亢進|鳥観 鳥瞰";

  var from_jp = [JPVariantsRev, JPShinjitaiCharacters, JPShinjitaiPhrases];

  var TSCharacters = "㑮 𫝈|㑯 㑔|㑳 㑇|㑶 㐹|㒓 𠉂|㓄 𪠟|㓨 刾|㔋 𪟎|㖮 𪠵|㗲 𠵾|㗿 𪡛|㘉 𠰱|㘓 𪢌|㘔 𫬐|㘚 㘎|㛝 𫝦|㜄 㚯|㜏 㛣|㜐 𫝧|㜗 𡞋|㜢 𡞱|㜷 𡝠|㞞 𪨊|㟺 𪩇|㠏 㟆|㠣 𫵷|㢗 𪪑|㢝 𢋈|㥮 㤘|㦎 𢛯|㦛 𢗓|㦞 𪫷|㨻 𪮃|㩋 𪮋|㩜 㨫|㩳 㧐|㩵 擜|㪎 𪯋|㯤 𣘐|㰙 𣗙|㵗 𣳆|㵾 𪷍|㶆 𫞛|㷍 𤆢|㷿 𤈷|㸇 𤎺|㹽 𫞣|㺏 𤠋|㺜 𪺻|㻶 𪼋|㿖 𪽮|㿗 𤻊|㿧 𤽯|䀉 𥁢|䀹 𥅴|䁪 𥇢|䁻 䀥|䂎 𥎝|䃮 鿎|䅐 𫀨|䅳 𫀬|䆉 𫁂|䉑 𫁲|䉙 𥬀|䉬 𫂈|䉲 𥮜|䉶 𫁷|䊭 𥺅|䊷 䌶|䊺 𫄚|䋃 𫄜|䋔 𫄞|䋙 䌺|䋚 䌻|䋦 𫄩|䋹 䌿|䋻 䌾|䋼 𫄮|䋿 𦈓|䌈 𦈖|䌋 𦈘|䌖 𦈜|䌝 𦈟|䌟 𦈞|䌥 𦈠|䌰 𦈙|䍤 𫅅|䍦 䍠|䍽 𦍠|䎙 𫅭|䎱 䎬|䓣 𬜯|䕤 𫟕|䕳 𦰴|䖅 𫟑|䗅 𫊪|䗿 𧉞|䙔 𫋲|䙡 䙌|䙱 𧜭|䚩 𫌯|䛄 𫍠|䛳 𫍫|䜀 䜧|䜖 𫟢|䝭 𫎧|䝻 𧹕|䝼 䞍|䞈 𧹑|䞋 𫎪|䞓 𫎭|䟃 𫎺|䟆 𫎳|䟐 𫎱|䠆 𫏃|䠱 𨅛|䡐 𫟤|䡩 𫟥|䡵 𫟦|䢨 𨑹|䤤 𫟺|䥄 𫠀|䥇 䦂|䥑 鿏|䥕 𬭯|䥗 𫔋|䥩 𨱖|䥯 𫔆|䥱 䥾|䦘 𨸄|䦛 䦶|䦟 䦷|䦯 𫔵|䦳 𨷿|䧢 𨸟|䪊 𫖅|䪏 𩏼|䪗 𩐀|䪘 𩏿|䪴 𫖫|䪾 𫖬|䫀 𫖱|䫂 𫖰|䫟 𫖲|䫴 𩖗|䫶 𫖺|䫻 𫗇|䫾 𫠈|䬓 𫗊|䬘 𩙮|䬝 𩙯|䬞 𩙧|䬧 𫗟|䭀 𩠇|䭃 𩠈|䭑 𫗱|䭔 𫗰|䭿 𩧭|䮄 𫠊|䮝 𩧰|䮞 𩨁|䮠 𩧿|䮫 𩨇|䮰 𫘮|䮳 𩨏|䮾 𩧪|䯀 䯅|䯤 𩩈|䰾 鲃|䱀 𫚐|䱁 𫚏|䱙 𩾈|䱧 𫚠|䱬 𩾊|䱰 𩾋|䱷 䲣|䱸 𫠑|䱽 䲝|䲁 鳚|䲅 𫚜|䲖 𩾂|䲘 鳤|䲰 𪉂|䳜 𫛬|䳢 𫛰|䳤 𫛮|䳧 𫛺|䳫 𫛼|䴉 鹮|䴋 𫜅|䴬 𪎈|䴱 𫜒|䴴 𪎋|䴽 𫜔|䵳 𪑅|䵴 𫜙|䶕 𫜨|䶲 𫜳|丟 丢|並 并|乾 干|亂 乱|亙 亘|亞 亚|佇 伫|佈 布|佔 占|併 并|來 来|侖 仑|侶 侣|侷 局|俁 俣|係 系|俓 𠇹|俔 伣|俠 侠|俥 伡|俬 私|倀 伥|倆 俩|倈 俫|倉 仓|個 个|們 们|倖 幸|倫 伦|倲 㑈|偉 伟|偑 㐽|側 侧|偵 侦|偽 伪|傌 㐷|傑 杰|傖 伧|傘 伞|備 备|傢 家|傭 佣|傯 偬|傳 传|傴 伛|債 债|傷 伤|傾 倾|僂 偻|僅 仅|僉 佥|僑 侨|僕 仆|僞 伪|僤 𫢸|僥 侥|僨 偾|僱 雇|價 价|儀 仪|儁 俊|儂 侬|億 亿|儈 侩|儉 俭|儎 傤|儐 傧|儔 俦|儕 侪|儘 尽|償 偿|儣 𠆲|優 优|儭 𠋆|儲 储|儷 俪|儸 㑩|儺 傩|儻 傥|儼 俨|兇 凶|兌 兑|兒 儿|兗 兖|內 内|兩 两|冊 册|冑 胄|冪 幂|凈 净|凍 冻|凙 𪞝|凜 凛|凱 凯|別 别|刪 删|剄 刭|則 则|剋 克|剎 刹|剗 刬|剛 刚|剝 剥|剮 剐|剴 剀|創 创|剷 铲|剾 𠛅|劃 划|劇 剧|劉 刘|劊 刽|劌 刿|劍 剑|劏 㓥|劑 剂|劚 㔉|勁 劲|勑 𠡠|動 动|務 务|勛 勋|勝 胜|勞 劳|勢 势|勣 𪟝|勩 勚|勱 劢|勳 勋|勵 励|勸 劝|勻 匀|匭 匦|匯 汇|匱 匮|區 区|協 协|卹 恤|卻 却|卽 即|厙 厍|厠 厕|厤 历|厭 厌|厲 厉|厴 厣|參 参|叄 叁|叢 丛|吒 咤|吳 吴|吶 呐|呂 吕|咼 呙|員 员|哯 𠯟|唄 呗|唓 𪠳|唸 念|問 问|啓 启|啞 哑|啟 启|啢 唡|喎 㖞|喚 唤|喪 丧|喫 吃|喬 乔|單 单|喲 哟|嗆 呛|嗇 啬|嗊 唝|嗎 吗|嗚 呜|嗩 唢|嗰 𠮶|嗶 哔|嗹 𪡏|嘆 叹|嘍 喽|嘓 啯|嘔 呕|嘖 啧|嘗 尝|嘜 唛|嘩 哗|嘪 𪡃|嘮 唠|嘯 啸|嘰 叽|嘳 𪡞|嘵 哓|嘸 呒|嘺 𪡀|嘽 啴|噁 恶|噅 𠯠|噓 嘘|噚 㖊|噝 咝|噞 𪡋|噠 哒|噥 哝|噦 哕|噯 嗳|噲 哙|噴 喷|噸 吨|噹 当|嚀 咛|嚇 吓|嚌 哜|嚐 尝|嚕 噜|嚙 啮|嚛 𪠸|嚥 咽|嚦 呖|嚧 𠰷|嚨 咙|嚮 向|嚲 亸|嚳 喾|嚴 严|嚶 嘤|嚽 𪢕|囀 啭|囁 嗫|囂 嚣|囃 𠱞|囅 冁|囈 呓|囉 啰|囌 苏|囑 嘱|囒 𪢠|囪 囱|圇 囵|國 国|圍 围|園 园|圓 圆|圖 图|團 团|圞 𪢮|垻 坝|埡 垭|埨 𫭢|埬 𪣆|埰 采|執 执|堅 坚|堊 垩|堖 垴|堚 𪣒|堝 埚|堯 尧|報 报|場 场|塊 块|塋 茔|塏 垲|塒 埘|塗 涂|塚 冢|塢 坞|塤 埙|塵 尘|塸 𫭟|塹 堑|塿 𪣻|墊 垫|墜 坠|墠 𫮃|墮 堕|墰 坛|墲 𪢸|墳 坟|墶 垯|墻 墙|墾 垦|壇 坛|壈 𡒄|壋 垱|壎 埙|壓 压|壗 𡋤|壘 垒|壙 圹|壚 垆|壜 坛|壞 坏|壟 垄|壠 垅|壢 坜|壣 𪤚|壩 坝|壪 塆|壯 壮|壺 壶|壼 壸|壽 寿|夠 够|夢 梦|夥 伙|夾 夹|奐 奂|奧 奥|奩 奁|奪 夺|奬 奖|奮 奋|奼 姹|妝 妆|姍 姗|姦 奸|娙 𫰛|娛 娱|婁 娄|婡 𫝫|婦 妇|婭 娅|媈 𫝨|媧 娲|媯 妫|媰 㛀|媼 媪|媽 妈|嫋 袅|嫗 妪|嫵 妩|嫺 娴|嫻 娴|嫿 婳|嬀 妫|嬃 媭|嬇 𫝬|嬈 娆|嬋 婵|嬌 娇|嬙 嫱|嬡 嫒|嬣 𪥰|嬤 嬷|嬦 𫝩|嬪 嫔|嬰 婴|嬸 婶|嬻 𪥿|孃 娘|孄 𫝮|孆 𫝭|孇 𪥫|孋 㛤|孌 娈|孎 𡠟|孫 孙|學 学|孻 𡥧|孾 𪧀|孿 孪|宮 宫|寀 采|寠 𪧘|寢 寝|實 实|寧 宁|審 审|寫 写|寬 宽|寵 宠|寶 宝|將 将|專 专|尋 寻|對 对|導 导|尷 尴|屆 届|屍 尸|屓 屃|屜 屉|屢 屡|層 层|屨 屦|屩 𪨗|屬 属|岡 冈|峯 峰|峴 岘|島 岛|峽 峡|崍 崃|崑 昆|崗 岗|崙 仑|崢 峥|崬 岽|嵐 岚|嵗 岁|嵼 𡶴|嵽 𫶇|嵾 㟥|嶁 嵝|嶄 崭|嶇 岖|嶈 𡺃|嶔 嵚|嶗 崂|嶘 𡺄|嶠 峤|嶢 峣|嶧 峄|嶨 峃|嶮 崄|嶸 嵘|嶹 𫝵|嶺 岭|嶼 屿|嶽 岳|巊 𪩎|巋 岿|巒 峦|巔 巅|巖 岩|巗 𪨷|巘 𪩘|巰 巯|巹 卺|帥 帅|師 师|帳 帐|帶 带|幀 帧|幃 帏|幓 㡎|幗 帼|幘 帻|幝 𪩷|幟 帜|幣 币|幩 𪩸|幫 帮|幬 帱|幹 干|幾 几|庫 库|廁 厕|廂 厢|廄 厩|廈 厦|廎 庼|廕 荫|廚 厨|廝 厮|廞 𫷷|廟 庙|廠 厂|廡 庑|廢 废|廣 广|廧 𪪞|廩 廪|廬 庐|廳 厅|弒 弑|弔 吊|弳 弪|張 张|強 强|彃 𪪼|彄 𫸩|彆 别|彈 弹|彌 弥|彎 弯|彔 录|彙 汇|彠 彟|彥 彦|彫 雕|彲 彨|彿 佛|後 后|徑 径|從 从|徠 徕|復 复|徵 征|徹 彻|徿 𪫌|恆 恒|恥 耻|悅 悦|悞 悮|悵 怅|悶 闷|悽 凄|惡 恶|惱 恼|惲 恽|惻 恻|愛 爱|愜 惬|愨 悫|愴 怆|愷 恺|愻 𢙏|愾 忾|慄 栗|態 态|慍 愠|慘 惨|慚 惭|慟 恸|慣 惯|慤 悫|慪 怄|慫 怂|慮 虑|慳 悭|慶 庆|慺 㥪|慼 戚|慾 欲|憂 忧|憊 惫|憐 怜|憑 凭|憒 愦|憖 慭|憚 惮|憢 𢙒|憤 愤|憫 悯|憮 怃|憲 宪|憶 忆|憸 𪫺|憹 𢙐|懀 𢙓|懇 恳|應 应|懌 怿|懍 懔|懎 𢠁|懞 蒙|懟 怼|懣 懑|懤 㤽|懨 恹|懲 惩|懶 懒|懷 怀|懸 悬|懺 忏|懼 惧|懾 慑|戀 恋|戇 戆|戔 戋|戧 戗|戩 戬|戰 战|戱 戯|戲 戏|戶 户|拋 抛|挩 捝|挱 挲|挾 挟|捨 舍|捫 扪|捱 挨|捲 卷|掃 扫|掄 抡|掆 㧏|掗 挜|掙 挣|掚 𪭵|掛 挂|採 采|揀 拣|揚 扬|換 换|揮 挥|揯 搄|損 损|搖 摇|搗 捣|搵 揾|搶 抢|摋 𢫬|摐 𪭢|摑 掴|摜 掼|摟 搂|摯 挚|摳 抠|摶 抟|摺 折|摻 掺|撈 捞|撊 𪭾|撏 挦|撐 撑|撓 挠|撝 㧑|撟 挢|撣 掸|撥 拨|撧 𪮖|撫 抚|撲 扑|撳 揿|撻 挞|撾 挝|撿 捡|擁 拥|擄 掳|擇 择|擊 击|擋 挡|擓 㧟|擔 担|據 据|擟 𪭧|擠 挤|擣 捣|擫 𢬍|擬 拟|擯 摈|擰 拧|擱 搁|擲 掷|擴 扩|擷 撷|擺 摆|擻 擞|擼 撸|擽 㧰|擾 扰|攄 摅|攆 撵|攋 𪮶|攏 拢|攔 拦|攖 撄|攙 搀|攛 撺|攜 携|攝 摄|攢 攒|攣 挛|攤 摊|攪 搅|攬 揽|敎 教|敓 敚|敗 败|敘 叙|敵 敌|數 数|斂 敛|斃 毙|斅 𢽾|斆 敩|斕 斓|斬 斩|斷 断|斸 𣃁|於 于|旂 旗|旣 既|昇 升|時 时|晉 晋|晛 𬀪|晝 昼|暈 晕|暉 晖|暐 𬀩|暘 旸|暢 畅|暫 暂|曄 晔|曆 历|曇 昙|曉 晓|曊 𪰶|曏 向|曖 暧|曠 旷|曥 𣆐|曨 昽|曬 晒|書 书|會 会|朥 𦛨|朧 胧|朮 术|東 东|枴 拐|柵 栅|柺 拐|査 查|桱 𣐕|桿 杆|梔 栀|梖 𪱷|梘 枧|梜 𬂩|條 条|梟 枭|梲 棁|棄 弃|棊 棋|棖 枨|棗 枣|棟 栋|棡 㭎|棧 栈|棲 栖|棶 梾|椏 桠|椲 㭏|楇 𣒌|楊 杨|楓 枫|楨 桢|業 业|極 极|榘 矩|榦 干|榪 杩|榮 荣|榲 榅|榿 桤|構 构|槍 枪|槓 杠|槤 梿|槧 椠|槨 椁|槫 𣏢|槮 椮|槳 桨|槶 椢|槼 椝|樁 桩|樂 乐|樅 枞|樑 梁|樓 楼|標 标|樞 枢|樠 𣗊|樢 㭤|樣 样|樤 𣔌|樧 榝|樫 㭴|樳 桪|樸 朴|樹 树|樺 桦|樿 椫|橈 桡|橋 桥|機 机|橢 椭|橫 横|橯 𣓿|檁 檩|檉 柽|檔 档|檜 桧|檟 槚|檢 检|檣 樯|檭 𣘴|檮 梼|檯 台|檳 槟|檵 𪲛|檸 柠|檻 槛|櫃 柜|櫅 𪲎|櫍 𬃊|櫓 橹|櫚 榈|櫛 栉|櫝 椟|櫞 橼|櫟 栎|櫠 𪲮|櫥 橱|櫧 槠|櫨 栌|櫪 枥|櫫 橥|櫬 榇|櫱 蘖|櫳 栊|櫸 榉|櫻 樱|欄 栏|欅 榉|欇 𪳍|權 权|欍 𣐤|欏 椤|欐 𪲔|欑 𪴙|欒 栾|欓 𣗋|欖 榄|欘 𣚚|欞 棂|欽 钦|歎 叹|歐 欧|歟 欤|歡 欢|歲 岁|歷 历|歸 归|歿 殁|殘 残|殞 殒|殢 𣨼|殤 殇|殨 㱮|殫 殚|殭 僵|殮 殓|殯 殡|殰 㱩|殲 歼|殺 杀|殻 壳|殼 壳|毀 毁|毆 殴|毊 𪵑|毿 毵|氂 牦|氈 毡|氌 氇|氣 气|氫 氢|氬 氩|氭 𣱝|氳 氲|氾 泛|汎 泛|汙 污|決 决|沒 没|沖 冲|況 况|泝 溯|洩 泄|洶 汹|浹 浃|浿 𬇙|涇 泾|涗 涚|涼 凉|淒 凄|淚 泪|淥 渌|淨 净|淩 凌|淪 沦|淵 渊|淶 涞|淺 浅|渙 涣|減 减|渢 沨|渦 涡|測 测|渾 浑|湊 凑|湋 𣲗|湞 浈|湧 涌|湯 汤|溈 沩|準 准|溝 沟|溡 𪶄|溫 温|溮 浉|溳 涢|溼 湿|滄 沧|滅 灭|滌 涤|滎 荥|滙 汇|滬 沪|滯 滞|滲 渗|滷 卤|滸 浒|滻 浐|滾 滚|滿 满|漁 渔|漊 溇|漍 𬇹|漚 沤|漢 汉|漣 涟|漬 渍|漲 涨|漵 溆|漸 渐|漿 浆|潁 颍|潑 泼|潔 洁|潕 𣲘|潙 沩|潚 㴋|潛 潜|潣 𫞗|潤 润|潯 浔|潰 溃|潷 滗|潿 涠|澀 涩|澅 𣶩|澆 浇|澇 涝|澐 沄|澗 涧|澠 渑|澤 泽|澦 滪|澩 泶|澫 𬇕|澬 𫞚|澮 浍|澱 淀|澾 㳠|濁 浊|濃 浓|濄 㳡|濆 𣸣|濕 湿|濘 泞|濚 溁|濛 蒙|濜 浕|濟 济|濤 涛|濧 㳔|濫 滥|濰 潍|濱 滨|濺 溅|濼 泺|濾 滤|濿 𪵱|瀂 澛|瀃 𣽷|瀅 滢|瀆 渎|瀇 㲿|瀉 泻|瀋 沈|瀏 浏|瀕 濒|瀘 泸|瀝 沥|瀟 潇|瀠 潆|瀦 潴|瀧 泷|瀨 濑|瀰 弥|瀲 潋|瀾 澜|灃 沣|灄 滠|灍 𫞝|灑 洒|灒 𪷽|灕 漓|灘 滩|灙 𣺼|灝 灏|灡 㳕|灣 湾|灤 滦|灧 滟|灩 滟|災 灾|為 为|烏 乌|烴 烃|無 无|煇 𪸩|煉 炼|煒 炜|煙 烟|煢 茕|煥 焕|煩 烦|煬 炀|煱 㶽|熂 𪸕|熅 煴|熉 𤈶|熌 𤇄|熒 荧|熓 𤆡|熗 炝|熚 𤇹|熡 𤋏|熰 𬉼|熱 热|熲 颎|熾 炽|燀 𬊤|燁 烨|燈 灯|燉 炖|燒 烧|燖 𬊈|燙 烫|燜 焖|營 营|燦 灿|燬 毁|燭 烛|燴 烩|燶 㶶|燻 熏|燼 烬|燾 焘|爃 𫞡|爄 𤇃|爇 𦶟|爍 烁|爐 炉|爖 𤇭|爛 烂|爥 𪹳|爧 𫞠|爭 争|爲 为|爺 爷|爾 尔|牀 床|牆 墙|牘 牍|牽 牵|犖 荦|犛 牦|犞 𪺭|犢 犊|犧 牺|狀 状|狹 狭|狽 狈|猌 𪺽|猙 狰|猶 犹|猻 狲|獁 犸|獃 呆|獄 狱|獅 狮|獊 𪺷|獎 奖|獨 独|獩 𤞃|獪 狯|獫 猃|獮 狝|獰 狞|獱 㺍|獲 获|獵 猎|獷 犷|獸 兽|獺 獭|獻 献|獼 猕|玀 猡|玁 𤞤|珼 𫞥|現 现|琱 雕|琺 珐|琿 珲|瑋 玮|瑒 玚|瑣 琐|瑤 瑶|瑩 莹|瑪 玛|瑲 玱|瑻 𪻲|瑽 𪻐|璉 琏|璊 𫞩|璕 𬍤|璗 𬍡|璝 𪻺|璡 琎|璣 玑|璦 瑷|璫 珰|璯 㻅|環 环|璵 玙|璸 瑸|璼 𫞨|璽 玺|璾 𫞦|璿 璇|瓄 𪻨|瓅 𬍛|瓊 琼|瓏 珑|瓔 璎|瓕 𤦀|瓚 瓒|瓛 𤩽|甌 瓯|甕 瓮|產 产|産 产|甦 苏|甯 宁|畝 亩|畢 毕|畫 画|異 异|畵 画|當 当|畼 𪽈|疇 畴|疊 叠|痙 痉|痠 酸|痮 𪽪|痾 疴|瘂 痖|瘋 疯|瘍 疡|瘓 痪|瘞 瘗|瘡 疮|瘧 疟|瘮 瘆|瘱 𪽷|瘲 疭|瘺 瘘|瘻 瘘|療 疗|癆 痨|癇 痫|癉 瘅|癐 𤶊|癒 愈|癘 疠|癟 瘪|癡 痴|癢 痒|癤 疖|癥 症|癧 疬|癩 癞|癬 癣|癭 瘿|癮 瘾|癰 痈|癱 瘫|癲 癫|發 发|皁 皂|皚 皑|皟 𤾀|皰 疱|皸 皲|皺 皱|盃 杯|盜 盗|盞 盏|盡 尽|監 监|盤 盘|盧 卢|盨 𪾔|盪 荡|眝 𪾣|眞 真|眥 眦|眾 众|睍 𪾢|睏 困|睜 睁|睞 睐|瞘 眍|瞜 䁖|瞞 瞒|瞤 𥆧|瞶 瞆|瞼 睑|矇 蒙|矉 𪾸|矑 𪾦|矓 眬|矚 瞩|矯 矫|硃 朱|硜 硁|硤 硖|硨 砗|硯 砚|碕 埼|碙 𥐻|碩 硕|碭 砀|碸 砜|確 确|碼 码|碽 䂵|磑 硙|磚 砖|磠 硵|磣 碜|磧 碛|磯 矶|磽 硗|磾 䃅|礄 硚|礆 硷|礎 础|礐 𬒈|礒 𥐟|礙 碍|礦 矿|礪 砺|礫 砾|礬 矾|礮 𪿫|礱 砻|祕 秘|祿 禄|禍 祸|禎 祯|禕 祎|禡 祃|禦 御|禪 禅|禮 礼|禰 祢|禱 祷|禿 秃|秈 籼|稅 税|稈 秆|稏 䅉|稜 棱|稟 禀|種 种|稱 称|穀 谷|穇 䅟|穌 稣|積 积|穎 颖|穠 秾|穡 穑|穢 秽|穩 稳|穫 获|穭 穞|窩 窝|窪 洼|窮 穷|窯 窑|窵 窎|窶 窭|窺 窥|竄 窜|竅 窍|竇 窦|竈 灶|竊 窃|竚 𥩟|竪 竖|竱 𫁟|競 竞|筆 笔|筍 笋|筧 笕|筴 䇲|箇 个|箋 笺|箏 筝|節 节|範 范|築 筑|篋 箧|篔 筼|篘 𥬠|篠 筿|篢 𬕂|篤 笃|篩 筛|篳 筚|篸 𥮾|簀 箦|簂 𫂆|簍 篓|簑 蓑|簞 箪|簡 简|簢 𫂃|簣 篑|簫 箫|簹 筜|簽 签|簾 帘|籃 篮|籅 𥫣|籋 𥬞|籌 筹|籔 䉤|籙 箓|籛 篯|籜 箨|籟 籁|籠 笼|籤 签|籩 笾|籪 簖|籬 篱|籮 箩|籲 吁|粵 粤|糉 粽|糝 糁|糞 粪|糧 粮|糰 团|糲 粝|糴 籴|糶 粜|糹 纟|糺 𫄙|糾 纠|紀 纪|紂 纣|紃 𬘓|約 约|紅 红|紆 纡|紇 纥|紈 纨|紉 纫|紋 纹|納 纳|紐 纽|紓 纾|純 纯|紕 纰|紖 纼|紗 纱|紘 纮|紙 纸|級 级|紛 纷|紜 纭|紝 纴|紞 𬘘|紟 𫄛|紡 纺|紬 䌷|紮 扎|細 细|紱 绂|紲 绁|紳 绅|紵 纻|紹 绍|紺 绀|紼 绋|紿 绐|絀 绌|絁 𫄟|終 终|絃 弦|組 组|絅 䌹|絆 绊|絍 𫟃|絎 绗|結 结|絕 绝|絙 𫄠|絛 绦|絝 绔|絞 绞|絡 络|絢 绚|絥 𫄢|給 给|絧 𫄡|絨 绒|絪 𬘡|絰 绖|統 统|絲 丝|絳 绛|絶 绝|絹 绢|絺 𫄨|綀 𦈌|綁 绑|綃 绡|綄 𬘫|綆 绠|綇 𦈋|綈 绨|綉 绣|綋 𫟄|綌 绤|綎 𬘩|綏 绥|綐 䌼|綑 捆|經 经|綖 𫄧|綜 综|綝 𬘭|綞 缍|綟 𫄫|綠 绿|綡 𫟅|綢 绸|綣 绻|綧 𬘯|綪 𬘬|綫 线|綬 绶|維 维|綯 绹|綰 绾|綱 纲|網 网|綳 绷|綴 缀|綵 彩|綸 纶|綹 绺|綺 绮|綻 绽|綽 绰|綾 绫|綿 绵|緄 绲|緇 缁|緊 紧|緋 绯|緍 𦈏|緑 绿|緒 绪|緓 绬|緔 绱|緗 缃|緘 缄|緙 缂|線 线|緝 缉|緞 缎|緟 𫟆|締 缔|緡 缗|緣 缘|緤 𫄬|緦 缌|編 编|緩 缓|緬 缅|緮 𫄭|緯 纬|緰 𦈕|緱 缑|緲 缈|練 练|緶 缏|緷 𦈉|緸 𦈑|緹 缇|緻 致|緼 缊|縈 萦|縉 缙|縊 缢|縋 缒|縍 𫄰|縎 𦈔|縐 绉|縑 缣|縕 缊|縗 缞|縛 缚|縝 缜|縞 缟|縟 缛|縣 县|縧 绦|縫 缝|縬 𦈚|縭 缡|縮 缩|縯 𬙂|縰 𫄳|縱 纵|縲 缧|縳 䌸|縴 纤|縵 缦|縶 絷|縷 缕|縸 𫄲|縹 缥|縺 𦈐|總 总|績 绩|繂 𫄴|繃 绷|繅 缫|繆 缪|繈 𫄶|繏 𦈝|繐 𰬸|繒 缯|繓 𦈛|織 织|繕 缮|繚 缭|繞 绕|繟 𦈎|繡 绣|繢 缋|繨 𫄤|繩 绳|繪 绘|繫 系|繬 𫄱|繭 茧|繮 缰|繯 缳|繰 缲|繳 缴|繶 𫄷|繷 𫄣|繸 䍁|繹 绎|繻 𦈡|繼 继|繽 缤|繾 缱|繿 䍀|纁 𫄸|纆 𬙊|纇 颣|纈 缬|纊 纩|續 续|纍 累|纏 缠|纓 缨|纔 才|纕 𬙋|纖 纤|纗 𫄹|纘 缵|纚 𫄥|纜 缆|缽 钵|罃 䓨|罈 坛|罌 罂|罎 坛|罰 罚|罵 骂|罷 罢|羅 罗|羆 罴|羈 羁|羋 芈|羣 群|羥 羟|羨 羡|義 义|羵 𫅗|羶 膻|習 习|翫 玩|翬 翚|翹 翘|翽 翙|耬 耧|耮 耢|聖 圣|聞 闻|聯 联|聰 聪|聲 声|聳 耸|聵 聩|聶 聂|職 职|聹 聍|聻 𫆏|聽 听|聾 聋|肅 肃|脅 胁|脈 脉|脛 胫|脣 唇|脥 𣍰|脩 修|脫 脱|脹 胀|腎 肾|腖 胨|腡 脶|腦 脑|腪 𣍯|腫 肿|腳 脚|腸 肠|膃 腽|膕 腘|膚 肤|膞 䏝|膠 胶|膢 𦝼|膩 腻|膹 𪱥|膽 胆|膾 脍|膿 脓|臉 脸|臍 脐|臏 膑|臗 𣎑|臘 腊|臚 胪|臟 脏|臠 脔|臢 臜|臥 卧|臨 临|臺 台|與 与|興 兴|舉 举|舊 旧|舘 馆|艙 舱|艣 𫇛|艤 舣|艦 舰|艫 舻|艱 艰|艷 艳|芻 刍|苧 苎|茲 兹|荊 荆|莊 庄|莖 茎|莢 荚|莧 苋|菕 𰰨|華 华|菴 庵|菸 烟|萇 苌|萊 莱|萬 万|萴 荝|萵 莴|葉 叶|葒 荭|葝 𫈎|葤 荮|葦 苇|葯 药|葷 荤|蒍 𫇭|蒐 搜|蒓 莼|蒔 莳|蒕 蒀|蒞 莅|蒭 𫇴|蒼 苍|蓀 荪|蓆 席|蓋 盖|蓧 𦰏|蓮 莲|蓯 苁|蓴 莼|蓽 荜|蔄 𬜬|蔔 卜|蔘 参|蔞 蒌|蔣 蒋|蔥 葱|蔦 茑|蔭 荫|蔯 𫈟|蔿 𫇭|蕁 荨|蕆 蒇|蕎 荞|蕒 荬|蕓 芸|蕕 莸|蕘 荛|蕝 𫈵|蕢 蒉|蕩 荡|蕪 芜|蕭 萧|蕳 𫈉|蕷 蓣|蕽 𫇽|薀 蕰|薆 𫉁|薈 荟|薊 蓟|薌 芗|薑 姜|薔 蔷|薘 荙|薟 莶|薦 荐|薩 萨|薳 䓕|薴 苧|薵 䓓|薹 苔|薺 荠|藍 蓝|藎 荩|藝 艺|藥 药|藪 薮|藭 䓖|藴 蕴|藶 苈|藷 𫉄|藹 蔼|藺 蔺|蘀 萚|蘄 蕲|蘆 芦|蘇 苏|蘊 蕴|蘋 苹|蘚 藓|蘞 蔹|蘟 𦻕|蘢 茏|蘭 兰|蘺 蓠|蘿 萝|虆 蔂|虉 𬟁|處 处|虛 虚|虜 虏|號 号|虧 亏|虯 虬|蛺 蛱|蛻 蜕|蜆 蚬|蝀 𬟽|蝕 蚀|蝟 猬|蝦 虾|蝨 虱|蝸 蜗|螄 蛳|螞 蚂|螢 萤|螮 䗖|螻 蝼|螿 螀|蟂 𫋇|蟄 蛰|蟈 蝈|蟎 螨|蟘 𫋌|蟜 𫊸|蟣 虮|蟬 蝉|蟯 蛲|蟲 虫|蟳 𫊻|蟶 蛏|蟻 蚁|蠀 𧏗|蠁 蚃|蠅 蝇|蠆 虿|蠍 蝎|蠐 蛴|蠑 蝾|蠔 蚝|蠙 𧏖|蠟 蜡|蠣 蛎|蠦 𫊮|蠨 蟏|蠱 蛊|蠶 蚕|蠻 蛮|蠾 𧑏|衆 众|衊 蔑|術 术|衕 同|衚 胡|衛 卫|衝 冲|袞 衮|裊 袅|裏 里|補 补|裝 装|裡 里|製 制|複 复|褌 裈|褘 袆|褲 裤|褳 裢|褸 褛|褻 亵|襀 𫌀|襇 裥|襉 裥|襏 袯|襓 𫋹|襖 袄|襗 𫋷|襘 𫋻|襝 裣|襠 裆|襤 褴|襪 袜|襬 摆|襯 衬|襰 𧝝|襲 袭|襴 襕|襵 𫌇|覈 核|見 见|覎 觃|規 规|覓 觅|視 视|覘 觇|覛 𫌪|覡 觋|覥 觍|覦 觎|親 亲|覬 觊|覯 觏|覲 觐|覷 觑|覹 𫌭|覺 觉|覼 𫌨|覽 览|覿 觌|觀 观|觴 觞|觶 觯|觸 触|訁 讠|訂 订|訃 讣|計 计|訊 讯|訌 讧|討 讨|訏 𬣙|訐 讦|訑 𫍙|訒 讱|訓 训|訕 讪|訖 讫|託 托|記 记|訛 讹|訜 𫍛|訝 讶|訞 𫍚|訟 讼|訢 䜣|訣 诀|訥 讷|訨 𫟞|訩 讻|訪 访|設 设|許 许|訴 诉|訶 诃|診 诊|註 注|証 证|詀 𧮪|詁 诂|詆 诋|詊 𫟟|詎 讵|詐 诈|詑 𫍡|詒 诒|詓 𫍜|詔 诏|評 评|詖 诐|詗 诇|詘 诎|詛 诅|詝 𬣞|詞 词|詠 咏|詡 诩|詢 询|詣 诣|試 试|詩 诗|詪 𬣳|詫 诧|詬 诟|詭 诡|詮 诠|詰 诘|話 话|該 该|詳 详|詵 诜|詷 𫍣|詼 诙|詿 诖|誂 𫍥|誄 诔|誅 诛|誆 诓|誇 夸|誋 𫍪|誌 志|認 认|誑 诳|誒 诶|誕 诞|誘 诱|誚 诮|語 语|誠 诚|誡 诫|誣 诬|誤 误|誥 诰|誦 诵|誨 诲|說 说|誫 𫍨|説 说|誰 谁|課 课|誳 𫍮|誴 𫟡|誶 谇|誷 𫍬|誹 诽|誺 𫍧|誼 谊|誾 訚|調 调|諂 谄|諄 谆|談 谈|諉 诿|請 请|諍 诤|諏 诹|諑 诼|諒 谅|諓 𬣡|論 论|諗 谂|諛 谀|諜 谍|諝 谞|諞 谝|諟 𬤊|諡 谥|諢 诨|諣 𫍩|諤 谔|諥 𫍳|諦 谛|諧 谐|諫 谏|諭 谕|諮 咨|諯 𫍱|諰 𫍰|諱 讳|諲 𬤇|諳 谙|諴 𫍯|諶 谌|諷 讽|諸 诸|諺 谚|諼 谖|諾 诺|謀 谋|謁 谒|謂 谓|謄 誊|謅 诌|謆 𫍸|謉 𫍷|謊 谎|謎 谜|謏 𫍲|謐 谧|謔 谑|謖 谡|謗 谤|謙 谦|謚 谥|講 讲|謝 谢|謠 谣|謡 谣|謨 谟|謫 谪|謬 谬|謭 谫|謯 𫍹|謱 𫍴|謳 讴|謸 𫍵|謹 谨|謾 谩|譁 哗|譂 𫟠|譅 𰶎|譆 𫍻|證 证|譊 𫍢|譎 谲|譏 讥|譑 𫍤|譓 𬤝|譖 谮|識 识|譙 谯|譚 谭|譜 谱|譞 𫍽|譟 噪|譨 𫍦|譫 谵|譭 毁|譯 译|議 议|譴 谴|護 护|譸 诪|譽 誉|譾 谫|讀 读|讅 谉|變 变|讋 詟|讌 䜩|讎 雠|讒 谗|讓 让|讕 谰|讖 谶|讚 赞|讜 谠|讞 谳|豈 岂|豎 竖|豐 丰|豔 艳|豬 猪|豵 𫎆|豶 豮|貓 猫|貗 𫎌|貙 䝙|貝 贝|貞 贞|貟 贠|負 负|財 财|貢 贡|貧 贫|貨 货|販 贩|貪 贪|貫 贯|責 责|貯 贮|貰 贳|貲 赀|貳 贰|貴 贵|貶 贬|買 买|貸 贷|貺 贶|費 费|貼 贴|貽 贻|貿 贸|賀 贺|賁 贲|賂 赂|賃 赁|賄 贿|賅 赅|資 资|賈 贾|賊 贼|賑 赈|賒 赊|賓 宾|賕 赇|賙 赒|賚 赉|賜 赐|賝 𫎩|賞 赏|賟 𧹖|賠 赔|賡 赓|賢 贤|賣 卖|賤 贱|賦 赋|賧 赕|質 质|賫 赍|賬 账|賭 赌|賰 䞐|賴 赖|賵 赗|賺 赚|賻 赙|購 购|賽 赛|賾 赜|贃 𧹗|贄 贽|贅 赘|贇 赟|贈 赠|贉 𫎫|贊 赞|贋 赝|贍 赡|贏 赢|贐 赆|贑 𫎬|贓 赃|贔 赑|贖 赎|贗 赝|贚 𫎦|贛 赣|贜 赃|赬 赪|趕 赶|趙 赵|趨 趋|趲 趱|跡 迹|踐 践|踰 逾|踴 踊|蹌 跄|蹔 𫏐|蹕 跸|蹟 迹|蹠 跖|蹣 蹒|蹤 踪|蹳 𫏆|蹺 跷|蹻 𫏋|躂 跶|躉 趸|躊 踌|躋 跻|躍 跃|躎 䟢|躑 踯|躒 跞|躓 踬|躕 蹰|躘 𨀁|躚 跹|躝 𨅬|躡 蹑|躥 蹿|躦 躜|躪 躏|軀 躯|軉 𨉗|車 车|軋 轧|軌 轨|軍 军|軏 𫐄|軑 轪|軒 轩|軔 轫|軕 𫐅|軗 𨐅|軛 轭|軜 𫐇|軝 𬨂|軟 软|軤 轷|軨 𫐉|軫 轸|軬 𫐊|軲 轱|軷 𫐈|軸 轴|軹 轵|軺 轺|軻 轲|軼 轶|軾 轼|軿 𫐌|較 较|輄 𨐈|輅 辂|輇 辁|輈 辀|載 载|輊 轾|輋 𪨶|輒 辄|輓 挽|輔 辅|輕 轻|輖 𫐏|輗 𫐐|輛 辆|輜 辎|輝 辉|輞 辋|輟 辍|輢 𫐎|輥 辊|輦 辇|輨 𫐑|輩 辈|輪 轮|輬 辌|輮 𫐓|輯 辑|輳 辏|輶 𬨎|輷 𫐒|輸 输|輻 辐|輼 辒|輾 辗|輿 舆|轀 辒|轂 毂|轄 辖|轅 辕|轆 辘|轇 𫐖|轉 转|轊 𫐕|轍 辙|轎 轿|轐 𫐗|轔 辚|轗 𫐘|轟 轰|轠 𫐙|轡 辔|轢 轹|轣 𫐆|轤 轳|辦 办|辭 辞|辮 辫|辯 辩|農 农|迴 回|逕 迳|這 这|連 连|週 周|進 进|遊 游|運 运|過 过|達 达|違 违|遙 遥|遜 逊|遞 递|遠 远|遡 溯|適 适|遱 𫐷|遲 迟|遷 迁|選 选|遺 遗|遼 辽|邁 迈|還 还|邇 迩|邊 边|邏 逻|邐 逦|郟 郏|郵 邮|鄆 郓|鄉 乡|鄒 邹|鄔 邬|鄖 郧|鄟 𫑘|鄧 邓|鄩 𬩽|鄭 郑|鄰 邻|鄲 郸|鄳 𫑡|鄴 邺|鄶 郐|鄺 邝|酇 酂|酈 郦|醃 腌|醖 酝|醜 丑|醞 酝|醟 蒏|醣 糖|醫 医|醬 酱|醱 酦|醲 𬪩|醶 𫑷|釀 酿|釁 衅|釃 酾|釅 酽|釋 释|釐 厘|釒 钅|釓 钆|釔 钇|釕 钌|釗 钊|釘 钉|釙 钋|釚 𫟲|針 针|釟 𫓥|釣 钓|釤 钐|釦 扣|釧 钏|釨 𫓦|釩 钒|釲 𫟳|釳 𨰿|釴 𬬩|釵 钗|釷 钍|釹 钕|釺 钎|釾 䥺|釿 𬬱|鈀 钯|鈁 钫|鈃 钘|鈄 钭|鈅 钥|鈆 𫓪|鈇 𫓧|鈈 钚|鈉 钠|鈋 𨱂|鈍 钝|鈎 钩|鈐 钤|鈑 钣|鈒 钑|鈔 钞|鈕 钮|鈖 𫟴|鈗 𫟵|鈛 𫓨|鈞 钧|鈠 𨱁|鈡 钟|鈣 钙|鈥 钬|鈦 钛|鈧 钪|鈮 铌|鈯 𨱄|鈰 铈|鈲 𨱃|鈳 钶|鈴 铃|鈷 钴|鈸 钹|鈹 铍|鈺 钰|鈽 钸|鈾 铀|鈿 钿|鉀 钾|鉁 𨱅|鉅 巨|鉆 钻|鉈 铊|鉉 铉|鉊 𬬿|鉋 铇|鉍 铋|鉑 铂|鉔 𫓬|鉕 钷|鉗 钳|鉚 铆|鉛 铅|鉝 𫟷|鉞 钺|鉠 𫓭|鉢 钵|鉤 钩|鉥 𬬸|鉦 钲|鉧 𬭁|鉬 钼|鉭 钽|鉮 𬬹|鉳 锫|鉶 铏|鉷 𫟹|鉸 铰|鉺 铒|鉻 铬|鉽 𫟸|鉾 𫓴|鉿 铪|銀 银|銁 𫓲|銂 𫟻|銃 铳|銅 铜|銈 𫓯|銊 𫓰|銍 铚|銏 𫟶|銑 铣|銓 铨|銖 铢|銘 铭|銚 铫|銛 铦|銜 衔|銠 铑|銣 铷|銥 铱|銦 铟|銨 铵|銩 铥|銪 铕|銫 铯|銬 铐|銱 铞|銳 锐|銶 𨱇|銷 销|銹 锈|銻 锑|銼 锉|鋁 铝|鋂 𰾄|鋃 锒|鋅 锌|鋇 钡|鋉 𨱈|鋌 铤|鋏 铗|鋐 𬭎|鋒 锋|鋗 𫓶|鋙 铻|鋝 锊|鋟 锓|鋠 𫓵|鋣 铘|鋤 锄|鋥 锃|鋦 锔|鋨 锇|鋩 铓|鋪 铺|鋭 锐|鋮 铖|鋯 锆|鋰 锂|鋱 铽|鋶 锍|鋸 锯|鋹 𬬮|鋼 钢|錀 𬬭|錁 锞|錂 𨱋|錄 录|錆 锖|錇 锫|錈 锩|錏 铔|錐 锥|錒 锕|錕 锟|錘 锤|錙 锱|錚 铮|錛 锛|錜 𫓻|錝 𫓽|錞 𬭚|錟 锬|錠 锭|錡 锜|錢 钱|錤 𫓹|錥 𫓾|錦 锦|錨 锚|錩 锠|錫 锡|錮 锢|錯 错|録 录|錳 锰|錶 表|錸 铼|錼 镎|錽 𫓸|鍀 锝|鍁 锨|鍃 锪|鍄 𨱉|鍅 钫|鍆 钔|鍇 锴|鍈 锳|鍉 𫔂|鍊 炼|鍋 锅|鍍 镀|鍒 𫔄|鍔 锷|鍘 铡|鍚 钖|鍛 锻|鍠 锽|鍤 锸|鍥 锲|鍩 锘|鍬 锹|鍭 𬭤|鍮 𨱎|鍰 锾|鍵 键|鍶 锶|鍺 锗|鍼 针|鍾 钟|鎂 镁|鎄 锿|鎇 镅|鎈 𫟿|鎊 镑|鎌 镰|鎍 𫔅|鎓 𬭩|鎔 镕|鎖 锁|鎘 镉|鎙 𫔈|鎚 锤|鎛 镈|鎝 𨱏|鎞 𫔇|鎡 镃|鎢 钨|鎣 蓥|鎦 镏|鎧 铠|鎩 铩|鎪 锼|鎬 镐|鎭 镇|鎮 镇|鎯 𨱍|鎰 镒|鎲 镋|鎳 镍|鎵 镓|鎶 鿔|鎷 𨰾|鎸 镌|鎿 镎|鏃 镞|鏆 𨱌|鏇 旋|鏈 链|鏉 𨱒|鏌 镆|鏍 镙|鏏 𬭬|鏐 镠|鏑 镝|鏗 铿|鏘 锵|鏚 𬭭|鏜 镗|鏝 镘|鏞 镛|鏟 铲|鏡 镜|鏢 镖|鏤 镂|鏥 𫔊|鏦 𫓩|鏨 錾|鏰 镚|鏵 铧|鏷 镤|鏹 镪|鏺 䥽|鏻 𬭸|鏽 锈|鏾 𫔌|鐃 铙|鐄 𨱑|鐇 𫔍|鐈 𫓱|鐋 铴|鐍 𫔎|鐎 𨱓|鐏 𨱔|鐐 镣|鐒 铹|鐓 镦|鐔 镡|鐘 钟|鐙 镫|鐝 镢|鐠 镨|鐥 䦅|鐦 锎|鐧 锏|鐨 镄|鐩 𬭼|鐪 𫓺|鐫 镌|鐮 镰|鐯 䦃|鐲 镯|鐳 镭|鐵 铁|鐶 镮|鐸 铎|鐺 铛|鐼 𫔁|鐽 𫟼|鐿 镱|鑀 𰾭|鑄 铸|鑉 𫠁|鑊 镬|鑌 镔|鑑 鉴|鑒 鉴|鑔 镲|鑕 锧|鑞 镴|鑠 铄|鑣 镳|鑥 镥|鑪 𬬻|鑭 镧|鑰 钥|鑱 镵|鑲 镶|鑴 𫔔|鑷 镊|鑹 镩|鑼 锣|鑽 钻|鑾 銮|鑿 凿|钁 镢|钂 镋|長 长|門 门|閂 闩|閃 闪|閆 闫|閈 闬|閉 闭|開 开|閌 闶|閍 𨸂|閎 闳|閏 闰|閐 𨸃|閑 闲|閒 闲|間 间|閔 闵|閗 𫔯|閘 闸|閝 𫠂|閞 𫔰|閡 阂|閣 阁|閤 合|閥 阀|閨 闺|閩 闽|閫 阃|閬 阆|閭 闾|閱 阅|閲 阅|閵 𫔴|閶 阊|閹 阉|閻 阎|閼 阏|閽 阍|閾 阈|閿 阌|闃 阒|闆 板|闇 暗|闈 闱|闉 𬮱|闊 阔|闋 阕|闌 阑|闍 阇|闐 阗|闑 𫔶|闒 阘|闓 闿|闔 阖|闕 阙|闖 闯|關 关|闞 阚|闠 阓|闡 阐|闢 辟|闤 阛|闥 闼|陘 陉|陝 陕|陞 升|陣 阵|陰 阴|陳 陈|陸 陆|陽 阳|隉 陧|隊 队|階 阶|隑 𬮿|隕 陨|際 际|隤 𬯎|隨 随|險 险|隮 𬯀|隯 陦|隱 隐|隴 陇|隸 隶|隻 只|雋 隽|雖 虽|雙 双|雛 雏|雜 杂|雞 鸡|離 离|難 难|雲 云|電 电|霑 沾|霢 霡|霣 𫕥|霧 雾|霼 𪵣|霽 霁|靂 雳|靄 霭|靆 叇|靈 灵|靉 叆|靚 靓|靜 静|靝 靔|靦 腼|靧 𫖃|靨 靥|鞏 巩|鞝 绱|鞦 秋|鞽 鞒|鞾 𫖇|韁 缰|韃 鞑|韆 千|韉 鞯|韋 韦|韌 韧|韍 韨|韓 韩|韙 韪|韚 𫠅|韛 𫖔|韜 韬|韝 鞲|韞 韫|韠 𫖒|韻 韵|響 响|頁 页|頂 顶|頃 顷|項 项|順 顺|頇 顸|須 须|頊 顼|頌 颂|頍 𫠆|頎 颀|頏 颃|預 预|頑 顽|頒 颁|頓 顿|頔 𬱖|頗 颇|領 领|頜 颌|頠 𬱟|頡 颉|頤 颐|頦 颏|頫 𫖯|頭 头|頮 颒|頰 颊|頲 颋|頴 颕|頵 𫖳|頷 颔|頸 颈|頹 颓|頻 频|頽 颓|顂 𩓋|顃 𩖖|顅 𫖶|顆 颗|題 题|額 额|顎 颚|顏 颜|顒 颙|顓 颛|顔 颜|顗 𫖮|願 愿|顙 颡|顛 颠|類 类|顢 颟|顣 𫖹|顥 颢|顧 顾|顫 颤|顬 颥|顯 显|顰 颦|顱 颅|顳 颞|顴 颧|風 风|颭 飐|颮 飑|颯 飒|颰 𩙥|颱 台|颳 刮|颶 飓|颷 𩙪|颸 飔|颺 飏|颻 飖|颼 飕|颾 𩙫|飀 飗|飄 飘|飆 飙|飈 飚|飋 𫗋|飛 飞|飠 饣|飢 饥|飣 饤|飥 饦|飦 𫗞|飩 饨|飪 饪|飫 饫|飭 饬|飯 饭|飱 飧|飲 饮|飴 饴|飵 𫗢|飶 𫗣|飼 饲|飽 饱|飾 饰|飿 饳|餃 饺|餄 饸|餅 饼|餈 糍|餉 饷|養 养|餌 饵|餎 饹|餏 饻|餑 饽|餒 馁|餓 饿|餔 𫗦|餕 馂|餖 饾|餗 𫗧|餘 余|餚 肴|餛 馄|餜 馃|餞 饯|餡 馅|餦 𫗠|餧 𫗪|館 馆|餪 𫗬|餫 𫗥|餬 糊|餭 𫗮|餱 糇|餳 饧|餵 喂|餶 馉|餷 馇|餸 𩠌|餺 馎|餼 饩|餾 馏|餿 馊|饁 馌|饃 馍|饅 馒|饈 馐|饉 馑|饊 馓|饋 馈|饌 馔|饑 饥|饒 饶|饗 飨|饘 𫗴|饜 餍|饞 馋|饟 𫗵|饠 𫗩|饢 馕|馬 马|馭 驭|馮 冯|馯 𫘛|馱 驮|馳 驰|馴 驯|馹 驲|馼 𫘜|駁 驳|駃 𫘝|駉 𬳶|駊 𫘟|駎 𩧨|駐 驻|駑 驽|駒 驹|駓 𬳵|駔 驵|駕 驾|駘 骀|駙 驸|駚 𩧫|駛 驶|駝 驼|駞 𫘞|駟 驷|駡 骂|駢 骈|駤 𫘠|駧 𩧲|駩 𩧴|駪 𬳽|駫 𫘡|駭 骇|駰 骃|駱 骆|駶 𩧺|駸 骎|駻 𫘣|駼 𬳿|駿 骏|騁 骋|騂 骍|騃 𫘤|騄 𫘧|騅 骓|騉 𫘥|騊 𫘦|騌 骔|騍 骒|騎 骑|騏 骐|騑 𬴂|騔 𩨀|騖 骛|騙 骗|騚 𩨊|騜 𫘩|騝 𩨃|騞 𬴃|騟 𩨈|騠 𫘨|騤 骙|騧 䯄|騪 𩨄|騫 骞|騭 骘|騮 骝|騰 腾|騱 𫘬|騴 𫘫|騵 𫘪|騶 驺|騷 骚|騸 骟|騻 𫘭|騼 𫠋|騾 骡|驀 蓦|驁 骜|驂 骖|驃 骠|驄 骢|驅 驱|驊 骅|驋 𩧯|驌 骕|驍 骁|驎 𬴊|驏 骣|驓 𫘯|驕 骄|驗 验|驙 𫘰|驚 惊|驛 驿|驟 骤|驢 驴|驤 骧|驥 骥|驦 骦|驨 𫘱|驪 骊|驫 骉|骯 肮|髏 髅|髒 脏|體 体|髕 髌|髖 髋|髮 发|鬆 松|鬍 胡|鬖 𩭹|鬚 须|鬠 𫘽|鬢 鬓|鬥 斗|鬧 闹|鬨 哄|鬩 阋|鬮 阄|鬱 郁|鬹 鬶|魎 魉|魘 魇|魚 鱼|魛 鱽|魟 𫚉|魢 鱾|魥 𩽹|魦 𫚌|魨 鲀|魯 鲁|魴 鲂|魵 𫚍|魷 鱿|魺 鲄|魽 𫠐|鮀 𬶍|鮁 鲅|鮃 鲆|鮄 𫚒|鮅 𫚑|鮆 𫚖|鮈 𬶋|鮊 鲌|鮋 鲉|鮍 鲏|鮎 鲇|鮐 鲐|鮑 鲍|鮒 鲋|鮓 鲊|鮚 鲒|鮜 鲘|鮝 鲞|鮞 鲕|鮟 𩽾|鮠 𬶏|鮡 𬶐|鮣 䲟|鮤 𫚓|鮦 鲖|鮪 鲔|鮫 鲛|鮭 鲑|鮮 鲜|鮯 𫚗|鮰 𫚔|鮳 鲓|鮵 𫚛|鮶 鲪|鮸 𩾃|鮺 鲝|鮿 𫚚|鯀 鲧|鯁 鲠|鯄 𩾁|鯆 𫚙|鯇 鲩|鯉 鲤|鯊 鲨|鯒 鲬|鯔 鲻|鯕 鲯|鯖 鲭|鯗 鲞|鯛 鲷|鯝 鲴|鯞 𫚡|鯡 鲱|鯢 鲵|鯤 鲲|鯧 鲳|鯨 鲸|鯪 鲮|鯫 鲰|鯬 𫚞|鯰 鲶|鯱 𩾇|鯴 鲺|鯶 𩽼|鯷 鳀|鯻 𬶟|鯽 鲫|鯾 𫚣|鯿 鳊|鰁 鳈|鰂 鲗|鰃 鳂|鰆 䲠|鰈 鲽|鰉 鳇|鰊 𬶠|鰋 𫚢|鰌 䲡|鰍 鳅|鰏 鲾|鰐 鳄|鰑 𫚊|鰒 鳆|鰓 鳃|鰕 𫚥|鰛 鳁|鰜 鳒|鰟 鳑|鰠 鳋|鰣 鲥|鰤 𫚕|鰥 鳏|鰦 𫚤|鰧 䲢|鰨 鳎|鰩 鳐|鰫 𫚦|鰭 鳍|鰮 鳁|鰱 鲢|鰲 鳌|鰳 鳓|鰵 鳘|鰶 𬶭|鰷 鲦|鰹 鲣|鰺 鲹|鰻 鳗|鰼 鳛|鰽 𫚧|鰾 鳔|鱀 𬶨|鱂 鳉|鱄 𫚋|鱅 鳙|鱆 𫠒|鱇 𩾌|鱈 鳕|鱉 鳖|鱊 𫚪|鱒 鳟|鱔 鳝|鱖 鳜|鱗 鳞|鱘 鲟|鱚 𬶮|鱝 鲼|鱟 鲎|鱠 鲙|鱢 𫚫|鱣 鳣|鱤 鳡|鱧 鳢|鱨 鲿|鱭 鲚|鱮 𫚈|鱯 鳠|鱲 𫚭|鱷 鳄|鱸 鲈|鱺 鲡|鳥 鸟|鳧 凫|鳩 鸠|鳬 凫|鳲 鸤|鳳 凤|鳴 鸣|鳶 鸢|鳷 𫛛|鳼 𪉃|鳽 𫛚|鳾 䴓|鴀 𫛜|鴃 𫛞|鴅 𫛝|鴆 鸩|鴇 鸨|鴉 鸦|鴐 𫛤|鴒 鸰|鴔 𫛡|鴕 鸵|鴗 𫁡|鴛 鸳|鴜 𪉈|鴝 鸲|鴞 鸮|鴟 鸱|鴣 鸪|鴥 𫛣|鴦 鸯|鴨 鸭|鴮 𫛦|鴯 鸸|鴰 鸹|鴲 𪉆|鴳 𫛩|鴴 鸻|鴷 䴕|鴻 鸿|鴽 𫛪|鴿 鸽|鵁 䴔|鵂 鸺|鵃 鸼|鵊 𫛥|鵏 𬷕|鵐 鹀|鵑 鹃|鵒 鹆|鵓 鹁|鵚 𪉍|鵜 鹈|鵝 鹅|鵟 𫛭|鵠 鹄|鵡 鹉|鵧 𫛨|鵩 𫛳|鵪 鹌|鵫 𫛱|鵬 鹏|鵮 鹐|鵯 鹎|鵰 雕|鵲 鹊|鵷 鹓|鵾 鹍|鶄 䴖|鶇 鸫|鶉 鹑|鶊 鹒|鶌 𫛵|鶒 𫛶|鶓 鹋|鶖 鹙|鶗 𫛸|鶘 鹕|鶚 鹗|鶠 𬸘|鶡 鹖|鶥 鹛|鶦 𫛷|鶩 鹜|鶪 䴗|鶬 鸧|鶭 𫛯|鶯 莺|鶰 𫛫|鶱 𬸣|鶲 鹟|鶴 鹤|鶹 鹠|鶺 鹡|鶻 鹘|鶼 鹣|鶿 鹚|鷀 鹚|鷁 鹢|鷂 鹞|鷄 鸡|鷅 𫛽|鷉 䴘|鷊 鹝|鷐 𫜀|鷓 鹧|鷔 𪉑|鷖 鹥|鷗 鸥|鷙 鸷|鷚 鹨|鷟 𬸦|鷣 𫜃|鷤 𫛴|鷥 鸶|鷦 鹪|鷨 𪉊|鷩 𫜁|鷫 鹔|鷭 𬸪|鷯 鹩|鷲 鹫|鷳 鹇|鷴 鹇|鷷 𫜄|鷸 鹬|鷹 鹰|鷺 鹭|鷽 鸴|鷿 𬸯|鸂 㶉|鸇 鹯|鸊 䴙|鸋 𫛢|鸌 鹱|鸏 鹲|鸑 𬸚|鸕 鸬|鸗 𫛟|鸘 鹴|鸚 鹦|鸛 鹳|鸝 鹂|鸞 鸾|鹵 卤|鹹 咸|鹺 鹾|鹼 碱|鹽 盐|麗 丽|麥 麦|麨 𪎊|麩 麸|麪 面|麫 面|麬 𤿲|麯 曲|麲 𪎉|麳 𪎌|麴 曲|麵 面|麷 𫜑|麼 么|麽 么|黃 黄|黌 黉|點 点|黨 党|黲 黪|黴 霉|黶 黡|黷 黩|黽 黾|黿 鼋|鼂 鼌|鼉 鼍|鼕 冬|鼴 鼹|齊 齐|齋 斋|齎 赍|齏 齑|齒 齿|齔 龀|齕 龁|齗 龂|齘 𬹼|齙 龅|齜 龇|齟 龃|齠 龆|齡 龄|齣 出|齦 龈|齧 啮|齩 𫜪|齪 龊|齬 龉|齭 𫜭|齮 𬺈|齯 𫠜|齰 𫜬|齲 龋|齴 𫜮|齶 腭|齷 龌|齼 𬺓|齾 𫜰|龍 龙|龎 厐|龐 庞|龑 䶮|龓 𫜲|龔 龚|龕 龛|龜 龟|龭 𩨎|龯 𨱆|鿁 䜤|鿓 鿒|𠁞 𠀾|𠌥 𠆿|𠏢 𠉗|𠐊 𫝋|𠗣 㓆|𠞆 𠛆|𠠎 𠚳|𠬙 𪠡|𠽃 𪠺|𠿕 𪜎|𡂡 𪢒|𡃄 𪡺|𡃕 𠴛|𡃤 𪢐|𡄔 𠴢|𡄣 𠵸|𡅏 𠲥|𡅯 𪢖|𡑍 𫭼|𡑭 𡋗|𡓁 𪤄|𡓾 𡋀|𡔖 𡍣|𡞵 㛟|𡟫 𫝪|𡠹 㛿|𡢃 㛠|𡮉 𡭜|𡮣 𡭬|𡳳 𡳃|𡸗 𪨩|𡹬 𪨹|𡻕 岁|𡽗 𡸃|𡾱 㟜|𡿖 𪩛|𢍰 𪪴|𢠼 𢙑|𢣐 𪬚|𢣚 𢘝|𢣭 𢘞|𢤩 𪫡|𢤱 𢘙|𢤿 𪬯|𢯷 𪭝|𢶒 𪭯|𢶫 𢫞|𢷮 𢫊|𢹿 𢬦|𢺳 𪮳|𣈶 暅|𣋋 𣈣|𣍐 𫧃|𣙎 㭣|𣜬 𪳗|𣝕 𣘷|𣞻 𣘓|𣠩 𣞎|𣠲 𣑶|𣯩 𣯣|𣯴 𣭤|𣯶 毶|𣽏 𪶮|𣾷 㳢|𣿉 𣶫|𤁣 𣺽|𤄷 𪶒|𤅶 𣷷|𤑳 𤎻|𤑹 𪹀|𤒎 𤊀|𤒻 𪹹|𤓌 𪹠|𤓎 𤎺|𤓩 𤊰|𤘀 𪺣|𤛮 𤙯|𤛱 𫞢|𤜆 𪺪|𤠮 𪺸|𤢟 𤝢|𤢻 𢢐|𤩂 𫞧|𤪺 㻘|𤫩 㻏|𤬅 𪼴|𤳷 𪽝|𤳸 𤳄|𤷃 𪽭|𤸫 𤶧|𤺔 𪽴|𥊝 𥅿|𥌃 𥅘|𥏝 𪿊|𥕥 𥐰|𥖅 𥐯|𥖲 𪿞|𥗇 𪿵|𥗽 𬒗|𥜐 𫀓|𥜰 𫀌|𥞵 𥞦|𥢢 䅪|𥢶 𫞷|𥢷 𫀮|𥨐 𥧂|𥪂 𥩺|𥯤 𫁳|𥴨 𫂖|𥴼 𫁺|𥵃 𥱔|𥵊 𥭉|𥶽 𫁱|𥸠 𥮋|𥻦 𫂿|𥼽 𥹥|𥽖 𥺇|𥾯 𫄝|𥿊 𦈈|𦀖 𫄦|𦂅 𦈒|𦃄 𦈗|𦃩 𫄯|𦅇 𫄪|𦅈 𫄵|𦆲 𫟇|𦒀 𫅥|𦔖 𫅼|𦘧 𡳒|𦟼 𫆝|𦠅 𫞅|𦡝 𫆫|𦢈 𣍨|𦣎 𦟗|𦧺 𫇘|𦪙 䑽|𦪽 𦨩|𦱌 𫇪|𦾟 𦶻|𧎈 𧌥|𧒯 𫊹|𧔥 𧒭|𧕟 𧉐|𧜗 䘞|𧜵 䙊|𧝞 䘛|𧞫 𫌋|𧟀 𧝧|𧡴 𫌫|𧢄 𫌬|𧦝 𫍞|𧦧 𫍟|𧩕 𫍭|𧩙 䜥|𧩼 𫍶|𧫝 𫍺|𧬤 𫍼|𧭈 𫍾|𧭹 𫍐|𧳟 𧳕|𧵳 䞌|𧶔 𧹓|𧶧 䞎|𧷎 𪠀|𧸘 𫎨|𧹈 𪥠|𧽯 𫎸|𨂐 𫏌|𨄣 𨀱|𨅍 𨁴|𨆪 𫏕|𨇁 𧿈|𨇞 𨅫|𨇤 𫏨|𨇰 𫏞|𨇽 𫏑|𨈊 𨂺|𨈌 𨄄|𨊰 䢀|𨊸 䢁|𨊻 𨐆|𨋢 䢂|𨌈 𫐍|𨍰 𫐔|𨎌 𫐋|𨎮 𨐉|𨏠 𨐇|𨏥 𨐊|𨞺 𫟫|𨟊 𫟬|𨢿 𨡙|𨣈 𨡺|𨣞 𨟳|𨣧 𨠨|𨤻 𨤰|𨥛 𨱀|𨥟 𫓫|𨦫 䦀|𨧀 𬭊|𨧜 䦁|𨧰 𫟽|𨧱 𨱊|𨨏 𬭛|𨨛 𫓼|𨨢 𫓿|𨩰 𫟾|𨪕 𫓮|𨫒 𨱐|𨬖 𫔏|𨭆 𬭶|𨭎 𬭳|𨭖 𫔑|𨭸 𫔐|𨮂 𨱕|𨮳 𫔒|𨯅 䥿|𨯟 𫔓|𨰃 𫔉|𨰋 𫓳|𨰥 𫔕|𨰲 𫔃|𨲳 𫔖|𨳑 𨸁|𨳕 𨸀|𨴗 𨸅|𨴹 𫔲|𨵩 𨸆|𨵸 𨸇|𨶀 𨸉|𨶏 𨸊|𨶮 𨸌|𨶲 𨸋|𨷲 𨸎|𨼳 𫔽|𨽏 𨸘|𩀨 𫕚|𩅙 𫕨|𩎖 𫖑|𩎢 𩏾|𩏂 𫖓|𩏠 𫖖|𩏪 𩏽|𩏷 𫃗|𩑔 𫖪|𩒎 𫖭|𩓣 𩖕|𩓥 𫖵|𩔑 𫖷|𩔳 𫖴|𩖰 𫠇|𩗀 𩙦|𩗓 𫗈|𩗴 𫗉|𩘀 𩙩|𩘝 𩙭|𩘹 𩙨|𩘺 𩙬|𩙈 𩙰|𩚛 𩟿|𩚥 𩠀|𩚩 𫗡|𩚵 𩠁|𩛆 𩠂|𩛌 𫗤|𩛡 𫗨|𩛩 𩠃|𩜇 𩠉|𩜦 𩠆|𩜵 𩠊|𩝔 𩠋|𩝽 𫗳|𩞄 𩠎|𩞦 𩠏|𩞯 䭪|𩟐 𩠅|𩟗 𫗚|𩠴 𩠠|𩡣 𩡖|𩡺 𩧦|𩢡 𩧬|𩢴 𩧵|𩢸 𩧳|𩢾 𩧮|𩣏 𩧶|𩣑 䯃|𩣫 𩧸|𩣵 𩧻|𩣺 𩧼|𩤊 𩧩|𩤙 𩨆|𩤲 𩨉|𩤸 𩨅|𩥄 𩨋|𩥇 𩨍|𩥉 𩧱|𩥑 𩨌|𩦠 𫠌|𩧆 𩨐|𩭙 𩬣|𩯁 𫙂|𩯳 𩯒|𩰀 𩬤|𩰹 𩰰|𩳤 𩲒|𩴵 𩴌|𩵦 𫠏|𩵩 𩽺|𩵹 𩽻|𩶁 𫚎|𩶘 䲞|𩶰 𩽿|𩶱 𩽽|𩷰 𩾄|𩸃 𩾅|𩸄 𫚝|𩸡 𫚟|𩸦 𩾆|𩻗 𫚨|𩻬 𫚩|𩻮 𫚘|𩼶 𫚬|𩽇 𩾎|𩿅 𫠖|𩿤 𫛠|𩿪 𪉄|𪀖 𫛧|𪀦 𪉅|𪀾 𪉋|𪁈 𪉉|𪁖 𪉌|𪂆 𪉎|𪃍 𪉐|𪃏 𪉏|𪃒 𫛻|𪃧 𫛹|𪄆 𪉔|𪄕 𪉒|𪅂 𫜂|𪆷 𫛾|𪇳 𪉕|𪈼 𱊜|𪉸 𫜊|𪋿 𫧮|𪌭 𫜓|𪍠 𫜕|𪓰 𫜟|𪔵 𪔭|𪘀 𪚏|𪘯 𪚐|𪙏 𫜯|𪟖 𠛾|𪷓 𣶭|𫒡 𫓷|𫜦 𫜫";

  var TSPhrases = "一目瞭然 一目了然|上鍊 上链|不瞭解 不了解|么麼 幺麽|么麽 幺麽|乾乾淨淨 干干净净|乾乾脆脆 干干脆脆|乾元 乾元|乾卦 乾卦|乾嘉 乾嘉|乾圖 乾图|乾坤 乾坤|乾坤一擲 乾坤一掷|乾坤再造 乾坤再造|乾坤大挪移 乾坤大挪移|乾宅 乾宅|乾斷 乾断|乾旦 乾旦|乾曜 乾曜|乾清宮 乾清宫|乾盛世 乾盛世|乾紅 乾红|乾綱 乾纲|乾縣 乾县|乾象 乾象|乾造 乾造|乾道 乾道|乾陵 乾陵|乾隆 乾隆|乾隆年間 乾隆年间|乾隆皇帝 乾隆皇帝|二噁英 二𫫇英|以免藉口 以免借口|以功覆過 以功复过|侔德覆載 侔德复载|傢俱 家具|傷亡枕藉 伤亡枕藉|八濛山 八濛山|凌藉 凌借|出醜狼藉 出丑狼藉|函覆 函复|千鍾粟 千锺粟|反反覆覆 反反复复|反覆 反复|反覆思維 反复思维|反覆思量 反复思量|反覆性 反复性|名覆金甌 名复金瓯|哪吒 哪吒|回覆 回复|壺裏乾坤 壶里乾坤|大目乾連冥間救母變文 大目乾连冥间救母变文|宫商角徵羽 宫商角徵羽|射覆 射复|尼乾陀 尼乾陀|幺麼 幺麽|幺麼小丑 幺麽小丑|幺麼小醜 幺麽小丑|康乾 康乾|張法乾 张法乾|彷彿 仿佛|彷徨 彷徨|徵弦 徵弦|徵絃 徵弦|徵羽摩柯 徵羽摩柯|徵聲 徵声|徵調 徵调|徵音 徵音|情有獨鍾 情有独钟|憑藉 凭借|憑藉着 凭借着|手鍊 手链|扭轉乾坤 扭转乾坤|找藉口 找借口|拉鍊 拉链|拉鍊工程 拉链工程|拜覆 拜复|據瞭解 据了解|文錦覆阱 文锦复阱|於世成 於世成|於乎 於乎|於仲完 於仲完|於倫 於伦|於其一 於其一|於則 於则|於勇明 於勇明|於呼哀哉 於呼哀哉|於單 於单|於坦 於坦|於崇文 於崇文|於忠祥 於忠祥|於惟一 於惟一|於戲 於戏|於敖 於敖|於梨華 於梨华|於清言 於清言|於潛 於潜|於琳 於琳|於穆 於穆|於竹屋 於竹屋|於菟 於菟|於邑 於邑|於陵子 於陵子|旋乾轉坤 旋乾转坤|旋轉乾坤 旋转乾坤|旋轉乾坤之力 旋转乾坤之力|明瞭 明了|明覆 明复|書中自有千鍾粟 书中自有千锺粟|有序 有序|朝乾夕惕 朝乾夕惕|木吒 木吒|李乾德 李乾德|李澤鉅 李泽钜|李鍊福 李链福|李鍾郁 李锺郁|樊於期 樊於期|沈沒 沉没|沈沒成本 沉没成本|沈積 沉积|沈船 沉船|沈默 沉默|流徵 流徵|浪蕩乾坤 浪荡乾坤|滑藉 滑借|無序 无序|牴牾 抵牾|牴觸 抵触|狐藉虎威 狐借虎威|珍珠項鍊 珍珠项链|甚鉅 甚钜|申覆 申复|畢昇 毕昇|發覆 发复|瞭如 了如|瞭如指掌 了如指掌|瞭望 瞭望|瞭然 了然|瞭然於心 了然于心|瞭若指掌 了若指掌|瞭解 了解|瞭解到 了解到|示覆 示复|神祇 神祇|稟覆 禀复|答覆 答复|篤麼 笃麽|簡單明瞭 简单明了|籌畫 筹划|素藉 素借|老態龍鍾 老态龙钟|肘手鍊足 肘手链足|茵藉 茵借|萬鍾 万锺|蒜薹 蒜薹|蕓薹 芸薹|蕩覆 荡复|蕭乾 萧乾|藉代 借代|藉以 借以|藉助 借助|藉助於 借助于|藉卉 借卉|藉口 借口|藉喻 借喻|藉寇兵 借寇兵|藉寇兵齎盜糧 借寇兵赍盗粮|藉手 借手|藉據 借据|藉故 借故|藉故推辭 借故推辞|藉方 借方|藉條 借条|藉槁 借槁|藉機 借机|藉此 借此|藉此機會 借此机会|藉甚 借甚|藉由 借由|藉着 借着|藉端 借端|藉端生事 借端生事|藉箸代籌 借箸代筹|藉草枕塊 借草枕块|藉藉 藉藉|藉藉无名 藉藉无名|藉詞 借词|藉讀 借读|藉資 借资|衹得 只得|衹見樹木 只见树木|衹見樹木不見森林 只见树木不见森林|袖裏乾坤 袖里乾坤|覆上 复上|覆住 复住|覆信 复信|覆冒 复冒|覆呈 复呈|覆命 复命|覆墓 复墓|覆宗 复宗|覆帳 复帐|覆幬 复帱|覆成 复成|覆按 复按|覆文 复文|覆杯 复杯|覆校 复校|覆瓿 复瓿|覆盂 复盂|覆盆 覆盆|覆盆子 覆盆子|覆盤 覆盘|覆育 复育|覆蕉尋鹿 复蕉寻鹿|覆逆 复逆|覆醢 复醢|覆醬瓿 复酱瓿|覆電 复电|覆露 复露|覆鹿尋蕉 复鹿寻蕉|覆鹿遺蕉 复鹿遗蕉|覆鼎 复鼎|見覆 见复|角徵 角徵|角徵羽 角徵羽|計畫 计划|變徵 变徵|變徵之聲 变徵之声|變徵之音 变徵之音|貂覆額 貂复额|買臣覆水 买臣复水|踅門瞭戶 踅门了户|躪藉 躏借|郭子乾 郭子乾|酒逢知己千鍾少 酒逢知己千锺少|酒逢知己千鍾少話不投機半句多 酒逢知己千锺少话不投机半句多|醞藉 酝借|重覆 重复|金吒 金吒|金鍊 金链|鈞覆 钧复|鉅子 钜子|鉅萬 钜万|鉅防 钜防|鉸鍊 铰链|銀鍊 银链|錢鍾書 钱锺书|鍊墜 链坠|鍊子 链子|鍊形 链形|鍊條 链条|鍊錘 链锤|鍊鎖 链锁|鍛鍾 锻锺|鍾繇 钟繇|鍾萬梅 锺万梅|鍾重發 锺重发|鍾鍛 锺锻|鍾馗 锺馗|鎖鍊 锁链|鐵鍊 铁链|鑽石項鍊 钻石项链|雁杳魚沈 雁杳鱼沉|雖覆能復 虽覆能复|電覆 电复|露覆 露复|項鍊 项链|頗覆 颇复|頸鍊 颈链|顛乾倒坤 颠乾倒坤|顛倒乾坤 颠倒乾坤|顧藉 顾借|麼些族 麽些族|黄鍾公 黄锺公|龍鍾 龙钟";

  var to_cn = [TSCharacters, TSPhrases];

  const fromDicts = {
      hk: from_hk,
      tw: from_tw,
      twp: from_twp,
      jp: from_jp
  };

  const toDicts = {
      cn: to_cn
  };

  var Locale = /*#__PURE__*/Object.freeze({
    __proto__: null,
    from: fromDicts,
    to: toDicts
  });

  const Converter = ConverterBuilder(Locale);

  exports.Converter = Converter;
  exports.ConverterFactory = ConverterFactory;
  exports.CustomConverter = CustomConverter;
  exports.HTMLConverter = HTMLConverter;
  exports.Locale = Locale;
  exports.Trie = Trie;

}));

/* AllinPay interactive prototype. No network requests or production authentication. */
(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const flat=n=>[n,...(n.c||[]).flatMap(flat)], forms=FIGMA_DATA.forms;
const steps=['主體資料','經營與聯繫','結算帳戶','產品與費率','文件材料','確認提交'];
function rowKey(row){return row?.id||row?.['公司 MID']||'';} const storageKey='allinpay-demo-v1';
const state={values:{},checks:{},files:{},people:{directors:1,authSigners:1,shareHolders:1},emailVerified:false,errors:{},drafts:[],fail:false,selected:new Set(['M000238','M000531']),revealed:new Set(),search:'',searchScope:'全部欄位',status:'全部狀態',page:1,noticeCount:3,editing:null};
try{state.drafts=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(state.drafts))state.drafts=[]}catch{state.drafts=[]}
const formFields=forms.flatMap(f=>f.sections.flatMap(s=>s.fields));
const options={legalStatus:['法人團體 · Body Corporate','個人 · Individual','合夥 · Partnership','非屬法團 · Unincorporated Body'],merchantType:['GENERAL 普通','GROUP 集團'],registerCertType:['01 營業執照／BR','02 事業單位法人證書','03 身份證','04 其他'],threeCertFlag:['1 是','0 否'],registerCapital:['100 萬以下','100–500 萬','500–1,000 萬','1,000 萬以上'],licencePeriod:['1 年以下','1–3 年','3–5 年','5–10 年','10 年以上'],workerNumber:['1–10 人','11–50 人','51–100 人','100 人以上'],idcardType:['身份證','護照','港澳通行證','台灣通行證','居住證','臨時身份證','其他'],addrCountryCode:['HKG 中國香港','CHN 中國內地','SGP 新加坡'],cardCountryCode:['HKG 中國香港','CHN 中國內地','SGP 新加坡'],addrProvinceCode:['香港','九龍','新界','廣東省','新加坡'],cardProvinceCode:['香港','九龍','新界','廣東省','新加坡'],addrCityCode:['中西區','灣仔區','觀塘區','沙田區','深圳市','廣州市','新加坡'],cardCityCode:['中西區','灣仔區','觀塘區','沙田區','深圳市','廣州市','新加坡'],signType:['01 線上簽約','00 線下簽約'],settlePeriod:['T2（系統決定）'],currency:['HKD 港元','USD 美元','CNY 人民幣','SGD 新加坡元'],cardType:['00 借記卡','01 存摺'],cardBankCode:['004 香港上海滙豐銀行','012 中國銀行（香港）','024 恒生銀行','003 渣打銀行（香港）','015 東亞銀行'],isCompay:['Y 對公','N 對私'],handleClear:['N 否','Y 是'],chargeType:['BLENDED 混合型','IC++ 交換費加成型'],refundFeeFlag:['N 不退','Y 退還'],connectType:['託管支付頁','直連 CNP'],tokenCreateWay:['自動建立','由商戶建立'],chargeWay:['按筆扣費','月結扣費']};
Object.assign(options,{
 registerCapital:['少於10萬','10–20萬','20–50萬','50–100萬','100萬以上'],licencePeriod:['少於1年','1–3年','3–5年','5年以上'],workerNumber:['少於10人','10–20','20–50','50–100','100以上'],
 addrCountryCode:['HKG 中國香港','CHN 中國內地','MAC 中國澳門','SGP 新加坡','USA 美國','GBR 英國'],cardCountryCode:['HKG 中國香港','CHN 中國內地','SGP 新加坡','USA 美國','GBR 英國'],
 currency:['HKD 港元','CNY 人民幣','USD 美元','CAD 加元','EUR 歐元','GBP 英鎊','JPY 日圓','TWD 新台幣','AUD 澳元'],cardType:['00 借記卡','01 存摺','02 信用卡','03 準貸記卡','04 預消費卡','05 境外卡'],
 chargeType:['BLENDED 混合型','REGIONAL 區域型','WALLET 電子錢包','INTERCHANGE 交換費率'],connectType:['1 跳轉','0 直連'],tokenCreateWay:['1 跳轉','0 直連'],chargeWay:['預付費','餘額扣費','按月結算']
});
const readOnly=new Set(['settlePeriod','riskLevel','merchantAgreementNum']);
function defaults(){for(const f of formFields){if(f.type==='Select'&&!/^請/.test(f.placeholder))state.values[f.id]=f.placeholder;if(readOnly.has(f.id))state.values[f.id]=f.placeholder}for(const c of forms.flatMap(f=>f.sections.flatMap(s=>s.checks)))state.checks[c.id]=c.checked;state.checks['613:4956']=false}
defaults();
const table=flat(FIGMA_DATA.trees[1]).find(n=>n.n==='Excel Company Data Table');
const headers=table.c[0].c.map(c=>c.c[0].text);
const sourceRows=table.c.slice(1).map(r=>{const row={};r.c.forEach((c,i)=>{const all=flat(c);row[headers[i]]=all.find(n=>n.text)?.text||'';if(headers[i]==='商戶狀態')row.status=all.find(n=>n.props?.Status)?.props.Status;if(headers[i]==='銀行帳號'){const p=all.find(n=>n.props?.['Full account#464:5'])?.props;row.bank=p?.['Full account#464:5'];row['銀行帳號']=p?.['Masked account#464:4']?.replace(/\d{4}(?= \d{4}$)/,'****')}});return row});
const rows=Array.from({length:120},(_,i)=>i<5?{...sourceRows[i]}:{...sourceRows[i%5],'客戶中文名稱':sourceRows[i%5]['客戶中文名稱']+'（示例 '+(i+1)+'）','公司 MID':'DEMO'+String(i+1).padStart(4,'0'),'DBA no.':'DEMO-'+(i+1)});
const statusNames={Synced:'已同步至 All-In Pay',Approved:'通過審核',Draft:'草稿',Disabled:'停用',Enabled:'已啟用',Pending:'待審核'};
const statusColors={Synced:'blue',Approved:'purple',Draft:'',Disabled:'red',Enabled:'green',Pending:'amber'};
const btn=(text,action,cls='',extra='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const pill=(name,cls='')=>`<span class="pill ${cls}">${esc(name)}</span>`;
function route(){const p=location.hash.slice(2).split('/');return {page:p[0]||'dashboard',step:Math.max(1,Math.min(6,Number(p[1])||1))}}
function go(path){if(location.hash==='#/'+path)render();else location.hash='/'+path;window.scrollTo(0,0)}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3500)}
function modal(title,body,actions=btn('確定','close','primary')){$('#modal').innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2>${btn('關閉','close')}</div><div class="modal-body">${body}</div><div class="modal-foot">${actions}</div>`;if(!$('#modal').open)$('#modal').showModal()}
const scopeMessage=()=>modal('示例功能','<p>此項為儀表板資訊展示，目前未連接實際待辦、統計或外部服務。</p><p class="hint">可使用側欄進入商戶管理、新增商戶、帳號管理及草稿等互動流程。</p>');
function sidebar(page){return `<aside class="sidebar" aria-label="主選單"><a class="brand" href="#/dashboard" aria-label="ALLINPAY 儀表板"><img src="azure-logo.png" alt="Azure"><small>Application Agency System</small></a><div class="nav-label">主選單</div><a class="nav-link ${page==='dashboard'?'active':''}" href="#/dashboard"><img src="dashboard-icon.svg" alt="">儀表板</a><div class="nav-link"><img src="merchant-icon.svg" alt="">商戶入網 <span style="margin-left:auto">⌄</span></div><a class="nav-link sub ${page==='application'?'active':''}" href="#/application/1">新增商戶</a>${btn('批量導入','scope','nav-link sub')}<a class="nav-link sub ${page==='merchants'?'active':''}" href="#/merchants">商戶管理 ${state.noticeCount?`<span class="badge" title="${state.noticeCount} 筆新加入或修改">${state.noticeCount}</span>`:''}</a>${btn('查閱更新記錄','activity','nav-link sub')}<div class="nav-divider"></div>${btn('<img src="d0541.svg" alt="">帳號管理','scope','nav-link')}<a class="nav-link ${page==='drafts'?'active':''}" href="#/drafts"><img src="f57a5.svg" alt="">已儲存的草稿</a><div class="sidebar-bottom"><div class="user-name">MR STEPHEN LI</div><div>最高管理員 · Demo</div><div>繁體中文</div>${btn('設定','settings')}${btn('登出','logout')}</div></aside>`}
function tabs(page){return page==='dashboard'||page==='drafts'?'':`<nav class="tabs" aria-label="工作頁籤"><a href="#/dashboard">⌂</a><a href="#/dashboard">交易量統計</a><a class="${page==='merchants'?'active':''}" href="#/merchants">商戶管理</a>${page==='application'?'<a class="active" href="#/application/1">新增客戶</a>':''}</nav>`}
function demoBar(form=false){return `<div class="demo-bar"><span>DEMO · ${form?'BR 可本機辨識，其餘業務流程為示例':'使用模擬業務資料，未連接正式系統'}</span>${form?btn('填入完整示例','sample')+btn('清空表單','clear-form'):''}<label style="margin-left:auto"><input type="checkbox" id="simulate-failure" ${state.fail?'checked':''}>模擬儲存／提交失敗</label></div>`}
function dashboard(){return `<div class="page-heading"><h1>儀表板</h1><p>營運總覽 · 優先處理風險、待辦及重點商戶。所有數據為模擬示例。</p></div>${demoBar()}<div class="toolbar"><select aria-label="統計日期範圍" style="width:290px" id="dashboard-range"><option>最近 30 天 · 2026/08/16–09/14</option><option>最近 7 天 · 2026/09/08–09/14</option></select><span class="hint grow">資料範圍：全部商戶 · 更新於 12:30（模擬）</span>${btn('新增商戶','new','primary')}</div><div class="metrics">${[['商戶總數','120','本月新增 16 間'],['待審核','18','其中 4 間已等待超過 2 天'],['待補資料','9','其中 3 間為重點商戶'],['同步失敗','3','請核對失敗原因後重試']].map((m,i)=>`<button class="metric" data-action="metric" data-index="${i}"><span>${m[0]}</span><strong data-metric="${i}">${m[1]}</strong><small>${m[2]}</small></button>`).join('')}</div><div class="dashboard-grid"><section class="card"><h2>優先待辦 <span class="muted">Priority Actions</span></h2><p class="hint">依處理急迫程度排序。點擊「處理」可進入相關資料頁面。</p>${[['緊急','red','同步失敗','3 間商戶等待重新同步，優先確認銀行資料及驗證結果。','sync-task'],['即將到期','amber','證照提醒','7 間商戶的 BR／CR 將於 30 日內到期。','expiry-task'],['待跟進','blue','審核與補件','18 間待審核；9 間待補資料。','review-task'],['可續填','','尚未提交草稿','11 份草稿尚未完成，最近一份更新於今天 11:40。','drafts']].map(m=>`<div class="task-row">${pill(m[0],m[1])}<div class="task-copy"><h3>${m[2]}</h3><p>${m[3]}</p></div>${btn('處理',m[4])}</div>`).join('')}</section><section class="card"><h2>VIP／重點商戶 <span class="muted">Key Accounts</span></h2><p class="hint">以需要優先跟進的商戶為主，顯示負責人、風險提示及下一步。以下為重點名單示例。</p>${[['海港科技有限公司','陳偉明','待補銀行月結單','今天跟進 · 優先'],['新星零售有限公司','李志豪','BR 將於 14 日後到期','9/16 前聯絡'],['城市精選有限公司','張家輝','新服務申請待審核','待審核 · 2 天']].map((m,i)=>`<div class="task-row"><div class="task-copy"><h3>${m[0]}</h3><p>負責人：${m[1]}</p><p>${m[2]} · ${m[3]}</p></div>${btn('查看商戶','detail','',`data-mid="${sourceRows[i]['公司 MID']}"`)}</div>`).join('')}</section></div><section class="card activity"><h2>最新動態 <span class="muted">Recent Activity</span></h2><p class="hint">保留關鍵操作紀錄，方便交接及追蹤。</p>${['12:18　林嘉欣更新海港科技有限公司的聯絡資料','11:52　黃嘉敏完成 2 間商戶的資料審核','11:40　陳偉明儲存一份新商戶草稿','10:26　系統發現 3 間商戶同步失敗，等待處理'].map(t=>`<p>${t}</p>`).join('')}</section><p class="hint">僅顯示登入者有權查看的商戶、數字及操作記錄；代理商登入後改為自己的資料範圍。</p>`}
function labelHTML(label){const [zh,...en]=String(label||'').split(/\s{2,}/);return esc(zh).replace('*','<span class="required">*</span>')+(en.length?`<span class="en">${esc(en.join(' '))}</span>`:'')}
function fieldOptions(f){
 const bank=f.id.startsWith('card'),country=state.values[bank?'cardCountryCode':'addrCountryCode']||'HKG',province=state.values[bank?'cardProvinceCode':'addrProvinceCode'];
 if(/ProvinceCode$/.test(f.id))return country.startsWith('HKG')?['香港','九龍','新界']:country.startsWith('CHN')?['廣東省','上海市','北京市']:country.startsWith('SGP')?['新加坡']:country.startsWith('MAC')?['澳門']:country.startsWith('USA')?['California','New York']:['England','Scotland'];
 if(/CityCode$/.test(f.id))return country.startsWith('HKG')?(province==='九龍'?['觀塘區','油尖旺區','九龍城區']:province==='新界'?['沙田區','荃灣區','屯門區']:['中西區','灣仔區','東區','南區']):country.startsWith('CHN')?(province==='廣東省'?['深圳市','廣州市']:province==='上海市'?['上海市']:['北京市']):country.startsWith('SGP')?['新加坡']:country.startsWith('MAC')?['澳門']:country.startsWith('USA')?['San Francisco','New York']:['London','Edinburgh'];
 return options[f.id]||options[f.id.split('.').pop()]||['是','否'];
}
function field(f,index=0){const key=f.id.replace('[]',`[${index}]`), saved=state.values[key]??state.values[f.id]??'', id='field-'+key.replace(/[^\w-]/g,'-'),err=state.errors[key];const type=f.placeholder==='YYYY/MM/DD'?'date':/Email$/.test(f.id)?'email':/Phone$/.test(f.id)?'tel':/webUrl/.test(f.id)?'url':'text';let control;
if(f.id==='cardBankCode'){control=`<input id="${id}" data-field="${esc(key)}" list="bank-codes" value="${esc(saved)}" placeholder="搜尋香港銀行代碼／名稱"><datalist id="bank-codes">${options.cardBankCode.map(o=>`<option value="${esc(o)}"></option>`).join('')}</datalist>`}
else if(f.type==='Select'){const opts=fieldOptions(f);const list=[...new Set([...(saved?[saved]:[]),...opts])];control=`<select id="${id}" name="${esc(key)}" data-field="${esc(key)}" ${readOnly.has(f.id)?'disabled':''} ${err?'aria-invalid="true"':''}><option value="">${esc(/^請/.test(f.placeholder)?f.placeholder:'請選擇')}</option>${list.map(v=>`<option ${v===saved?'selected':''}>${esc(v)}</option>`).join('')}</select>`}
else control=`<input id="${id}" name="${esc(key)}" data-field="${esc(key)}" type="${type}" placeholder="${esc(f.placeholder)}" value="${esc(type==='date'?saved.replaceAll('/','-'):saved)}" ${readOnly.has(f.id)?'readonly':''} ${err?'aria-invalid="true"':''} ${f.id==='cardNo'?'inputmode="numeric"':''}>`;
return `<div class="field ${err?'invalid':''}" data-field-wrap="${esc(key)}"><label for="${id}">${labelHTML(f.label)}</label>${control}${f.hint?`<div class="hint">${esc(f.hint)}</div>`:''}${f.id==='contactEmail'?btn(state.emailVerified?'已驗證（模擬）':'驗證電郵（模擬）','verify-email','mini-action'):''}${err?`<div class="error" role="alert">${esc(err)}</div>`:''}</div>`}
function check(c){return `<label class="check"><input type="checkbox" data-check="${c.id}" ${state.checks[c.id]?'checked':''} ${/不適用|不支援/.test(c.label)?'disabled':''}>${esc(c.label)}</label>`}
function application(step){const schema=forms[step-1];return `${demoBar(true)}${state.editing?`<div class="notice">正在編輯 ${esc(state.editing)} 的模擬資料；不會更新正式系統。</div>`:''}${state.errors._form?`<div class="notice error" role="alert">${esc(state.errors._form)}</div>`:''}${step===6?review():schema.sections.map((s,si)=>section(s,step,si)).join('')}`}
function section(s,step,si){let content='';const repeat=s.fields[0]?.id.includes('[]');const conditional=s.name.includes('中國內地');let lead='';if(conditional&&!(state.values.addrCountryCode||'').startsWith('CHN'))lead='<div class="notice">目前業務所在地為非中國內地，以下為條件欄位，可留空。</div>';
if(repeat){const group=s.fields[0].id.split('[')[0];for(let i=0;i<state.people[group];i++)content+=`<div class="repeat"><div class="repeat-heading"><span>${s.name} ${i+1}</span>${state.people[group]>1?btn('移除此人','remove-person','danger',`data-group="${group}" data-index="${i}"`):''}</div><div class="grid">${s.fields.map(f=>field(f,i)).join('')}</div></div>`;content+=btn('＋ 新增一位','add-person','add-person',`data-group="${group}"`)+' <span class="hint">制裁／PEP 篩查：待檢查（Demo 不執行真實篩查）</span>'}
else if(s.fields.length)content=`<div class="grid ${conditional?'four':''}">${s.fields.map(f=>field(f)).join('')}</div>`;
if(s.checks.length){if(s.name.includes('SME'))content+=check(s.checks[0])+`<div class="grid" style="margin-top:20px">${['MASTERCARD','VISA','AMERICAEXPRESS'].map((name,i)=>`<div><h3>${name}</h3><div style="display:grid;gap:14px">${s.checks.slice(1+i*3,4+i*3).map(check).join('')}</div></div>`).join('')}</div>`;else content+=`<div class="check-grid">${s.checks.map(check).join('')}</div>`}
if(s.uploads.length)content+=`<div class="upload-list">${s.uploads.map(u=>uploadRow(u)).join('')}</div>`;
if(s.texts.length>2)content+=s.texts.slice(2).map(t=>`<p class="hint">${esc(t)}</p>`).join('');
return `<section class="card" data-section="${esc(s.name)}"><h2>${esc(s.texts[0]||s.name)}</h2><p class="hint">${esc(s.texts[1]||'')}</p>${lead}${content}</section>`}
function uploadRow(u){const file=state.files[u.id],err=state.errors['file-'+u.id];return `<div class="upload-row" data-upload-row="${u.id}"><div><div class="upload-name">${labelHTML(u.name)}</div><div class="hint">${esc(u.hint)}</div>${err?`<div class="error" style="color:var(--error)">${esc(err)}</div>`:''}</div><div class="file-state ${file?'ready':''}">${file?`${esc(file.name)}<br>${file.demo?'示例附件（未上傳）':file.needsReselect?'已還原檔名，請重新選取檔案':`${(file.size/1024).toFixed(0)} KB · 已選取（僅本機）`}`:'尚未上傳'}</div><div class="upload-actions">${file?btn('移除','remove-file','danger',`data-id="${u.id}"`):''}${btn(file?'重新上傳':'選擇文件','upload','',`data-id="${u.id}"`)}<input class="hidden" type="file" data-upload="${u.id}" accept=".jpg,.jpeg,.png,.zip"></div></div>`}
function footer(step){return `<footer class="footer"><div class="footer-left">${step>1?btn('上一步','previous'):''}${btn('儲存草稿','save-draft')}<span class="hint">${state.savedAt?'上次儲存：'+esc(state.savedAt):'可隨時儲存草稿'}</span></div><div class="actions"><span class="hint">Step ${step}／6</span>${step<6?btn('下一步','next','primary'):btn('確認提交','submit','primary')}</div></footer>`}
function stepper(current){return `<nav class="stepper" aria-label="申請步驟">${steps.map((t,i)=>`<button type="button" class="step ${i+1===current?'active':''} ${i+1<current?'done':''}" data-action="step" data-step="${i+1}" ${i+1===current?'aria-current="step"':''}><span class="number">${i+1}</span>${t}</button>`).join('')}</nav>`}
function value(id){return esc(state.values[id]||'尚未填寫')}
function productChecks(){return forms[3].sections.slice(0,7).flatMap(s=>s.checks).filter(c=>state.checks[c.id])}
function review(){const errors=validateAll(),products=productChecks(),files=Object.keys(state.files).length;return `<section class="card"><h2>提交前檢查 <span class="muted">Review Before Submission</span></h2><p class="hint">請核對所有資料及文件。下列內容會隨前面步驟的輸入同步更新。</p><div class="notice ${Object.keys(errors).length?'warn':''}">${Object.keys(errors).length?'尚有 '+Object.keys(errors).length+' 項資料需要確認；可返回各步驟補充。':'✓ 必填資料已填寫 · ✓ 示例文件已備妥 · ✓ 聯絡電郵已驗證（模擬）'}</div><div class="hint">Demo 不執行真實 OCR、風控或銀行資料驗證。文件只保存檔名，不會上傳。</div></section><section class="card"><h2>申請資料摘要 <span class="muted">Application Summary</span></h2><p class="hint">點擊各區塊的「返回修改」，可直接返回該步驟。</p>${[
['主體資料',`${value('merchantName')}／${value('merchantEnglishName')}<br>法律地位：${value('legalStatus')}<br>BR：${value('registerCertNo')} · 有效期：${value('registerCertPeriod')}<br>DBA no.：${value('dbaNo')} · 董事：${state.people.directors} 位`],
['經營與聯繫',`地區：${value('addrCountryCode')}／${value('addrProvinceCode')}<br>MCC：${value('mcc')} · ${value('merchantProfile')}<br>聯絡人：${value('contactName')} · ${value('contactPhone')}<br>電郵：${value('contactEmail')} ${state.emailVerified?'（已模擬驗證）':'（待驗證）'}`],
['結算帳戶',`${value('cardBankName')} · ${value('currency')}<br>帳戶名稱：${value('cardName')}<br>銀行帳號：${esc(mask(state.values.cardNo||''))}<br>銀行代碼：${value('cardBankCode')} · 分行代碼：${value('cardBranchCode')}<br>結算週期：${value('settlePeriod')}`],
['產品與費率',`已選 ${products.length} 項產品：${products.map(p=>esc(p.label)).join('、')||'尚未選擇'}<br>費率類型：${value('chargeType')} · 本地卡：${value('localCardRate')}% · 境外卡：${value('overseasCardRate')}%`],
['文件材料',`已準備 ${files} 份附件（含示例附件）<br>${Object.values(state.files).slice(0,4).map(f=>esc(f.name)).join('、')||'尚未選擇文件'}${files>4?'…':''}<br>銀行月結單：一般至少 1 個月；特殊行業 3 個月`]
].map((x,i)=>`<div class="summary-row"><h3>${x[0]}</h3><p>${x[1]}</p>${btn('返回修改','step','',`data-step="${i+1}"`)}</div>`).join('')}</section><section class="card"><h2>帳單名稱預覽 <span class="muted">Statement Preview</span></h2><p class="hint">供核對持卡人帳單上顯示的商戶名稱。</p><div class="statement">${value('merchantEnglishShortName')}</div><p class="hint">幣別：${value('currency')} · 交易金額示例：1,280.00 · MCC：${value('mcc')}</p></section><section class="card"><h2>聲明及確認 <span class="muted">Declaration</span></h2><p class="hint">提交後將送交審核；如需修改已提交內容，請依審核狀態申請補件或更新。</p>${check({id:'613:4956',label:'我已核對申請資料，並確認獲授權代表此商戶提交。'})}<p class="hint">此為 Demo，只會產生模擬申請編號，不會向任何銀行或平台送出資料。</p></section>`}
function mask(s){return s.length>8?s.slice(0,4)+' **** '+s.slice(-4):s?'****':'尚未填寫'}
function filteredRows(){const q=state.search.trim().toLowerCase();return rows.filter(r=>(state.status==='全部狀態'||statusNames[r.status]===state.status)&&(!q||(state.searchScope==='全部欄位'?Object.values(r).join(' '):r[state.searchScope]||'').toLowerCase().includes(q)))}
function merchants(){const list=filteredRows(),pages=Math.max(1,Math.ceil(list.length/5));state.page=Math.min(state.page,pages);const visible=list.slice((state.page-1)*5,state.page*5);return `<div class="page-heading"><h1>商戶管理</h1><p>公司 MID / BR 管理（Excel 表單）</p></div>${demoBar()}${state.noticeCount?`<div class="notice toolbar"><span class="grow">有 ${state.noticeCount} 筆新加入或修改的商戶資料待確認。</span>${btn('確認已讀','read-notice')}</div>`:''}<section class="card"><div class="search-grid"><div><label for="merchant-search">跨欄位搜尋</label><input id="merchant-search" placeholder="搜尋公司名稱、MID、BR、DBA、聯繫人、銀行名稱或帳號" value="${esc(state.search)}"></div><div><label for="search-scope">搜尋範圍</label><select id="search-scope">${['全部欄位','客戶中文名稱','公司 MID','BR','DBA no.','客戶聯繫人','MCC 行業代碼'].map(x=>`<option ${x===state.searchScope?'selected':''}>${x}</option>`).join('')}</select></div><div><label for="merchant-status">商戶狀態</label><select id="merchant-status">${['全部狀態',...Object.values(statusNames)].map(x=>`<option ${x===state.status?'selected':''}>${x}</option>`).join('')}</select></div>${btn('重設','reset-search')}${btn('搜尋','search','primary')}</div></section><div class="batch-bar"><label class="check"><input id="select-all" type="checkbox" ${visible.length&&visible.every(r=>state.selected.has(rowKey(r)))?'checked':''}>全選本頁</label><span id="selected-count">已選 ${state.selected.size} 家公司</span><span class="hint">可一次同步多家公司；同步前會檢查 MID、BR 與必填資料</span>${btn('批次同步至 All-In Pay','batch-sync','primary')}</div><div class="table-wrap"><table class="merchants"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${visible.map(r=>`<tr>${headers.map(h=>merchantCell(r,h)).join('')}</tr>`).join('')||`<tr><td colspan="27" class="empty">沒有符合條件的商戶，請調整搜尋條件。</td></tr>`}</tbody></table></div><div class="table-footer"><span class="hint">顯示 ${list.length?(state.page-1)*5+1:0}–${Math.min(state.page*5,list.length)} 筆，共 ${list.length} 筆公司資料<br>左右捲動查看全部欄位 · 首 5 筆依 Figma；其餘為分頁演示資料</span><div class="pagination">${btn('‹ 上一頁','page','',`data-page="${state.page-1}" ${state.page===1?'disabled':''}`)}${[...new Set([1,Math.max(1,state.page-1),state.page,Math.min(pages,state.page+1),pages])].sort((a,b)=>a-b).map(p=>btn(p,'page',p===state.page?'primary':'',`data-page="${p}"`)).join('')}${btn('下一頁 ›','page','',`data-page="${state.page+1}" ${state.page===pages?'disabled':''}`)}</div></div>`}
function merchantCell(r,h){const mid=esc(rowKey(r));if(h==='選取')return `<td><input type="checkbox" aria-label="選取 ${esc(r['客戶中文名稱'])}" data-select="${mid}" ${state.selected.has(rowKey(r))?'checked':''}></td>`;if(h==='商戶狀態')return `<td>${pill(statusNames[r.status],statusColors[r.status])}</td>`;if(h==='銀行帳號'){const shown=state.revealed.has(rowKey(r));return `<td><span>${esc(shown?r.bank:r[h])}</span><button class="eye" data-action="reveal" data-mid="${mid}" aria-label="${shown?'隱藏':'顯示'}銀行帳號" aria-pressed="${shown}"><img src="${shown?'65f1e.svg':'d2a18.svg'}" alt=""></button></td>`}if(h==='官網連結')return `<td><button data-action="website" data-url="${esc(r[h])}">${esc(r[h])} ↗</button></td>`;if(h==='操作')return `<td>${btn('編輯','edit','',`data-mid="${mid}"`)}${btn('商戶轉換','transfer','',`data-mid="${mid}"`)}${btn('公司詳情','detail','',`data-mid="${mid}"`)}${btn('同步至 All-In Pay','sync','',`data-mid="${mid}"`)}</td>`;return `<td>${esc(r[h])}</td>`}
function draftView(){return `<div class="page-heading"><h1>已儲存的草稿</h1><p>從目前瀏覽器還原申請，不必重新填寫。請勿在共用裝置輸入真實個人資料。</p></div>${demoBar()}${state.drafts.length?`<section class="card"><div class="table-wrap"><table><thead><tr><th>申請／商戶名稱</th><th>目前步驟</th><th>最後儲存</th><th>草稿狀態</th><th>操作</th></tr></thead><tbody>${state.drafts.map(d=>`<tr><td>${esc(d.values.merchantName||'未命名商戶')}<br><span class="hint">${esc(d.id)}</span></td><td>${d.step}／6 ${steps[d.step-1]}</td><td>${esc(d.savedAt)}</td><td>${pill(d.step>=5?'接近完成':'填寫中','blue')}</td><td>${btn('繼續填寫','restore','primary',`data-id="${d.id}"`)} ${btn('刪除','delete-draft','danger',`data-id="${d.id}"`)}</td></tr>`).join('')}</tbody></table></div></section>`:`<section class="card empty"><h2>尚未儲存草稿</h2><p>完成任一部分後點擊「儲存草稿」，便可在這裡繼續。</p>${btn('新增商戶','new','primary')}</section>`}`}
function render(){const r=route(),form=r.page==='application';$('#app').innerHTML=`${sidebar(r.page)}${btn('選單','mobile-menu','mobile-menu')}<main class="main">${tabs(r.page)}${form?stepper(r.step):''}<div class="content ${form?'form-content':''}">${form?application(r.step):r.page==='merchants'?merchants():r.page==='drafts'?draftView():dashboard()}</div></main>${form?footer(r.step):''}`}
function requiredFiles(){const ids=['140101','140401'];if((state.values.legalStatus||'').includes('法人'))ids.push('140201','140301','141101');if((state.values.signType||'').startsWith('01'))ids.push('100301','100302','101401','101402','101404');if(Number(state.values.avgMonthAmount)>500000)ids.push('141701');if(productChecks().some(c=>forms[3].sections[1].checks.includes(c)||forms[3].sections[3].checks.includes(c)||forms[3].sections[6].checks.includes(c)))ids.push('141601');if(state.values.connectType==='0 直連')ids.push('141201');return ids}
function validateStepBase(step){const errors={};if(step===5){for(const id of requiredFiles()){const f=state.files[id];if(!f||f.needsReselect)errors['file-'+id]='請提供適用的文件（可用完整示例演示）'}return errors}if(step===6)return errors;
for(const s of forms[step-1].sections){if(s.name.includes('中國內地')&&!(state.values.addrCountryCode||'').startsWith('CHN'))continue;const repeat=s.fields[0]?.id.includes('[]'),group=repeat?s.fields[0].id.split('[')[0]:null;for(let i=0;i<(repeat?state.people[group]:1);i++)for(const f of s.fields){const key=f.id.replace('[]',`[${i}]`),v=(state.values[key]??state.values[f.id]??'').trim();let required=f.label.includes('*');if(group==='authSigners'&&!(state.values.addrCountryCode||'').startsWith('SGP')&&!state.checks['607:4846'])required=false;if(required&&!v)errors[key]='請填寫'+f.label.split('*')[0].trim();if(v&&/Email$/.test(f.id)&&!/^\S+@\S+\.\S+$/.test(v))errors[key]='請輸入有效的電郵地址';if(v&&/Phone$/.test(f.id)&&!/^\+\d[\d\s-]{7,15}$/.test(v))errors[key]='請加入國際區號，例如 +852 6123 8821';if(f.id==='mcc'&&v&&!/^\d{4}$/.test(v))errors[key]='請輸入 4 位 MCC 行業代碼';if(f.id==='webUrl'&&v&&!/^https:\/\/\S+\.\S+/.test(v))errors[key]='網址格式錯誤，請以 https:// 開頭';if(f.id==='cardBranchCode'&&v&&!/^\d{3}$/.test(v))errors[key]='請輸入 3 位分行代碼';if(f.id==='registerCertPeriod'&&v&&new Date(v).getTime()<Date.now()+30*864e5)errors[key]='BR 有效期須至少尚餘 30 天；仍可儲存草稿';if(/Amount|Rate|Ratio|Cycle|Price|markup|minStlAmt/.test(f.id)&&v&&!/^\d+(\.\d{1,2})?$/.test(v))errors[key]='請輸入有效數值，最多 2 位小數'}}
if(step===2&&!state.emailVerified)errors.contactEmail=errors.contactEmail||'請先完成電郵模擬驗證';if(step===3){if(state.values.isCompay==='Y 對公'&&state.values.cardName!==state.values.merchantEnglishName)errors.cardName='對公帳戶名稱須與英文商戶名稱一致';if((state.values.cardCountryCode||'').startsWith('HKG'))for(const k of ['swiftCode','cardBankName'])if(!state.values[k])errors[k]='香港帳戶需填寫此欄位'}if(step===4){if(!productChecks().length)errors._products='請至少選擇一項產品';for(const [ratio,cycle]of[['depositRatio','depositCycle'],['posCashDepRatio','posDepCycle'],['onQRDepRatio','onQRDepCycle'],['inQRDepRatio','inQRDepCycle']])if(Number(state.values[ratio])>0&&(!Number.isInteger(Number(state.values[cycle]))||Number(state.values[cycle])<1||Number(state.values[cycle])>180))errors[cycle]='比例大於 0 時，釋放週期須為 1–180 天'}return errors}
function validateStep(step){
 const e=validateStepBase(step),v=state.values,required=(k,message)=>{if(!String(v[k]||'').trim())e[k]=message||'請填寫此條件必填欄位'};
 if(step===1){if((v.legalStatus||'').includes('法人'))required('nar1Period','法人團體須填寫 NAR1 有效期');if((v.addrCountryCode||'').startsWith('CHN')&&!(v.legalStatus||'').includes('個人')&&v.threeCertFlag==='0 否')for(const k of ['creditCode','creditCodePeriod','organCode','organCodePeriod','taxCode','taxCodePeriod'])required(k);if((v.addrCountryCode||'HKG').startsWith('HKG')&&v.registerCertNo&&!/^\d{8}-\d{3}$/.test(v.registerCertNo))e.registerCertNo='香港 BR 格式：8 位數字及 3 位分支碼，例如 12345678-000'}
 if(step===2){if((v.addrCountryCode||'').startsWith('CHN'))required('addrCityCode');if(productChecks().some(c=>forms[3].sections[1].checks.includes(c)||forms[3].sections[3].checks.includes(c)||forms[3].sections[6].checks.includes(c)))required('webUrl','線上產品需要商戶網站');if(Number(v.avgPerAmount)>Number(v.maxAmount))e.maxAmount='最高消費金額不可少於平均單筆金額'}
 if(step===3){if((v.cardCountryCode||'').startsWith('CHN'))required('cardCityCode');if(v.cardNo&&!/^[\d\s-]{6,30}$/.test(v.cardNo))e.cardNo='請輸入有效的示例銀行帳號';if((v.cardCountryCode||'').startsWith('HKG')&&v.cardBankCode&&!/^\d{3}(?:\s|$)/.test(v.cardBankCode))e.cardBankCode='香港銀行代碼須為 3 位數字';if(v.isCompay==='N 對私'){required('cardIdcardNo');const names=Array.from({length:state.people.directors},(_,i)=>[v['directors['+i+'].name'],[v['directors['+i+'].firstNameEn'],v['directors['+i+'].lastNameEn']].join(' ')]).flat();if(!names.includes(v.cardName))e.cardName='對私帳戶持有人須為董事之一'}}
 if(step===4){const cnp=productChecks().some(c=>forms[3].sections[1].checks.includes(c)||forms[3].sections[6].checks.includes(c));if(cnp){required('connectType');required('tokenCreateWay')}if(state.checks['603:4817']){required('chargeWay');if(v.chargeWay==='按月結算')required('monthMinPrice')}for(const f of forms[3].sections.flatMap(s=>s.fields))if(/Rate|Ratio/.test(f.id)&&Number(v[f.id])>100)e[f.id]='比例或費率不可超過 100%'}
 return e;
}
function validateAll(){return Object.assign({},...[1,2,3,4,5].map(validateStep))}
function showErrors(errors,step){state.errors={...errors,_form:'請檢查標示的欄位，或先儲存草稿後繼續補充。'+(errors._products?' '+errors._products:'')};if(route().step!==step)go('application/'+step);else render();setTimeout(()=>$('.invalid,.notice.error')?.scrollIntoView({behavior:'smooth',block:'center'}),50)}
function saveDraft(){if(state.fail){modal('草稿儲存失敗','<div class="notice error">已模擬儲存失敗，輸入內容仍保留在目前頁面。</div><p>關閉「模擬儲存／提交失敗」後，可再次儲存。</p>',btn('返回編輯','close')+btn('重試','save-draft','primary'));return}const id=state.draftId||'DRAFT-'+Date.now(),savedAt=new Date().toLocaleString('zh-HK',{hour12:false});const draft={id,savedAt,step:route().step,values:structuredClone(state.values),checks:structuredClone(state.checks),files:structuredClone(state.files),people:{...state.people},emailVerified:state.emailVerified};const next=[draft,...state.drafts.filter(d=>d.id!==id)];try{localStorage.setItem(storageKey,JSON.stringify(next));state.drafts=next;state.draftId=id;state.savedAt=savedAt;modal('草稿儲存成功',`<div class="notice">${esc(draft.values.merchantName||'未命名商戶')} 已儲存。</div><p>可從「已儲存的草稿」繼續填寫。附件僅保留檔名，重新開啟後須重新選取實際檔案。</p><p class="hint">儲存位置：目前瀏覽器；清除瀏覽器資料會移除此草稿。</p>`,btn('查看草稿','drafts')+btn('繼續填寫','close','primary'))}catch{modal('草稿儲存失敗','<p>瀏覽器儲存空間不可用，內容仍保留在目前頁面。請勿關閉此頁。</p>')}}
function fillSample(row=sourceRows[0]){const sample={legalStatus:'法人團體 · Body Corporate',merchantType:'GENERAL 普通',merchantName:row['客戶中文名稱'],merchantShortName:'海港科技',merchantEnglishName:row['客戶英文名稱'],merchantEnglishShortName:'HARBOUR TECH*HK',dbaNo:row['DBA no.'],registerCertNo:row.BR.replace('BR ','')+'-000',registerCertName:row['客戶英文名稱'],registerCertPeriod:'2028-08-31',crCode:'DEMO-CR-0238',nar1Period:'2028-06-30',registerCapital:'100萬以上',licencePeriod:'5年以上',workerNumber:'20–50',addrProvinceCode:'香港',addrCityCode:'中西區',addrStreet:'香港中環示例道 18 號 12 樓',addrStreetEn:'12/F, 18 Example Road, Central, Hong Kong',mcc:row['MCC 行業代碼'],merchantProfile:row['行業類型'],webUrl:'https://example.com',website:'Harbour Tech',avgPerAmount:'1280.00',maxAmount:'50000.00',avgMonthAmount:'280000.00',contactName:row['客戶聯繫人'],contactPhone:row['聯絡人電話'],contactEmail:'contact@example.com',financeName:'林嘉欣',financePhone:'+852 6000 0000',developer:'陳偉明',developerEmail:'agent@example.com',merchantAgreementPeriod:'2028-08-31',merchantAgreementNum:'DEMO-AGR-2026001',cardProvinceCode:'香港',cardCityCode:'中西區',cardAddress:'香港中環示例道 1 號',swiftCode:'HSBCHKHHHKH',cardBankName:'香港上海滙豐銀行',cardName:row['客戶英文名稱'],cardNo:row.bank,cardBranchCode:'001',settlementPrefix:'HARBOUR TECH',localCardRate:'1.65',overseasCardRate:'2.85',markup:'0.00',minStlAmt:'100.00',depositRatio:'0',depositCycle:'0',posCashDepRatio:'5',posDepCycle:'30',refundFeeRatio:'100',onQRDepRatio:'0',onQRDepCycle:'0',inQRDepRatio:'0',inQRDepCycle:'0',connectType:'1 跳轉',tokenCreateWay:'1 跳轉',chargeWay:'按月結算',monthMinPrice:'0.00'};state.values={...state.values,...sample};for(const group of ['directors','authSigners','shareHolders'])for(let i=0;i<state.people[group];i++)Object.assign(state.values,{[group+`[${i}].name`]:'陳偉明',[group+`[${i}].firstNameEn`]:'Wai Ming',[group+`[${i}].lastNameEn`]:'Chan',[group+`[${i}].idcardType`]:'身份證',[group+`[${i}].idcardNo`]:'DEMO-ID-0001',[group+`[${i}].idcardNoPeriod`]:'2030-12-31',[group+`[${i}].birthDay`]:'1985-06-15'});state.checks['603:4689']=true;state.checks['603:4745']=true;state.checks['603:4767']=true;state.emailVerified=true;for(const id of requiredFiles())state.files[id]={name:'DEMO-'+id+'.png',size:102400,demo:true};state.errors={}}
function submit(){const errors=validateAll();if(Object.keys(errors).length){const first=[1,2,3,4,5].find(s=>Object.keys(validateStep(s)).length);showErrors(validateStep(first),first);return}if(!state.checks['613:4956']){modal('請確認聲明','<p>請先勾選授權及資料確認聲明。</p>');return}if(state.fail){modal('申請提交失敗','<div class="notice error">模擬連線失敗，申請未送出。</div><p>六個步驟的內容仍保留，可儲存草稿或關閉失敗模擬後重試。</p>',btn('返回修改','close')+btn('儲存草稿','save-draft')+btn('重新提交','submit','primary'));return}modal('確認提交申請',`<p>即將為 <strong>${value('merchantName')}</strong> 建立模擬申請。</p><p class="hint">此操作不會連接 All-In Pay、發送電郵或上傳文件。</p>`,btn('取消','close')+btn('確認提交（模擬）','confirm-submit','primary'))}
function detail(mid){const r=rows.find(r=>rowKey(r)===mid);if(!r)return;modal('公司詳情',`<h3>${esc(r['客戶中文名稱'])}</h3><p class="hint">${esc(r['客戶英文名稱'])} · ${esc(mid)}</p><dl>${headers.filter(h=>!['選取','操作','銀行帳號'].includes(h)).map(h=>`<dt>${esc(h)}</dt><dd>${h==='商戶狀態'?pill(statusNames[r.status],statusColors[r.status]):esc(r[h])}</dd>`).join('')}<dt>銀行帳號</dt><dd>${esc(r['銀行帳號'])}</dd></dl>`,btn('關閉','close')+btn('編輯公司','edit','primary',`data-mid="${esc(mid)}"`))}
function transfer(mid){const r=rows.find(r=>rowKey(r)===mid);state.transferMid=mid;modal('商戶轉換',`<h3>${esc(r['客戶中文名稱'])}</h3><p class="hint">左側為舊資料，右側為新資料；只更新有填寫的項目，全部選填。</p><div class="grid">${['BR','DBA no.','小票號','銀行帳號','銀行代碼','分行代碼'].map(k=>`<div class="field"><label>目前${k}</label><input readonly value="${esc(r[k]||'未提供')}"></div><div class="field"><label>新${k}（選填）</label><input data-transfer="${k}" placeholder="請輸入新${k}"></div>`).join('')}</div><p class="hint">此額外對話框為互動流程示例，不是本次 8 頁的逐項設計還原。</p>`,btn('取消','close')+btn('確認轉換','confirm-transfer','primary'))}
function sync(mids){if(!mids.length){toast('請先選擇公司');return}if(state.fail){modal('同步失敗','<div class="notice error">已模擬同步失敗，商戶資料未變更。</div>');return}for(const mid of mids){const r=rows.find(r=>rowKey(r)===mid);if(r)r.status='Synced'}modal('模擬同步完成',`<p>${mids.length} 家公司的 Demo 狀態已更新為「已同步至 All-In Pay」。</p><p class="hint">未向 All-In Pay 發送任何資料。</p>`);render()}
document.addEventListener('input',e=>{if(e.target.dataset.field){const k=e.target.dataset.field;state.values[k]=e.target.value;if(k==='contactEmail'){state.emailVerified=false;const verify=e.target.closest('.field')?.querySelector('[data-action="verify-email"]');if(verify)verify.textContent='驗證電郵（模擬）'}delete state.errors[k];const wrap=e.target.closest('.field');wrap?.classList.remove('invalid');wrap?.querySelector('.error')?.remove()}});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.field){state.values[el.dataset.field]=el.value;delete state.errors[el.dataset.field]}if(el.dataset.check)state.checks[el.dataset.check]=el.checked;if(el.id==='simulate-failure')state.fail=el.checked;if(el.dataset.select){el.checked?state.selected.add(el.dataset.select):state.selected.delete(el.dataset.select);$('#selected-count').textContent=`已選 ${state.selected.size} 家公司`}if(el.id==='select-all'){for(const r of filteredRows().slice((state.page-1)*5,state.page*5))el.checked?state.selected.add(rowKey(r)):state.selected.delete(rowKey(r));render()}if(el.dataset.upload){const f=el.files[0];if(!f)return;if(f.size>10*1024*1024||!(/\.(jpe?g|png|zip)$/i.test(f.name))){modal('文件格式不符','<div class="notice error">僅支援 JPG／PNG／ZIP，單一檔案不可超過 10 MB。</div>');return}state.files[el.dataset.upload]={name:f.name,size:f.size,demo:false,needsReselect:false};delete state.errors['file-'+el.dataset.upload];render();toast('已選取文件，僅留在本機；不會上傳')}if(el.id==='dashboard-range'){const week=el.selectedIndex===1;[120,week?6:18,week?3:9,week?1:3].forEach((v,i)=>document.querySelector(`[data-metric="${i}"]`).textContent=v);toast('已切換示例統計區間')}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='merchant-search')actions.search()});
const actions={close:()=>$('#modal').close(),scope:scopeMessage,'mobile-menu':()=>$('.sidebar').classList.toggle('open'),new:()=>go('application/1'),drafts:()=>{$('#modal').close();go('drafts')},step:el=>{state.errors={};go('application/'+el.dataset.step)},previous:()=>{state.errors={};go('application/'+(route().step-1))},next:()=>{const step=route().step,errors=validateStep(step);if(Object.keys(errors).length)showErrors(errors,step);else{state.errors={};go('application/'+(step+1))}},'save-draft':saveDraft,submit,'confirm-submit':()=>{const id='DEMO-'+Date.now().toString().slice(-8);modal('申請提交成功',`<div class="notice">模擬申請已建立，狀態：待審核。</div><p>申請編號：<strong>${id}</strong></p><p>商戶：${value('merchantName')}</p><p class="hint">這是前端演示結果，未提交至正式平台。</p>`,btn('返回儀表板','dashboard','primary'));state.lastApplication=id},dashboard:()=>{$('#modal').close();go('dashboard')},sample:()=>modal('載入完整示例資料','<p>將以「海港科技有限公司」的模擬資料取代目前表單內容，並加入示例附件。現有已儲存草稿不受影響。</p>',btn('取消','close')+btn('載入示例','confirm-sample','primary')),'confirm-sample':()=>{fillSample();$('#modal').close();render();toast('已填入完整示例，可逐步查看或直接到確認提交')},'clear-form':()=>modal('清空目前表單','<p>將清除目前尚未儲存的內容，已儲存草稿不受影響。</p>',btn('取消','close')+btn('清空','confirm-clear','danger')),'confirm-clear':()=>{Object.assign(state,{values:{},checks:{},files:{},errors:{},emailVerified:false,draftId:null,savedAt:null,editing:null,people:{directors:1,authSigners:1,shareHolders:1}});defaults();$('#modal').close();render()},'verify-email':()=>{if(!/^\S+@\S+\.\S+$/.test(state.values.contactEmail||'')){toast('請先輸入有效的聯絡電郵');return}modal('電郵驗證（模擬）',`<p>此 Demo 不發送電郵。驗證對象：${value('contactEmail')}</p><div class="field"><label for="email-code">演示驗證碼：123456</label><input id="email-code" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="請輸入 123456"></div><p id="verify-error" class="error"></p>`,btn('取消','close')+btn('確認驗證','confirm-email','primary'))},'confirm-email':()=>{if($('#email-code').value!=='123456'){$('#verify-error').textContent='驗證碼不正確，請輸入示例驗證碼 123456。';return}state.emailVerified=true;delete state.errors.contactEmail;$('#modal').close();render();toast('電郵模擬驗證完成')},'add-person':el=>{state.people[el.dataset.group]++;render()},'remove-person':el=>{const g=el.dataset.group,i=Number(el.dataset.index),count=state.people[g];for(let j=i;j<count-1;j++)for(const f of formFields.filter(f=>f.id.startsWith(g+'[')))state.values[f.id.replace('[]',`[${j}]`)]=state.values[f.id.replace('[]',`[${j+1}]`)]||'';for(const f of formFields.filter(f=>f.id.startsWith(g+'[')))delete state.values[f.id.replace('[]',`[${count-1}]`)];state.people[g]--;render()},upload:el=>document.querySelector(`[data-upload="${el.dataset.id}"]`).click(),'remove-file':el=>{delete state.files[el.dataset.id];render()},restore:el=>{const d=state.drafts.find(d=>d.id===el.dataset.id);if(!d)return;Object.assign(state,{values:structuredClone(d.values),checks:structuredClone(d.checks),files:structuredClone(d.files),people:{...d.people},emailVerified:d.emailVerified,errors:{},draftId:d.id,savedAt:d.savedAt,editing:null});for(const f of Object.values(state.files))if(!f.demo)f.needsReselect=true;go('application/'+d.step);toast('已還原草稿；實際附件請重新選取')},'delete-draft':el=>modal('刪除草稿','<p>此操作會從目前瀏覽器移除此草稿，無法復原。</p>',btn('取消','close')+btn('確認刪除','confirm-delete','danger',`data-id="${el.dataset.id}"`)),'confirm-delete':el=>{const next=state.drafts.filter(d=>d.id!==el.dataset.id);try{localStorage.setItem(storageKey,JSON.stringify(next));state.drafts=next;$('#modal').close();render();toast('草稿已刪除，無法復原')}catch{toast('刪除失敗，請檢查瀏覽器儲存權限')}},search:()=>{state.search=$('#merchant-search').value;state.status=$('#merchant-status').value;state.searchScope=$('#search-scope').value;state.page=1;render()},'reset-search':()=>{state.search='';state.status='全部狀態';state.searchScope='全部欄位';state.page=1;render()},page:el=>{state.page=Number(el.dataset.page);render()},reveal:el=>{state.revealed.has(el.dataset.mid)?state.revealed.delete(el.dataset.mid):state.revealed.add(el.dataset.mid);const r=rows.find(r=>rowKey(r)===el.dataset.mid);el.closest('td').outerHTML=merchantCell(r,'銀行帳號')},detail:el=>detail(el.dataset.mid),edit:el=>{const mid=el.dataset.mid;modal('編輯公司資料','<p>將把選定公司的示例資料帶入六步表單。現有尚未儲存的輸入將被取代，已儲存草稿不受影響。</p>',btn('取消','close')+btn('開始編輯','confirm-edit','primary',`data-mid="${esc(mid)}"`))},'confirm-edit':el=>{fillSample(rows.find(r=>rowKey(r)===el.dataset.mid));state.editing=el.dataset.mid;state.draftId=null;$('#modal').close();go('application/1')},transfer:el=>transfer(el.dataset.mid),'confirm-transfer':()=>{const inputs=$$('[data-transfer]'),changes=inputs.filter(i=>i.value.trim());if(!changes.length){toast('請至少填寫一項新資料');return}const r=rows.find(r=>rowKey(r)===state.transferMid);changes.forEach(i=>{r[i.dataset.transfer]=i.value.trim();if(i.dataset.transfer==='銀行帳號'){r.bank=i.value.trim();r['銀行帳號']=mask(r.bank)}});$('#modal').close();render();toast('已更新本次 Demo 的商戶資料')},sync:el=>sync([el.dataset.mid]),'batch-sync':()=>sync([...state.selected]),'read-notice':()=>{state.noticeCount=0;render();toast('已確認新加入或修改的商戶')},website:el=>modal('官網連結（示例）',`<p>${esc(el.dataset.url)} 為設計中的示例網址。Demo 不會帶你到未驗證的外部商戶網站。</p>`),activity:()=>modal('最近更新記錄','<p>12:18　林嘉欣更新海港科技有限公司的聯絡資料</p><p>11:52　黃嘉敏完成 2 間商戶的資料審核</p><p>11:40　陳偉明儲存一份新商戶草稿</p><p class="hint">以上為 Figma 的模擬操作紀錄。</p>'),settings:()=>modal('Demo 設定','<p>語言：繁體中文<br>目前身分：最高管理員（模擬）<br>所有草稿僅存於本瀏覽器。</p><p class="hint">帳號權限及密碼驗證不是這 8 頁的實作範圍，不能當成正式安全機制。</p>'),logout:()=>modal('離開 Demo','<p>這份原型沒有真實登入連線。請先儲存草稿，便可關閉瀏覽器分頁。</p>'),metric:el=>{if(el.dataset.index==='0')go('merchants');else actions[['','review-task','review-task','sync-task'][el.dataset.index]]()},'sync-task':()=>modal('同步失敗 · 待辦示例','<p>3 間商戶等待重新同步。請先核對銀行資料及驗證結果。</p><p class="hint">儀表板為固定設計示例；商戶表單示例可進行模擬同步。</p>',btn('關閉','close')+btn('前往商戶管理','open-merchants','primary')),'expiry-task':()=>modal('證照提醒','<p>7 間商戶的 BR／CR 將於 30 日內到期。</p><p class="hint">此數字為設計示例。可在商戶管理查看各商戶的證照有效期。</p>',btn('關閉','close')+btn('前往商戶管理','open-merchants','primary')),'review-task':()=>modal('審核與補件','<p>18 間待審核；9 間待補資料。</p><p class="hint">審核工作台不在本次指定 8 頁內，可透過商戶管理查看或編輯示例資料。</p>',btn('關閉','close')+btn('前往商戶管理','open-merchants','primary')),'open-merchants':()=>{$('#modal').close();go('merchants')}};
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled)actions[el.dataset.action]?.(el)});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});
document.addEventListener('change',e=>{const k=e.target.dataset.field;if(!k)return;if(/CountryCode$/.test(k)){const prefix=k.startsWith('card')?'card':'addr';state.values[prefix+'ProvinceCode']='';state.values[prefix+'CityCode']='';render()}else if(/ProvinceCode$/.test(k)){state.values[k.replace('Province','City')]='';render()}});
window.addEventListener('beforeunload',e=>{if(Object.values(state.values).some(v=>v&&/^請/.test(v)===false)&&!state.savedAt&&state.values.merchantName){e.preventDefault();e.returnValue=''}});
const AZURE_EXTERNAL=false;
// Compiled inside the existing demo closure to reuse the six-step forms and tokens.
const permissionLabels=['查看商戶與申請','新增商戶／儲存草稿','編輯商戶資料','批量導入','匯出商戶資料','查看完整銀行帳號','商戶轉換','審核及退回補件','同步至 All-In Pay','管理登入帳號／重設密碼','設定角色與權限','查看操作記錄'];
const roles=['最高管理員','基本管理員','主代理商','次代理商'];
const rolePermissions=role=>permissionLabels.map((_,i)=>role===roles[0]||role===roles[1]&&!([9,10].includes(i))||role===roles[2]&&[0,1,2,3,4,11].includes(i)||role===roles[3]&&[0,1,2].includes(i));
const accountKey='allinpay-accounts-demo-v2',P='Demo1234!';
let accounts=[['李家豪','admin@example.com',0,'—','已啟用'],['黃嘉敏','manager@example.com',1,'—','已啟用'],['陳偉明','chan@example.com',2,'海港代理','已啟用'],['林嘉欣','lam@example.com',3,'海港代理','已啟用'],['周俊傑','chow@example.com',3,'城市代理','待啟用'],['鄭思穎','cheng@example.com',3,'金聯代理','已停用']].map((a,i)=>({id:'ACC-'+(i+1),name:a[0],email:a[1],role:roles[a[2]],agency:a[3],status:a[4],last:'2026/09/14 '+['09:12','10:08','08:46','09:35','—','08:26'][i],permissions:rolePermissions(roles[a[2]]),scope:a[2]<2?'全平台資料':'本人及獲指派的商戶'}));
try{const saved=JSON.parse(localStorage.getItem(accountKey)||'null');if(Array.isArray(saved)&&saved.length)accounts=saved;}catch{}
const BO={user:null,authError:'',loginEmail:'admin@example.com',otpUntil:0,resendAt:0,reset:false,registration:false,search:'',role:'全部角色',restricted:false,audit:[],hidden:new Set(),order:[...headers],pins:[],freezeThrough:null,sort:null,desc:false,tab:'基礎信息',importRows:[],accountPage:1};
headers.splice(headers.indexOf('主代理商')+1,0,'主代理商代碼');headers.splice(headers.indexOf('次代理商')+1,0,'次代理商代碼');BO.order=[...headers];rows.forEach((r,i)=>{r['主代理商代碼']='MA-'+String((i%3)+1).padStart(3,'0');r['次代理商代碼']='SA-'+String((i%5)+1).padStart(3,'0');r['銀行代碼']=['012','004','024','003','015'][i%5];r['分行代碼']='001';});
const originalRender=render,originalSidebar=sidebar,originalFiltered=filteredRows,originalCell=merchantCell;
const can=i=>!!BO.user&&!BO.restricted&&!!BO.user.permissions[i];
function deny(){modal('權限不足','<div class="notice error">目前帳號沒有此操作權限，不能編輯或查看其他帳號的權限。</div><p>請聯絡最高管理員或獲授權人員。</p>')}
function audit(message){BO.audit.unshift({time:new Date().toLocaleString('zh-HK',{hour12:false}),message,user:BO.user?.name||'Demo'});}
function saveAccounts(){try{localStorage.setItem(accountKey,JSON.stringify(accounts));return true}catch{modal('儲存失敗','<div class="notice error">瀏覽器儲存空間不可用，未儲存變更。</div>');return false}}
function authInput(id,label,type='text',value=''){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" autocomplete="${type==='password'?'off':'email'}" placeholder="${type==='password'?'請輸入 Demo 密碼':'請輸入'}"></div>`}
function authPage(page){let content='';const err=`<p class="login-error" role="alert">${esc(BO.authError)}</p>`;
if(page==='login')content=`<h1>登入</h1><p class="hint">歡迎回來，請登入以繼續管理商戶申請。</p>${authInput('login-email','電郵地址','email',BO.loginEmail)}${authInput('login-password','密碼','password')}${err}<a href="#/forgot" style="text-align:right">忘記密碼？</a>${btn('登入','bo-login','primary')}<div class="divider">或</div>${btn('使用 Google 登入','google-login')}<a href="#/code-login">使用電郵驗證碼登入</a><a href="#/register">未有帳戶？ 建立帳戶</a><div class="login-demo">Demo 密碼：<strong>${P}</strong> · 驗證碼：<strong>123456</strong><br>請勿輸入真實密碼。選擇示例身分：<div class="quick-role">${roles.map((r,i)=>btn(r,'pick-role','',`data-index="${i}"`)).join('')}</div></div>`;
else if(page==='register')content=`<h1>建立帳戶</h1><p class="hint">以電郵註冊平台帳號（僅示例，不會建立真實帳戶）。</p>${authInput('reg-name','姓名')}${authInput('login-email','電郵地址','email')}${authInput('reg-password','設定密碼','password')}${authInput('reg-confirm','確認密碼','password')}<label class="check" style="margin-top:20px"><input id="reg-terms" type="checkbox">我已閱讀服務條款及私隱政策（Demo）</label>${err}${btn('建立帳戶','bo-register','primary')}<a href="#/login">返回登入</a>`;
else if(['forgot','code-login'].includes(page))content=`<h1>${page==='forgot'?'忘記密碼':'電郵驗證碼登入'}</h1><p class="hint">輸入示例電郵，將進入驗證碼 Demo；不會寄送郵件。</p>${authInput('login-email','電郵地址','email',BO.loginEmail)}${err}${btn(page==='forgot'?'傳送重設驗證碼':'傳送驗證碼',page==='forgot'?'forgot-code':'login-code','primary')}<a href="#/login">返回登入</a>`;
else if(page==='reset')content=`<h1>重設密碼</h1><p class="hint">輸入示例驗證碼 123456，並示範設定新密碼。密碼不會儲存。</p>${authInput('login-code','驗證碼')}${authInput('new-password','新密碼','password')}${authInput('confirm-password','確認新密碼','password')}${err}${btn('更新密碼','bo-reset','primary')}<a href="#/login">返回登入</a>`;
else if(page==='auth-success')content=`<div class="notice">✓ 操作完成（Demo）</div><h1>設定已完成</h1><p>可使用示例帳號返回登入。登入密碼仍為 ${P}。</p><p class="hint">沒有發送郵件、變更正式密碼或建立正式帳號。</p>${btn('返回登入','bo-to-login','primary')}`;
else content=`<h1>輸入登入驗證碼</h1><p class="hint">驗證對象：${esc(BO.loginEmail)}</p>${authInput('login-code','六位數驗證碼')}${err}<p class="hint">Demo 驗證碼：123456 · 10 分鐘內有效</p>${btn('驗證並登入','bo-verify','primary')}${btn('重新發送','bo-resend','',`id="bo-resend"`)}<a href="#/login">返回登入</a>`;
return `<main class="auth-layout"><aside class="auth-brand-panel"><a class="brand" href="#/login"><img src="azure-logo.png" alt="Azure"><small>Application Agency System</small></a><h1>更安全、更清晰的<br>商戶申請與管理流程</h1><p>集中處理公司資料、申請進度與<br>All-In Pay 同步狀態。</p><small>安全登入 · 商戶資料受權限保護</small></aside><section class="login-wrap"><form class="login-card" id="bo-auth-form">${content}<p class="hint" style="margin-top:24px">前端 Demo，並非正式登入或安全機制。</p><a href="external.html">開啟外部商戶申請</a></form></section></main>`;}
sidebar=function(page){return originalSidebar(page).replace("${unused}",'').replace(btn('<img src="d0541.svg" alt="">帳號管理','scope','nav-link'),`<a class="nav-link ${page==='accounts'?'active':''}" href="#/accounts"><img src="d0541.svg" alt="">帳號管理</a>`).replace(btn('批量導入','scope','nav-link sub'),'<a class="nav-link sub" href="#/import">批量導入</a>').replace('MR STEPHEN LI',esc(BO.user?.name||'Demo')).replace('最高管理員 · Demo',esc((BO.restricted?'權限不足示例':BO.user?.role)||'Demo')+' · Demo');};
function accountList(){const limited=!can(9);let list=accounts.filter(a=>(!limited||a.id===BO.user.id)&&(!BO.search||[a.name,a.email,a.agency].some(v=>v.toLowerCase().includes(BO.search.toLowerCase())))&&(BO.role==='全部角色'||a.role===BO.role));return `<div class="page-heading"><h1>帳號管理</h1><p>管理可登入平台的人員帳號與權限；此頁與商戶資料管理分開。</p></div>${demoBar()}${limited?'<div class="readonly-banner">權限不足示例：只顯示自己的帳號，不能編輯，也無法查看其他人的權限。</div>':''}<section class="card"><div class="permission-toolbar"><div><h2>帳號列表 <span class="muted">Account List</span></h2><p class="hint">${list.length} 個帳號 · 姓名及電郵皆為模擬資料。</p></div>${BO.restricted?btn('返回最高管理員 Demo','full-access'):can(9)?btn('Demo：權限不足','limited-access'):''}</div><div class="account-filter"><input id="account-search" aria-label="搜尋帳號" placeholder="搜尋姓名、登入電郵或代理商" value="${esc(BO.search)}"><select id="account-role" aria-label="角色">${['全部角色',...roles].map(r=>`<option ${r===BO.role?'selected':''}>${r}</option>`).join('')}</select>${btn('搜尋','search-accounts')}${can(9)?btn('新增帳號','add-account','primary'):''}</div><div class="table-scroll"><table class="accounts-table"><thead><tr>${['姓名／登入電郵','角色','所屬代理商','狀態','最後登入','操作'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${list.map(a=>`<tr><td>${esc(a.name)}<small>${esc(a.email)}</small></td><td>${a.role}</td><td>${esc(a.agency)}</td><td>${pill(a.status,a.status==='已啟用'?'green':a.status==='已停用'?'red':'amber')}</td><td>${esc(a.last)}</td><td><div class="account-actions">${can(9)?btn('編輯','edit-account','',`data-id="${a.id}"`)+btn(a.status==='待啟用'?'重寄邀請':'重設密碼',a.status==='待啟用'?'invite-account':'reset-account','',`data-id="${a.id}"`)+(can(10)?btn('帳號權限管理','permissions','',`data-id="${a.id}"`):'')+btn(a.status==='已停用'?'啟用':'停用','toggle-account',a.status==='已停用'?'':'danger',`data-id="${a.id}" ${a.id===BO.user.id?'disabled title="不能停用目前登入帳號"':''}`):'<span class="hint">唯讀 · 無編輯權限</span>'}</div></td></tr>`).join('')||'<tr><td colspan="6">沒有符合條件的帳號。</td></tr>'}</tbody></table></div><p class="hint">顯示 1–${list.length} 筆，共 ${list.length} 筆帳號 · 每頁 20 筆</p></section><section class="card"><h2>登入安全 <span class="muted">Sign-in Security</span></h2><p class="hint">密碼不以明文顯示或寄送。最高管理員至少保留 1 位；帳號權限變更只影響該帳號。</p>${can(9)?btn('登入安全設定','security-settings'):''}</section>`;}
function accountForm(id){if(!can(9))return deny();let a=accounts.find(x=>x.id===id)||{name:'',email:'',role:roles[3],agency:''};BO.editId=id;modal(id?'編輯帳號':'新增帳號',`<div class="grid">${[['acc-name','姓名',a.name],['acc-email','登入電郵',a.email],['acc-agency','所屬代理商',a.agency]].map(([i,l,v])=>`<div class="field"><label for="${i}">${l}</label><input id="${i}" value="${esc(v)}"></div>`).join('')}<div class="field"><label for="acc-role">角色</label><select id="acc-role">${roles.map(r=>`<option ${r===a.role?'selected':''}>${r}</option>`).join('')}</select></div></div><p id="acc-error" class="modal-error"></p><p class="hint">新增帳號為待啟用示例，不會寄送真實邀請。</p>`,btn('取消','close')+btn('儲存帳號','save-account','primary'));}
function permissionModal(id){if(!can(10))return deny();const a=accounts.find(x=>x.id===id);BO.permissionId=id;modal('帳號權限管理',`<p>只修改目前選中的帳號，不會更改同角色其他帳號的權限。</p><div class="profile-summary"><strong>${esc(a.name)}</strong> · ${esc(a.email)}</div><div class="grid"><div class="field"><label for="permission-role">帳號角色</label><select id="permission-role">${roles.map(r=>`<option ${r===a.role?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label for="permission-scope">資料範圍</label><select id="permission-scope">${['全平台資料','本人及所屬次代理商','本人及獲指派的商戶'].map(s=>`<option ${s===a.scope?'selected':''}>${s}</option>`).join('')}</select></div></div><h3 style="margin-top:24px">功能權限 Permissions</h3><table class="permission-table"><thead><tr><th>功能</th><th>允許此帳號</th></tr></thead><tbody>${permissionLabels.map((p,i)=>`<tr><td>${p}</td><td><input type="checkbox" aria-label="${p}" data-permission="${i}" ${a.permissions[i]?'checked':''}></td></tr>`).join('')}</tbody></table><p class="permission-save-hint">儲存前須輸入目前登入者的密碼；不能移除最後一位最高管理員，每次變更保留操作記錄。</p>`,btn('取消','close')+btn('儲存此帳號權限','save-permissions','primary'));}
function passwordGate(title,callback){BO.pendingMutation=callback;modal('修改前密碼驗證',`<div class="profile-summary">${esc(title)}</div><p>請輸入目前登入者的 Demo 密碼以確認修改。</p>${authInput('verify-password','目前登入者密碼','password')}<p class="hint">Demo 密碼：${P} · 此密碼不是正式帳號憑證。</p><p id="password-error" class="modal-error" role="alert"></p>`,btn('取消','close')+btn('確認並儲存','confirm-password','primary'));}
filteredRows=function(){let list=originalFiltered();if(BO.user?.role===roles[2])list=list.filter((r,i)=>i%3===0);if(BO.user?.role===roles[3])list=list.filter((r,i)=>i%5===0);if(BO.sort)list=list.slice().sort((a,b)=>String(a[BO.sort]||'').localeCompare(String(b[BO.sort]||''),'zh-Hant',{numeric:true})*(BO.desc?-1:1));return list;};
merchantCell=function(r,h){if(h==='銀行帳號'&&!can(5))return `<td>${esc(r[h])}<span class="scope-tag"> · 無查看權限</span></td>`;if(h==='操作')return `<td>${can(2)?btn('編輯','edit','',`data-mid="${rowKey(r)}"`):''}${can(6)?btn('商戶轉換','transfer','',`data-mid="${rowKey(r)}"`):''}${btn('公司詳情','detail','',`data-mid="${rowKey(r)}"`)}${can(8)?btn('同步至 All-In Pay','sync','',`data-mid="${rowKey(r)}"`):''}</td>`;return originalCell(r,h);};
const oldMerchants=merchants;
merchants=function(){let html=oldMerchants();const cols=visibleMerchantColumns();let list=filteredRows().slice((state.page-1)*5,state.page*5),widths=cols.map(h=>h==='操作'?480:h==='選取'?70:h==='客戶中文名稱'||h==='客戶英文名稱'?260:180);const pinStyle=(h,i)=>BO.pins.includes(h)?`class="pinned" style="left:${widths.slice(0,i).reduce((s,v)=>s+v,0)}px;width:${widths[i]}px"`:`style="width:${widths[i]}px"`;const table=`<div class="table-wrap"><table class="merchants merchant-table-new" style="width:${widths.reduce((s,v)=>s+v,0)}px"><thead><tr>${cols.map((h,i)=>`<th ${pinStyle(h,i)}><span class="merchant-head">${esc(h)}${!['選取','操作'].includes(h)?btn(BO.sort===h?(BO.desc?'↓':'↑'):'⋮','column-menu','',`data-col="${esc(h)}" aria-label="${esc(h)}欄位操作"`):''}</span></th>`).join('')}</tr></thead><tbody>${list.map(r=>`<tr>${cols.map((h,i)=>merchantCell(r,h).replace('<td>',`<td ${pinStyle(h,i)}>`)).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}">沒有符合條件的商戶。</td></tr>`}</tbody></table></div>`;html=html.replace(/<div class="table-wrap">[\s\S]*?<\/table><\/div>/,table);html=html.replace('<div class="batch-bar">',`<div class="toolbar">${btn('欄位設定','columns')}${can(4)?btn('匯出 CSV','export-merchants'):''}<span class="hint">可隱藏／重排／凍結欄位，點擊表頭選單排序</span></div><div class="batch-bar">`);if(!can(8))html=html.replace(btn('批次同步至 All-In Pay','batch-sync','primary'),'');return html;};
function columnsModal(){modal('顯示／排列欄位',`<p>勾選要顯示的欄位，使用上下按鈕調整順序。預設不凍結欄位；請由表頭 ▾ 選單選擇「凍結至此欄」（包含左側所有可見欄位）或「取消所有凍結」。</p><div class="col-settings">${BO.order.map((h,i)=>`<div class="col-setting"><label><input type="checkbox" data-col-visible="${esc(h)}" ${!BO.hidden.has(h)?'checked':''} ${['選取','操作'].includes(h)?'disabled':''}>${esc(h)}</label>${btn('↑','move-col','',`data-col="${esc(h)}" data-dir="-1" ${i===0?'disabled':''} aria-label="${esc(h)}上移"`)}${btn('↓','move-col','',`data-col="${esc(h)}" data-dir="1" ${i===BO.order.length-1?'disabled':''} aria-label="${esc(h)}下移"`)}</div>`).join('')}</div>`,btn('恢復預設','reset-cols')+btn('套用','apply-cols','primary'));}
function showDetail(mid){const r=rows.find(x=>rowKey(x)===mid);BO.detailMid=mid;const sections={'基礎信息':['地區','客戶類型','主代理商','主代理商代碼','次代理商','次代理商代碼','所屬集團','客戶聯繫人','聯絡人電話','聯絡人電郵','MCC 行業代碼','行業類型','官網連結'],'結算信息':['銀行名稱','銀行帳號','銀行代碼','分行代碼','單筆最高交易金額'],'材料信息':['BR','BR 有效期','CR 有效期'],'增值及其他功能配置':[]};modal('公司詳情',`<div class="profile-summary"><h3>${esc(r['客戶中文名稱'])}</h3>${esc(r['客戶英文名稱'])}<p class="hint">公司 MID：${midDisplay(r)} · BR：${esc(r.BR)}</p></div><div class="entity-tabs">${Object.keys(sections).map(t=>btn(t,'detail-tab',BO.tab===t?'primary':'',`data-tab="${t}"`)).join('')}</div><dl>${sections[BO.tab].map(h=>`<dt>${h}</dt><dd>${esc(r[h]||'未提供')}</dd>`).join('')}${BO.tab==='增值及其他功能配置'?'<dt>分賬功能</dt><dd>未開通</dd><dt>終端訂單支付</dt><dd>聯機模式</dd><dt>退貨服務費</dt><dd>0.00% + HKD 0.00</dd><dt>收單保證金</dt><dd>0.00% · 釋放期 0 天</dd><dt>All-In Pay 同步</dt><dd>'+statusNames[r.status]+'</dd>':''}</dl>${BO.tab==='材料信息'?btn('重新上傳文件','company-upload','',`data-mid="${mid}"`):''}`,btn('關閉','close')+(can(2)?btn('編輯公司','edit-detail','primary',`data-mid="${mid}"`):''));}
function transferModal(mid){if(!can(6))return deny();const r=rows.find(x=>rowKey(x)===mid);state.transferMid=mid;const keys=['BR','DBA no.','小票號','銀行帳號','銀行代碼','分行代碼'];modal('商戶轉換',`<p>可更換 BR、DBA、小票及銀行資料。所有新欄位選填，空白會保留原值。</p><div class="profile-summary"><strong>${esc(r['客戶中文名稱'])}</strong><p>公司 MID：${midDisplay(r)}</p></div><div class="dual-panels"><section><h3>舊資料 · 唯讀</h3>${keys.map(k=>`<div class="field"><label>目前${k}</label><input readonly value="${esc(r[k]||'未提供')}"></div>`).join('')}</section><section><h3>新資料 · 選填</h3>${keys.map(k=>`<div class="field"><label>新${k}</label>${k==='銀行代碼'?`<select data-transfer="${k}"><option value="">不變更</option>${options.cardBankCode.map(o=>`<option value="${o.slice(0,3)}">${o}</option>`).join('')}</select>`:`<input data-transfer="${k}" placeholder="${k==='分行代碼'?'3 位分行代碼':'請輸入新'+k}">`}</div>`).join('')}</section></div><div class="grid" style="margin-top:24px"><div class="field"><label>生效日期（選填）</label><input type="date" id="transfer-date"></div><div class="field"><label>轉換原因（選填）</label><input id="transfer-reason"></div><div class="field"><label>BR 商業登記證（更換 BR 時）</label><input type="file" accept=".png,.jpg,.jpeg,.pdf" id="transfer-br"></div><div class="field"><label>銀行月結單 · 最少 1 個月；特殊行業 3 個月</label><input type="file" accept=".png,.jpg,.jpeg,.pdf" multiple id="transfer-bank"></div></div><label class="check" style="margin-top:24px"><input type="checkbox" id="transfer-confirm">我已確認新資料正確，並了解會建立更新記錄。</label><p class="modal-error" id="transfer-error"></p>`,btn('取消','close')+btn('確認轉換','transfer-save','primary'));}
function importPage(){return `<div class="page-heading"><h1>批量導入資料</h1><p>填寫基本資料，再上傳文件進行批量驗證與導入。</p></div>${demoBar()}<section class="card"><h2>基本資料</h2><div class="grid"><div class="field"><label>商戶名稱模糊查詢</label><input id="import-merchant" placeholder="請輸入商戶名稱"></div><div class="field"><label>歸屬合作方</label><input id="import-partner" placeholder="請輸入合作方"></div></div><div class="import-zone"><h3>資料文件</h3><p>CSV／Excel · 上限 10 MB</p><input type="file" id="import-file" accept=".csv,.xlsx,.xls"><p class="hint">CSV 會解析真實示例內容；Excel 使用預設五筆驗證示例，不執行正式匯入。</p></div><div class="toolbar">${btn('下載 CSV 模板','import-template')}${btn('載入驗證示例','import-sample')}</div></section><section class="card"><h2>資料驗證與預覽</h2><div class="table-scroll"><table class="accounts-table"><thead><tr><th>客戶中文名稱</th><th>公司 MID</th><th>BR</th><th>驗證結果</th></tr></thead><tbody>${BO.importRows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.mid)}</td><td>${esc(r.br)}</td><td>${r.error?pill(r.error,'red'):pill('通過','green')}</td></tr>`).join('')||'<tr><td colspan="4">請選取文件或載入示例。</td></tr>'}</tbody></table></div><div class="toolbar">${btn('下載錯誤報告','import-errors')}${btn('重設','import-reset')}${btn('確認導入','import-confirm','primary',BO.importRows.length?'':'disabled')}</div></section>`;}
render=function(){const r=route();if(['login','register','verify','forgot','reset','auth-success','code-login'].includes(r.page)||!BO.user){$('#app').innerHTML=authPage(BO.user?r.page:(!['login','register','verify','forgot','reset','auth-success','code-login'].includes(r.page)?'login':r.page));$('#bo-auth-form')?.addEventListener('submit',e=>{e.preventDefault();actions['bo-login']()});return}if(['accounts','import','activity'].includes(r.page)){$('#app').innerHTML=`${sidebar(r.page)}${btn('選單','mobile-menu','mobile-menu')}<main class="main"><div class="content">${r.page==='accounts'?accountList():r.page==='import'?(can(3)?importPage():'<div class="readonly-banner">您沒有批量導入權限。</div>'):`<h1>查閱更新記錄</h1><section class="card">${BO.audit.map(a=>`<p>${esc(a.time)} · ${esc(a.user)} · ${esc(a.message)}</p>`).join('')||'<p>尚未有本次 Demo 的更新記錄。</p>'}</section>`}</div></main>`;return}if(r.page==='application'&&!can(1)){$('#app').innerHTML=`${sidebar(r.page)}<main class="main"><div class="content"><div class="readonly-banner">您沒有新增商戶的權限。</div></div></main>`;return}originalRender();};
function downloadCSV(name,lines){const b=new Blob(['\ufeff'+lines.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function loginAs(a){if(!a||a.status!=='已啟用'){BO.authError='帳號不存在、尚待啟用或已停用。';render();return}BO.user=a;BO.restricted=false;BO.authError='';BO.loginEmail=a.email;go('dashboard');audit('示例登入成功');}
Object.assign(actions,{
'pick-role':el=>{$('#login-email').value=accounts[+el.dataset.index].email;$('#login-password').value=P;BO.loginEmail=accounts[+el.dataset.index].email;},
'bo-login':()=>{const submitAction=({register:'bo-register',verify:'bo-verify',forgot:'forgot-code',reset:'bo-reset','auth-success':'bo-to-login','code-login':'login-code'})[route().page];if(submitAction)return actions[submitAction]();BO.loginEmail=$('#login-email')?.value.trim()||BO.loginEmail;let a=accounts.find(x=>x.email.toLowerCase()===BO.loginEmail.toLowerCase());if($('#login-password')?.value!==P){BO.authError='Demo 電郵或密碼不正確，請使用示例密碼 Demo1234!。';render();return}loginAs(a)},'bo-to-login':()=>{BO.authError='';go('login')},
'google-login':()=>modal('Google 登入 · 示範','<p>將以最高管理員示例登入，沒有連接 Google 或取得您的 Google 帳號資料。</p>',btn('取消','close')+btn('繼續示範','google-confirm','primary')),'google-confirm':()=>{$('#modal').close();loginAs(accounts[0])},
'login-code':()=>{BO.loginEmail=$('#login-email').value.trim();if(!/^\S+@\S+\.\S+$/.test(BO.loginEmail)){BO.authError='請輸入有效的示例電郵。';render();return}BO.otpUntil=Date.now()+600000;BO.resendAt=Date.now()+60000;BO.authError='';go('verify')},'forgot-code':()=>{BO.loginEmail=$('#login-email').value.trim();if(!/^\S+@\S+\.\S+$/.test(BO.loginEmail)){BO.authError='請輸入有效電郵。';render();return}BO.otpUntil=Date.now()+600000;BO.authError='';go('reset')},'bo-verify':()=>{if(Date.now()>BO.otpUntil||$('#login-code').value!=='123456'){BO.authError='驗證碼不正確或已過期，請重新發送。';render();return}loginAs(accounts.find(a=>a.email===BO.loginEmail))},'bo-resend':()=>{if(Date.now()<BO.resendAt)return;BO.otpUntil=Date.now()+600000;BO.resendAt=Date.now()+60000;BO.authError='';toast('示例驗證碼 123456，沒有寄出真實郵件');render()},
'bo-register':()=>{let n=$('#reg-name').value.trim(),e=$('#login-email').value.trim(),p=$('#reg-password').value;if(!n||!/^\S+@\S+\.\S+$/.test(e)||p.length<8||!/[A-Za-z]/.test(p)||!/\d/.test(p)||p!==$('#reg-confirm').value||!$('#reg-terms').checked){BO.authError='請填妥資料、至少 8 位英數密碼、相同確認密碼及條款。';render();return}if(accounts.some(a=>a.email===e)){BO.authError='示例帳號已存在。';render();return}accounts.push({id:'ACC-'+Date.now(),name:n,email:e,role:roles[3],agency:'—',status:'待啟用',last:'—',permissions:rolePermissions(roles[3]),scope:'本人及獲指派的商戶'});if(saveAccounts()){BO.authError='';go('auth-success')}},'bo-reset':()=>{const p=$('#new-password').value;if(Date.now()>BO.otpUntil||$('#login-code').value!=='123456'||p.length<8||!/[A-Za-z]/.test(p)||!/\d/.test(p)||p!==$('#confirm-password').value){BO.authError='請確認有效驗證碼，及至少 8 位英數且一致的新密碼。';render();return}BO.authError='';go('auth-success')},
'search-accounts':()=>{BO.search=$('#account-search').value.trim();BO.role=$('#account-role').value;render()},'add-account':()=>accountForm(),'edit-account':el=>accountForm(el.dataset.id),'save-account':()=>{if(!can(9))return deny();const id=BO.editId,a=accounts.find(x=>x.id===id),name=$('#acc-name').value.trim(),email=$('#acc-email').value.trim(),role=$('#acc-role').value,agency=$('#acc-agency').value.trim();if(!name||!/^\S+@\S+\.\S+$/.test(email)||accounts.some(x=>x.id!==id&&x.email===email)){$('#acc-error').textContent='請輸入姓名及未被使用的有效電郵。';return}if(a?.role===roles[0]&&role!==roles[0]&&accounts.filter(x=>x.role===roles[0]&&x.status==='已啟用').length===1){$('#acc-error').textContent='不能移除最後一位最高管理員。';return}passwordGate('儲存帳號 '+name,()=>{const update=a||{id:'ACC-'+Date.now(),last:'—',status:'待啟用',permissions:rolePermissions(role),scope:'本人及獲指派的商戶'};Object.assign(update,{name,email,role,agency});if(!a)accounts.push(update);audit('新增／更新帳號 '+name);return saveAccounts()});},
permissions:el=>permissionModal(el.dataset.id),'save-permissions':()=>{if(!can(10))return deny();const a=accounts.find(x=>x.id===BO.permissionId),permissions=$$('[data-permission]').map(c=>c.checked),role=$('#permission-role').value,scope=$('#permission-scope').value;if(a.role===roles[0]&&(role!==roles[0]||!permissions[10])&&accounts.filter(x=>x.role===roles[0]&&x.permissions[10]&&x.status==='已啟用').length===1){toast('不能移除最後一位最高管理員或其權限管理能力');return}passwordGate('變更 '+a.name+' 的個別權限（不影響同角色其他帳號）',()=>{Object.assign(a,{permissions,role,scope});audit('變更 '+a.name+' 的個別帳號權限');return saveAccounts()});},'confirm-password':()=>{if($('#verify-password').value!==P){$('#password-error').textContent='密碼不正確，請輸入目前登入者的 Demo 密碼。';return}if(BO.pendingMutation?.()){BO.pendingMutation=null;render();modal('變更已儲存','<div class="notice">密碼驗證通過，變更僅套用至所選帳號，操作記錄已更新。</div>');}},
'toggle-account':el=>{if(!can(9))return deny();const a=accounts.find(x=>x.id===el.dataset.id);if(a.id===BO.user.id||a.role===roles[0]&&accounts.filter(x=>x.role===roles[0]&&x.status==='已啟用').length===1)return toast('不能停用自己或最後一位最高管理員');passwordGate((a.status==='已停用'?'啟用':'停用')+'帳號 '+a.name,()=>{a.status=a.status==='已停用'?'已啟用':'已停用';audit(a.status+'帳號 '+a.name);return saveAccounts()});},'reset-account':el=>{if(!can(9))return deny();let a=accounts.find(x=>x.id===el.dataset.id);passwordGate('重設 '+a.name+' 的密碼',()=>{audit('模擬傳送密碼重設連結：'+a.email);return true})},'invite-account':el=>{if(!can(9))return deny();let a=accounts.find(x=>x.id===el.dataset.id);audit('模擬重寄邀請：'+a.email);modal('邀請已重新寄送（模擬）',`<p>${esc(a.email)}</p><p>沒有真正發送電郵。</p>`)},
'limited-access':()=>{BO.restricted=true;render()},'full-access':()=>{BO.restricted=false;render()},'security-settings':()=>modal('登入安全設定',`<div class="field"><label>閒置登出時間</label><select id="security-idle"><option>30 分鐘</option><option>15 分鐘</option></select></div><p class="hint">此設定為介面演示，不提供真實安全防護。QR Code／TOTP 功能依要求暫停。</p>`,btn('取消','close')+btn('儲存設定','save-security','primary')),'save-security':()=>passwordGate('更新登入安全設定',()=>{audit('更新登入安全設定（Demo）');return true}),
settings:()=>modal('個人設定',`<div class="profile-summary">${esc(BO.user.name)} · ${esc(BO.user.email)}<br>${BO.user.role}</div><p>語言：繁體中文<br>資料及權限僅供本機示例，不是正式後端安全機制。</p>`,btn('關閉','close')+btn('登入安全設定','security-settings')),logout:()=>modal('確認登出','<p>請先儲存草稿。登出後需重新登入此 Demo。</p>',btn('取消','close')+btn('確認登出','bo-logout','primary')),'bo-logout':()=>{BO.user=null;state.revealed.clear();$('#modal').close();go('login')},activity:()=>go('activity'),
columns:columnsModal,'apply-cols':()=>{$('#modal').close();render()},'move-col':el=>{let i=BO.order.indexOf(el.dataset.col),j=i+Number(el.dataset.dir);if(j>=0&&j<BO.order.length)[BO.order[i],BO.order[j]]=[BO.order[j],BO.order[i]];columnsModal()},'pin-col':el=>{let c=el.dataset.col;BO.freezeThrough=c;visibleMerchantColumns();columnsModal()},'reset-cols':()=>{BO.order=[...headers];BO.pins=[];BO.freezeThrough=null;BO.hidden.clear();columnsModal()},'column-menu':el=>{BO.column=el.dataset.col;modal(esc(BO.column)+' · 欄位操作','<p>排序、隱藏或凍結目前欄位。</p>',btn('升序','sort-asc')+btn('降序','sort-desc')+btn('隱藏欄位','hide-column')+btn(BO.pins.includes(BO.column)?'取消凍結':'凍結欄位','freeze-column'))},'sort-asc':()=>{BO.sort=BO.column;BO.desc=false;$('#modal').close();render()},'sort-desc':()=>{BO.sort=BO.column;BO.desc=true;$('#modal').close();render()},'hide-column':()=>{BO.hidden.add(BO.column);$('#modal').close();render()},'freeze-column':()=>{BO.freezeThrough=BO.column;visibleMerchantColumns();$('#modal').close();render()},'export-merchants':()=>{if(!can(4))return deny();let cols=BO.order.filter(h=>!['選取','操作'].includes(h));downloadCSV('allinpay-merchants-demo.csv',[cols,...filteredRows().map(r=>cols.map(c=>c==='商戶狀態'?statusNames[r.status]:r[c]))])},
detail:el=>{BO.tab='基礎信息';showDetail(el.dataset.mid)},'detail-tab':el=>{BO.tab=el.dataset.tab;showDetail(BO.detailMid)},'edit-detail':el=>{if(!can(2))return deny();BO.editMid=el.dataset.mid;let r=rows.find(r=>rowKey(r)===BO.editMid),keys=BO.tab==='結算信息'?['銀行名稱','銀行帳號','銀行代碼','分行代碼']:BO.tab==='材料信息'?['BR','BR 有效期','CR 有效期']:['客戶中文名稱','客戶英文名稱','客戶聯繫人','聯絡人電話','聯絡人電郵'];modal('編輯公司 · '+BO.tab,`<div class="grid">${keys.map(k=>`<div class="field"><label>${k}</label><input data-detail-field="${k}" value="${esc(r[k]||'')}"></div>`).join('')}</div>`,btn('取消','close')+btn('儲存草稿','detail-draft')+btn('儲存變更','detail-save','primary'))},'detail-save':()=>{if(!can(2))return deny();const r=rows.find(r=>rowKey(r)===BO.editMid);$$('[data-detail-field]').forEach(i=>r[i.dataset.detailField]=i.value);audit('更新商戶 '+BO.editMid);$('#modal').close();render();toast('本次 Demo 資料已更新')},'detail-draft':()=>{let vals={};$$('[data-detail-field]').forEach(i=>vals[i.dataset.detailField]=i.value);try{localStorage.setItem('allinpay-company-draft-'+BO.editMid,JSON.stringify(vals));toast('編輯內容草稿已存於本瀏覽器')}catch{toast('草稿儲存失敗')}},'company-upload':()=>{if(!can(2))return deny();modal('重新上傳文件','<p>選擇新文件，確認後替換本次 Demo 的附件紀錄。</p><input id="company-file" type="file" accept=".pdf,.png,.jpg,.jpeg"><p class="hint">單檔上限 10 MB，不會上傳至伺服器。</p>',btn('取消','close')+btn('確認文件','confirm-company-file','primary'))},'confirm-company-file':()=>{let f=$('#company-file').files[0];if(!f||f.size>10*1024*1024||!/\.(pdf|png|jpe?g)$/i.test(f.name))return toast('請選擇 10 MB 以下 PDF／PNG／JPG');audit('重新上傳文件（本機）：'+f.name);modal('文件已更新',`<p>${esc(f.name)}</p><p class="hint">僅更新本機示例紀錄，未傳送真實文件。</p>`)},
transfer:el=>transferModal(el.dataset.mid),'transfer-save':()=>{if(!can(6))return deny();let changes=$$('[data-transfer]').filter(i=>i.value.trim()),e=$('#transfer-error');if(!changes.length||!$('#transfer-confirm').checked){e.textContent='請填寫至少一項新資料並勾選確認聲明。';return}let b=changes.find(i=>i.dataset.transfer==='分行代碼');if(b&&!/^\d{3}$/.test(b.value)){e.textContent='分行代碼須為 3 位數字。';return}let r=rows.find(r=>rowKey(r)===state.transferMid);changes.forEach(i=>{r[i.dataset.transfer]=i.value.trim();if(i.dataset.transfer==='銀行帳號'){r.bank=i.value.trim();r['銀行帳號']=mask(r.bank)}});audit('商戶轉換：'+state.transferMid);$('#modal').close();render();toast('已更新有填寫的新資料，未填項目保留原值')},
'import-sample':()=>{BO.importRows=sourceRows.map((r,i)=>({name:r['客戶中文名稱'],mid:rowKey(r),br:r.BR,error:i===1?'缺少 CR 有效期':i===3?'MID 重複':''}));render()},'import-template':()=>downloadCSV('merchant-import-template.csv',[['客戶中文名稱','公司 MID','BR'],['測試商戶','DEMO-NEW-001','12345678']]),'import-errors':()=>downloadCSV('merchant-import-errors.csv',[['客戶中文名稱','公司 MID','錯誤'],...BO.importRows.filter(r=>r.error).map(r=>[r.name,r.mid,r.error])]),'import-reset':()=>{BO.importRows=[];render()},'import-confirm':()=>{if(!can(3))return deny();const ok=BO.importRows.filter(r=>!r.error);if(!ok.length)return toast('沒有通過驗證的資料');for(const item of ok){if(rows.some(r=>rowKey(r)===item.mid))continue;rows.push({...sourceRows[0],'客戶中文名稱':item.name,'公司 MID':item.mid,BR:item.br,status:'Draft'})}audit('模擬批量導入 '+ok.length+' 筆');BO.importRows=[];modal('導入完成（Demo）',`<p>${ok.length} 筆通過的資料已處理；重複 MID 不新增。</p>`,btn('查看商戶','open-merchants','primary'));}
});
// Action-time checks: disabling buttons alone is not an authorization model.
for(const [action,permission]of Object.entries({'edit':2,'confirm-edit':2,'reveal':5,'sync':8,'batch-sync':8,'new':1,'save-draft':1,'submit':1,'confirm-submit':1})){const original=actions[action];actions[action]=el=>{if(!can(permission))return deny();return original(el)}}
document.addEventListener('change',async e=>{let t=e.target;if(t.dataset.colVisible){t.checked?BO.hidden.delete(t.dataset.colVisible):BO.hidden.add(t.dataset.colVisible)}if(t.id==='import-file'){let f=t.files[0];if(!f||f.size>10*1024*1024)return toast('請選擇 10 MB 以下的文件');if(/\.xlsx?$/i.test(f.name)){actions['import-sample']();toast('Excel 示範：載入預設驗證結果，未解析此檔案');return}if(!/\.csv$/i.test(f.name))return toast('僅支援 CSV／Excel');let lines=(await f.text()).replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1,501),seen=new Set(rows.flatMap(r=>[rowKey(r),r['公司 MID']]).filter(Boolean));BO.importRows=lines.map(l=>{let v=l.split(',').map(s=>s.trim().replace(/^"|"$/g,'')),error=!v[0]||!v[1]?'缺少必填欄位':seen.has(v[1])?'MID 重複':!/^\d{8}(?:-\d{3})?$/.test(v[2]||'')?'BR 格式不正確':'';seen.add(v[1]);return {name:v[0],mid:v[1],br:v[2],error}});render();}});
setInterval(()=>{let b=$('#bo-resend');if(b){let n=Math.max(0,Math.ceil((BO.resendAt-Date.now())/1000));b.disabled=n>0;b.textContent=n?'重新發送（'+n+'s）':'重新發送'}},1000);

// September 23 Figma update. This is a LOCAL demo, never a security boundary.
const DBKEY = 'allinpay-backoffice-20260923-v1';
const SESSIONKEY = DBKEY + '-session';
const demoNames = ['海港科技','新星零售','城市精選','頂峰創意工作室','金聯貿易','晨星餐飲','青木生活','星河數碼','樂悠旅遊','維港咖啡','朗晴教育','明日設計','好日烘焙','尚品家居','嘉信物流','創源工程','柏林花藝','晴天運動','東岸珠寶','匯聚書店','森活食品','銀河寵物','一木文創','海灣精品'];
const contacts = ['陳嘉欣','李志豪','黃嘉敏','林子晴','張家輝','周俊傑','鄭思穎','吳詠欣'];
const agencyPeople = ['陳偉明','李志豪','張家輝','林嘉欣','周俊傑','鄭思穎'];
const industryData = [['5734','電腦軟件'],['5411','食品零售'],['5999','專門零售'],['7399','商業服務'],['5045','電腦設備'],['5812','餐飲'],['5942','書店'],['5995','寵物用品']];
Object.assign(statusNames,{MoreInfo:'待補資料',SyncFailed:'同步失敗',Rejected:'已拒絕'});
Object.assign(statusColors,{MoreInfo:'amber',SyncFailed:'red',Rejected:'red'});
const DEMO = {size:20, columnFilters:{}, menu:null, review:null, queue:null, queuePage:1, fileURLs:new Map(), br:null, period:'30', draftPage:1};
// Never inherit previously entered legacy demo data into this new demonstration.
accounts = accounts.slice(0,6).map((a,i)=>({...a,agencyCode:i===2?'MA-001':i===3?'SA-001':i===4?'SA-002':i===5?'SA-003':'',permissions:rolePermissions(a.role)}));
for(let i=6;i<28;i++) accounts.push({id:'ACC-'+(i+1),name:contacts[i%8]+'（示例 '+(i+1)+'）',email:'staff'+(i+1)+'@example.com',role:roles[2+i%2],agency:agencyPeople[i%3],agencyCode:(i%2?'SA-':'MA-')+String(i+1).padStart(3,'0'),status:i%11===0?'已停用':i%7===0?'待啟用':'已啟用',last:'2026/09/23 '+String(8+i%5).padStart(2,'0')+':'+String(i*7%60).padStart(2,'0'),permissions:rolePermissions(roles[2+i%2]),scope:'本人及獲指派的商戶'});
rows.splice(0,rows.length,...Array.from({length:240},(_,i)=>{
  const r={...sourceRows[i%5]}, firstIds=['M000238','M000412','M000531','M000640','M000715','M000826'];
  const status=i<6?['MoreInfo','Approved','Pending','Synced','SyncFailed','Pending'][i]:['Synced','Approved','Pending','MoreInfo','Enabled','Pending','SyncFailed','Rejected','Draft','Disabled'][i%10];
  const group=i%3, bankCodes=['004','012','024','003','015'];
  return {...r,'客戶中文名稱':demoNames[i%24]+(i<24?'有限公司':'（'+String(Math.floor(i/24)+1).padStart(2,'0')+'）有限公司'),'客戶英文名稱':i===0?'HARBOUR TECH LIMITED':'DEMO '+['RETAIL','TECH','LIVING','TRADING','FOOD','DESIGN'][i%6]+' '+String(i+1).padStart(3,'0')+' LIMITED','公司 MID':firstIds[i]||'M'+String(1000+i).padStart(6,'0'),BR:String(71234567+i*17),'BR 有效期':i%17===0?'2026/10/05':'2028/08/31','CR 有效期':'2028/06/30','DBA no.':'DBA-'+String(i+1).padStart(5,'0'),'地區':['香港','九龍','新界'][i%3],'客戶類型':i%12===0?'集團':'普通','主代理商':agencyPeople[group],'主代理商代碼':'MA-'+String(group+1).padStart(3,'0'),'次代理商':agencyPeople[3+i%3],'次代理商代碼':'SA-'+String(i%3+1).padStart(3,'0'),'客戶聯繫人':contacts[i%8],'聯絡人電話':'+852 6000 '+String(i+1).padStart(4,'0'),'聯絡人電郵':'merchant'+(i+1)+'@example.com','MCC 行業代碼':industryData[i%8][0],'行業類型':industryData[i%8][1],'銀行名稱':options.cardBankCode.find(b=>b.startsWith(bankCodes[i%5])).slice(4),'銀行代碼':bankCodes[i%5],'分行代碼':String(101+i%200),'銀行帳號':'6222 **** '+String(4821+i).padStart(4,'0'),bank:'62220000'+String(4821+i).padStart(4,'0'),'單筆最高交易金額':String(5000+i*200),'小票號':'RCP-DEMO-'+(i+1),'官網連結':'https://example.com','最後更新':'2026/09/'+String(1+i%23).padStart(2,'0')+' 10:30',status,createdDay:1+i%30,missing:i%2?['銀行月結單（最近 1 個月）','董事地址證明']:['BR 清晰副本','聯絡電郵驗證'],syncReason:['銀行代碼與銀行名稱不一致','遠端服務暫時未回應（示例）','收款帳戶資料未通過核對'][i%3],owner:i%3===0?'ACC-3':'ACC-'+(7+i%22),vip:i<6};
}));
BO.audit=Array.from({length:18},(_,i)=>({time:'2026/09/23 '+String(12-Math.floor(i/5)).padStart(2,'0')+':'+String(58-i*3%60).padStart(2,'0'),user:contacts[i%8],message:['更新商戶聯絡資料','儲存新增商戶草稿','完成資料審核','確認補件清單','模擬同步失敗'][i%5]+' · '+demoNames[i%24]+'（模擬）'}));
state.drafts=[];
for(let i=0;i<18;i++){
  state.values={};state.checks={};state.files={};defaults();fillSample(rows[i]);
  const step=2+i%5;if(step<5){state.values.contactEmail='';state.emailVerified=false;}
  state.drafts.push({id:'DEMO-DRAFT-'+String(i+1).padStart(3,'0'),owner:i%3===0?'ACC-3':i%3===1?'ACC-4':'ACC-1',step,savedAt:'2026/09/23 '+String(9+i%4).padStart(2,'0')+':'+String(i*3%60).padStart(2,'0'),values:structuredClone(state.values),checks:structuredClone(state.checks),files:structuredClone(state.files),people:{...state.people},emailVerified:state.emailVerified});
}
Object.assign(state,{values:{},checks:{},files:{},people:{directors:1,authSigners:1,shareHolders:1},emailVerified:false,errors:{},selected:new Set(),noticeCount:12});defaults();
try {const stored=JSON.parse(localStorage.getItem(DBKEY)||'null');if(stored?.version===1&&Array.isArray(stored.rows)&&Array.isArray(stored.accounts)&&Array.isArray(stored.drafts)){rows.splice(0,rows.length,...stored.rows);accounts=stored.accounts;state.drafts=stored.drafts;BO.audit=stored.audit||[];state.noticeCount=stored.noticeCount??12;}}catch{}
function persistDemo(){try{localStorage.setItem(DBKEY,JSON.stringify({version:1,rows,accounts,drafts:state.drafts,audit:BO.audit.slice(0,300),noticeCount:state.noticeCount}));return true;}catch{return false;}}
saveAccounts=persistDemo;
try{const uid=sessionStorage.getItem(SESSIONKEY);BO.user=accounts.find(a=>a.id===uid&&a.status==='已啟用')||null;}catch{}
const oldLoginAs=loginAs;
loginAs=function(a){oldLoginAs(a);if(BO.user){try{sessionStorage.setItem(SESSIONKEY,a.id);}catch{}state.selected.clear();persistDemo();}};
const scopedRows=()=>!BO.user?[]:BO.user.role===roles[2]?rows.filter(r=>r['主代理商代碼']===(BO.user.agencyCode||'MA-001')):BO.user.role===roles[3]?rows.filter(r=>r['次代理商代碼']===(BO.user.agencyCode||'SA-001')):rows;
const scopedDrafts=()=>state.drafts.filter(d=>BO.user&&(BO.user.role===roles[0]||BO.user.role===roles[1]||d.owner===BO.user.id));
const accessibleRow=mid=>scopedRows().find(r=>rowKey(r)===mid);
const cellValue=(r,h)=>h==='商戶狀態'?statusNames[r.status]:h==='公司 MID'?midInfo(r).label:String(r[h]??'');
filteredRows=function(){const q=state.search.trim().toLowerCase();let list=scopedRows().filter(r=>(state.status==='全部狀態'||statusNames[r.status]===state.status)&&(!q||(state.searchScope==='全部欄位'?headers.map(h=>cellValue(r,h)).join(' '):cellValue(r,state.searchScope)).toLowerCase().includes(q))&&Object.entries(DEMO.columnFilters).every(([h,vals])=>vals.includes(cellValue(r,h))));if(BO.sort)list.sort((a,b)=>cellValue(a,BO.sort).localeCompare(cellValue(b,BO.sort),'zh-Hant',{numeric:true})*(BO.desc?-1:1));return list;};
const pageButtons=(page,count,action='page')=>{const max=Math.max(1,count);return `<div class="pagination">${btn('‹',action,'',`aria-label="上一頁" data-page="${page-1}" ${page<=1?'disabled':''}`)}${[...new Set([1,Math.max(1,page-1),page,Math.min(max,page+1),max])].sort((a,b)=>a-b).map(n=>btn(n,action,n===page?'primary':'',`data-page="${n}"`)).join('')}${btn('›',action,'',`aria-label="下一頁" data-page="${page+1}" ${page>=max?'disabled':''}`)}</div>`};
function heading(title,description=''){return `<div class="page-heading"><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>`;}
dashboard=function(){const list=scopedRows().filter(r=>DEMO.period==='30'||r.createdDay>=24),counts=['all','Pending','MoreInfo','SyncFailed'].map(s=>s==='all'?list.length:list.filter(r=>r.status===s).length);return `${heading('儀表板','營運總覽 · 優先處理風險、待辦及重點商戶。')}${demoBar()}<div class="toolbar"><select aria-label="統計日期範圍" id="demo-period"><option value="30">最近 30 天</option><option value="7" ${DEMO.period==='7'?'selected':''}>最近 7 天</option></select><span class="grow hint">資料範圍：${BO.user.role.includes('代理')?'所屬代理商':'全部商戶'} · 即時 Demo 數據</span>${can(1)?btn('新增商戶','new','primary'):''}</div><div class="metrics">${['商戶總數','待審核','待補資料','同步失敗'].map((name,i)=>`<button class="metric" data-action="metric" data-index="${i}"><span>${name}</span><strong>${counts[i]}</strong><small>${['查看全部商戶 →','查看審核清單 →','查看補件清單 →','核對失敗原因 →'][i]}</small></button>`).join('')}</div><section class="card"><h2>優先待辦 <span class="muted">Priority Actions</span></h2><p class="hint">依處理急迫程度排序，點擊「處理」開啟商戶審核。</p>${[['緊急','同步失敗',counts[3]+' 間商戶等待重新同步，請確認銀行資料與驗證結果。'],['即將到期','證照提醒',list.filter(r=>r['BR 有效期']==='2026/10/05').length+' 間商戶的 BR 將於 30 日內到期。'],['待跟進','審核與補件',counts[1]+' 間待審核；'+counts[2]+' 間待補資料。'],['可續填','尚未提交草稿',scopedDrafts().length+' 份草稿尚未完成，可從草稿頁繼續填寫。']].map(([tag,title,copy])=>`<div class="priority-row"><span class="priority-label">${tag}</span><strong>${title}</strong><p>${copy}</p>${btn('處理','priority-review')}</div>`).join('')}</section><section class="card"><h2>VIP／重點商戶 <span class="muted">Key Accounts</span></h2><p class="hint">需要優先跟進的商戶與目前進度。</p>${list.filter(r=>r.vip).slice(0,4).map(r=>`<div class="priority-row"><strong>${esc(r['客戶中文名稱'])}</strong><span>負責人：${esc(r['主代理商'])}</span>${pill(statusNames[r.status],statusColors[r.status])}${btn('查看商戶','detail','',`data-mid="${rowKey(r)}"`)}</div>`).join('')||'<p class="hint">本區間沒有重點商戶。</p>'}</section><section class="card"><h2>最新動態 <span class="muted">Recent Activity</span></h2>${visibleAudit().slice(0,5).map(a=>`<p class="hint">${esc(a.time)}　${esc(a.user)} · ${esc(a.message)}</p>`).join('')}${can(11)?btn('查看全部記錄','activity'):''}</section>`;};
function visibleAudit(){return BO.user?.role.includes('代理')?BO.audit.filter(a=>a.user===BO.user.name):BO.audit;}
merchantCell=function(r,h){const id=esc(rowKey(r));if(h==='公司 MID')return `<td>${midDisplay(r)}</td>`;if(h==='操作')return `<td><div class="row-actions">${can(2)?btn('編輯','edit','',`data-mid="${id}"`):''}${btn('公司詳情','detail','',`data-mid="${id}"`)}${can(6)?btn('BR轉換','transfer','',`data-mid="${id}"`):''}${can(7)?btn('審核','review-merchant','review-button',`data-mid="${id}" ${!['Pending','MoreInfo'].includes(r.status)?'disabled':''}`):''}${can(8)?btn(['Syncing','AwaitingResponse'].includes(r.status)?'查詢同步結果':'同步至 All-In Pay',['Syncing','AwaitingResponse'].includes(r.status)?'mid-check':'sync','sync-button',`data-mid="${id}" ${!['Approved','SyncFailed','Syncing','AwaitingResponse'].includes(r.status)?'disabled':''}`):''}</div></td>`;if(h==='銀行帳號'&&!can(5))return `<td>${esc(r[h])}</td>`;return originalCell(r,h);};
// Stable content-sized columns across pages; long prose wraps, identifiers stay readable.
function merchantColumnWidths(cols){
 const ctx=document.createElement('canvas').getContext('2d');
 const family=getComputedStyle(document.body).fontFamily,measure=(text,bold=false)=>{ctx.font=(bold?'600 ':'400 ')+'13px '+family;return ctx.measureText(String(text)).width;};
 const caps={'客戶中文名稱':170,'客戶英文名稱':196,'聯絡人電郵':176,'銀行名稱':150,'所屬集團':140,'官網連結':150};
 const data=scopedRows();
 return cols.map(h=>{
  if(h==='選取')return 44;
  if(h==='操作')return Math.ceil([...(can(2)?['編輯']:[]),'公司詳情',...(can(6)?['BR轉換']:[]),...(can(7)?['審核']:[]),...(can(8)?['同步至 All-In Pay']:[])].reduce((n,v)=>n+measure(v)+18,0)+46);
  const header=measure(h,true)+54;
  const value=Math.max(0,...data.map(r=>measure(cellValue(r,h))));
  const extra=h==='銀行帳號'&&can(5)?56:['商戶狀態','公司 MID'].includes(h)?46:28;
  return Math.ceil(Math.max(header,caps[h]?Math.min(value+extra,caps[h]):value+extra));
 });
}
merchants=function(){let list=filteredRows(),pages=Math.max(1,Math.ceil(list.length/DEMO.size));state.page=Math.min(Math.max(1,state.page),pages);const shown=list.slice((state.page-1)*DEMO.size,state.page*DEMO.size),cols=visibleMerchantColumns(),widths=merchantColumnWidths(cols);const style=(h,i)=>`${BO.pins.includes(h)?'class="pinned" ':''}style="width:${widths[i]}px;${BO.pins.includes(h)?'left:'+widths.slice(0,i).reduce((s,v)=>s+v,0)+'px;':''}"`;return `${heading('商戶管理','公司 MID／BR 管理（Excel 表單）')}${demoBar()}${state.noticeCount?`<div class="notice toolbar"><span class="grow">${state.noticeCount} 筆新加入或修改的商戶資料待確認</span>${btn('確認已讀','read-notice')}</div>`:''}<section class="card"><div class="search-grid"><div><label for="merchant-search">跨欄位搜尋</label><input id="merchant-search" value="${esc(state.search)}" placeholder="搜尋公司名稱、MID、BR、代理商或聯絡人"></div><div><label for="search-scope">搜尋範圍</label><select id="search-scope">${['全部欄位',...headers.filter(h=>!['選取','操作'].includes(h))].map(h=>`<option ${state.searchScope===h?'selected':''}>${esc(h)}</option>`).join('')}</select></div><div><label for="merchant-status">商戶狀態</label><select id="merchant-status">${['全部狀態',...Object.values(statusNames)].map(h=>`<option ${state.status===h?'selected':''}>${h}</option>`).join('')}</select></div>${btn('重設','reset-search')}${btn('搜尋','search','primary')}</div></section><div class="toolbar"><label class="check"><input type="checkbox" id="demo-select-page" ${shown.length&&shown.every(r=>state.selected.has(rowKey(r)))?'checked':''}>全選本頁</label><span id="selected-count">已選 ${state.selected.size} 家</span><span class="grow"></span>${btn('顯示／排列欄位','columns')}${can(4)?btn('匯出 CSV','export-merchants'):''}${can(8)?btn('批次同步','batch-sync','sync-button'):''}</div>${Object.keys(DEMO.columnFilters).length?`<div class="filter-tags">${Object.entries(DEMO.columnFilters).map(([h,v])=>btn(esc(h)+'：'+v.length+' 項 ×','remove-column-filter','',`data-col="${esc(h)}"`)).join('')}</div>`:''}<div class="table-wrap"><table class="merchants merchant-table-new" style="width:${widths.reduce((s,v)=>s+v,0)}px"><thead><tr>${cols.map((h,i)=>`<th scope="col" ${style(h,i)}><span class="merchant-head">${esc(h)}${!['選取','操作'].includes(h)?btn((BO.sort===h?(BO.desc?'↓ ':'↑ '):'')+'▾','column-menu',DEMO.columnFilters[h]?'filtered':'',`data-col="${esc(h)}" aria-label="${esc(h)}欄位選單" aria-haspopup="dialog"`):''}</span></th>`).join('')}</tr></thead><tbody>${shown.map(r=>`<tr>${cols.map((h,i)=>merchantCell(r,h).replace('<td>',`<td ${style(h,i)}>`)).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}">沒有符合條件的商戶，請調整篩選。</td></tr>`}</tbody></table></div><div class="table-footer"><span class="hint">顯示 ${list.length?(state.page-1)*DEMO.size+1:0}–${Math.min(state.page*DEMO.size,list.length)}，共 ${list.length} 筆 · 全部為假資料</span><label>每頁 <select id="demo-page-size">${[20,40,80].map(n=>`<option ${n===DEMO.size?'selected':''}>${n}</option>`).join('')}</select> 筆</label>${pageButtons(state.page,pages)}</div>`;};
function closeColumn(){const menu=$('#column-popover');if(menu)menu.remove();DEMO.menu=null;}
function showColumn(el){closeColumn();const h=el.dataset.col,values=[...new Set(scopedRows().map(r=>cellValue(r,h)))].sort((a,b)=>a.localeCompare(b,'zh-Hant',{numeric:true}));DEMO.menu={h,values,selected:new Set(DEMO.columnFilters[h]||values),query:'',choice:BO.sort===h?(BO.desc?'desc':'asc'):null,anchor:el};const p=document.createElement('section');p.id='column-popover';p.className='column-popover';p.setAttribute('role','dialog');p.setAttribute('aria-label',h+'欄位選單');const rect=el.getBoundingClientRect();p.style.left=Math.max(8,Math.min(innerWidth-268,rect.right-260))+'px';p.style.top=Math.max(8,Math.min(innerHeight-430,rect.bottom+6))+'px';p.innerHTML=`<strong>${esc(h)}</strong><div class="column-choices">${[['asc','升序排列'],['desc','降序排列'],['hide','隱藏此欄']].map(([v,l])=>btn(l,'column-choice',DEMO.menu.choice===v?'active':'',`data-choice="${v}" aria-pressed="${DEMO.menu.choice===v}"`)).join('')}</div><div class="column-freeze">${btn('凍結至此欄','column-freeze',BO.freezeThrough===h?'active':'',`aria-pressed="${BO.freezeThrough===h}" title="連同左邊所有顯示欄位一起凍結"`)}${BO.freezeThrough?btn('取消所有凍結','column-unfreeze'):''}</div><div class="menu-rule"></div><input id="column-search" aria-label="搜尋此欄位內容" placeholder="搜尋此欄位內容" autocomplete="off"><div id="column-results"><p class="hint">輸入關鍵字後顯示符合的內容</p></div><footer>${btn('清除','column-clear')}${btn('套用','column-apply','primary')}</footer>`;document.body.append(p);$('#column-search').focus();}
function columnResults(){const m=DEMO.menu;if(!m)return;const list=m.values.filter(v=>v.toLowerCase().includes(m.query.toLowerCase()));$('#column-results').innerHTML=!m.query.trim()?'<p class="hint">輸入關鍵字後顯示符合的內容</p>':`<div class="column-bulk">${btn('全選','column-all','text-button')}${btn('取消全選','column-none','text-button')}<small>${m.selected.size} 已選</small></div><div class="column-list">${list.map(v=>`<label><input type="checkbox" data-column-value="${esc(v)}" ${m.selected.has(v)?'checked':''}><span>${esc(v||'（空白）')}</span></label>`).join('')||'<p class="hint">沒有相符內容</p>'}</div>`;}
const uiToOld={1:5,2:1,3:2,4:3,5:4,6:6},oldToUi={1:2,2:3,3:4,4:5,5:1,6:6};
steps.splice(0,steps.length,'文件材料','主體資料','經營與聯繫','結算帳戶','產品與費率','確認提交');
const legacyApplication=application,legacyValidate=validateStep,legacyReview=review,legacyUpload=uploadRow,legacyFill=fillSample;
validateStep=step=>legacyValidate(uiToOld[step]);
review=()=>legacyReview().replace(/data-step="([1-6])"/g,(_,n)=>`data-step="${oldToUi[n]}"`).replaceAll('Step 5','Step 1');
const friendlyProducts=['線下收單 · In-store Acquiring','線上外卡 · Online Card Payments','線下掃碼 · In-store QR Payments','線上掃碼 · Online QR Payments','帳戶驗證 · Account Verification','一碼付 · Unified QR Payments','支付連結 · Payment Links'];
forms[3].sections.slice(0,7).forEach((s,i)=>{s.texts[0]=friendlyProducts[i];s.texts[1]='勾選需要開通的產品，可同時選擇多項。';});
forms[4].sections[0].texts[1]='依法律主體、產品及風險決定必交項目。PDF／JPG／PNG／ZIP，每檔上限 10 MB；文件僅留在目前瀏覽器。';
application=function(step){let html=legacyApplication(uiToOld[step]);if(step===1)html=`<section class="br-callout"><div><h2>先匯入 BR，讓系統幫你填</h2><p>核對辨識結果後，帶入主體資料與經營資料。</p><small>本 HTML 使用固定假資料演示；實際文件辨識請使用獨立 BR 工具。</small></div><div>${btn('匯入 BR','br-start','primary')}<a href="https://notdesign.github.io/allinpay-br-demo/" target="_blank" rel="noopener noreferrer">開啟本機 BR 辨識工具 ↗</a></div></section>`+html;return html;};
function invitationSource(){
  if(!can(1))return null;
  const user=BO.user,isAgent=user.role.includes('代理'),code=isAgent?user.agencyCode:user.id;
  if(!code)return null;
  const label=isAgent?'代理商代碼':'邀請帳號',query=isAgent?'agency':'inviter';
  return {label,code,isAgent,identity:`${user.role}：${user.name} · ${label}：${code}`,link:'https://notdesign.github.io/allinpay-merchant-demo/external.html?'+query+'='+encodeURIComponent(code)};
}
function invitation(){const source=invitationSource();return source?`<section class="agency-invitation"><div><h3>邀請客戶填寫</h3><p>分享你的專屬申請連結，客戶可自行填寫；連結會附上你的${source.label}。</p><small>${esc(source.identity)}</small></div>${btn('分享我的申請連結','share-agency','primary')}</section>`:'';}
uploadRow=function(u){const f=state.files[u.id],error=state.errors['file-'+u.id];return `<div class="upload-row ${error?'invalid':''}" data-upload-row="${u.id}"><div class="upload-heading"><div class="upload-name">${labelHTML(u.name)}${requiredFiles().includes(u.id)?' <span class="required">*</span>':''}</div>${f?pill('已選取','green'):pill('未選取')}</div><p class="hint">${esc(u.hint)}</p><div class="file-state ${f?'ready':''}">${f?esc(f.name)+(f.demo?' · 示例附件':f.needsReselect?' · 請重新選取':' · 僅本機'):'尚未選擇文件'}</div>${error?`<p class="error">${esc(error)}</p>`:''}<div class="upload-actions">${f?btn('預覽','preview-demo-file','',`data-id="${u.id}"`)+btn('移除','remove-file','danger',`data-id="${u.id}"`):''}${btn(f?'重新選擇':'選擇文件','demo-upload','',`data-id="${u.id}"`)}<input hidden type="file" data-demo-upload="${u.id}" accept=".pdf,.jpg,.jpeg,.png,.zip"></div></div>`;};
fillSample=function(row=rows[0]){legacyFill(row);state.values.registerCertNo=String(row.BR).replace(/^BR /,'').replace(/-\d{3}$/,'')+'-000';state.values.cardBankCode=row['銀行代碼']+' '+row['銀行名稱'];state.values.cardBankName=row['銀行名稱'];state.values.cardBranchCode=row['分行代碼'];state.values.developer=BO.user?.agencyCode||'MA-001';};
function draftSnapshot(id=state.draftId||'DRAFT-'+Date.now()){return {id,owner:BO.user.id,step:route().step,savedAt:new Date().toLocaleString('zh-HK',{hour12:false}),values:structuredClone(state.values),checks:structuredClone(state.checks),files:structuredClone(state.files),people:{...state.people},emailVerified:state.emailVerified};}
saveDraft=function(){if(!can(1))return deny();if(state.fail){modal('草稿儲存失敗','<div class="notice error">未能儲存，輸入內容仍保留在目前表單。</div><p>關閉「模擬失敗」後可重新儲存。</p>',btn('返回編輯','close')+btn('重試','save-draft','primary'));return;}const d=draftSnapshot(),before=state.drafts;state.drafts=[d,...state.drafts.filter(x=>x.id!==d.id)];if(!persistDemo()){state.drafts=before;return modal('草稿儲存失敗','<p>瀏覽器儲存空間不可用；請勿關閉此頁。</p>');}state.draftId=d.id;state.savedAt=d.savedAt;audit('儲存商戶草稿 · '+(d.values.merchantName||'未命名商戶'));persistDemo();modal('草稿儲存成功',`<div class="notice">${esc(d.values.merchantName||'未命名商戶')} 已儲存。</div><p>可從「已儲存的草稿」繼續填寫。實際附件只保留檔名，下次須重新選取。</p>`,btn('查看草稿','drafts')+btn('繼續填寫','close','primary'));};
draftView=function(){const ds=scopedDrafts(),pages=Math.max(1,Math.ceil(ds.length/20));DEMO.draftPage=Math.min(DEMO.draftPage,pages);return `${heading('已儲存的草稿','資料只存在目前瀏覽器，可繼續填寫或刪除。')}${demoBar()}<section class="card"><div class="table-scroll"><table class="accounts-table"><thead><tr><th>商戶／草稿編號</th><th>填寫進度</th><th>最後儲存</th><th>草稿狀態</th><th>操作</th></tr></thead><tbody>${ds.slice((DEMO.draftPage-1)*20,DEMO.draftPage*20).map(d=>`<tr><td>${esc(d.values.merchantName||'未命名商戶')}<small>${esc(d.id)}</small></td><td>Step ${d.step}／6 · ${steps[d.step-1]}</td><td>${esc(d.savedAt)}</td><td class="center">${pill(d.step>=5?'接近完成':'填寫中',d.step>=5?'blue':'')}</td><td><div class="row-actions">${btn('繼續填寫','restore','primary',`data-id="${d.id}"`)}${btn('刪除','delete-draft','danger',`data-id="${d.id}"`)}</div></td></tr>`).join('')||'<tr><td colspan="5">沒有草稿。請從新增商戶開始。</td></tr>'}</tbody></table></div><div class="table-footer"><span>共 ${ds.length} 份草稿</span>${pageButtons(DEMO.draftPage,pages,'draft-page')}</div></section>`;};
function queueModal(status){DEMO.queue=status;const list=scopedRows().filter(r=>r.status===status&&(DEMO.period==='30'||r.createdDay>=24));const p=Math.max(1,Math.min(DEMO.queuePage,Math.ceil(list.length/10)||1));DEMO.queuePage=p;modal(statusNames[status]+'商戶',`<p class="hint">共 ${list.length} 間 · 點擊右側操作查看或處理。</p><div class="table-scroll"><table class="accounts-table queue-table"><thead><tr><th>商戶／公司 MID</th><th>${status==='MoreInfo'?'待補項目':status==='SyncFailed'?'失敗原因':'申請狀態'}</th><th>操作</th></tr></thead><tbody>${list.slice((p-1)*10,p*10).map(r=>`<tr><td>${esc(r['客戶中文名稱'])}<small>公司 MID：${midDisplay(r)}</small></td><td>${status==='MoreInfo'?esc(r.missing.join('、')):status==='SyncFailed'?esc(r.syncReason):pill('待審核','amber')}</td><td>${btn(status==='Pending'?'審核':'查看詳情',status==='Pending'?'review-merchant':status==='MoreInfo'?'missing-detail':'sync-detail',status==='Pending'?'review-button':'',`data-mid="${rowKey(r)}"`)}</td></tr>`).join('')||'<tr><td colspan="3">目前沒有待處理商戶。</td></tr>'}</tbody></table></div>${pageButtons(p,Math.ceil(list.length/10),'queue-page')}`,btn('關閉','close'));}
const reviewReasons={Rejected:['註冊資料與證明文件不一致','不符合收單服務範圍','證照無效或已到期','未符合風險審核要求','其他'],MoreInfo:['缺少銀行月結單','身份或地址證明不完整','BR 圖片不清晰','商戶聯絡資料待確認','其他']};
function reviewModal(mid,decision='Approved'){if(!can(7))return deny();const r=accessibleRow(mid);if(!r)return deny();if(!['Pending','MoreInfo'].includes(r.status))return modal('目前不可審核',`<p>${esc(r['客戶中文名稱'])} 目前狀態為「${statusNames[r.status]}」。</p>`);const previous=DEMO.review;DEMO.review={mid,decision,reason:previous?.mid===mid&&previous.decision===decision?previous.reason:'',note:previous?.mid===mid?previous.note:''};const rev=DEMO.review;modal('商戶審核',`<div class="profile-summary"><h3>${esc(r['客戶中文名稱'])}</h3><p>${esc(r['客戶英文名稱'])}</p><small>公司 MID：${midDisplay(r)} · 目前狀態：${statusNames[r.status]}</small></div><div class="review-decisions">${[['Approved','通過'],['Rejected','拒絕'],['MoreInfo','退回補件']].map(([v,l])=>`<label class="${v===decision?'active':''}"><input type="radio" name="review-decision" value="${v}" ${v===decision?'checked':''}>${l}</label>`).join('')}</div>${decision!=='Approved'?`<div class="field"><label for="review-reason">${decision==='Rejected'?'拒絕':'補件'}原因 <span class="required">*</span></label><select id="review-reason"><option value="">請選擇原因</option>${reviewReasons[decision].map(x=>`<option ${x===rev.reason?'selected':''}>${x}</option>`).join('')}</select></div>`:''}<div class="field"><label for="review-note">${decision==='Approved'?'審核備註（選填）':'補充說明 <span class="required">*</span>'}</label><textarea id="review-note" rows="3" maxlength="500" placeholder="請填寫具體原因，方便後續跟進">${esc(rev.note)}</textarea></div><p id="review-error" class="modal-error" role="alert"></p><p class="hint">此操作只更新 Demo 商戶狀態，不會通知真實商戶。</p>`,btn('取消','close')+btn('確認審核結果','review-confirm','review-button'));}
function persistMerchantChange(message){state.noticeCount++;audit(message);persistDemo();render();}
sync=function(mids){if(!can(8))return deny();const selected=mids.map(accessibleRow).filter(Boolean),eligible=selected.filter(r=>['Approved','SyncFailed'].includes(r.status));if(!eligible.length)return modal('沒有可同步的商戶','<p>只有「通過審核」或「同步失敗」的商戶可以同步。</p>');if(state.fail){eligible.forEach(r=>{r.status='SyncFailed';r.syncReason='模擬連線中斷，請稍後重試';});persistMerchantChange('模擬同步失敗 · '+eligible.length+' 間');return modal('同步失敗','<div class="notice error">未能完成同步，資料已保留，可從同步失敗清單重試。</div>');}eligible.forEach(r=>r.status='Synced');persistMerchantChange('完成模擬同步 · '+eligible.length+' 間');modal('同步完成',`<div class="notice">${eligible.length} 間商戶已模擬同步。</div>${eligible.length<selected.length?`<p>${selected.length-eligible.length} 間狀態不適用，已略過。</p>`:''}<p class="hint">沒有向 All-In Pay 發送任何資料。</p>`);};
function brStart(){DEMO.br={phase:'upload',values:[['merchantName','中文名稱','海港科技有限公司'],['merchantEnglishName','英文名稱','SAMPLE HARBOUR TECHNOLOGY LIMITED'],['registerCertName','註冊證書名稱','SAMPLE HARBOUR TECHNOLOGY LIMITED'],['registerCertNo','BR 號碼','12345678-000'],['registerCertPeriod','證書有效期','2028-08-31'],['legalStatus','法律地位','法人團體 · Body Corporate'],['merchantProfile','業務性質','TECHNOLOGY SERVICES']],filename:'DEMO-BR.png',applied:false};modal('匯入 BR',`<div class="notice warn">互動示例：本 HTML 不會辨識你上傳的文件，以下使用固定假資料演示。</div><div class="import-zone"><h3>商業登記證（BR）</h3><p>可直接使用示例，或選取一份測試文件演示上傳。</p><input id="demo-br-file" type="file" accept=".pdf,.png,.jpg,.jpeg"><p class="hint">PDF／JPG／PNG · 最多 10 MB</p></div>`,btn('取消','close')+btn('使用示例辨識','br-recognize','primary'));}
function brReview(ready=false){const b=DEMO.br;b.phase=ready?'ready':'review';modal(ready?'已核對，準備套用':'核對辨識結果',`<p class="hint">${esc(b.filename)} · 固定示例辨識結果，請核對後才套用；地址不會自動帶入。</p><div class="br-fields">${b.values.map(([k,l,v])=>`<div class="field"><label for="br-${k}">${l}</label><input id="br-${k}" data-br-field="${k}" value="${esc(v)}" ${ready?'readonly':''}></div>`).join('')}</div><div class="notice warn">仍待核對：英文營業地址（區域拆分待確認）<br>無法辨識：商業登記證繳款日期。以上項目不會帶入。</div>${ready?'<p class="br-status">已核對，可套用；地址仍待確認</p>':'<label class="check"><input type="checkbox" id="br-checked">我已核對以上 7 個欄位，確認可套用。</label>'}<p id="br-error" class="modal-error"></p>`,btn('取消，保留原資料','close')+btn(ready?'確認並套用 7 個欄位':'已核對，準備套用',ready?'br-apply':'br-ready','primary'));}
function brResult(){const b=DEMO.br;modal('已成功寫入申請資料',`<div class="notice">7 個欄位已帶入，現在可以繼續填寫。</div><div class="import-result"><section><h3>完成匯入</h3><ol>${b.values.map(([,l,v])=>`<li><strong>${l}</strong>：${esc(v)}</li>`).join('')}</ol></section><section><h3>仍待核對 · 未帶入</h3><ol><li>英文營業地址：請核對並拆分地區與街道。</li></ol><h3>無法辨識 · 未帶入</h3><ol><li>商業登記證繳款日期：原件未能清楚辨識。</li></ol></section></div><p class="hint">BR 示例附件已加入 Step 1。其餘必填資料及文件仍須補齊。</p>`,btn('完成','close','primary'));}
const previousRender=render,legacyAccounts=accountList,legacyModal=modal;
modal=function(title,body,buttons){closeColumn();legacyModal(title,body,buttons);$('#modal').dataset.kind=/權限管理|核對辨識|準備套用|商戶轉換/.test(title)?'wide':/商戶$|公司詳情/.test(title)?'wide':'';};
accountList=function(){let html=legacyAccounts();const t=document.createElement('template');t.innerHTML=html;const body=t.content.querySelector('tbody');const all=[...body.children];const validCount=all[0]?.children.length===6?all.length:0;const p=Math.max(1,Math.min(BO.accountPage,Math.ceil(validCount/20)||1));BO.accountPage=p;all.forEach((tr,i)=>{if(validCount&&(i<(p-1)*20||i>=p*20))tr.remove();});const footer=[...t.content.querySelectorAll('p.hint')].find(p=>p.textContent.startsWith('顯示'));if(footer)footer.outerHTML=`<div class="table-footer"><span>顯示 ${validCount?(p-1)*20+1:0}–${Math.min(p*20,validCount)}，共 ${validCount} 個帳號</span>${pageButtons(p,Math.ceil(validCount/20),'account-page')}</div>`;return t.innerHTML;};
render=function(){closeColumn();previousRender();const r=route();if(!BO.user)return;if(r.page==='application'){const step=$('.stepper');if(step)step.insertAdjacentHTML('beforebegin',invitation());}if(r.page==='activity'){$('.content').innerHTML=`${heading('查閱更新記錄','本機操作紀錄，不會上傳至伺服器。')}${can(11)?`<section class="card"><div class="table-scroll"><table class="accounts-table"><thead><tr><th>時間</th><th>操作人員</th><th>內容</th></tr></thead><tbody>${visibleAudit().map(a=>`<tr><td>${esc(a.time)}</td><td>${esc(a.user)}</td><td>${esc(a.message)}</td></tr>`).join('')||'<tr><td colspan="3">沒有操作紀錄。</td></tr>'}</tbody></table></div></section>`:'<div class="readonly-banner">目前帳號沒有查看操作記錄的權限。</div>'}`;}};
Object.assign(actions,{
  'column-unfreeze':()=>{BO.freezeThrough=null;render();},'column-menu':showColumn,'column-freeze':()=>{const h=DEMO.menu?.h;if(!h||!headers.includes(h))return;BO.freezeThrough=h;closeColumn();render();$$('[data-action="column-menu"]').find(el=>el.dataset.col===h)?.focus({preventScroll:true});},'column-choice':el=>{DEMO.menu.choice=el.dataset.choice;$$('.column-choices button').forEach(b=>{const active=b===el;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});},
  'column-all':()=>{const m=DEMO.menu;m.values.filter(v=>v.toLowerCase().includes(m.query.toLowerCase())).forEach(v=>m.selected.add(v));columnResults();},'column-none':()=>{const m=DEMO.menu;m.values.filter(v=>v.toLowerCase().includes(m.query.toLowerCase())).forEach(v=>m.selected.delete(v));columnResults();},
  'column-clear':()=>{const m=DEMO.menu;delete DEMO.columnFilters[m.h];if(BO.sort===m.h)BO.sort=null;closeColumn();state.page=1;render();},'column-apply':()=>{const m=DEMO.menu;if(m.choice==='hide')BO.hidden.add(m.h);else if(m.choice){BO.sort=m.h;BO.desc=m.choice==='desc';}if(m.query.trim()||DEMO.columnFilters[m.h]){if(m.selected.size===m.values.length)delete DEMO.columnFilters[m.h];else DEMO.columnFilters[m.h]=[...m.selected];}closeColumn();state.page=1;render();},'remove-column-filter':el=>{delete DEMO.columnFilters[el.dataset.col];state.page=1;render();},
  'reset-search':()=>{state.search='';state.status='全部狀態';state.searchScope='全部欄位';state.page=1;DEMO.columnFilters={};render();},
  metric:el=>{if(el.dataset.index==='0'){state.search='';state.status='全部狀態';DEMO.columnFilters={};go('merchants');}else {DEMO.queuePage=1;queueModal(['','Pending','MoreInfo','SyncFailed'][+el.dataset.index]);}},'queue-page':el=>{DEMO.queuePage=+el.dataset.page;queueModal(DEMO.queue);},'priority-review':()=>{const r=scopedRows().find(r=>rowKey(r)==='M000826'&&['Pending','MoreInfo'].includes(r.status))||scopedRows().find(r=>['Pending','MoreInfo'].includes(r.status));if(r)reviewModal(rowKey(r));else modal('沒有待審核商戶','<p>目前範圍的商戶已處理完成。</p>');},'review-merchant':el=>reviewModal(el.dataset.mid),
  'review-confirm':()=>{const rev=DEMO.review;if(!can(7)||!accessibleRow(rev.mid))return deny();rev.reason=$('#review-reason')?.value||'';rev.note=$('#review-note').value.trim();if(rev.decision!=='Approved'&&(!rev.reason||!rev.note)){$('#review-error').textContent=!rev.reason?'請先選擇原因。':'請填寫補充說明。';return;}modal('確認提交審核結果',`<p>商戶：${esc(accessibleRow(rev.mid)['客戶中文名稱'])}</p><p>審核結果：<strong>${statusNames[rev.decision]}</strong></p>${rev.reason?`<p>原因：${esc(rev.reason)}</p>`:''}<p>${esc(rev.note||'沒有備註')}</p>`,btn('返回修改','review-back')+btn('確認提交','review-save','review-button'));},'review-back':()=>reviewModal(DEMO.review.mid,DEMO.review.decision),'review-save':()=>{if(!can(7))return deny();const rev=DEMO.review,r=accessibleRow(rev.mid);if(!r||!['Pending','MoreInfo'].includes(r.status))return deny();if(state.fail)return modal('審核儲存失敗','<div class="notice error">原狀態未變更，請關閉失敗模擬後重試。</div>',btn('返回審核','review-back','primary'));r.status=rev.decision;r.reviewReason=rev.reason;r.reviewNote=rev.note;if(rev.decision==='MoreInfo')r.missing=[rev.reason,rev.note];persistMerchantChange('審核 '+r['客戶中文名稱']+'：'+statusNames[r.status]);modal('審核結果已儲存',`<div class="notice">${esc(r['客戶中文名稱'])}：${statusNames[r.status]}</div><p>僅更新 Demo，未發送通知。</p>`,btn('完成','close','primary'));},
  'missing-detail':el=>{const r=accessibleRow(el.dataset.mid);if(!r)return deny();modal('待補資料詳情',`<h3>${esc(r['客戶中文名稱'])}</h3><ol>${r.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`,btn('返回清單','queue-back')+(can(7)?btn('審核','review-merchant','review-button',`data-mid="${rowKey(r)}"`):''));},'sync-detail':el=>{const r=accessibleRow(el.dataset.mid);if(!r)return deny();modal('同步失敗詳情',`<h3>${esc(r['客戶中文名稱'])}</h3><div class="notice error">${esc(r.syncReason)}</div><p class="hint">請先核對公司與結算資料，然後重新同步。</p>`,btn('返回清單','queue-back')+btn('公司詳情','detail','',`data-mid="${rowKey(r)}"`)+(can(8)?btn('重新同步','sync','sync-button',`data-mid="${rowKey(r)}"`):''));},'queue-back':()=>queueModal(DEMO.queue),sync:el=>sync([el.dataset.mid]),'batch-sync':()=>sync([...state.selected]),
  'demo-upload':el=>$(`[data-demo-upload="${el.dataset.id}"]`).click(),'preview-demo-file':el=>{const f=state.files[el.dataset.id],url=DEMO.fileURLs.get(el.dataset.id);if(!f)return;if(url&&/\.(png|jpe?g)$/i.test(f.name))modal('文件預覽',`<p>${esc(f.name)}</p><img class="document-preview" src="${url}" alt="選取的測試文件">`);else modal('文件預覽',`<p>${esc(f.name)}</p><p class="hint">${f.demo?'這是模擬附件記錄，不是真實文件。':f.needsReselect?'請先重新選取原文件。':'檔案已選取，僅保留在目前瀏覽器。'}</p>`);},
  'save-draft':saveDraft,'draft-page':el=>{DEMO.draftPage=+el.dataset.page;render();},'account-page':el=>{BO.accountPage=+el.dataset.page;render();},
  'confirm-delete':el=>{if(!scopedDrafts().some(d=>d.id===el.dataset.id))return deny();const before=state.drafts;state.drafts=state.drafts.filter(d=>d.id!==el.dataset.id);if(!persistDemo()){state.drafts=before;return toast('刪除失敗，草稿仍保留');}$('#modal').close();render();toast('草稿已刪除，無法復原');},
'confirm-submit':()=>{if(!can(1))return deny();if(Object.keys(validateAll()).length||!state.checks['613:4956'])return submit();const id=state.editing||'APP-'+crypto.randomUUID(),v=state.values,base=rows.find(r=>rowKey(r)===id);const entry={...(base||rows[0]),'客戶中文名稱':v.merchantName,'客戶英文名稱':v.merchantEnglishName,id,'公司 MID':base?.['公司 MID']||'',BR:v.registerCertNo,'BR 有效期':v.registerCertPeriod,'DBA no.':v.dbaNo,'客戶聯繫人':v.contactName,'聯絡人電話':v.contactPhone,'聯絡人電郵':v.contactEmail,'MCC 行業代碼':v.mcc,'行業類型':v.mccName||v.merchantProfile,'銀行名稱':v.cardBankName,'銀行代碼':v.cardBankCode,'分行代碼':v.cardBranchCode,bank:v.cardNo,'銀行帳號':mask(v.cardNo),status:'Pending',owner:BO.user.id,createdDay:23,application:structuredClone(draftSnapshot()),vip:false};if(BO.user.role===roles[2]){entry['主代理商']=BO.user.name;entry['主代理商代碼']=BO.user.agencyCode;}if(BO.user.role===roles[3]){entry['次代理商']=BO.user.name;entry['次代理商代碼']=BO.user.agencyCode;}if(base)Object.assign(base,entry);else rows.unshift(entry);state.drafts=state.drafts.filter(d=>d.id!==state.draftId);state.savedAt=new Date().toLocaleString();state.draftId=null;persistMerchantChange('提交商戶申請 · '+v.merchantName);modal('申請提交成功',`<div class="notice">申請已建立，等待審核。</div><p>申請編號：<strong>${id}</strong></p><p>${esc(v.merchantName)}</p>`,btn('查看商戶','open-merchants','primary'));},
  'read-notice':()=>{state.noticeCount=0;persistDemo();render();toast('已確認全部更新提示');},
  'br-start':brStart,'br-recognize':()=>{const f=$('#demo-br-file')?.files[0];if(f&&(f.size>10*1024*1024||!/\.(pdf|png|jpe?g)$/i.test(f.name)))return toast('請選擇 10 MB 以下的 PDF／PNG／JPG');DEMO.br.filename=f?.name||'DEMO-BR.png';modal('辨識中','<div class="progress-demo"></div><p>正在模擬辨識示例 BR，未讀取或分析真實文件。</p>','');const b=DEMO.br;setTimeout(()=>{if(!$('#modal').open||DEMO.br!==b)return;if(state.fail)modal('暫時無法辨識這份 BR','<div class="notice warn">圖片太模糊，或未找到完整 BR 欄位。</div><p>尚未寫入任何申請資料。關閉失敗模擬後可重新選擇。</p>',btn('先手動填寫','close')+btn('重新選檔','br-start','primary'));else brReview();},700);},'br-ready':()=>{if(!$('#br-checked').checked){$('#br-error').textContent='請先核對並勾選確認。';return;}let valid=true;DEMO.br.values.forEach(item=>{item[2]=$(`[data-br-field="${item[0]}"]`).value.trim();if(!item[2])valid=false;});if(!valid){$('#br-error').textContent='請補齊要套用的欄位。';return;}brReview(true);},'br-apply':()=>{if(DEMO.br?.phase!=='ready')return;if(state.fail)return modal('資料寫入失敗','<div class="notice error">這次資料尚未寫入，原有申請內容已保留。</div>',btn('返回核對','br-return')+btn('重試寫入','br-apply','primary'));DEMO.br.values.forEach(([k,,v])=>state.values[k]=v);state.files['140101']={name:DEMO.br.filename,size:102400,demo:true};DEMO.br.applied=true;render();brResult();},'br-return':()=>brReview(),
  'share-agency':()=>{const source=invitationSource();if(!source)return deny();modal('分享我的申請連結',`<p>客戶點擊後開啟商戶申請頁，連結會保留你的${source.label}。</p><div class="profile-summary">${esc(source.identity)}</div><div class="field"><label for="agency-link">專屬申請連結</label><input id="agency-link" readonly value="${esc(source.link)}"></div><div class="field"><label for="agency-message">邀請內容</label><textarea id="agency-message" rows="4">您好，請透過以下連結填寫商戶申請資料：\n${esc(source.link)}\n邀請人：${esc(BO.user.name)}（${esc(BO.user.role)}）</textarea></div><p class="hint">此為 Demo 邀請來源參數；尚未串接正式申請歸屬服務。</p>`,btn('複製邀請內容','copy-agency-message')+btn('複製連結','copy-agency-link','primary'));},'copy-agency-link':()=>copyText($('#agency-link').value),'copy-agency-message':()=>copyText($('#agency-message').value),
  settings:()=>modal('個人設定',`<div class="profile-summary"><strong>${esc(BO.user.name)}</strong><p>${esc(BO.user.email)} · ${esc(BO.user.role)}</p></div><p>語言：繁體中文</p><p class="hint">Demo 資料只儲存在本瀏覽器，沒有正式登入、郵件或 All-In Pay 連線。請勿輸入真實客戶或密碼。</p>`,btn('重設全部 Demo 資料','reset-demo','danger')+btn('登入安全設定','security-settings')+btn('關閉','close','primary')),
  'reset-demo':()=>modal('重設 Demo 資料','<p>將刪除此版本在本瀏覽器儲存的草稿、帳號及商戶修改，還原 240 間示例商戶；無法復原。</p>',btn('取消','close')+btn('確認重設','reset-demo-confirm','danger')),'reset-demo-confirm':()=>{try{localStorage.removeItem(DBKEY);sessionStorage.removeItem(SESSIONKEY);}catch{}state.values={};location.hash='/login';location.reload();},
  'bo-logout':()=>{BO.user=null;BO.pendingMutation=null;state.revealed.clear();state.selected.clear();Object.assign(state,{values:{},checks:{},files:{},draftId:null,savedAt:null,errors:{},emailVerified:false});defaults();try{sessionStorage.removeItem(SESSIONKEY);}catch{}$('#modal').close();go('login');}
});
async function copyText(value){try{await navigator.clipboard.writeText(value);toast('已複製');}catch{const el=$('#agency-link');el?.select();toast('無法自動複製，請選取文字後複製。');}}
const originalAuthPage=authPage;
authPage=page=>originalAuthPage(page).replace('href="external.html"','href="https://notdesign.github.io/allinpay-merchant-demo/external.html"');
actions['import-sample']=()=>{const batch=Date.now().toString().slice(-7);BO.importRows=Array.from({length:5},(_,i)=>({name:'批量示例商戶 '+(i+1),mid:'DEMO-'+batch+'-'+i,br:String(81234567+i),error:i===1?'缺少 CR 有效期':i===3?'MID 重複':''}));render();};
actions['import-confirm']=()=>{if(!can(3))return deny();let added=0,skipped=0;for(const item of BO.importRows){if(item.error||rows.some(r=>rowKey(r)===item.mid)){skipped++;continue;}rows.push({...rows[0],'客戶中文名稱':item.name,'客戶英文名稱':'DEMO IMPORTED MERCHANT',id:item.mid,'公司 MID':item.mid.startsWith('DEMO-')?'':item.mid,BR:item.br,status:'Draft',owner:BO.user.id,createdDay:23,vip:false,application:null,'主代理商代碼':BO.user.role===roles[2]?BO.user.agencyCode:'MA-001','次代理商代碼':BO.user.role===roles[3]?BO.user.agencyCode:'SA-001'});added++;}if(!added)return toast('沒有可導入的資料；請檢查格式及重複 MID');audit('模擬批量導入 '+added+' 筆');BO.importRows=[];state.noticeCount+=added;persistDemo();modal('導入完成（Demo）',`<div class="notice">已新增 ${added} 間商戶</div><p>${skipped} 筆格式錯誤或重複的資料未導入。</p><p class="hint">新增商戶為草稿狀態，請補齊資料後提交。</p>`,btn('查看商戶','open-merchants','primary'));};
const originalDetailEditor=actions['edit-detail'];
actions['edit-detail']=el=>{originalDetailEditor(el);if(!can(2))return;try{const draft=JSON.parse(localStorage.getItem(DBKEY+'-company-'+BO.editMid)||'null');if(draft){$$('[data-detail-field]').forEach(i=>{if(draft[i.dataset.detailField]!==undefined)i.value=draft[i.dataset.detailField];});toast('已提取這間公司的編輯草稿');}}catch{}};
actions['detail-draft']=()=>{if(!can(2))return deny();const vals={};$$('[data-detail-field]').forEach(i=>vals[i.dataset.detailField]=i.value);try{localStorage.setItem(DBKEY+'-company-'+BO.editMid,JSON.stringify(vals));modal('草稿儲存成功','<p>再次開啟這間公司的編輯視窗，會自動提取本瀏覽器的草稿。</p>',btn('完成','close','primary'));}catch{modal('草稿儲存失敗','<p>內容仍留在本次編輯中；請檢查瀏覽器儲存空間後再試。</p>');}};
const originalDetailSave=actions['detail-save'];
actions['detail-save']=()=>{if(!can(2))return deny();const bankInput=$$('[data-detail-field]').find(i=>i.dataset.detailField==='銀行帳號'),bank=bankInput?.value;originalDetailSave();const row=rows.find(r=>rowKey(r)===BO.editMid);if(bank&&!bank.includes('*')){row.bank=bank;row['銀行帳號']=mask(bank);}try{localStorage.removeItem(DBKEY+'-company-'+BO.editMid);}catch{}};
const originalClose=actions.close;actions.close=()=>{BO.pendingMutation=null;originalClose();};
// Guard both navigation entry points and mutations. Demo checks are not server auth.
for(const action of ['detail','edit','confirm-edit','transfer','reveal','company-upload','edit-detail']){const original=actions[action];actions[action]=el=>{const mid=el?.dataset?.mid||BO.detailMid;if(mid&&!accessibleRow(mid))return deny();return original(el);};}
const restoreDraft=actions.restore;actions.restore=el=>{if(!scopedDrafts().some(d=>d.id===el.dataset.id)||!can(1))return deny();restoreDraft(el);};
for(const action of ['detail-save','transfer-save','import-confirm','confirm-password','confirm-company-file']){const original=actions[action];actions[action]=el=>{const result=original(el);persistDemo();return result;};}
const originalEdit=actions['confirm-edit'];actions['confirm-edit']=el=>{const r=accessibleRow(el.dataset.mid);if(!r)return deny();originalEdit(el);if(r.application){Object.assign(state,structuredClone(r.application));state.editing=rowKey(r);state.draftId=null;render();}};
document.addEventListener('input',e=>{const t=e.target;if(t.id==='column-search'){const m=DEMO.menu;const first=!m.query.trim();m.query=t.value;if(first&&m.query.trim()&&!DEMO.columnFilters[m.h])m.selected=new Set(m.values.filter(v=>v.toLowerCase().includes(m.query.toLowerCase())));columnResults();}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.columnValue!==undefined){t.checked?DEMO.menu.selected.add(t.dataset.columnValue):DEMO.menu.selected.delete(t.dataset.columnValue);columnResults();}if(t.id==='demo-period'){DEMO.period=t.value;render();}if(t.id==='demo-page-size'){DEMO.size=+t.value;state.page=1;render();}if(t.id==='demo-select-page'){filteredRows().slice((state.page-1)*DEMO.size,state.page*DEMO.size).forEach(r=>t.checked?state.selected.add(rowKey(r)):state.selected.delete(rowKey(r)));render();}if(t.name==='review-decision'){DEMO.review.note=$('#review-note')?.value||'';reviewModal(DEMO.review.mid,t.value);}if(t.dataset.demoUpload){const f=t.files[0];if(!f)return;if(f.size>10*1024*1024||!/\.(pdf|png|jpe?g|zip)$/i.test(f.name))return modal('文件格式不符','<p>請選擇 10 MB 以下的 PDF／JPG／PNG／ZIP。</p>');const id=t.dataset.demoUpload,old=DEMO.fileURLs.get(id);if(old)URL.revokeObjectURL(old);DEMO.fileURLs.set(id,URL.createObjectURL(f));state.files[id]={name:f.name,size:f.size,demo:false,needsReselect:false};delete state.errors['file-'+id];render();toast('文件已選取，沒有上傳至伺服器');}});
document.addEventListener('pointerdown',e=>{if(DEMO.menu&&!e.target.closest('#column-popover')&&!e.target.closest('[data-action="column-menu"]'))closeColumn();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&DEMO.menu){const anchor=DEMO.menu.anchor;closeColumn();anchor?.focus();}});
window.addEventListener('resize',closeColumn);
// Local demo API for repeatable functional QA; no credentials or external requests.
window.AllinPayDemo={getSummary:()=>({merchants:scopedRows().length,drafts:scopedDrafts().length,accounts:can(9)?accounts.length:BO.user?1:0,user:BO.user?.role||null}),version:'2026.09.23'};

// Row identity is independent of the nullable MID returned by All-In Pay.
Object.assign(statusNames,{Syncing:'同步處理中',AwaitingResponse:'等待 All-In Pay 回應'});
Object.assign(statusColors,{Syncing:'blue',AwaitingResponse:'amber'});
function visibleMerchantColumns(){
 const boundary=BO.order.indexOf(BO.freezeThrough);
 const cols=BO.order.filter(h=>!BO.hidden.has(h));
 BO.pins=boundary<0?[]:BO.order.slice(0,boundary+1).filter(h=>!BO.hidden.has(h));
 return cols;
}
function midInfo(r){
 if(r['公司 MID'])return {label:r['公司 MID'],color:'',hint:'All-In Pay 已回傳 MID（Demo）',assigned:true};
 const states={Draft:['尚未提交','gray','尚未提交完整申請資料'],MoreInfo:['待補資料','amber','補齊資料並通過審核後才可同步'],Pending:['待審核','amber','審核通過後才可同步至 All-In Pay'],Approved:['待同步','purple','尚未送出至 All-In Pay'],Syncing:['處理中','blue','已送出，All-In Pay 正在處理，尚未產生 MID'],AwaitingResponse:['等待回應','amber','尚未收到 All-In Pay 回應；請查詢結果，勿重複提交'],SyncFailed:['同步失敗','red','同步失敗，尚未取得 MID；請查看失敗原因'],Rejected:['未獲批','red','申請未通過審核，尚未同步']};
 const [label,color,hint]=states[r.status]||['尚未取得 MID','gray','尚未收到 MID，請核對同步結果'];
 return {label,color,hint,assigned:false};
}
function midDisplay(r){const m=midInfo(r);return `<span class="merchant-mid" data-mid-state="${m.assigned?'assigned':esc(r.status)}" title="${esc(m.hint)}">${m.assigned?esc(m.label):pill(m.label,m.color)}</span>`;}
// Migrate saved demo rows without clearing drafts, selections or company edits.
// Legacy synthetic M numbers become stable internal IDs, not unassigned MIDs.
rows.forEach(r=>{
 // Previous form submissions generated M + 9 timestamp digits before any sync.
 // Recognize that legacy format only on saved applications with no success response.
 const legacyApplication=r.application&&/^M\d{9}$/.test(r['公司 MID']||'')&&!r.syncRespondedAt&&!['Synced','Enabled','Disabled'].includes(r.status);
 if(legacyApplication){r.id||=r['公司 MID'];r['公司 MID']='';}
 if(r.id)return;
 const legacy=r['公司 MID'];r.id=legacy||'APP-'+crypto.randomUUID();
 const seeded=/^M\d{6}$/.test(legacy||'');
 if(seeded&&!['Synced','Enabled','Disabled'].includes(r.status))r['公司 MID']='';
 if(seeded&&r.id==='M001006'&&r.status==='SyncFailed'){r.status='Syncing';r['公司 MID']='';}
 if(seeded&&r.id==='M001007'&&r.status==='Rejected'){r.status='AwaitingResponse';r['公司 MID']='';}
});
const midSync=sync;
sync=function(ids){
 if(!can(8))return deny();
 const eligible=ids.map(accessibleRow).filter(r=>r&&['Approved','SyncFailed'].includes(r.status));
 if(!eligible.length)return midSync(ids);
 if(state.fail)return midSync(ids);
 eligible.forEach(r=>{r.status='Syncing';r.syncRequestedAt=new Date().toISOString();});
 persistMerchantChange('模擬送出同步 · '+eligible.length+' 間，等待回應');
 modal('已送出，正在處理',`<div class="notice">${eligible.length} 間商戶已模擬送出，尚未取得新的 MID。</div><p>只有收到 All-In Pay 的成功回應後才會產生 MID。</p><p class="hint">此為 Demo，以下可演示不同回應；沒有向 All-In Pay 發送資料。</p>`,btn('關閉','close')+btn('等待回應','mid-demo-wait')+btn('模擬失敗','mid-demo-fail')+btn('模擬成功回應','mid-demo-success','primary'));
 BO.syncPending=eligible.map(rowKey);
};
function settleDemoSync(kind){
 if(!can(8))return deny();
 const list=(BO.syncPending||[]).map(accessibleRow).filter(r=>r&&['Syncing','AwaitingResponse'].includes(r.status));
 if(!list.length)return toast('沒有等待回應的商戶');
 list.forEach(r=>{
  r.status=kind==='success'?'Synced':kind==='fail'?'SyncFailed':'AwaitingResponse';
  if(kind==='success'){r['公司 MID']||='M'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();r.syncRespondedAt=new Date().toISOString();}
  if(kind==='fail')r.syncReason='模擬回應：銀行資料驗證失敗，請核對後重試';
 });
 persistMerchantChange('模擬同步回應 · '+list.length+' 間');
 BO.syncPending=[];
 modal(kind==='success'?'同步完成':kind==='fail'?'同步失敗':'等待 All-In Pay 回應',`<div class="notice">${list.map(r=>esc(r['客戶中文名稱'])+'：'+midDisplay(r)).join('<br>')}</div><p class="hint">以上為本機 Demo 回應，未連接正式 All-In Pay。</p>`,btn('完成','close','primary'));
}
Object.assign(actions,{
 'mid-demo-success':()=>settleDemoSync('success'),'mid-demo-fail':()=>settleDemoSync('fail'),'mid-demo-wait':()=>settleDemoSync('wait'),
 'mid-check':el=>{const r=accessibleRow(el.dataset.mid);if(!r||!can(8)||!['Syncing','AwaitingResponse'].includes(r.status))return deny();BO.syncPending=[rowKey(r)];modal('查詢同步結果（Demo）',`<p>${esc(r['客戶中文名稱'])}</p><p>公司 MID：${midDisplay(r)}</p><p class="hint">沒有連接正式系統，請選擇要演示的回應。</p>`,btn('關閉','close')+btn('等待回應','mid-demo-wait')+btn('模擬失敗','mid-demo-fail')+btn('模擬成功回應','mid-demo-success','primary'));},
 'export-merchants':()=>{if(!can(4))return deny();const cols=BO.order.filter(h=>!['選取','操作'].includes(h));downloadCSV('allinpay-merchants-demo.csv',[[...cols,'MID 狀態'],...filteredRows().map(r=>[...cols.map(c=>c==='商戶狀態'?statusNames[r.status]:r[c]??''),midInfo(r).assigned?'已取得':midInfo(r).label])]);}
});

// Field labels exported from the updated Figma frames; catalogue and option codes from OATS V2.
const V2_DATA = {"version":"OATS-V2-20260923","figmaFile":"sxaOCLv6tQwQeOzZIG4XsY","forms":[{"id":"595:5407","sections":[{"id":"597:4573","name":"法律主體","texts":["法律主體","法律地位會影響需要填寫的資料及必須上傳的文件。"],"fields":[{"id":"legalStatus","label":"法律地位  Legal Status","placeholder":"法人團體 · Body Corporate","hint":"個人／合夥／法人團體／非屬法團","type":"Select","source":"602:4730","max":null,"readonly":false},{"id":"merchantType","label":"客戶類型  Customer Type","placeholder":"GENERAL 普通","hint":"GENERAL／GROUP","type":"Select","source":"602:4734","max":null,"readonly":false},{"id":"groupId","label":"歸屬集團客戶號  Group Customer ID","placeholder":"請輸入集團客戶號","hint":"普通客戶可填寫；須為本機構既有集團","type":"Text","source":"602:4738","max":15,"readonly":false}]},{"id":"597:4598","name":"商戶名稱","texts":["商戶名稱","中文名稱須唯一；英文全名須與 BR 一致。"],"fields":[{"id":"merchantName","label":"中文名稱  Chinese Name","placeholder":"請輸入中文全名","hint":"上限 100 bytes","type":"Text","source":"602:4741","max":100,"readonly":false},{"id":"merchantShortName","label":"中文簡稱  Chinese Short Name","placeholder":"請輸入中文簡稱","hint":"上限 100 bytes","type":"Text","source":"602:4744","max":100,"readonly":false},{"id":"merchantEnglishName","label":"英文名稱  English Name","placeholder":"請輸入英文全名","hint":"與結算帳戶名稱交叉核對","type":"Text","source":"602:4747","max":100,"readonly":false},{"id":"merchantEnglishShortName","label":"英文簡稱  English Short Name","placeholder":"品牌名*城市","hint":"持卡人帳單描述符；上限 100","type":"Text","source":"602:4750","max":100,"readonly":false},{"id":"dbaNo","label":"DBA no.  DBA Number","placeholder":"請輸入 DBA no.","hint":"選填；與 BR、公司名稱分開儲存","type":"Text","source":"602:4753"}]},{"id":"597:4627","name":"註冊證書","texts":["註冊證書","BR 有效期不足 30 天時不可提交，但仍可儲存草稿。"],"fields":[{"id":"registerCertType","label":"註冊證書類型  Certificate Type","placeholder":"01 營業執照／BR","hint":"01／02 事業單位法人證書／03 身份證／04 其他","type":"Select","source":"602:4756","max":null,"readonly":false},{"id":"registerCertNo","label":"註冊證書號碼  Certificate Number","placeholder":"12345678-000","hint":"香港 BR：8 位數字及 3 位分支碼","type":"Text","source":"602:4760","max":30,"readonly":false},{"id":"registerCertName","label":"註冊證書名稱  Certificate Name","placeholder":"請輸入證書名稱","hint":"與 OCR 比對","type":"Text","source":"602:4763","max":200,"readonly":false},{"id":"registerCertPeriod","label":"註冊證書有效期  Certificate Expiry Date","placeholder":"YYYY/MM/DD","hint":"選擇日期；有效期須至少餘下 30 天","type":"Text","source":"602:4766","max":null,"readonly":false},{"id":"crCode","label":"CR 註冊登記證號  CR Number","placeholder":"請輸入 CR 編號","hint":"法人團體建議必填","type":"Text","source":"602:4769","max":30,"readonly":false},{"id":"nar1Period","label":"NAR1 有效期  NAR1 Expiry Date","placeholder":"YYYY/MM/DD","hint":"法人團體必填；請核對周年申報日期","type":"Text","source":"602:4772","max":null,"readonly":false}]},{"id":"597:4670","name":"中國內地證照（條件欄位）","texts":["中國內地證照（條件欄位）","業務所在地為中國內地且法律地位非個人時適用；非三證合一時需補充三類證號。"],"fields":[{"id":"threeCertFlag","label":"是否三證合一  Combined Business Licence","placeholder":"1 是","hint":"1 是／0 否","type":"Select","source":"602:4775","max":null,"readonly":false},{"id":"creditCode","label":"信用代碼證  Credit Certificate Number","placeholder":"請輸入","hint":"非三證合一必填","type":"Text","source":"602:4779","max":30,"readonly":false},{"id":"creditCodePeriod","label":"信用代碼證有效期  Credit Certificate Expiry","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:4782","max":null,"readonly":false},{"id":"organCode","label":"組織機構代碼證  Organisation Code","placeholder":"請輸入","hint":"非三證合一必填","type":"Text","source":"602:4785","max":30,"readonly":false},{"id":"organCodePeriod","label":"組織機構代碼證有效期  Organisation Code Expiry","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:4788","max":null,"readonly":false},{"id":"taxCode","label":"稅務登記證  Tax Registration Number","placeholder":"請輸入","hint":"非三證合一必填","type":"Text","source":"602:4791","max":30,"readonly":false},{"id":"taxCodePeriod","label":"稅務登記證有效期  Tax Registration Expiry","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:4794","max":null,"readonly":false}]},{"id":"597:4720","name":"規模與經營年限","texts":["規模與經營年限","供風控判斷企業規模。"],"fields":[{"id":"registerCapital","label":"註冊資本  Registered Capital","placeholder":"請選擇","hint":"少於10萬／10–20萬／20–50萬／50–100萬／100萬以上","type":"Select","source":"602:4797","max":null,"readonly":false},{"id":"licencePeriod","label":"經營年限  Years in Business","placeholder":"請選擇","hint":"少於1年／1–3年／3–5年／5年以上","type":"Select","source":"602:4801","max":null,"readonly":false},{"id":"workerNumber","label":"員工人數  Number of Employees","placeholder":"請選擇","hint":"少於10人／10–20／20–50／50–100／100以上","type":"Select","source":"602:4805","max":null,"readonly":false}]},{"id":"602:4991","name":"董事","texts":["董事","必填，可新增多位；對私結算持有人必須在董事名單內。"],"fields":[{"id":"directors[].name","label":"姓名  Full Name","placeholder":"請輸入姓名","hint":"","type":"Text","source":"602:4997"},{"id":"directors[].firstNameEn","label":"英文名 First  First Name","placeholder":"請輸入英文名","hint":"","type":"Text","source":"602:5001"},{"id":"directors[].lastNameEn","label":"英文姓 Last  Last Name","placeholder":"請輸入英文姓","hint":"","type":"Text","source":"602:5006"},{"id":"directors[].idcardType","label":"證件類型  ID Type","placeholder":"請選擇","hint":"身份證／護照／港澳通行證／台灣通行證／居住證／其他","type":"Select","source":"602:5010"},{"id":"directors[].idcardNo","label":"證件號碼  ID Number","placeholder":"請輸入證件號碼","hint":"","type":"Text","source":"602:5017"},{"id":"directors[].idcardNoPeriod","label":"證件有效期  ID Expiry Date","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:5021"},{"id":"directors[].birthDay","label":"出生日期  Date of Birth","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:5026"}]},{"id":"602:5028","name":"授權簽名人","texts":["授權簽名人","香港／新加坡開通 AMEX 相關產品時須填寫，且僅限 1 位；出生日期必填。"],"fields":[{"id":"authSigners[].name","label":"姓名  Full Name","placeholder":"請輸入姓名","hint":"","type":"Text","source":"602:5034"},{"id":"authSigners[].firstNameEn","label":"英文名 First  First Name","placeholder":"請輸入英文名","hint":"","type":"Text","source":"602:5038"},{"id":"authSigners[].lastNameEn","label":"英文姓 Last  Last Name","placeholder":"請輸入英文姓","hint":"","type":"Text","source":"602:5043"},{"id":"authSigners[].idcardType","label":"證件類型  ID Type","placeholder":"請選擇","hint":"身份證／護照／港澳通行證／台灣通行證／居住證／其他","type":"Select","source":"602:5047"},{"id":"authSigners[].idcardNo","label":"證件號碼  ID Number","placeholder":"請輸入證件號碼","hint":"","type":"Text","source":"602:5054"},{"id":"authSigners[].idcardNoPeriod","label":"證件有效期  ID Expiry Date","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:5058"},{"id":"authSigners[].birthDay","label":"出生日期  Date of Birth","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:5063"}]},{"id":"602:5065","name":"控股股東","texts":["控股股東","持股 ≥25% 的控股股東須登記；與董事相同可沿用資料及證件。"],"fields":[{"id":"shareHolders[].name","label":"姓名  Full Name","placeholder":"請輸入姓名","hint":"","type":"Text","source":"602:5071"},{"id":"shareHolders[].firstNameEn","label":"英文名 First  First Name","placeholder":"請輸入英文名","hint":"","type":"Text","source":"602:5075"},{"id":"shareHolders[].lastNameEn","label":"英文姓 Last  Last Name","placeholder":"請輸入英文姓","hint":"","type":"Text","source":"602:5080"},{"id":"shareHolders[].idcardType","label":"證件類型  ID Type","placeholder":"請選擇","hint":"身份證／護照／港澳通行證／台灣通行證／居住證／其他","type":"Select","source":"602:5084"},{"id":"shareHolders[].idcardNo","label":"證件號碼  ID Number","placeholder":"請輸入證件號碼","hint":"","type":"Text","source":"602:5091"},{"id":"shareHolders[].idcardNoPeriod","label":"證件有效期  ID Expiry Date","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:5095"},{"id":"shareHolders[].birthDay","label":"出生日期  Date of Birth","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:5100"}]}]},{"id":"595:5412","sections":[{"id":"597:4746","name":"業務地址","texts":["業務地址","國家／地區、省、市分開儲存；中國內地地址需要市編號。"],"fields":[{"id":"addrCountryCode","label":"國家／地區編號  Country / Region","placeholder":"HKG 中國香港","hint":"HKG／CHN／MAC／SGP／USA／GBR","type":"Select","source":"602:4809","max":null,"readonly":false},{"id":"addrProvinceCode","label":"省編號  Province / District","placeholder":"請選擇省／區","hint":"按國家聯動","type":"Select","source":"602:4813","max":null,"readonly":false},{"id":"addrCityCode","label":"市編號  City","placeholder":"請選擇城市","hint":"中國內地必填","type":"Select","source":"602:4817","max":null,"readonly":false},{"id":"addrStreet","label":"業務地址（中文）  Chinese Business Address","placeholder":"請輸入中文地址","hint":"不含國家／省／市；上限 200","type":"Text","source":"602:4821","max":200,"readonly":false},{"id":"addrStreetEn","label":"業務地址（英文）  English Business Address","placeholder":"請輸入英文地址","hint":"不含國家／省／市；上限 200","type":"Text","source":"602:4824","max":200,"readonly":false}]},{"id":"597:4785","name":"行業與經營概況","texts":["行業與經營概況","MCC 對應行業名稱；風控級別會影響文件清單及建議結算週期。"],"fields":[{"id":"mcc","label":"MCC 行業代碼  Merchant Category Code","placeholder":"5814","hint":"4 位數字；快餐店","type":"Text","source":"602:4827","max":4,"readonly":false},{"id":"mccName","label":"行業名稱  Industry Name","placeholder":"按 MCC 自動帶出","hint":"唯讀；不在清單內將轉人工核定","type":"Text","source":"602:4830"},{"id":"riskLevel","label":"風控級別  Risk Level","placeholder":"低風險","hint":"低／中／高；可採用系統建議或人工調整","type":"Select","source":"602:4836","max":null,"readonly":false},{"id":"webUrl","label":"商戶網站  Business Website","placeholder":"https://","hint":"開通 CNP／PayByLink 卡產品時必填；上限 100 字元","type":"Text","source":"602:4833","max":100,"readonly":false},{"id":"riskOverrideReason","label":"下調風控級別原因  Override Reason","placeholder":"請填寫原因","hint":"僅人工設定低於系統建議時必填","type":"Text","source":"1027:7196"}]},{"id":"597:4814","name":"交易規模","texts":["交易規模","金額保留 2 位小數；平均單筆高於行業常態 3 倍時，列入風控提示。"],"fields":[{"id":"avgPerAmount","label":"平均單筆消費金額  Average Transaction Amount","placeholder":"0.00","hint":"","type":"Text","source":"602:4839","max":null,"readonly":false},{"id":"maxAmount","label":"最高消費金額  Maximum Transaction Amount","placeholder":"0.00","hint":"","type":"Text","source":"602:4842","max":null,"readonly":false},{"id":"avgMonthAmount","label":"平均單月銷售金額  Average Monthly Sales","placeholder":"0.00","hint":"","type":"Text","source":"602:4845","max":null,"readonly":false}]},{"id":"597:4837","name":"聯絡人及協議","texts":["聯絡人及協議","聯絡人姓名、電話及電郵各自獨立；提交前需完成電郵驗證。"],"fields":[{"id":"contactName","label":"客戶聯絡人  Contact Name","placeholder":"請輸入姓名","hint":"","type":"Text","source":"602:4848","max":50,"readonly":false},{"id":"contactPhone","label":"聯絡電話  Contact Phone","placeholder":"+852","hint":"E.164 格式，包含國際區號","type":"Text","source":"602:4851","max":20,"readonly":false},{"id":"contactEmail","label":"聯絡電郵  Contact Email","placeholder":"name@example.com","hint":"提交前驗證","type":"Text","source":"602:4854","max":60,"readonly":false},{"id":"maintainerName","label":"維護人姓名  Account Manager","placeholder":"請輸入維護人姓名","hint":"選填，上限 50 字元","type":"Text","source":"602:4857","max":50,"readonly":false},{"id":"maintainerEmail","label":"維護人電郵  Account Manager Email","placeholder":"name@example.com","hint":"選填，上限 60 字元","type":"Text","source":"602:4860","max":60,"readonly":false},{"id":"developer","label":"拓展人／代理商碼  Sales / Agent Code","placeholder":"請輸入 sales／agency code","hint":"選填，用於佣金計算","type":"Text","source":"602:4863","max":90,"readonly":false},{"id":"developerEmail","label":"拓展人電郵  Sales / Agent Email","placeholder":"name@example.com","hint":"選填","type":"Text","source":"602:4866","max":60,"readonly":false},{"id":"merchantAgreementNum","label":"支付服務協議號  Agreement Number","placeholder":"由系統生成","hint":"唯讀","type":"Text","source":"602:4869","max":30,"readonly":true},{"id":"merchantAgreementPeriod","label":"協議有效期  Agreement Expiry Date","placeholder":"YYYY/MM/DD","hint":"","type":"Text","source":"602:4872","max":null,"readonly":false},{"id":"signType","label":"簽約方式  Signing Method","placeholder":"01 線上簽約","hint":"01 線上／00 線下","type":"Select","source":"602:4875","max":null,"readonly":false},{"id":"remark","label":"備註  Remarks","placeholder":"請輸入備註","hint":"選填，上限 100","type":"Text","source":"602:4879","max":100,"readonly":false}]}]},{"id":"595:5417","sections":[{"id":"602:4881","name":"結算參數","texts":["結算參數","按風控建議提供預設值，仍可手動修改；格式為 T 或 D 加數字。"],"fields":[{"id":"settlePeriod","label":"結算週期  Settlement Cycle","placeholder":"T1","hint":"選填；可輸入 T1／T2／T3／T5／T7／D0／D1","type":"Text","source":"602:4887","max":4,"readonly":false},{"id":"currency","label":"幣別  Currency","placeholder":"HKD 港元","hint":"HKD／CNY／USD／EUR／GBP／JPY／AUD","type":"Select","source":"602:4893","max":null,"readonly":false}]},{"id":"602:4904","name":"開戶行歸屬地","texts":["開戶行歸屬地","按銀行所在地填寫。香港銀行代碼必填；分行代碼選填；中國內地須填城市及分行。"],"fields":[{"id":"cardCountryCode","label":"歸屬國編號  Bank Country / Region","placeholder":"HKG 中國香港","hint":"HKG／CHN／SGP／USA／GBR","type":"Select","source":"602:4910","max":null,"readonly":false},{"id":"cardProvinceCode","label":"歸屬省編號  Bank Province / District","placeholder":"請選擇省／區","hint":"","type":"Select","source":"602:4916","max":null,"readonly":false},{"id":"cardCityCode","label":"歸屬城市編號  Bank City","placeholder":"請選擇城市","hint":"中國內地必填","type":"Select","source":"602:4922","max":null,"readonly":false},{"id":"cardAddress","label":"開戶行地址  Bank Address","placeholder":"請輸入地址","hint":"不含國家／省／市，條件必填","type":"Text","source":"602:4928","max":200,"readonly":false},{"id":"swiftCode","label":"Swift Code  SWIFT Code","placeholder":"請輸入 SWIFT","hint":"選填；8 或 11 位英數字元","type":"Text","source":"602:4934","max":11,"readonly":false},{"id":"cardBankName","label":"開戶銀行  Bank Name","placeholder":"請輸入銀行名稱","hint":"非中國內地必填","type":"Text","source":"602:4939","max":100,"readonly":false},{"id":"cardBankCode","label":"開戶銀行行號  Bank Code","placeholder":"004 香港上海滙豐銀行","hint":"香港銀行代碼（3 位），可搜尋銀行；其他地區可輸入","type":"Select","source":"602:4945","max":15,"readonly":false},{"id":"cardBranchCode","label":"開戶支行行號  Branch Code","placeholder":"請輸入 3 位分行代碼（選填）","hint":"香港選填；中國內地必填","type":"Text","source":"602:4951","max":15,"readonly":false}]},{"id":"602:4954","name":"帳戶信息","texts":["帳戶信息","對公帳戶名稱須與英文商戶名稱一致；對私持有人須為董事之一。"],"fields":[{"id":"isCompay","label":"是否對公  Account Ownership","placeholder":"Y 對公","hint":"對公須與商戶英文名稱一致；對私须與董事身份資料一致","type":"Select","source":"602:4960","max":null,"readonly":false},{"id":"cardName","label":"帳戶名稱  Account Name","placeholder":"請輸入帳戶名稱","hint":"","type":"Text","source":"602:4966","max":null,"readonly":false},{"id":"cardNo","label":"銀行帳號  Bank Account Number","placeholder":"請輸入銀行帳號","hint":"檢視時僅顯示末 4 位；可切換顯示／隱藏","type":"Text","source":"602:4971","max":30,"readonly":false},{"id":"cardIdcardNo","label":"結算身份證號  Account Holder ID Number","placeholder":"請輸入證件號碼","hint":"對私必填","type":"Text","source":"602:4976","max":30,"readonly":false},{"id":"settlementPrefix","label":"結算摘要前綴  Statement Prefix","placeholder":"請輸入摘要前綴","hint":"選填","type":"Text","source":"602:4982","max":100,"readonly":false},{"id":"handleClear","label":"是否支持手工清算  Manual Settlement","placeholder":"N 否","hint":"預設 N；開啟需終審批准","type":"Select","source":"602:4987","max":null,"readonly":false}]}]},{"id":"595:5422","sections":[{"id":"1025:7131","name":"功能配置","texts":["功能配置","按需開通分帳及終端訂單支付。"],"fields":[{"id":"splitFlag","label":"分帳功能  Split Payments","placeholder":"不開通","hint":"不開通／開通","type":"Select","source":"1025:7152"},{"id":"termOrderPay","label":"終端訂單支付  Terminal Order Payments","placeholder":"不開通","hint":"不開通／聯機模式／脫機模式","type":"Select","source":"1025:7159"}]},{"id":"1025:7164","name":"退貨配置","texts":["退貨配置","費率及每筆固定費用分別設定。"],"fields":[{"id":"refundFeeFlag","label":"退貨是否退手續費  Refund Processing Fees","placeholder":"否","hint":"是／否","type":"Select","source":"1025:7185"},{"id":"overdraftRefund","label":"透支退貨  Overdraft Refund","placeholder":"否","hint":"是／否","type":"Select","source":"1025:7192"},{"id":"refundSvcRate","label":"退貨服務費（%）  Refund Service Rate","placeholder":"0.00","hint":"","type":"Text","source":"1025:7199"},{"id":"refundSvcFix","label":"每筆退貨費（HKD）  Fixed Refund Fee","placeholder":"0.00","hint":"","type":"Text","source":"1025:7204"}]},{"id":"1025:7207","name":"其他配置","texts":["其他配置","保證金比例、釋放週期及其他服務費用各自設定。"],"fields":[{"id":"connectType","label":"連接模式  Connection Mode","placeholder":"跳轉模式","hint":"直連／跳轉；直連卡產品需 PCI DSS","type":"Select","source":"1025:7228"},{"id":"tokenCreateWay","label":"TOKEN 建立模式  Token Creation Mode","placeholder":"跳轉模式","hint":"直連／跳轉","type":"Select","source":"1025:7235"},{"id":"depositRatio","label":"CNP 保證金（%）  CNP Deposit Ratio","placeholder":"0.00","hint":"","type":"Text","source":"1025:7242"},{"id":"depositCycle","label":"CNP 釋放週期（天）  CNP Release Period","placeholder":"180","hint":"","type":"Text","source":"1025:7247"},{"id":"posCashDepRatio","label":"收單保證金（%）  Acquiring Deposit Ratio","placeholder":"0.00","hint":"","type":"Text","source":"1025:7252"},{"id":"posDepCycle","label":"收單釋放週期（天）  Acquiring Release Period","placeholder":"0","hint":"","type":"Text","source":"1025:7257"},{"id":"onQRDepRatio","label":"線上掃碼保證金（%）  Online QR Deposit Ratio","placeholder":"0.00","hint":"","type":"Text","source":"1025:7262"},{"id":"onQRDepCycle","label":"線上掃碼釋放週期（天）  Online QR Release Period","placeholder":"0","hint":"","type":"Text","source":"1025:7267"},{"id":"inQRDepRatio","label":"線下掃碼保證金（%）  In-store QR Deposit Ratio","placeholder":"0.00","hint":"","type":"Text","source":"1025:7272"},{"id":"inQRDepCycle","label":"線下掃碼釋放週期（天）  In-store QR Release Period","placeholder":"0","hint":"","type":"Text","source":"1025:7277"},{"id":"markup","label":"加成費率（%）  Markup","placeholder":"0.00","hint":"","type":"Text","source":"1025:7282"},{"id":"disputeRate","label":"爭議處理費（%）  Dispute Service Rate","placeholder":"0.00","hint":"","type":"Text","source":"1025:7287"},{"id":"disputeFix","label":"每筆爭議費（HKD）  Fixed Dispute Fee","placeholder":"150.00","hint":"","type":"Text","source":"1025:7292"},{"id":"rdrRate","label":"預爭議 RDR 費（%）  RDR Service Rate","placeholder":"0.00","hint":"","type":"Text","source":"1025:7297"},{"id":"rdrFix","label":"每筆 RDR 費（HKD）  Fixed RDR Fee","placeholder":"120.00","hint":"","type":"Text","source":"1025:7302"},{"id":"chargeWay","label":"帳戶驗證扣費方式  Verification Billing","placeholder":"月結","hint":"月結／預存款／結算資金","type":"Select","source":"1025:7307"},{"id":"monthMinPrice","label":"月保底（HKD）  Monthly Minimum","placeholder":"0.00","hint":"開通帳戶驗證且採月結時必填","type":"Text","source":"1025:7314"}]},{"id":"1025:7317","name":"結算配置","texts":["結算配置","依協議設定最低清算金額。"],"fields":[{"id":"minStlAmt","label":"最低清算金額（HKD）  Minimum Settlement Amount","placeholder":"0.00","hint":"選填","type":"Text","source":"1025:7338"}]}]}],"documents":[{"id":"140101","name":"註冊證書（營業執照／BR）\nBusiness Registration Certificate","hint":"尚未匯入 BR，可先手動填寫","source":"608:4843"},{"id":"140201","name":"CI 公司註冊證書\nCertificate of Incorporation","hint":"法人團體必交","source":"608:4850"},{"id":"140301","name":"公司註冊登記查冊\nCompany Search Report","hint":"選填；用於董事及股東資料核實","source":"608:4857"},{"id":"100301","name":"負責人身份證正面\nID Document — Front","hint":"線上簽約必交","source":"608:4864"},{"id":"100302","name":"負責人身份證反面\nID Document — Back","hint":"線上簽約必交","source":"608:4871"},{"id":"140901","name":"董事身份證明\nDirector ID Document","hint":"多於一位董事時，每位一份","source":"608:4878"},{"id":"140902","name":"董事地址證明\nDirector Address Proof","hint":"中高風險；最近三個月內","source":"608:4885"},{"id":"141001","name":"股東身份證明\nShareholder ID Document","hint":"持股 ≥25% 且非董事者必交；已連結董事者無須重複提供","source":"608:4892"},{"id":"141002","name":"股東地址證明\nShareholder Address Proof","hint":"高風險且股東非董事時必交","source":"608:4899"},{"id":"141101","name":"NAR1／NNC1 周年申報表\nAnnual Return / Incorporation Form","hint":"法人團體必交；請確認文件有效期與申報資料一致。","source":"608:4906"},{"id":"140401","name":"銀行月結單\nBank Statement","hint":"所有商戶必交：最近至少 1 個月銀行月結單","source":"608:4913"},{"id":"141301","name":"近三個月銀行月結單\nThree-month Bank Statements","hint":"中高風險商戶必交：最近 3 個月銀行月結單","source":"608:4920"},{"id":"101401","name":"門頭照片\nStorefront Photo","hint":"線上簽約或實體店必交","source":"608:4927"},{"id":"101402","name":"門店內景照片\nStore Interior Photo","hint":"須顯示收銀台；線上簽約或實體店必交","source":"608:4934"},{"id":"140701","name":"支付服務合作協議\nPayment Services Agreement","hint":"線上由系統生成；線下提供用印版本","source":"608:4955"},{"id":"141401","name":"租賃協議\nLease Agreement","hint":"實體店且中高風險","source":"608:4976"},{"id":"141601","name":"商戶與消費者 T&C\nCustomer Terms and Conditions","hint":"CNP／線上商戶，包含退款及爭議政策","source":"608:4983"},{"id":"141201","name":"PCI DSS 證書\nPCI DSS Certificate","hint":"開通 CNP／PayByLink 卡產品且使用直連時必交","source":"608:4990"},{"id":"141701","name":"最近一年年度財務報告\nAnnual Financial Report","hint":"月銷售 >500,000 或高風險","source":"608:4997"},{"id":"109701","name":"附屬材料 1\nSupporting Document 1","hint":"高風險補充業務說明","source":"608:5011"},{"id":"109702","name":"附屬材料 2\nSupporting Document 2","hint":"選填或風控加收","source":"608:5018"}],"options":{"legalStatus":[["PERSON","個人"],["PARTNER","合夥"],["BODY_CORPORATE","法人團體"],["NO_CORPORATION","非屬法團"]],"merchantType":[["GENERAL","普通"],["GROUP","集團"]],"registerCertType":[["01","營業執照／BR"],["02","事業單位法人證書"],["03","身份證"],["04","其他"]],"threeCertFlag":[["1","是"],["0","否"]],"registerCapital":[["01","少於 10 萬"],["02","10–20 萬"],["03","20–50 萬"],["04","50–100 萬"],["05","100 萬以上"]],"licencePeriod":[["01","少於 1 年"],["02","1–3 年"],["03","3–5 年"],["04","5 年以上"]],"workerNumber":[["01","少於 10 人"],["02","10–20 人"],["03","20–50 人"],["04","50–100 人"],["05","100 人以上"]],"addrCountryCode":[["HKG","中國香港"],["CHN","中國內地"],["MAC","中國澳門"],["SGP","新加坡"],["USA","美國"],["GBR","英國"]],"cardCountryCode":[["HKG","中國香港"],["CHN","中國內地"],["SGP","新加坡"],["USA","美國"],["GBR","英國"]],"riskLevel":[["1","低風險"],["2","中風險"],["3","高風險"]],"signType":[["01","線上簽約"],["00","線下簽約"]],"currency":[["HKD","HKD 港元"],["CNY","CNY 人民幣"],["USD","USD 美元"],["EUR","EUR 歐元"],["GBP","GBP 英鎊"],["JPY","JPY 日圓"],["AUD","AUD 澳元"]],"isCompay":[["Y","對公"],["N","對私"]],"handleClear":[["N","否"],["Y","是"]],"idcardType":[["01","身份證"],["02","護照"],["03","港澳通行證"],["04","台灣通行證"],["05","港澳台居民居住證"],["07","其他"]],"splitFlag":[["N","不開通"],["Y","開通"]],"termOrderPay":[["N","不開通"],["ONLINE","聯機模式"],["OFFLINE","脫機模式"]],"refundFeeFlag":[["N","否"],["Y","是"]],"overdraftRefund":[["N","否"],["Y","是"]],"connectType":[["1","跳轉模式"],["0","直連模式"]],"tokenCreateWay":[["1","跳轉模式"],["0","直連模式"]],"chargeWay":[["MONTH_SETTLE","月結"],["PRE_FEE","預存款"],["BALANCE","結算資金"]]},"defaults":{"merchantType":"GENERAL","registerCertType":"01","threeCertFlag":"1","addrCountryCode":"HKG","merchantAgreementNum":"DEMO-AGR-V2","merchantAgreementPeriod":"2029-09-22","signType":"01","settlePeriod":"T1","currency":"HKD","cardCountryCode":"HKG","isCompay":"Y","handleClear":"N","riskLevel":"1","splitFlag":"N","termOrderPay":"N","refundFeeFlag":"N","overdraftRefund":"N","refundSvcRate":"0.00","refundSvcFix":"0.00","connectType":"1","tokenCreateWay":"1","depositRatio":"0.00","depositCycle":"180","posCashDepRatio":"0.00","posDepCycle":"0","onQRDepRatio":"0.00","onQRDepCycle":"0","inQRDepRatio":"0.00","inQRDepCycle":"0","markup":"0.00","disputeRate":"0.00","disputeFix":"150.00","rdrRate":"0.00","rdrFix":"120.00","chargeWay":"MONTH_SETTLE","monthMinPrice":"0.00","minStlAmt":"0.00"},"catalog":{"GROUPS":[{"k":"POS","n":"收單","pre":"EDC","combo":["小費","DCC交易","MOTO消費","收單-預授權"],"rows":[{"n":"VISA 收單-消費","ct":"Regional","pref":true,"brand":"VISA"},{"n":"MASTERCARD 收單-消費","ct":"Regional","pref":true,"dcc":true,"brand":"MASTERCARD"},{"n":"UNIONPAY 收單-消費","ct":"Regional","pref":true,"brand":"UNIONPAY"},{"n":"AMERICAEXPRESS 收單-消費","ct":"Regional","pref":true,"brand":"AMERICAEXPRESS"},{"n":"JCB 收單-消費","ct":"Blended","brand":"JCB"},{"n":"DINERSCLUB 收單-消費","ct":"Blended","brand":"DINERSCLUB"},{"n":"VISA 收單-分期消費","ct":null,"mode":"INST","brand":"VISA"},{"n":"八達通-消費","ct":null,"pre":""}]},{"k":"CTV","n":"CTV","pre":"","rows":[{"n":"VISA 線上消費","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD 線上消費","ct":"Blended","brand":"MASTERCARD"},{"n":"JCB 線上消費","ct":"Blended","brand":"JCB"},{"n":"UNIONPAY 線上消費","ct":"Blended","brand":"UNIONPAY"}]},{"k":"CNP","n":"CNP","pre":"","cnp":true,"rows":[{"n":"VISA 線上消費","ct":"Regional","brand":"VISA"},{"n":"MASTERCARD 線上消費","ct":"Regional","brand":"MASTERCARD"},{"n":"VISA 線上分期消費","ct":null,"mode":"INST","brand":"VISA"},{"n":"DINERSCLUB 線上消費","ct":"Regional","brand":"DINERSCLUB"},{"n":"JCB 線上消費","ct":"Regional","brand":"JCB"},{"n":"AMERICAEXPRESS 線上消費","ct":"Blended","brand":"AMERICAEXPRESS"},{"n":"UNIONPAY 線上消費","ct":"Blended","brand":"UNIONPAY"},{"n":"VISA TOKEN線上消費","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD TOKEN線上消費","ct":"Blended","brand":"MASTERCARD"},{"n":"JCB TOKEN線上消費","ct":"Blended","brand":"JCB"},{"n":"AMERICAEXPRESS TOKEN線上消費","ct":"Blended","brand":"AMERICAEXPRESS"},{"n":"UNIONPAY TOKEN線上消費","ct":"Blended","brand":"UNIONPAY"},{"n":"VISA TOKEN預授權","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD TOKEN預授權","ct":"Blended","brand":"MASTERCARD"},{"n":"JCB TOKEN預授權","ct":"Blended","brand":"JCB"},{"n":"AMERICAEXPRESS TOKEN預授權","ct":"Blended","brand":"AMERICAEXPRESS"},{"n":"UNIONPAY TOKEN預授權","ct":"Blended","brand":"UNIONPAY"},{"n":"VISA 線上預授權","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD 線上預授權","ct":"Blended","brand":"MASTERCARD"},{"n":"DINERSCLUB 線上預授權","ct":"Blended","brand":"DINERSCLUB"},{"n":"JCB 線上預授權","ct":"Blended","brand":"JCB"},{"n":"AMERICAEXPRESS 線上預授權","ct":"Blended","brand":"AMERICAEXPRESS"},{"n":"UNIONPAY 線上預授權","ct":"Blended","brand":"UNIONPAY"},{"n":"UNIONPAY SecurePay","ct":"Blended","brand":"UNIONPAY"},{"n":"VISA Click To Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Click To Pay","ct":"Blended","brand":"MASTERCARD"},{"n":"VISA Apple Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Apple Pay","ct":"Blended","brand":"MASTERCARD"},{"n":"VISA Google Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Google Pay","ct":"Blended","brand":"MASTERCARD"}]},{"k":"VD","n":"VisaDirect","pre":"","tip":"費率配置按固定金額收取時，費率填100%，保底和封頂填相同金額","rows":[{"n":"VISA 本地付款","ct":null},{"n":"VISA 跨境實時付款","ct":null},{"n":"VISA 跨境普通匯款","ct":null}]},{"k":"ONQR","n":"線上掃碼支付","pre":"費率","rows":[{"n":"微信掃碼-正掃","ct":"Wallet","wal":true},{"n":"微信APP支付","ct":"Wallet","wal":true},{"n":"微信小程序支付","ct":"Wallet","wal":true},{"n":"微信公衆號支付","ct":"Wallet","wal":true},{"n":"微信公衆號-服務商授權","ct":"Wallet","wal":true},{"n":"微信H5支付","ct":"Wallet","wal":true},{"n":"微信H5支付-服務商收銀台","ct":"Wallet","wal":true},{"n":"支付寶H5支付","ct":"Wallet","wal":true},{"n":"支付寶APP支付","ct":"Wallet","wal":true},{"n":"支付寶WEB支付","ct":"Wallet","wal":true},{"n":"銀聯雲閃付掃碼-正掃","ct":"Blended","upi":true},{"n":"payNow-正掃","ct":"Blended"},{"n":"八達通-正掃","ct":null},{"n":"八達通-WEB支付","ct":null}]},{"k":"INQR","n":"線下掃碼支付","pre":"費率","rows":[{"n":"微信掃碼-正掃","ct":"Wallet","wal":true},{"n":"微信刷卡-反掃","ct":"Wallet","wal":true},{"n":"微信公衆號支付","ct":"Wallet","wal":true},{"n":"微信公衆號-服務商授權","ct":"Wallet","wal":true},{"n":"支付寶-正掃","ct":"Wallet","wal":true},{"n":"支付寶刷卡-反掃","ct":"Wallet","wal":true},{"n":"銀聯雲閃付掃碼-正掃","ct":"Blended","upi":true},{"n":"銀聯雲閃付刷卡-反掃","ct":"Blended","upi":true},{"n":"payNow-正掃","ct":"Blended"},{"n":"PayMe掃碼-正掃","ct":"Blended"},{"n":"PayMe刷卡-反掃","ct":"Blended"},{"n":"八達通-正掃","ct":null}]},{"k":"PBL","n":"PayByLink","pre":"","cnp":true,"rows":[{"n":"微信掃碼-正掃","ct":"Wallet","wal":true},{"n":"微信H5支付-服務商收銀台","ct":"Wallet","wal":true},{"n":"微信公衆號-服務商授權","ct":"Wallet","wal":true},{"n":"支付寶H5支付","ct":"Wallet","wal":true},{"n":"支付寶WEB支付","ct":"Wallet","wal":true},{"n":"銀聯雲閃付掃碼-正掃","ct":"Blended","upi":true},{"n":"payNow-正掃","ct":"Blended"},{"n":"八達通-正掃","ct":null},{"n":"八達通-WEB支付","ct":null},{"n":"VISA 線上消費","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD 線上消費","ct":"Blended","brand":"MASTERCARD"},{"n":"JCB 線上消費","ct":"Blended","brand":"JCB"},{"n":"AMERICAEXPRESS 線上消費","ct":"Blended","brand":"AMERICAEXPRESS"},{"n":"UNIONPAY 線上消費","ct":"Blended","brand":"UNIONPAY"},{"n":"UNIONPAY SecurePay","ct":"Blended","brand":"UNIONPAY"},{"n":"VISA Click To Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Click To Pay","ct":"Blended","brand":"MASTERCARD"},{"n":"VISA Apple Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Apple Pay","ct":"Blended","brand":"MASTERCARD"},{"n":"VISA Google Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Google Pay","ct":"Blended","brand":"MASTERCARD"}]},{"k":"AV","n":"帳戶驗證","pre":"","rows":[{"n":"VISA 賬戶驗證","ct":"Blended","mode":"PER"},{"n":"MASTERCARD 賬戶驗證","ct":"Blended","mode":"PER"},{"n":"UNIONPAY 帳戶風險篩查","ct":"Blended","mode":"PER","note":"只支持結算資金扣收"}]},{"k":"VAS","n":"增值服務","pre":"","rows":[{"n":"微信報關","ct":null,"mode":"NONE"}]},{"k":"ONE","n":"一碼付","pre":"","rows":[{"n":"微信H5支付-服務商收銀台","ct":"Wallet","wal":true},{"n":"微信公衆號-服務商授權","ct":"Wallet","wal":true},{"n":"支付寶H5支付","ct":"Wallet","wal":true},{"n":"支付寶-正掃","ct":"Wallet","wal":true},{"n":"payNow-正掃","ct":"Blended"},{"n":"八達通-WEB支付","ct":null},{"n":"VISA 線上消費","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD 線上消費","ct":"Blended","brand":"MASTERCARD"},{"n":"JCB 線上消費","ct":"Blended","brand":"JCB"},{"n":"AMERICAEXPRESS 線上消費","ct":"Blended","brand":"AMERICAEXPRESS"},{"n":"UNIONPAY SecurePay","ct":"Blended","brand":"UNIONPAY"},{"n":"VISA Click To Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Click To Pay","ct":"Blended","brand":"MASTERCARD"},{"n":"VISA Apple Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Apple Pay","ct":"Blended","brand":"MASTERCARD"},{"n":"VISA Google Pay","ct":"Blended","brand":"VISA"},{"n":"MASTERCARD Google Pay","ct":"Blended","brand":"MASTERCARD"}]},{"k":"DD","n":"代扣","pre":"","rows":[{"n":"VISA 代扣","ct":"Blended"},{"n":"MASTERCARD 代扣","ct":"Blended"},{"n":"微信代扣","ct":"Wallet","wal":true},{"n":"支付寶代扣","ct":"Wallet","off":true,"wal":true}]}],"MCCS":[{"c":"5812","n":"餐廳","lv":"low","avg":250},{"c":"5814","n":"快餐店","lv":"low","avg":120},{"c":"5411","n":"超市／雜貨店","lv":"low","avg":300},{"c":"5311","n":"百貨公司","lv":"low","avg":500},{"c":"5651","n":"服飾零售","lv":"low","avg":600},{"c":"7230","n":"美容美髮","lv":"low","avg":400},{"c":"5462","n":"麵包糕餅店","lv":"low","avg":80},{"c":"5945","n":"玩具遊戲零售","lv":"low","avg":250},{"c":"5977","n":"化妝品店","lv":"mid","avg":500},{"c":"7298","n":"健康美容中心","lv":"mid","avg":800},{"c":"5944","n":"珠寶鐘錶","lv":"mid","avg":5000},{"c":"4722","n":"旅行社","lv":"mid","avg":8000},{"c":"7011","n":"酒店住宿","lv":"mid","avg":1500},{"c":"5722","n":"家用電器","lv":"mid","avg":2000},{"c":"5732","n":"電子產品零售","lv":"mid","avg":1500},{"c":"7995","n":"博彩","lv":"high","avg":1000},{"c":"6010","n":"金融機構—人工提現","lv":"high","avg":5000},{"c":"6011","n":"金融機構—自動提現","lv":"high","avg":3000},{"c":"6012","n":"金融機構—商品服務","lv":"high","avg":3000},{"c":"6051","n":"準現金／外幣兌換","lv":"high","avg":4000},{"c":"5122","n":"藥品批發","lv":"high","avg":2000},{"c":"5912","n":"藥房","lv":"high","avg":300},{"c":"5962","n":"電話銷售","lv":"high","avg":800},{"c":"5966","n":"外呼銷售","lv":"high","avg":800},{"c":"5967","n":"成人內容","lv":"high","avg":300},{"c":"4829","n":"匯款／轉帳","lv":"high","avg":5000},{"c":"5993","n":"煙草","lv":"high","avg":400},{"c":"7273","n":"約會交友服務","lv":"high","avg":600},{"c":"8062","n":"醫院","lv":"high","avg":6000}],"SME_RULES":{"VISA":{"SME":{"ex":[5122,5962,5966,5967,7995,5993,[3000,3300],4511,[3501,3833],9211,9222,9311,9399,9405,8062,4121]},"SMESMK":{"only":[5411]},"SMEB2B":null},"MASTERCARD":{"SME":{"ex":[8062,9211,9222,9223,9311,9399,9402,9405,4829,5541,5542,5993,[6010,6012],6050,6051,6532,6533,[6536,6538],6540,7011,7995]},"SMESMK":{"only":[5411]},"SMEB2B":null},"AMERICAEXPRESS":{"SME":{"ex":[[3000,3299],[3351,3441],4722,7011,7012,4829,[6010,6012],6051,6538,7995,5962,5963,5966,5967,7273,7322,7800,7802,9402,9406,5094]},"SMESMK":null,"SMEB2B":{"ex":[4829,6012,6051,6538,7322]}}},"TENORS":[3,6,9,12,18,24,36],"PROVINCES":{"HKG":[["HK-KLN","九龍"],["HK-HKI","香港島"],["HK-NT","新界"]],"HKG_CARD":[["HKG","香港"]],"MAC":[["MO-MAC","澳門半島"],["MO-TPA","氹仔"]],"CHN":[["CN-GD","廣東省"],["CN-SH","上海市"],["CN-BJ","北京市"],["CN-ZJ","浙江省"],["CN-FJ","福建省"]],"SGP":[["SG-CEN","Central Region"],["SG-EAST","East Region"]],"USA":[["US-NY","New York"],["US-CA","California"]],"GBR":[["GB-LND","Greater London"],["GB-MAN","Greater Manchester"]]},"CITIES":{"CN-GD":[["CN-GD-SZ","深圳市"],["CN-GD-GZ","廣州市"],["CN-GD-ZH","珠海市"]],"CN-SH":[["CN-SH-SH","上海市"]],"CN-BJ":[["CN-BJ-BJ","北京市"]],"CN-ZJ":[["CN-ZJ-HZ","杭州市"],["CN-ZJ-NB","寧波市"]],"CN-FJ":[["CN-FJ-XM","厦門市"],["CN-FJ-FZ","福州市"]]}},"sourceFieldIds":["legalStatus","merchantType","groupId","merchantName","merchantShortName","merchantEnglishName","merchantEnglishShortName","registerCertType","registerCertNo","registerCertName","registerCertPeriod","crCode","nar1Period","threeCertFlag","creditCode","creditCodePeriod","organCode","organCodePeriod","taxCode","taxCodePeriod","registerCapital","licencePeriod","workerNumber","addrCountryCode","addrProvinceCode","addrCityCode","addrStreet","addrStreetEn","mcc","riskLevel","webUrl","avgPerAmount","maxAmount","avgMonthAmount","contactName","contactPhone","contactEmail","maintainerName","maintainerEmail","developer","developerEmail","merchantAgreementNum","merchantAgreementPeriod","signType","remark","settlePeriod","currency","cardCountryCode","cardProvinceCode","cardCityCode","cardAddress","swiftCode","cardBankName","cardBankCode","cardBranchCode","isCompay","cardName","cardNo","cardIdcardNo","settlementPrefix","handleClear"]};

// Word feedback, 2026-09-29. Shared by backend and External; risk rules are unchanged.
V2_DATA.version = 'OATS-V2-20260929-document-feedback';
for (const form of V2_DATA.forms) for (const section of form.sections) {
  section.fields = section.fields.filter(f => f.id !== 'dbaNo');
  if (section.name === '法律主體') {
    section.texts = section.texts.map(t => t.replace('及必須上傳的文件', '；上傳文件均為選填'));
    const group = section.fields.find(f => f.id === 'groupId');
    Object.assign(group, {label:'所屬集團  Group', placeholder:'請輸入所屬集團', max:100});
    for (const f of [
      {id:'parentMerchant',label:'上級商戶  Parent Merchant',placeholder:'請輸入上級商戶',hint:'選填；填寫所屬上級商戶',type:'Text',max:100},
      {id:'inspectionDate',label:'考察日期  Inspection Date',placeholder:'YYYY/MM/DD',hint:'選填；實際考察日期',type:'Text'}
    ]) if (!section.fields.some(x => x.id === f.id)) section.fields.push(f);
  }
  for (const field of section.fields) {
    if (field.id === 'registerCertNo') Object.assign(field, {placeholder:'12345678-000-03-26-7', hint:'香港 BR 請填寫 Certificate No. 的完整號碼，包含最後三段；不會由日期推算尾碼'});
    if (['merchantShortName','merchantEnglishShortName'].includes(field.id)) field.hint += '；DBA 即中文或英文簡稱，不另設編號';
    if (field.id === 'cardBankName') field.hint = '按香港銀行代碼帶入；未列出銀行或其他地區請手動填寫';
  }
}
for (const doc of V2_DATA.documents) doc.hint = '選填；可選取或拖曳文件，未提供不會阻擋下一步。每檔上限 10 MB。';
const ONBOARDING_BANKS = Object.freeze({'003':'渣打銀行（香港）','004':'香港上海滙豐銀行','012':'中國銀行（香港）','015':'東亞銀行','016':'星展銀行（香港）','024':'恒生銀行'});

// OATS V2 onboarding. Browser-only demonstration; no OCR, screening or payment API calls.
const V2 = V2_DATA;
const v2Groups = V2.catalog.GROUPS;
const v2Fields = V2.forms.flatMap(f => f.sections.flatMap(s => s.fields));
const v2ById = Object.fromEntries(v2Fields.map(f => [f.id, f]));
const v2PersonKeys = ['name','firstNameEn','lastNameEn','idcardType','idcardNo','idcardNoPeriod','birthDay'];
let v2OcrEdit = null;
const v2Raw = k => String(state.values[k] ?? '').trim();
const v2Num = k => Number(v2Raw(k)) || 0;
const v2Model = () => state.values.__v2;
const v2RowKey = (g,i) => g.k + '|' + i;
const v2Rows = () => v2Groups.flatMap(g => v2Model().groups[g.k] ? g.rows.map((r,i) => ({g,r,i,key:v2RowKey(g,i),st:v2Model().rates[v2RowKey(g,i)]})).filter(x => x.st?.on) : []);
const v2Has = (key, predicate=()=>true) => v2Rows().some(x => x.g.k===key && predicate(x.r));
const v2Cnp = () => v2Has('CNP') || v2Has('PBL',r=>!!r.brand);
const v2Offline = () => v2Has('POS') || v2Has('INQR');
const v2Amex = () => ['HKG','SGP'].includes(v2Raw('addrCountryCode')) && v2Rows().some(x=>['POS','CTV','CNP','PBL','ONE'].includes(x.g.k)&&x.r.brand==='AMERICAEXPRESS');
const v2DateDays = d => d ? Math.round((new Date(d+'T00:00:00')-new Date(new Date().toDateString()))/86400000) : 99999;
const v2NormalizeName = s => String(s).toUpperCase().replace(/LIMITED/g,'LTD').replace(/ROAD/g,'RD').replace(/[^A-Z0-9\u3400-\u9fff]/g,'');
function v2Options(id) {
  if (/ProvinceCode$/.test(id)) {const k=id.startsWith('card')?'card':'addr',country=v2Raw(k+'CountryCode');return V2.catalog.PROVINCES[k==='card'&&country==='HKG'?'HKG_CARD':country]||[];}
  if (/CityCode$/.test(id)) return V2.catalog.CITIES[v2Raw((id.startsWith('card')?'card':'addr')+'ProvinceCode')]||[];
  return V2.options[id] || V2.options[id.split('.').pop()] || [];
}
function v2Canonical(k,v) {
  if (v===undefined || v===null || v==='') return '';
  const list=V2.options[k]||V2.options[k.split('.').pop()]||[];
  if(list.some(o=>o[0]===v))return v;
  const aliases={legalStatus:{'法人團體 · Body Corporate':'BODY_CORPORATE','個人 · Individual':'PERSON','合夥 · Partnership':'PARTNER','非屬法團 · Unincorporated Body':'NO_CORPORATION'},riskLevel:{'一般':'1'},chargeWay:{'按月結算':'MONTH_SETTLE','月結扣費':'MONTH_SETTLE','預付費':'PRE_FEE','餘額扣費':'BALANCE'}};
  if(aliases[k]?.[v])return aliases[k][v];
  const clean=s=>String(s).replace(/[\s–—-]/g,'');
  const match=list.find(o=>String(v).startsWith(o[0]+' ')||clean(v)===clean(o[1]));
  return match?.[0] ?? String(v);
}
function v2Ensure() {
  if(v2Model()?.version===2)return;
  const hadData=!!state.values.merchantName;
  if(!hadData)state.people={directors:1,authSigners:0,shareHolders:0};
  for(const k of Object.keys(state.values))state.values[k]=v2Canonical(k,state.values[k]);
  for(const [k,v] of Object.entries(V2.defaults))if(state.values[k]===undefined||k==='riskLevel'&&!['1','2','3'].includes(state.values[k]))state.values[k]=v;
  if(v2Raw('settlePeriod').includes('系統'))state.values.settlePeriod='T1';
  if(v2Raw('cardBankCode'))state.values.cardBankCode=v2Raw('cardBankCode').split(' ')[0];
  const geoAlias={'香港':'HK-HKI','九龍':'HK-KLN','新界':'HK-NT','廣東省':'CN-GD','上海市':'CN-SH','北京市':'CN-BJ','深圳市':'CN-GD-SZ','廣州市':'CN-GD-GZ'};
  for(const k of ['addrProvinceCode','addrCityCode','cardProvinceCode','cardCityCode'])if(geoAlias[v2Raw(k)])state.values[k]=k==='cardProvinceCode'&&v2Raw('cardCountryCode')==='HKG'?'HKG':geoAlias[v2Raw(k)];
  state.values.__v2={version:2,groups:{},rates:{},combo:{},sme:{},links:{authSigners:{},shareHolders:{}},signals:{},ocr:[],ack:{},manualRisk:false,legacy:hadData};
  if(hadData)for(const [id,g] of [['603:4689','POS'],['603:4745','INQR'],['603:4709','CNP']])if(state.checks[id])v2SetGroup(g,true);
  if(!hadData)for(const key of ['POS','CNP','INQR'])v2SetGroup(key,true);
  state.values.mccName=V2.catalog.MCCS.find(m=>m.c===v2Raw('mcc'))?.n||'';
}
function v2Reset() {
  state.values=structuredClone(V2.defaults);state.checks={};state.files={};state.people={directors:1,authSigners:0,shareHolders:0};
  state.emailVerified=false;state.errors={};state.draftId=null;state.savedAt=null;state.editing=null;DEMO.br=null;v2Ensure();
}
defaults=()=>{Object.assign(state.values,structuredClone(V2.defaults));v2Ensure();};
v2Ensure();
function v2SetGroup(k,on) {const m=v2Model(),g=v2Groups.find(g=>g.k===k);m.groups[k]=on;g.rows.forEach((r,i)=>{m.rates[v2RowKey(g,i)]??={on:!r.off,ct:r.ct||null,v:{}};});}
function v2Score() {
  const items=[],add=(label,n)=>items.push({label,n}),m=V2.catalog.MCCS.find(m=>m.c===v2Raw('mcc')),s=v2Model().signals;
  if(v2Raw('licencePeriod')==='01')add('經營年限少於 1 年',15);else if(v2Raw('licencePeriod')==='02')add('經營年限 1–3 年',8);
  if(v2Raw('legalStatus')==='PERSON')add('法律地位為個人',10);
  if(v2Raw('registerCapital')==='01')add('註冊資本少於 10 萬',6);
  if(v2Raw('registerCertPeriod')&&v2DateDays(v2Raw('registerCertPeriod'))<90)add('註冊證書距到期少於 90 天',8);
  if(m?.lv==='high')add('MCC 屬高風險',25);else if(m?.lv==='mid')add('MCC 屬中風險',12);
  if(v2Cnp())add('開通 CNP／PayByLink 卡產品',15);
  if(v2Cnp()&&v2Raw('connectType')==='0')add('卡產品採直連',10);
  if(v2Num('avgMonthAmount')>500000)add('月銷售超過 500,000',10);
  if(v2Num('maxAmount')>20000)add('單筆最高超過 20,000',8);
  if(m&&v2Num('avgPerAmount')>m.avg*3)add('平均單筆偏離行業常態超過 3 倍',12);
  const edits=v2Model().ocr.filter(o=>o.applied&&v2Raw(o.key)!==String(o.applied)).length;
  if(s.ocr||edits>=2)add('OCR 與人工修改差異不少於 2 項',10);
  if(s.virtual||v2Offline()&&!state.files['101401'])add('無門店照／虛擬辦公室',12);
  if(v2Raw('isCompay')==='N')add('結算帳戶為對私',8);
  if(v2Raw('isCompay')==='Y'&&v2Raw('cardName')&&v2Raw('merchantEnglishName')&&v2NormalizeName(v2Raw('cardName'))!==v2NormalizeName(v2Raw('merchantEnglishName')))add('對公帳戶名稱與英文商戶名稱不一致',15);
  if(s.cardlink)add('帳戶已關聯其他商戶',20);if(s.prepaid)add('涉及預付／儲值／預售',20);
  const total=Math.min(100,items.reduce((n,x)=>n+x.n,0)),reject=s.sanction?'命中制裁／PEP 名單':s.frozen?'關聯已凍結／關閉商戶':total>70?'風控評分超過 70':null;
  return {items,total,reject,level:total<=20?'1':total<=45?'2':'3'};
}
function v2SyncDerived() {
  for(const group of ['authSigners','shareHolders'])for(const [i,d] of Object.entries(v2Model().links[group])){
    if(d===null||d===undefined||+d>=state.people.directors)continue;
    for(const k of v2PersonKeys)state.values[`${group}[${i}].${k}`]=state.values[`directors[${d}].${k}`]||'';
  }
  state.values.mccName=V2.catalog.MCCS.find(m=>m.c===v2Raw('mcc'))?.n||(v2Raw('mcc').length===4?'未列入清單，待人工核定':'');
  if(!v2Model().manualRisk)state.values.riskLevel=v2Score().level;
}
function v2FileRequired() {
  return Object.fromEntries(V2.documents.map(d=>[d.id,false]));
}
requiredFiles=()=>Object.entries(v2FileRequired()).filter(([,yes])=>yes).map(([id])=>id);
function v2Required() {
  const v=state.values,r=new Set(['legalStatus','merchantType','merchantName','merchantShortName','merchantEnglishName','merchantEnglishShortName','registerCertType','registerCertNo','registerCertName','registerCertPeriod','registerCapital','licencePeriod','workerNumber','addrCountryCode','addrProvinceCode','addrStreet','addrStreetEn','mcc','riskLevel','avgPerAmount','maxAmount','avgMonthAmount','contactName','contactPhone','contactEmail','merchantAgreementPeriod','signType','currency','cardCountryCode','cardProvinceCode','cardBankCode','cardName','cardNo','isCompay']);
  if(v.legalStatus==='BODY_CORPORATE')r.add('nar1Period');
  if(v.addrCountryCode==='CHN'){r.add('addrCityCode');if(v.legalStatus!=='PERSON'){r.add('threeCertFlag');if(v.threeCertFlag==='0')for(const k of ['creditCode','organCode','taxCode'])r.add(k);}}
  if(v.cardCountryCode==='CHN'){r.add('cardCityCode');r.add('cardBranchCode');}else r.add('cardBankName');
  if(v.isCompay==='N')r.add('cardIdcardNo');if(v2Cnp())r.add('webUrl');
  if(v2Has('AV')&&v.chargeWay==='MONTH_SETTLE')r.add('monthMinPrice');
  if(v2Model().manualRisk&&+v.riskLevel<+v2Score().level)r.add('riskOverrideReason');
  return r;
}
function v2Visible(f) {
  const k=f.id,v=state.values;
  if(k==='groupId')return v.merchantType==='GENERAL';if(k==='nar1Period')return v.legalStatus==='BODY_CORPORATE';
  if(k==='threeCertFlag'||/^(creditCode|organCode|taxCode)/.test(k))return v.addrCountryCode==='CHN'&&v.legalStatus!=='PERSON'&&(k==='threeCertFlag'||v.threeCertFlag==='0');
  if(k==='addrCityCode')return v.addrCountryCode==='CHN';if(k==='cardCityCode')return v.cardCountryCode==='CHN';
  if(['swiftCode','cardBankName'].includes(k))return v.cardCountryCode!=='CHN';
  if(k==='cardIdcardNo')return v.isCompay==='N';if(k==='webUrl')return v2Cnp();
  if(k==='riskOverrideReason')return v2Required().has(k);return true;
}
function v2Display(k,v=state.values[k]) {return (v2Options(k).find(o=>o[0]===v)?.[1]||String(v??''))||'尚未填寫';}
function v2Field(f,index=0,linked=false) {
  if(!v2Visible(f))return '';
  const key=f.id.replace('[]',`[${index}]`),v=state.values[key]??'',id='field-'+key.replace(/[^\w-]/g,'-'),required=v2Required().has(f.id)||(f.id.includes('[]')&&(['name','firstNameEn','lastNameEn','idcardType','idcardNo'].includes(f.id.split('.').pop())||f.id.startsWith('authSigners')&&f.id.endsWith('birthDay'))),error=state.errors[key];
  const ro=linked||['mccName','merchantAgreementNum'].includes(key),type=f.placeholder==='YYYY/MM/DD'||/Period$|birthDay$/.test(key)&&!['settlePeriod','licencePeriod'].includes(key)?'date':/Email$/.test(key)?'email':/Phone$/.test(key)?'tel':key==='webUrl'?'url':'text';
  let label=f.label.split(/\s{2,}/);const heading=esc(label[0].replace(/\s*\*/g,''))+(required?' <span class="required">*</span>':'')+(label.length>1?`<span class="en">${esc(label.slice(1).join(' '))}</span>`:'');
  const attrs=`id="${id}" data-field="${esc(key)}" data-v2-field="${esc(key)}" ${ro?'readonly':''} ${required?'aria-required="true"':''} ${error?'aria-invalid="true"':''} ${f.max?'maxlength="'+f.max+'"':''}`;
  let control;
  if(f.type==='Select'&&key!=='cardBankCode'){const opts=v2Options(f.id);control=`<select ${attrs} ${ro?'disabled':''}><option value="">請選擇</option>${opts.map(([v1,l])=>`<option value="${esc(v1)}" ${v1===v?'selected':''}>${esc(l)}</option>`).join('')}${v&&!opts.some(o=>o[0]===v)?`<option value="${esc(v)}" selected>${esc(v)}（請重新選擇）</option>`:''}</select>`;}
  else control=`<input ${attrs} type="${type}" value="${esc(v)}" placeholder="${esc(f.placeholder)}" ${key==='mcc'?'list="v2-mcc" inputmode="numeric"':key==='cardBankCode'&&v2Raw('cardCountryCode')==='HKG'?'list="v2-banks" inputmode="numeric"':key==='settlePeriod'?'list="v2-settlement"':''}>`;
  return `<div class="field ${error?'invalid':''}" data-field-wrap="${esc(key)}"><label for="${id}">${heading}</label>${control}${f.hint?`<div class="hint">${esc(f.hint)}</div>`:''}${key==='contactEmail'?btn(state.emailVerified?'已驗證（模擬）':'驗證電郵（模擬）','verify-email','mini-action'):''}${error?`<div class="error" role="alert">${esc(error)}</div>`:''}</div>`;
}
function v2Card(title,copy,body) {return `<section class="card" data-section="${esc(title)}"><h2>${esc(title)}</h2>${copy?`<p class="hint">${esc(copy)}</p>`:''}${body}</section>`;}
function v2PersonSection(s) {
  const group=s.fields[0].id.split('[')[0],links=v2Model().links[group];let html='';
  for(let i=0;i<state.people[group];i++){const linked=links?.[i]!==undefined&&links?.[i]!==null;
    html+=`<div class="repeat"><div class="repeat-heading"><strong>${esc(s.name)} ${i+1}</strong>${btn('移除此人','v2-remove-person','danger',`data-group="${group}" data-index="${i}"`)}</div>${group!=='directors'?`<div class="v2-person-link"><label class="check"><input type="checkbox" data-v2-link="${group}" data-index="${i}" ${linked?'checked':''} ${!state.people.directors?'disabled':''}>與董事相同</label><select aria-label="沿用哪位董事" data-v2-director="${group}" data-index="${i}" ${!state.people.directors?'disabled':''}>${Array.from({length:state.people.directors},(_,j)=>`<option value="${j}" ${links?.[i]===j?'selected':''}>董事 ${j+1} · ${esc(v2Raw('directors['+j+'].name')||'未填姓名')}</option>`).join('')}</select><small class="hint">${linked?'董事修改時同步更新；取消勾選可獨立修改。':'可沿用已登記董事資料及證件。'}</small></div>`:''}<div class="grid">${s.fields.map(f=>v2Field(f,i,linked)).join('')}</div></div>`;
  }
  return v2Card(s.name,s.texts[1],html+btn('＋ 新增一位','v2-add-person','',`data-group="${group}" ${group==='authSigners'&&v2Amex()&&state.people[group]>=1?'disabled':''}`)+' <span class="hint">制裁／PEP：Demo 未執行真實篩查</span>');
}
function v2FormSections(index) {return V2.forms[index].sections.map(s=>{if(!s.fields.length)return '';if(s.fields[0]?.id.includes('[]'))return v2PersonSection(s);const fs=s.fields.filter(v2Visible);if(!fs.length)return '';let tail='';if(s.name==='結算參數')tail=`<div class="toolbar v2-quick">${['T1','T2','T3','T7'].map(x=>btn(x,'v2-settlement','',`data-value="${x}"`)).join('')}${btn('使用建議值 '+({1:'T1',2:'T2',3:'T3'}[state.values.riskLevel]),'v2-settlement','',`data-value="${({1:'T1',2:'T2',3:'T3'}[state.values.riskLevel])}"`)}</div>`;if(fs.some(f=>f.id==='riskLevel'))tail=v2RiskSummary();return v2Card(s.name,s.texts[1],`<div class="grid">${fs.map(f=>v2Field(f)).join('')}</div>`+tail);}).join('');}
function v2RiskSummary(){const score=v2Score();return `<div class="notice ${score.reject?'error':'warn'} v2-risk-summary"><strong>V2 風控示例：${score.total} 分 · ${score.reject?'拒件':v2Display('riskLevel',score.level)}</strong><p>${score.items.map(x=>esc(x.label)+' +'+x.n).join('；')||'暫無加分項。'}</p>${v2Model().manualRisk?btn('恢復系統建議','v2-reset-risk'):''}<small>只模擬參考原型規則，不代表正式審核結果。</small></div>`;}
function v2SmeOptions(brand) {const m=+v2Raw('mcc'),rules=V2.catalog.SME_RULES[brand];return ['SME','SMESMK','SMEB2B'].filter(t=>{const r=rules[t];return r&&m&&(r.only?r.only.includes(m):!r.ex.some(x=>Array.isArray(x)?m>=x[0]&&m<=x[1]:m===x));});}
function v2Sme() {return v2Card('特計商戶','',`<div class="v2-sme-table-wrap"><table class="v2-sme-table"><thead><tr><th scope="col">開通</th><th scope="col">卡組織</th><th scope="col">特計商戶類型</th></tr></thead><tbody>${['VISA','MASTERCARD','AMERICAEXPRESS'].map(b=>{const opts=v2SmeOptions(b),s=v2Model().sme[b]||{},hasMcc=!!v2Raw('mcc');return `<tr><td><input aria-label="開通 ${b} 特計商戶" type="checkbox" data-v2-sme="${b}" ${s.on?'checked':''} ${!opts.length?'disabled':''}></td><th scope="row">${b}</th><td>${!hasMcc?'<span class="hint">請先在第 3 步填寫 MCC</span>':!opts.length?'<span class="hint">目前 MCC 不適用任何特計商戶類型</span>':`<select aria-label="${b} 特計商戶類型" data-v2-sme-type="${b}">${opts.map(o=>`<option ${s.type===o?'selected':''}>${o}</option>`).join('')}</select>`}</td></tr>`;}).join('')}</tbody></table></div><p class="hint v2-sme-help">下拉只列出目前 MCC 可用的特計類型（按卡組織排除清單自動判定）。</p>`);}
function v2FeeSummary(r,st) {const v=st.v,ct=st.ct;if(r.mode==='NONE')return '無手續費';if(r.mode==='PER')return '每筆 HKD '+(v.per_fix??'0.00');if(r.mode==='INST')return V2.catalog.TENORS.filter(t=>v['t'+t+'_on']).map(t=>t+' 期').join('／')||'請設定開通期數';if(ct==='Regional')return '本地 '+(v.loc_rate??'0.00')+'%／跨境 '+(v.crs_rate??'0.00')+'%';if(ct==='Wallet')return '國內錢包 '+(v.cn_rate??'0.00')+'%／香港錢包 '+(v.hk_rate??'0.00')+'%';return (v.std_rate??'0.00')+'% + HKD '+(v.std_fix??'0.00');}
function v2Products() {
  const shown=v2Groups.filter(g=>v2Model().groups[g.k]);
  let html=v2Card('產品配置','先選擇產品類別，再勾選開通項目；費率直接顯示於產品同列，毋須逐項開啟視窗。',`<div class="check-grid">${v2Groups.map(g=>`<label class="check"><input type="checkbox" data-v2-group="${g.k}" ${v2Model().groups[g.k]?'checked':''}>${g.n}</label>`).join('')}</div>`)+v2Sme();
  if(!shown.length)html+='<div class="notice v2-catalog-empty">尚未選擇產品類別。請勾選上方類別以設定產品與費率。</div>';
  html+=shown.map(g=>{
    const enabled=!!v2Model().groups[g.k];
    return v2Card(g.n+' · 產品項目',(g.tip?g.tip+' ':'')+'勾選產品後直接編輯同列費率；未開通時只顯示、不帶入申請。',`${g.combo?`<div class="toolbar">${g.combo.map(c=>`<label class="check"><input type="checkbox" data-v2-combo="${g.k+'|'+c}" ${enabled&&v2Model().combo[g.k+'|'+c]?'checked':''} ${enabled?'':'disabled'}>${esc(c)}</label>`).join('')}</div>`:''}<div class="v2-product-grid">${g.rows.map((r,i)=>{
      const key=v2RowKey(g,i),st=v2Model().rates[key]||{on:false,ct:r.ct||null,v:{}},selected=enabled&&st.on;
      const mode=r.mode==='INST'?'分期費率':r.mode==='PER'?'按筆收費':r.mode==='NONE'?'無手續費':'固定費率';
      return `<div class="v2-product ${selected?'selected':'preview'}" data-v2-rate-row="${key}"><div class="v2-product-name"><label class="check"><input type="checkbox" data-v2-product="${key}" ${selected?'checked':''} ${enabled?'':'disabled'}><span>${esc(r.n)}</span></label>${r.note?`<p class="hint v2-product-note">${esc(r.note)}</p>`:''}</div><div class="v2-inline-pricing"><label for="pricing-${key}">收費類型</label>${r.ct?`<select id="pricing-${key}" data-v2-inline-pricing="${key}" aria-label="${esc(r.n)} 收費類型" ${selected?'':'disabled'}>${(r.wal?['Wallet','Blended']:['Regional','Blended']).map(x=>`<option ${st.ct===x?'selected':''}>${x}</option>`).join('')}</select>`:`<span>${mode}</span>`}</div><div class="v2-inline-fees">${v2InlineFees(g,r,key,st,!selected)}<p class="error v2-inline-error" data-v2-rate-error="${key}" role="alert">${selected?esc(v2FeeErrors(r,st).join('；')):''}</p></div></div>`;
    }).join('')}</div>`);
  }).join('');
  return '<div class="v2-products-page">'+html+v2FormSections(3)+'</div>';
}
function v2InlineFees(g,r,key,st,disabled) {
  const v=st.v,standard=[['rate','費率（%）','0.00'],['fix','每筆費用（HKD）','0.00'],['min','保底（HKD）','0'],['max','封頂（HKD）','0']];
  const header=fields=>`<div class="v2-rate-line v2-rate-head" style="--fee-count:${fields.length}" aria-hidden="true"><span>適用範圍</span>${fields.map(f=>`<span>${f[1]}</span>`).join('')}</div>`;
  const line=(prefix,label,fields=standard,toggle=null,locked=false)=>`<div class="v2-rate-line" style="--fee-count:${fields.length}">${toggle?`<label class="check v2-rate-scope"><input type="checkbox" data-v2-inline-key="${key}" data-v2-inline-toggle="${toggle}" ${v[toggle]?'checked':''}>${label}</label>`:`<span class="v2-rate-scope">${label}</span>`}${fields.map(([k,l,d])=>{const f=prefix?prefix+'_'+k:k,id='rate-'+key+'-'+f;return `<div class="v2-rate-input"><label for="${id}">${label} ${l}</label><input id="${id}" aria-label="${esc(r.n)} · ${label} ${l}" data-v2-inline-key="${key}" data-v2-inline-field="${f}" inputmode="decimal" value="${esc(v[f]??d)}" ${locked?'disabled':''}></div>`;}).join('')}</div>`;
  let html='';
  if(r.mode==='NONE')html='<span>此項服務無手續費</span>';
  else if(r.mode==='INST'){const fields=[['rate','費率（%）','0.00'],['fix','固定費用（HKD）','0']];html=header(fields)+V2.catalog.TENORS.map(t=>line('t'+t,t+' 期',fields,'t'+t+'_on',!v['t'+t+'_on'])).join('');}
  else if(r.mode==='PER'){const fields=[['per_fix','每筆費用（HKD）','0.00']];html=header(fields)+line('','每筆',fields);}
  else {
    html=header(standard);
    if(st.ct==='Regional'){html+=line('loc','本地卡')+line('crs','跨境卡');if(r.pref)html+=line('pref','優惠費率',standard,'pref_on',!v.pref_on);}
    else if(st.ct==='Wallet')html+=line('cn','國內錢包')+line('hk','香港錢包');
    else html+=line('std','統一費率');
    if(r.dcc){const fields=[['rate','DCC（%）','0.00'],['fix','每筆費用（HKD）','0.00'],['markup','Markup（%）','0.00']];html+=`<p class="hint">DCC 交易 · ${v2Model().combo[g.k+'|DCC交易']?'已啟用':'勾選上方 DCC 交易後可編輯'}</p>`+header(fields)+line('dcc','DCC',fields,null,!v2Model().combo[g.k+'|DCC交易']);}
    if(r.upi)html+=`<div class="v2-rate-upi"><label for="upi-${key}">開通優計劃</label><select id="upi-${key}" data-v2-inline-key="${key}" data-v2-inline-field="upi"><option value="N" ${v.upi!=='Y'?'selected':''}>否</option><option value="Y" ${v.upi==='Y'?'selected':''}>是</option></select></div>`;
  }
  return `<fieldset class="v2-inline-fieldset" aria-label="${esc(r.n)} 費率" ${disabled?'disabled':''}>${html}</fieldset>`;
}
// Page-local edits update the application model; draft persistence remains explicit.
function v2InlineChange(t) {
  const key=t.dataset.v2InlineKey||t.dataset.v2InlinePricing;if(!key||t.matches(':disabled'))return;
  const st=v2Model().rates[key],[gk,index]=key.split('|');if(!st?.on||!v2Model().groups[gk])return;
  const r=v2Groups.find(g=>g.k===gk).rows[+index];
  if(t.dataset.v2InlinePricing){st.ct=t.value;render();return;}
  if(t.dataset.v2InlineToggle){st.v[t.dataset.v2InlineToggle]=t.checked;render();return;}
  if(t.dataset.v2InlineField){st.v[t.dataset.v2InlineField]=t.value;const error=t.closest('[data-v2-rate-row]').querySelector('[data-v2-rate-error]');error.textContent=v2FeeErrors(r,st).join('；');t.setAttribute('aria-invalid',String(!!error.textContent));}
}
function v2FeeErrors(r,st) {
  const e=[],v=st.v,number=(k,d,percent=false)=>{const raw=String(v[k]??d);if(!/^\d+(\.\d{1,2})?$/.test(raw)||Number(raw)<0||percent&&Number(raw)>100)e.push('請填寫有效的'+(percent?' 0–100 費率':'非負金額')+'（最多 2 位小數）');};
  const line=p=>{number(p+'_rate','0',true);for(const k of ['fix','min','max'])number(p+'_'+k,'0');if(+v[p+'_max']>0&&+v[p+'_min']>+v[p+'_max'])e.push('保底不可大於封頂');};
  if(r.mode==='NONE')return e;if(r.mode==='INST'){const terms=V2.catalog.TENORS.filter(t=>v['t'+t+'_on']);if(!terms.length)e.push('請至少選擇一個分期期數');for(const t of terms){number('t'+t+'_rate','0',true);number('t'+t+'_fix','0');}}
  else if(r.mode==='PER')number('per_fix','0');else {for(const p of st.ct==='Regional'?['loc','crs']:st.ct==='Wallet'?['cn','hk']:['std'])line(p);if(r.pref&&st.ct==='Regional'&&v.pref_on)line('pref');if(r.dcc&&v2Model().combo['POS|DCC交易']){number('dcc_rate','0',true);number('dcc_fix','0');number('dcc_markup','0',true);}}
  return [...new Set(e)];
}
const v2Label=k=>(v2ById[k.replace(/\[\d+\]/,'[]')]?.label||'資料欄位').split(/\s{2,}/)[0].replace(/\s*\*/g,'');
const v2MissingDocs=()=>V2.documents.filter(d=>v2FileRequired()[d.id]&&(!state.files[d.id]||state.files[d.id].needsReselect));
function v2Consistency() {
  const list=[],add=(key,title,values,step,hard=false)=>{const filled=values.filter(x=>x[1]);if(filled.length<2)return;const same=filled.every(x=>v2NormalizeName(x[1])===v2NormalizeName(filled[0][1]));const fingerprint=JSON.stringify(filled);list.push({key,title,values:filled,step,hard,same,fingerprint,confirmed:!same&&v2Model().ack[key]?.fingerprint===fingerprint});};
  if(v2Raw('isCompay')==='Y')add('bank-name','公司英文名稱與對公帳戶名稱',[['商戶',v2Raw('merchantEnglishName')],['銀行帳戶',v2Raw('cardName')]],4);
  for(const o of v2Model().ocr.filter(o=>o.applied))add('ocr-'+o.key,v2Label(o.key)+' · 文件與表單',[['已核對辨識',o.applied],['目前表單',v2Raw(o.key)]],o.step||2);
  return list;
}
function v2ConsistencyCard() {
  const list=v2Consistency();return v2Card('資料一致性檢查','比較本次表單及已套用的辨識結果；尚未提供的文件不代表已完成核實。',list.length?`<div class="v2-consistency">${list.map(c=>`<div class="v2-check-row"><div><strong>${esc(c.title)}</strong><small>${c.values.map(([l,v])=>esc(l)+'：'+esc(v)).join('／')}</small></div>${pill(c.same?'一致':c.confirmed?'已確認差異':'待核對',c.same?'green':c.confirmed?'blue':'amber')}${!c.same?btn('查看差異','v2-difference','',`data-key="${esc(c.key)}"`):''}</div>`).join('')}</div>`:'<p class="hint">尚未有足夠資料可比對。可先填寫表單，或匯入 BR 核對後套用。</p>');
}
function v2BrStatus(){const count=v2Model().ocr.filter(o=>o.applied&&/BR/.test(o.source)).length;return `<section class="v2-br-status"><div><p>${count?'已從 BR 帶入 '+count+' 個欄位，請繼續核對':'尚未匯入 BR，可先手動填寫'}</p><small>BR 可預填名稱、證書資料、完整地址及業務性質；MCC、地區及聯絡方式需另行填寫。</small></div>${btn(count?'查看辨識來源':'匯入 BR 並辨識',count?'br-sources':'br-start')}</section>`;}
function v2Documents() {
  const miss=v2MissingDocs(),req=requiredFiles(),log=v2Model().ocr;
  return `<section class="br-callout"><div><h2>文件上傳與識別</h2><p>先匯入 BR，在 Overlay 核對後帶入 Step 2 主體資料及 Step 3 經營與聯繫。</p><small>BR 支援 PDF、JPG、PNG，文件僅在瀏覽器本機辨識；其他文件提供示例流程。</small></div><div>${btn('匯入 BR','br-start','primary')}${btn('多文件辨識示例','v2-ocr')}</div></section>`+v2Card('辨識結果及來源','只會套用你已核對並選取的欄位；低信心或無法辨識的項目不會自動寫入。',log.length?`<div class="table-scroll"><table><thead><tr><th>欄位</th><th>核對內容</th><th>辨識來源</th><th>狀態</th></tr></thead><tbody>${log.map(o=>`<tr><td>${esc(v2Label(o.key))}</td><td>${esc(o.value)}</td><td>${esc(o.source)}${o.confidence==null?'':' · 示例信心 '+o.confidence+'%'}</td><td>${pill(o.applied?'已套用':'待核對',o.applied?'green':'amber')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">尚未匯入文件，可先手動填寫。</p>')+v2ConsistencyCard()+v2Card('必交文件檢查','必交清單會隨法律主體、風險級別、產品及董事／股東設定更新。',`<div class="notice ${miss.length?'warn':''}">${req.length-miss.length}／${req.length} 項必交文件已備妥${miss.length?'；仍缺 '+miss.length+' 項':''}</div>${miss.length?'<ul class="v2-missing">'+miss.map(d=>`<li>${esc(d.name.split('\n')[0])}</li>`).join('')+'</ul>':''}`)+v2Card('文件材料','PDF／JPG／PNG／ZIP，每檔上限 10 MB。多頁或多位董事資料可合併為 PDF／ZIP；本機附件不會上傳。',`<div class="upload-list">${V2.documents.map(d=>uploadRow(d)).join('')}</div>`);
}
function v2ValidateFields(index) {
  const errors={},required=v2Required();
  for(const s of V2.forms[index].sections)for(const f of s.fields.filter(v2Visible)){
    const group=f.id.includes('[]')?f.id.split('[')[0]:null;
    for(let i=0;i<(group?state.people[group]:1);i++){
      const k=f.id.replace('[]',`[${i}]`),v=v2Raw(k),name=v2Label(k),personKey=k.split('.').pop();
      const req=required.has(k)||(group&&(['name','firstNameEn','lastNameEn','idcardType','idcardNo'].includes(personKey)||group==='authSigners'&&personKey==='birthDay'));
      if(req&&!v){errors[k]='請填寫'+name;continue;}if(!v)continue;
      if(f.type==='Select'&&k!=='cardBankCode'&&!v2Options(f.id).some(o=>o[0]===v))errors[k]='請重新選擇有效的'+name;
      if(f.max&&v.length>+f.max)errors[k]=name+'不可超過 '+f.max+' 個字元';
      if(['merchantName','merchantShortName'].includes(k)&&new TextEncoder().encode(v).length>100)errors[k]='中文名稱上限 100 bytes，請縮短內容';
      if((/English/.test(k)||['firstNameEn','lastNameEn'].includes(personKey))&&!/^[\x20-\x7E]+$/.test(v))errors[k]='請使用英文、數字及英文標點';
      if(/Email$/.test(k)&&!/^\S+@\S+\.[a-z]{2,}$/i.test(v))errors[k]='請輸入有效電郵地址';
      if(/Phone$/.test(k)&&!/^\+\d{7,15}$/.test(v.replace(/[\s-]/g,'')))errors[k]='請填寫含國際區號的電話，例如 +852 6123 4567';
      if((/Period$|birthDay$/.test(k)&&!['settlePeriod','licencePeriod'].includes(k))&&!/^\d{4}-\d{2}-\d{2}$/.test(v))errors[k]='請選擇有效日期';
      if(personKey==='birthDay'&&v2DateDays(v)>0)errors[k]='出生日期不能是未來日期';
      if(personKey==='idcardNoPeriod'&&v2DateDays(v)<0)errors[k]='證件已到期，請更新';
      if(k==='mcc'&&!/^\d{4}$/.test(v))errors[k]='請輸入 4 位 MCC 行業代碼';
      if(k==='registerCertNo'&&v2Raw('addrCountryCode')==='HKG'&&!/^\d{8}-?\d{3}(?:-\d{2}-\d{2}-[A-Z0-9])?$/i.test(v))errors[k]='請按原件輸入完整登記證號碼，例如 12345678-000-03-26-7';
      if(k==='registerCertPeriod'&&v2DateDays(v)<30)errors[k]='BR 有效期不足 30 天；仍可儲存草稿';
      if(k==='nar1Period'&&v2DateDays(v)<30)errors[k]='NAR1 有效期不足 30 天，請提供最新周年申報表';
      if(k==='merchantAgreementPeriod'&&v2DateDays(v)<0)errors[k]=name+'已到期，請核對';
      if(k==='webUrl'&&!/^https?:\/\/\S+\.\S+$/i.test(v))errors[k]='請輸入包含 https:// 的有效網站';
      if(k==='settlePeriod'&&!/^[TD]\d{1,2}$/.test(v))errors[k]='結算週期格式：T1、T2、T7 或 D1';
      if(k==='swiftCode'&&!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(v))errors[k]='SWIFT Code 為 8 或 11 位大寫英文／數字（選填）';
      if(k==='cardBankCode'&&v2Raw('cardCountryCode')==='HKG'&&!/^\d{3}$/.test(v))errors[k]='香港銀行代碼須為 3 位數字';
      if(k==='cardBranchCode'&&v2Raw('cardCountryCode')==='HKG'&&!/^\d{3}$/.test(v))errors[k]='香港分行代碼須為 3 位數字（選填）';
      if(k==='cardNo'&&!/^[A-Za-z0-9 -]{6,34}$/.test(v))errors[k]='請填寫有效銀行帳號（6–34 位英文或數字）';
      if(/Amount$|Rate$|Ratio$|Cycle$|Price$|Fix$|^markup$|^minStlAmt$/.test(k)){
        if(!/^\d+(\.\d{1,2})?$/.test(v))errors[k]='請輸入非負數值，最多 2 位小數';
        if(/Rate$|Ratio$|^markup$/.test(k)&&+v>100)errors[k]='比例或費率不可超過 100%';
        if(/Cycle$/.test(k)&&(!/^\d+$/.test(v)||+v>180))errors[k]='週期須為 0–180 的整數天數';
      }
    }
  }
  return errors;
}
validateStep=function(step){
  v2Ensure();v2SyncDerived();const e=step===1?{}:step<=5?v2ValidateFields(({2:0,3:1,4:2,5:3})[step]):{};
  if(step===1)for(const d of v2MissingDocs())e['file-'+d.id]='請提供'+d.name.split('\n')[0];
  if(step===2){if(!state.people.directors)e._directors='請至少新增一位董事';if(v2Amex()&&state.people.authSigners!==1)e._auth='香港／新加坡開通 AMEX 時，須有且僅有一位授權簽名人';}
  if(step===3){if(!state.emailVerified)e.contactEmail=e.contactEmail||'請完成電郵模擬驗證';if(v2Num('avgPerAmount')>v2Num('maxAmount'))e.maxAmount='最高消費金額不可小於平均單筆金額';}
  if(step===4&&v2Raw('isCompay')==='N'&&!Array.from({length:state.people.directors},(_,i)=>v2Raw(`directors[${i}].idcardNo`)).includes(v2Raw('cardIdcardNo')))e.cardIdcardNo='對私結算持有人須為已登記董事，證件號碼必須一致';
  if(step===5){
    if(!v2Rows().length)e._products='請至少選擇一項產品';
    for(const x of v2Rows()){const err=v2FeeErrors(x.r,x.st);if(err.length)e['_fee-'+x.key]=x.g.n+'／'+x.r.n+'：'+err.join('；');}
    for(const [ratio,cycle] of [['depositRatio','depositCycle'],['posCashDepRatio','posDepCycle'],['onQRDepRatio','onQRDepCycle'],['inQRDepRatio','inQRDepCycle']])if(v2Num(ratio)>0&&v2Num(cycle)<1)e[cycle]='比例大於 0 時，釋放週期須為 1–180 天';
    for(const [brand,s] of Object.entries(v2Model().sme))if(s.on&&!v2SmeOptions(brand).includes(s.type))e['_sme-'+brand]=brand+' 特計類型不適用目前 MCC，請重新選擇';
  }
  if(step===6){if(v2Score().reject)e._risk='風控阻擋：'+v2Score().reject+'（Demo）';for(const c of v2Consistency())if(!c.same&&!c.confirmed)e['_check-'+c.key]=c.title+'有差異，請核對並確認原因';}
  return e;
};
validateAll=()=>Object.assign({},...[1,2,3,4,5,6].map(validateStep));
productChecks=()=>v2Rows().map(x=>({id:x.key,label:x.g.n+'／'+x.r.n}));
function v2Review() {
  const errors=validateAll(),missing=Object.keys(errors).length;
  const signals=[['sanction','制裁／PEP 命中'],['cardlink','銀行帳號關聯其他商戶'],['frozen','關聯已凍結／關閉商戶'],['virtual','虛擬辦公室／無實體店'],['prepaid','預付／儲值／預售'],['ocr','OCR 與人工修改差異較大']];
  let html=v2Card('提交前檢查','按更新後的 V2 欄位、條件文件及產品配置檢查。',`<div class="notice ${missing?'warn':''}">${missing?'尚有 '+missing+' 項資料需要確認':'✓ 必填資料已填寫 · ✓ 文件已備妥 · ✓ 電郵已驗證（模擬）'}</div>${missing?'<ul class="v2-missing">'+[1,2,3,4,5,6].map(s=>{const e=Object.values(validateStep(s));return e.length?`<li>${btn('Step '+s+' '+steps[s-1]+' · '+e.length+' 項','step','text-button',`data-step="${s}"`)}<small>${esc(e.slice(0,3).join('；'))}${e.length>3?'……':''}</small></li>`:'';}).join('')+'</ul>':''}`);
  html+=v2Card('風控示例設定','以下為可切換的 Demo 狀態，不會查詢真實制裁名單或銀行資料。',`<div class="check-grid">${signals.map(([key,label])=>`<label class="check"><input type="checkbox" data-v2-signal="${key}" ${v2Model().signals[key]?'checked':''}>${label}</label>`).join('')}</div>`+v2RiskSummary())+v2ConsistencyCard();
  for(const [idx,step] of [[0,2],[1,3],[2,4],[3,5]]){
    html+=v2Card(steps[step-1],'',`<div class="toolbar">${btn('返回修改','step','',`data-step="${step}"`)}</div><div class="v2-summary">${V2.forms[idx].sections.flatMap(s=>s.fields.filter(v2Visible).flatMap(f=>{const group=f.id.includes('[]')?f.id.split('[')[0]:null;return Array.from({length:group?state.people[group]:1},(_,i)=>{const key=f.id.replace('[]',`[${i}]`),raw=v2Raw(key);if(!raw)return '';return `<div><dt>${group?esc(s.name)+' '+(i+1)+' · ':''}${esc(v2Label(key))}</dt><dd>${esc(key==='cardNo'?mask(raw):v2Display(f.id,raw))}</dd></div>`;});})).join('')}</div>`+(step===5?`<h3>已選 ${v2Rows().length} 項產品</h3><div class="v2-summary">${v2Rows().map(x=>`<div><dt>${esc(x.g.n+'／'+x.r.n)}</dt><dd>${esc(v2FeeSummary(x.r,x.st))}</dd></div>`).join('')}</div>`:''));
  }
  html+=v2Card('文件材料','',`<div class="toolbar">${btn('返回修改','step','',`data-step="1"`)}</div><div class="v2-summary">${V2.documents.filter(d=>state.files[d.id]||v2FileRequired()[d.id]).map(d=>`<div><dt>${esc(d.name.split('\n')[0])}</dt><dd>${esc(state.files[d.id]?.name||'尚未提供')}${state.files[d.id]?.needsReselect?'（須重新選取）':''}</dd></div>`).join('')}</div>`);
  html+=v2Card('帳單名稱預覽','建議使用全大寫「品牌名*城市」，25 字元內。',`<div class="statement">${esc(v2Raw('merchantEnglishShortName')||'尚未填寫')}</div>`)+v2Card('聲明及確認','此 Demo 只產生本機申請紀錄，不會向正式平台提交。',check({id:'613:4956',label:'我已核對申請資料，並確認獲授權代表此商戶提交。'}));return html;
}
application=function(step){v2Ensure();v2SyncDerived();return `<div class="v2-form" data-schema="oats-v2">${demoBar(true)}<div class="v2-version">OATS V2 · 六步申請流程</div>${v2Model().legacy?'<div class="notice warn">已保留舊草稿內容。欄位及產品規則已更新至 V2，請重新核對選項、產品費率及新增必填資料。</div>':''}${state.editing?`<div class="notice">正在編輯 ${esc(state.editing)} 的模擬資料</div>`:''}${state.errors._form?`<div class="notice error" role="alert">${esc(state.errors._form)}<ul>${Object.entries(state.errors).filter(([k])=>k.startsWith('_')&&k!=='_form').map(([,v])=>`<li>${esc(v)}</li>`).join('')}</ul></div>`:''}${[2,3].includes(step)?v2BrStatus():''}${step===1?v2Documents():step===5?v2Products():step===6?v2Review():v2FormSections(step-2)}<datalist id="v2-mcc">${V2.catalog.MCCS.map(m=>`<option value="${m.c}">${esc(m.n)}</option>`).join('')}</datalist><datalist id="v2-banks">${[['004','滙豐銀行'],['003','渣打銀行'],['012','中國銀行（香港）'],['024','恒生銀行'],['015','東亞銀行'],['016','星展銀行（香港）']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</datalist><datalist id="v2-settlement">${['T1','T2','T3','T7','D1'].map(v=>`<option>${v}</option>`).join('')}</datalist></div>`;};
fillSample=function(row){
  const existing=row;row=row||rows[0];
  v2Reset();const future=n=>{const d=new Date();d.setFullYear(d.getFullYear()+n);return d.toISOString().slice(0,10);};
  Object.assign(state.values,{legalStatus:'BODY_CORPORATE',merchantName:row['客戶中文名稱']||'海港科技有限公司',merchantShortName:'海港示例',merchantEnglishName:row['客戶英文名稱']||'SAMPLE HARBOUR LIMITED',merchantEnglishShortName:'HARBOUR*HK',dbaNo:row['DBA no.']||'DEMO-DBA-001',registerCertNo:'12345678-000',registerCertName:row['客戶英文名稱']||'SAMPLE HARBOUR LIMITED',registerCertPeriod:future(2),crCode:'7654321',nar1Period:future(1),registerCapital:'04',licencePeriod:'04',workerNumber:'03',addrCountryCode:'HKG',addrProvinceCode:'HK-HKI',addrStreet:'香港中環示例道 88 號（假資料）',addrStreetEn:'88 SAMPLE ROAD, CENTRAL, HONG KONG',mcc:'5812',avgPerAmount:'250.00',maxAmount:'3000.00',avgMonthAmount:'100000.00',contactName:'陳示例',contactPhone:'+85261234567',contactEmail:'merchant@example.com',maintainerName:'林示例',maintainerEmail:'maintainer@example.com',developer:BO.user?.agencyCode||'MA-001',developerEmail:'agency@example.com',cardProvinceCode:'HKG',cardBankName:'滙豐銀行',cardBankCode:'004',cardBranchCode:'812',cardName:row['客戶英文名稱']||'SAMPLE HARBOUR LIMITED',cardNo:'004812345678838',cardAddress:'1 SAMPLE ROAD, HONG KONG',swiftCode:'HSBCHKHHHKH',webUrl:'https://example.com',remark:'純演示資料，不是真實商戶。'});
  if(existing){
    for(const [key,column] of [['mcc','MCC 行業代碼'],['cardBankName','銀行名稱'],['cardBankCode','銀行代碼'],['cardBranchCode','分行代碼'],['contactName','客戶聯繫人'],['contactPhone','聯絡人電話'],['contactEmail','聯絡人電郵']])if(existing[column]!==undefined)state.values[key]=String(existing[column]);
    const br=String(existing.BR||'').replace(/^BR\s*/, '');if(br)state.values.registerCertNo=/^\d{8}$/.test(br)?br+'-000':br;
    if(existing['BR 有效期'])state.values.registerCertPeriod=existing['BR 有效期'].replaceAll('/','-');if(existing.bank)state.values.cardNo=existing.bank;v2Model().legacy=true;
  }
  for(const [key,val] of Object.entries({name:'陳示例',firstNameEn:'DEMO',lastNameEn:'CHAN',idcardType:'01',idcardNo:'Z123456(0)',idcardNoPeriod:future(4),birthDay:'1990-01-01'}))state.values['directors[0].'+key]=val;
  v2SetGroup('POS',true);for(const r of Object.values(v2Model().rates))r.on=false;
  v2Model().rates['POS|0']={on:true,ct:'Regional',v:{loc_rate:'1.50',loc_fix:'0.00',loc_min:'0',loc_max:'0',crs_rate:'2.50',crs_fix:'0.00',crs_min:'0',crs_max:'0'}};
  state.files['101401']={name:'DEMO-storefront.png',demo:true};v2SyncDerived();for(const id of requiredFiles())state.files[id]={name:'DEMO-'+id+'.pdf',size:1024,demo:true};state.emailVerified=true;v2SyncDerived();
};
// The independent BR tool remains unchanged; the backoffice entry uses only V2 fields.
const v2OldBrStart=actions['br-start'];
actions['br-start']=()=>{v2OldBrStart();DEMO.br.values=[['merchantName','中文名稱','海港科技有限公司'],['merchantEnglishName','英文名稱','SAMPLE HARBOUR TECHNOLOGY LIMITED'],['registerCertName','註冊證書名稱','SAMPLE HARBOUR TECHNOLOGY LIMITED'],['registerCertNo','BR 號碼','12345678-000'],['registerCertPeriod','證書有效期','2028-08-31'],['legalStatus','法律地位','BODY_CORPORATE'],['registerCertType','證書類型','01']];};
brReview=function(ready=false){const b=DEMO.br;b.phase=ready?'ready':'review';modal(ready?'已核對，準備套用':'核對辨識結果',`<p class="hint">${esc(b.filename)} · 固定示例辨識結果，並非讀取上傳文件。</p><div class="br-fields">${b.values.map(([k,l,v])=>`<div class="field"><label for="br-${k}">${l}</label>${V2.options[k]?`<select id="br-${k}" data-br-field="${k}" ${ready?'disabled':''}>${V2.options[k].map(([val,label])=>`<option value="${val}" ${v===val?'selected':''}>${label}</option>`).join('')}</select>`:`<input id="br-${k}" data-br-field="${k}" value="${esc(v)}" ${ready?'readonly':''}>`}</div>`).join('')}</div><div class="notice warn">仍待核對：英文營業地址；無法辨識：BR 繳款日期。這些項目不會帶入。</div>${ready?'<p class="br-status">已核對，可套用；地址仍待確認。</p>':'<label class="check"><input type="checkbox" id="br-checked">我已核對以上 7 個欄位，確認可套用。</label>'}<p id="br-error" class="error"></p>`,btn('取消，保留原資料','close')+btn(ready?'確認並套用 7 個欄位':'已核對，準備套用',ready?'br-apply':'br-ready','primary'));};
function v2ImportResult(imported,pending,unrecognized=[],done='close',unchanged=[]) {
  const list=items=>`<ol>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ol>`;
  modal(imported.length?'已成功寫入申請資料':'已完成匯入核對',`<div class="v2-import-result" data-figma-node="948:6768"><section class="v2-import-success"><h3>完成匯入 · ${imported.length} 個欄位已帶入</h3>${imported.length?list(imported):'<p>本次沒有需要新增或取代的欄位。</p>'}${unchanged.length?'<p>'+unchanged.length+' 個欄位與目前表單一致，已保留原值。</p>':''}</section><section class="v2-import-pending"><h3>仍待核對 · ${pending.length} 個欄位未帶入</h3>${pending.length?list(pending):'<p>本次沒有仍待核對的欄位。</p>'}</section><section class="v2-import-unrecognized"><h3>無法辨識</h3>${unrecognized.length?list(unrecognized):'<p>本次沒有無法辨識的欄位。</p>'}</section><p class="v2-import-note">尚未帶入的項目不會覆蓋原有資料。按「完成」返回申請表後，可繼續核對及補充。</p></div>`,btn('完成',done,'primary'));
  $('#modal .modal-head [data-action="close"]').remove();
}
brResult=function(){const b=DEMO.br;v2ImportResult(b.values.map(([k,l,v])=>`${l}：${k==='registerCertPeriod'?v.replaceAll('-','/'):v2Display(k,v)}`),['英文地址：請對照 BR 原件核對完整地址後，再手動填寫。']);};
function v2OcrStart(){v2OcrEdit=null;modal('多文件辨識（模擬）','<div class="notice warn">使用固定假資料演示，沒有 OCR 服務，選取的文件不會上傳。</div><p>可選擇多份空白測試文件，或直接使用示例。</p><input id="v2-ocr-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg"><p class="hint">PDF／PNG／JPG，每檔不超過 10 MB。</p>',btn('取消','close')+btn('使用示例辨識','v2-ocr-recognize','primary'));}
function v2OcrReview(ready=false){modal(ready?'已核對，準備套用':'核對辨識結果',`<div class="notice warn">以下全為示例資料，請確認選取欄位。低信心地址先保留，不會帶入。</div><div class="v2-ocr-list">${v2OcrEdit.map((o,i)=>`<label><input type="checkbox" data-v2-ocr-item="${i}" ${o.selected?'checked':''} ${ready||o.confidence<80?'disabled':''}><span><strong>${esc(v2Label(o.key))}</strong><small>${esc(o.value)}</small><small class="hint">${o.source} · 信心 ${o.confidence}%${o.confidence<80?' · 仍待核對':''}</small></span></label>`).join('')}</div><p class="hint">${ready?'已核對的欄位可套用；地址仍待確認。':'請勾選已確認可套用的資料，未選項目保留原值。'}</p><p id="v2-ocr-error" class="error" role="alert"></p>`,btn('取消，保留原資料','close')+btn(ready?'確認並套用':'已核對，準備套用',ready?'v2-ocr-apply':'v2-ocr-ready','primary'));}
function v2OcrRecognize(){
  const files=[...($('#v2-ocr-files')?.files||[])];if(files.some(f=>f.size>10485760||!/\.(pdf|png|jpe?g)$/i.test(f.name)))return toast('請選擇每檔 10 MB 以下的 PDF／PNG／JPG');
  modal('辨識中','<div class="progress-demo"></div><p>正在載入固定示例，未讀取或分析文件內容。</p>','');
  setTimeout(()=>{if(!$('#modal').open)return;if(state.fail)return modal('暫時無法辨識文件','<div class="notice warn">模擬辨識失敗，尚未寫入任何資料。</div>',btn('手動填寫','close')+btn('重試','v2-ocr','primary'));
    v2OcrEdit=[['merchantName','海港科技有限公司','BR',2],['merchantEnglishName','SAMPLE HARBOUR TECHNOLOGY LIMITED','BR',2],['registerCertName','SAMPLE HARBOUR TECHNOLOGY LIMITED','BR',2],['registerCertNo','12345678-000','BR',2],['registerCertPeriod','2028-08-31','BR',2],['crCode','7654321','CI',2],['nar1Period','2028-08-31','NAR1',2],['directors[0].name','陳示例','NAR1',2],['directors[0].idcardNo','Z123456(0)','身份證',2],['directors[0].birthDay','1990-01-01','身份證',2],['cardName','SAMPLE HARBOUR TECHNOLOGY LIMITED','銀行月結單',4],['cardNo','004812345678838','銀行月結單',4],['addrStreetEn','88 SAMPLE ROAD, HONG KONG','BR',3]].map(([key,value,source,step],i)=>({key,value,source:'示例 '+source,step,confidence:i===12?65:98,selected:i!==12}));v2OcrReview();},400);
}
submit=function(){if(!can(1))return deny();const errors=validateAll();if(Object.keys(errors).length){const step=[1,2,3,4,5,6].find(s=>Object.keys(validateStep(s)).length);showErrors(validateStep(step),step);return;}
  if(!state.checks['613:4956'])return toast('請先勾選聲明及確認');
  if(state.fail)return modal('申請提交失敗','<div class="notice error">本次模擬提交未成功，所有輸入及文件記錄仍保留。</div><p>可關閉失敗模擬後重試，或先儲存草稿。</p>',btn('返回檢閱','close')+btn('儲存草稿','save-draft')+btn('重試提交','submit','primary'));
  modal('確認提交申請',`<p>將為「${esc(v2Raw('merchantName'))}」建立本機模擬申請。</p><p class="hint">不會連接 All-In Pay、發送電郵或上傳文件。</p>`,btn('取消','close')+btn('確認提交（模擬）','confirm-submit','primary'));
};actions.submit=submit;
Object.assign(actions,{
  'confirm-clear':()=>{v2Reset();$('#modal').close();render();},
  'v2-add-person':el=>{const g=el.dataset.group;if(g==='authSigners'&&v2Amex()&&state.people[g]>=1)return toast('此情境只可有一位授權簽名人');state.people[g]++;render();},
  'v2-remove-person':el=>{const g=el.dataset.group,i=+el.dataset.index,n=state.people[g];if(g==='directors'&&n===1)return toast('董事至少保留一位');for(let j=i;j<n-1;j++)for(const k of v2PersonKeys)state.values[`${g}[${j}].${k}`]=state.values[`${g}[${j+1}].${k}`]||'';for(const k of v2PersonKeys)delete state.values[`${g}[${n-1}].${k}`];state.people[g]--;if(g==='directors'){for(const links of Object.values(v2Model().links))for(const key of Object.keys(links))if(links[key]===i)links[key]=null;else if(links[key]>i)links[key]--;}
    else{const links=v2Model().links[g];for(let j=i;j<n-1;j++)links[j]=links[j+1]??null;delete links[n-1];}render();},
  'v2-settlement':el=>{state.values.settlePeriod=el.dataset.value;render();},
  'v2-reset-risk':()=>{v2Model().manualRisk=false;render();},
  'v2-difference':el=>{const c=v2Consistency().find(c=>c.key===el.dataset.key);if(!c)return;modal('核對資料差異',`<h3>${esc(c.title)}</h3><ul>${c.values.map(([l,v])=>`<li>${esc(l)}：${esc(v)}</li>`).join('')}</ul><div class="field"><label for="v2-difference-reason">確認差異原因 <span class="required">*</span></label><textarea id="v2-difference-reason" maxlength="500" rows="3">${esc(v2Model().ack[c.key]?.reason||'')}</textarea></div><p class="hint">確認只針對目前資料；相關內容再次修改後須重新核對。</p><p id="v2-difference-error" class="error"></p>`,btn('返回修改','step','',`data-step="${c.step}"`)+btn('確認差異','v2-ack','primary',`data-key="${esc(c.key)}"`));},
  'v2-ack':el=>{const reason=$('#v2-difference-reason').value.trim();if(!reason){$('#v2-difference-error').textContent='請填寫確認原因';return;}const c=v2Consistency().find(c=>c.key===el.dataset.key);v2Model().ack[c.key]={fingerprint:c.fingerprint,reason};$('#modal').close();render();},
  'v2-ocr':v2OcrStart,'v2-ocr-recognize':v2OcrRecognize,
  'v2-ocr-ready':()=>{if(!v2OcrEdit.some(o=>o.selected)){$('#v2-ocr-error').textContent='請至少選取一個已核對欄位';return;}v2OcrReview(true);},
  'v2-ocr-apply':()=>{if(state.fail)return modal('資料寫入失敗','<div class="notice error">尚未寫入，原有申請內容保留。關閉失敗模擬後可重新核對。</div>',btn('返回核對','v2-ocr-back','primary')+btn('取消','close'));const selected=v2OcrEdit.filter(o=>o.selected);for(const o of selected){state.values[o.key]=o.value;o.applied=o.value;}v2Model().ocr=structuredClone(v2OcrEdit);v2SyncDerived();modal('已成功寫入申請資料',`<div class="notice">${selected.length} 個欄位已帶入</div><div class="import-result"><section><h3>完成匯入</h3><ol>${selected.map(o=>`<li>${esc(v2Label(o.key))}：${esc(o.value)}</li>`).join('')}</ol></section><section><h3>仍待核對 · 未帶入</h3><ol>${v2OcrEdit.filter(o=>!o.selected).map(o=>`<li>${esc(v2Label(o.key))}：${esc(o.value)}</li>`).join('')||'<li>沒有待核對項目</li>'}</ol><h3>無法辨識 · 未帶入</h3><p>商業登記證繳款日期（示例）。</p></section></div><p class="hint">示例不會代替必交文件，請返回文件材料補齊。</p>`,btn('完成','v2-ocr-done','primary'));},
  'v2-ocr-back':()=>v2OcrReview(),'v2-ocr-done':()=>{$('#modal').close();render();}
});
const v2OldRestore=actions.restore;actions.restore=el=>{v2OldRestore(el);v2Ensure();v2SyncDerived();if(route().page==='application')render();};
const v2OldEdit=actions['confirm-edit'];actions['confirm-edit']=el=>{v2OldEdit(el);v2Ensure();v2SyncDerived();if(route().page==='application')render();};
const v2Step=actions.step;actions.step=el=>{if($('#modal').open)$('#modal').close();v2Step(el);};
const v2SubmitConfirm=actions['confirm-submit'];actions['confirm-submit']=()=>{if(state.fail)return submit();v2SubmitConfirm();};
document.addEventListener('input',e=>{if(e.target.dataset.v2InlineField&&e.target.tagName==='INPUT')v2InlineChange(e.target);});
document.addEventListener('change',e=>{
  const t=e.target;if(t.dataset.v2Field){const k=t.dataset.v2Field;if(k==='riskLevel')v2Model().manualRisk=true;if(k==='settlePeriod'){state.values[k]=t.value.trim().toUpperCase();t.value=state.values[k];}v2SyncDerived();const mccName=$('[data-field="mccName"]');if(mccName)mccName.value=state.values.mccName;if(t.tagName==='SELECT'&&route().page==='application')render();}
  if(t.dataset.v2Group){v2SetGroup(t.dataset.v2Group,t.checked);render();}
  if(t.dataset.v2Product){v2Model().rates[t.dataset.v2Product].on=t.checked;render();}
  if(t.dataset.v2Combo){v2Model().combo[t.dataset.v2Combo]=t.checked;render();}
  if(t.dataset.v2Link){v2Model().links[t.dataset.v2Link][t.dataset.index]=t.checked?+t.closest('.v2-person-link').querySelector('select').value:null;render();}
  if(t.dataset.v2Director){v2Model().links[t.dataset.v2Director][t.dataset.index]=+t.value;render();}
  if(t.dataset.v2Signal){v2Model().signals[t.dataset.v2Signal]=t.checked;render();}
  if(t.dataset.v2Sme){const b=t.dataset.v2Sme;v2Model().sme[b]={on:t.checked,type:v2Model().sme[b]?.type||v2SmeOptions(b)[0]};render();}
  if(t.dataset.v2SmeType){const b=t.dataset.v2SmeType;v2Model().sme[b]={on:v2Model().sme[b]?.on||false,type:t.value};}
  if(t.dataset.v2InlineKey||t.dataset.v2InlinePricing)v2InlineChange(t);
  if(t.dataset.v2OcrItem!==undefined)v2OcrEdit[+t.dataset.v2OcrItem].selected=t.checked;
});
// Updated, read-only QA inventory. All form mutations remain in the visible UI.
Object.assign(window.AllinPayDemo,{version:'2026.09.24-inline-products-risk-sidebar',getOnboarding:()=>({version:2,fields:v2Fields.map(f=>f.id),documents:V2.documents.map(d=>d.id),products:v2Groups.map(g=>({key:g.k,count:g.rows.length})),errors:validateAll(),score:v2Score(),selectedProducts:v2Rows().map(x=>({key:x.key,name:x.r.n,pricing:x.st.ct,values:{...x.st.v}}))})});

// One upload interaction for cards, BR, batch OCR, and supporting dialogs.
// File selection and file drops dispatch the same existing change handlers.
function fileDropControl({inputId,accept='.pdf,.jpg,.jpeg,.png',multiple=false,title='拖曳文件至此',hint='PDF／JPG／PNG · 每份上限 10 MB',selected='',attributes=''}) {
 return `<div class="file-drop-zone" data-file-drop data-file-input="${esc(inputId)}" role="group" aria-label="文件上傳"><svg class="file-drop-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/></svg><strong class="file-drop-title">${esc(title)}</strong><small>${esc(hint)}</small>${btn('選擇文件','choose-file','',`data-input-id="${esc(inputId)}"`)}<input hidden type="file" id="${esc(inputId)}" accept="${esc(accept)}" ${multiple?'multiple':''} ${attributes}><span class="file-drop-status" role="status">${esc(selected||'或按「選擇文件」從電腦加入')}</span></div>`;
}
actions['choose-file']=el=>{const input=document.getElementById(el.dataset.inputId);if(input&&!input.disabled&&!input.closest('.external-readonly'))input.click();};
const uploadFileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
const uploadZone=e=>e.target instanceof Element?e.target.closest('[data-file-drop]'):e.target?.parentElement?.closest('[data-file-drop]');
const uploadInput=zone=>zone&&document.getElementById(zone.dataset.fileInput);
const uploadEnabled=zone=>{const input=uploadInput(zone);return input&&!input.disabled&&!zone.closest('.external-readonly');};
const clearUploadHover=()=>document.querySelectorAll('.document-drag').forEach(z=>z.classList.remove('document-drag'));
document.addEventListener('dragover',e=>{if(!uploadFileDrag(e))return;const zone=uploadZone(e);e.preventDefault();clearUploadHover();if(uploadEnabled(zone)){zone.classList.add('document-drag');e.dataTransfer.dropEffect='copy';}else e.dataTransfer.dropEffect='none';},true);
document.addEventListener('dragleave',e=>{const zone=uploadZone(e);if(zone&&!zone.contains(e.relatedTarget))zone.classList.remove('document-drag');});
document.addEventListener('dragend',clearUploadHover);
document.addEventListener('drop',e=>{
 if(!uploadFileDrag(e))return;e.preventDefault();e.stopImmediatePropagation();clearUploadHover();const zone=uploadZone(e);
 if(!uploadEnabled(zone))return;const input=uploadInput(zone),files=[...e.dataTransfer.files];
 if(!files.length)return toast('請拖入文件，不支援資料夾。');
 if(!input.multiple&&files.length!==1)return toast('此位置接受一份文件；多份請使用「多文件辨識」。');
 input.files=e.dataTransfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
},true);
document.addEventListener('change',e=>{const t=e.target;if(t.type!=='file'||t.dataset.demoUpload||['demo-br-file','document-batch-files'].includes(t.id))return;const status=t.closest('[data-file-drop]')?.querySelector('.file-drop-status');if(status)status.textContent=[...t.files].map(f=>f.name).join('、')||'尚未選擇文件';},true);
// Preserve each existing input, accept attribute, selection and event handlers.
// The few auxiliary dialogs use the same control without maintaining copies.
let uploadInputSequence=0;
function enhanceFileUploads(){
 for(const input of document.querySelectorAll('input[type="file"]:not([hidden])')){
  if(input.closest('[data-file-drop]'))continue;
  input.id||='upload-aux-'+(++uploadInputSequence);
  const host=document.createElement('div');host.innerHTML=fileDropControl({inputId:input.id,accept:input.accept,multiple:input.multiple,title:input.multiple?'拖曳一份或多份文件至此':'拖曳文件至此',hint:(input.accept||'支援文件')+' · 每份上限 10 MB'});
  const zone=host.firstElementChild,placeholder=zone.querySelector('input');
  input.before(zone);input.hidden=true;placeholder.replaceWith(input);zone.querySelector('button').disabled=input.disabled;
 }
}
new MutationObserver(enhanceFileUploads).observe(document.body,{childList:true,subtree:true});

// BR is part of the backoffice. Original documents and raw OCR stay in memory.
// No upload API, external OCR, or automatic persistence of review candidates.
let brModules;
const brDefs = [
  ['businessNameZh','中文名稱','merchantName',2],
  ['businessNameEn','英文名稱','merchantEnglishName',2],
  ['certificateNumber','登記證完整號碼','registerCertNo',2],
  ['expiryDate','註冊證書有效期','registerCertPeriod',2],
  ['legalStatus','法律地位','legalStatus',2],
  ['businessAddressZh','中文地址','addrStreet',3],
  ['businessAddressEn','英文地址','addrStreetEn',3],
  ['natureOfBusiness','業務性質','remark',3],
];
const brTargets = {businessNameEn:['merchantEnglishName','registerCertName'],certificateNumber:['registerCertNo','registerCertType']};
const brLabels = Object.fromEntries(brDefs.map(([,label,target])=>[target,label]));
Object.assign(brLabels,{registerCertName:'註冊證書名稱',registerCertType:'註冊證書類型',remark:'備註（BR 業務性質）'});
const brAlive = b => DEMO.br === b && !b.disposed;
async function brLoadModules(){
  if(location.protocol==='file:')throw Error('本機檔案辨識需要 HTTP 服務。請開啟同一後台的 GitHub 網址，或以 npm run serve 啟動下載的完整原始碼。單一 HTML 仍可使用示範資料。');
  if(!brModules)brModules=Promise.all([import('./br-engine/engine.mjs?v=20260929-uploads'),import('./br-engine/parser.mjs?v=20260929-uploads')]).catch(e=>{brModules=null;throw e;});
  return brModules;
}
function brRelease(b=DEMO.br){
  if(!b||b.disposed)return;b.disposed=true;b.controller?.abort();clearTimeout(b.timer);
  if(b.page)b.page.canvas.width=1;
  Promise.resolve(b.document?.destroy()).catch(()=>{});
  b.document=null;b.page=null;b.file=null;b.result=null;b.fields={};b.rawText='';
}
function brModal(title,body,buttons,kind='review'){
  modal(title,body,buttons);$('#modal').classList.add('br-dialog');$('#modal').dataset.br=kind;
}
function brUpload(error=''){
  const b=DEMO.br;if(!brAlive(b))return;b.phase='upload';
  brModal('匯入香港商業登記證',`<p class="hint">選擇文件後，先確認 BR 所在頁面，再開始辨識。</p>${error?`<p class="notice error" role="alert">${esc(error)}</p>`:''}${fileDropControl({inputId:'demo-br-file',title:'拖曳 BR 文件至此',hint:'PDF／JPG／PNG · 每份 10 MB／PDF 5 頁',selected:b.filename||''})}<p class="hint">文件只在此瀏覽器處理，不會傳送至外部辨識服務。</p>${b.document?`<div class="br-file-summary"><strong>${esc(b.filename)}</strong><label>BR 頁面 <select id="br-page" aria-label="選擇 BR 頁面">${Array.from({length:b.document.pages},(_,i)=>`<option value="${i+1}" ${b.pageNumber===i+1?'selected':''}>第 ${i+1} 頁／共 ${b.document.pages} 頁</option>`).join('')}</select></label><span>${(b.file.size/1024/1024).toFixed(2)} MB</span></div><div id="br-upload-preview" class="br-upload-preview"></div>`:'<p class="hint">未準備文件時，可使用虛構示範資料查看完整流程。</p>'}<p class="hint br-privacy">首次圖片辨識會下載本網站的辨識模型，可能需要較長時間。辨識原文不會存入草稿；按「儲存草稿」才會把已填表單欄位保存在此瀏覽器。</p>`,btn('取消','close')+(b.document?btn('開始辨識','br-recognize','primary'):btn('使用示範資料','br-recognize','primary')),'upload');
  if(b.page){const c=b.page.canvas.cloneNode();c.getContext('2d').drawImage(b.page.canvas,0,0);c.setAttribute('aria-label','所選 BR 原件預覽');$('#br-upload-preview').append(c);}
}
brStart=function(){brRelease();DEMO.br={phase:'upload',disposed:false,fields:{},selected:new Set(),choices:{},filename:'',pageNumber:1,confirmed:false,applied:false};brUpload();};
async function brAccept(file){
  const b=DEMO.br;if(!brAlive(b)||b.phase==='loading'||b.phase==='processing')return;
  if(!file)return;b.phase='loading';b.controller=new AbortController();const source=b.controller;
  brModal('正在開啟 BR',`<div class="progress-demo"></div><p>正在本機讀取 ${esc(file.name)}…</p>`,btn('取消','close'),'progress');
  try{
    const [engine]=await brLoadModules();if(!brAlive(b)||source.signal.aborted)return;
    const opened=await engine.loadDocument(file);if(!brAlive(b)||source.signal.aborted){await opened.destroy();return;}
    if(b.page)b.page.canvas.width=1;await b.document?.destroy();b.document=opened;b.file=file;b.filename=file.name;b.pageNumber=1;b.fields={};b.result=null;b.selected.clear();b.choices={};b.demo=false;
    const page=await opened.render(1);if(!brAlive(b)){page.canvas.width=1;return;}b.page=page;b.controller=null;brUpload();
  }catch(e){if(brAlive(b))brUpload(e.message||'文件無法開啟，請重新選擇。');}
}
async function brPage(number){
  const b=DEMO.br;if(!brAlive(b)||b.phase!=='upload')return;b.phase='loading';$('#br-page').disabled=true;$('#modal [data-action=br-recognize]').disabled=true;
  try{const page=await b.document.render(number);if(!brAlive(b)){page.canvas.width=1;return;}if(b.page)b.page.canvas.width=1;b.page=page;b.pageNumber=number;b.result=null;b.fields={};b.selected.clear();b.choices={};brUpload();}
  catch(e){if(brAlive(b))brUpload('此頁無法讀取，請重新選擇文件。');}
}
function brDemo(){
  const b=DEMO.br;b.demo=true;b.filename='SAMPLE-BR（虛構資料）';b.fields=Object.fromEntries(brDefs.map(([key])=>[key,{value:'',source:'虛構示例',page:1}]));
  const values={businessNameZh:'示例海港科技有限公司',businessNameEn:'SAMPLE HARBOUR TECHNOLOGY LIMITED',certificateNumber:'12345678-000-09-26-A',expiryDate:'2028-08-31',legalStatus:'法人團體 · Body Corporate',businessAddressEn:'UNIT 1201, 12/F, 88 EXAMPLE ROAD, HONG KONG',natureOfBusiness:'TECHNOLOGY SERVICES'};
  for(const [k,v]of Object.entries(values))b.fields[k].value=v;
  b.fields.businessAddressEn.warning='示例低信心地址，請對照原件核對。';b.fields.businessAddressEn.autoSelect=false;
  b.result={recognized:true,warnings:[],method:'demo'};b.selected=new Set(brDefs.filter(([k])=>values[k]&&b.fields[k].autoSelect!==false).map(([k])=>k));b.choices={};brReview();
}
async function brRecognize(){
  const b=DEMO.br;if(!brAlive(b))return;if(!b.document)return brDemo();if(!b.page||b.phase!=='upload')return;
  b.phase='processing';b.confirmed=false;b.controller=new AbortController();const controller=b.controller;
  brModal('正在辨識你的 BR',`<p>${esc(b.filename)} · 第 ${b.pageNumber} 頁</p><section class="br-progress"><h3 id="br-progress-label">載入本機辨識引擎</h3><progress id="br-progress" max="1" value="0"></progress><p>校正文件方向、讀取文字並整理可預填欄位。</p></section><p class="hint">原件與辨識原文只留在本頁；你可以隨時取消。</p>`,btn('取消辨識','br-cancel'),'progress');
  b.timer=setTimeout(()=>{if(brAlive(b)&&b.phase==='processing'){b.timedOut=true;controller.abort();}},120000);
  try{
    const [engine]=await brLoadModules();const result=await engine.recognizeDocument({...b.page,page:b.pageNumber,signal:controller.signal,onProgress:({progress,label})=>{if(brAlive(b)&&b.phase==='processing'){$('#br-progress').value=progress;$('#br-progress-label').textContent=label;}}});
    if(!brAlive(b)||controller.signal.aborted)return;b.result=result;b.fields=result.fields;b.selected=new Set(brDefs.filter(([k])=>result.recognized&&b.fields[k]?.value&&b.fields[k].autoSelect!==false).map(([k])=>k));b.choices={};b.demo=false;
    if(!brDefs.some(([k])=>b.fields[k]?.value))brModal('暫時無法辨識這份 BR','<div class="notice warn">未能取得可預填欄位。請先確認所選頁面是商業登記證（BR）；若原件正確，請重新辨識或手動填寫，這不代表文件一定不清晰。</div>',btn('手動填寫','close')+btn('重新選檔','br-start','primary'),'failure');else brReview();
  }catch(e){if(brAlive(b))brUpload(controller.signal.aborted?(b.timedOut?'辨識超過 120 秒，已停止。可換一份較清晰的文件，或手動填寫。':'已取消辨識，尚未更改申請資料。'):'本機辨識未完成。請重試或改用較清晰的文件。');}
  finally{clearTimeout(b.timer);b.controller=null;b.timedOut=false;}
}
function brValue(key,b=DEMO.br){return String(b.fields[key]?.value||'').trim();}
function brPlan(b=DEMO.br){
  const planned=[];for(const [key,,target,step]of brDefs){if(!b.selected.has(key)||!brValue(key,b))continue;
    for(const to of brTargets[key]||[target]){const value=to==='registerCertType'?'01':v2Canonical(to,brValue(key,b)),before=v2Raw(to);planned.push({key,target:to,value,before,step,label:brLabels[to],conflict:!!before&&before!==value,same:before===value,write:!before||before!==value&&b.choices[to]==='replace'});}}
  return planned;
}
function brInvalidate(){const b=DEMO.br;if(!b)return;b.confirmed=false;const c=$('#br-checked');if(c)c.checked=false;const submit=$('[data-action="br-ready"]');if(submit)submit.disabled=true;}
brReview=function(ready=false){
  const b=DEMO.br;if(!brAlive(b))return;b.phase=ready?'ready':'review';b.confirmed=ready;
  const plans=brPlan(b);const warnings=b.result?.warnings||[];
  const rows=brDefs.map(([key,label,target,step])=>{const d=b.fields[key]||{value:''},candidate=brValue(key),targets=brTargets[key]||[target];
    const conflicts=targets.map(to=>{const val=to==='registerCertType'?'01':v2Canonical(to,candidate),before=v2Raw(to);return candidate&&before&&before!==val?`<div class="br-conflict"><small>目前${esc(brLabels[to])}：${esc(v2Display(to,before))}</small><label>套用方式<select aria-label="${esc(brLabels[to])}衝突處理" data-br-conflict="${to}" ${ready?'disabled':''}><option value="keep" ${b.choices[to]!=='replace'?'selected':''}>保留原有資料</option><option value="replace" ${b.choices[to]==='replace'?'selected':''}>使用本次核對值</option></select></label></div>`:'';}).join('');
    return `<section class="br-candidate ${d.warning||d.autoSelect===false?'attention':''}"><label class="check"><input type="checkbox" data-br-select="${key}" aria-label="帶入${esc(label)}" ${b.selected.has(key)?'checked':''} ${ready?'disabled':''}><strong>${esc(label)}</strong><span>${!candidate?'未辨識':d.warning||d.autoSelect===false?'待核對':'待確認'}</span></label><label class="sr-only" for="br-${key}">${esc(label)}辨識值</label><input id="br-${key}" data-br-value="${key}" value="${esc(candidate)}" ${ready?'readonly':''} autocomplete="off" spellcheck="false"><small>帶入：Step ${step} · ${targets.map(t=>esc(brLabels[t])).join('、')}</small>${d.warning?`<p class="hint">${esc(d.warning)}</p>`:''}${d.alternatives?.length?`<p class="hint">候選：${d.alternatives.map(esc).join('／')}</p>`:''}${!b.demo&&d.source?`<details><summary>查看來源文字 · 第 ${d.page||b.pageNumber} 頁</summary><p>${esc(d.source)}</p></details>`:''}${conflicts}<p class="error" data-br-error="${key}" role="alert"></p></section>`;
  }).join('');
  brModal(ready?'已核對，準備套用':'核對辨識結果',`<p class="hint">對照原件核對資料，再帶入其他步驟。向下捲動查看所有欄位；不確定的資料先留空。</p>${b.demo?'<div class="notice warn">目前使用虛構示範資料，並未讀取文件。</div>':`<div class="notice ${warnings.length?'warn':''}">${warnings.length?warnings.map(w=>esc(w)).join('<br>'):'辨識完成。所有候選欄位均需對照原件核對。'}</div>`}<div class="br-workbench"><aside class="br-original"><h3>原件預覽</h3><p>${esc(b.filename)} · 第 ${b.pageNumber} 頁</p><div id="br-original-canvas"></div>${b.demo?'<div class="br-synthetic"><h3>商業登記證</h3><p>BUSINESS REGISTRATION CERTIFICATE</p><p>示例海港科技有限公司<br>SAMPLE HARBOUR TECHNOLOGY LIMITED</p><p>12345678-000</p><p>僅供介面演示 · 非真實文件</p></div>':''}<p class="hint">文件只留在本機。OCR 信心分數不代表實際辨識正確率。</p></aside><div class="br-candidates">${rows}${b.fields.startDate?.value?`<div class="notice"><strong>只供核對，不自動帶入</strong><p>本張 BR 生效日期：${esc(b.fields.startDate?.value||'未辨識')}</p><small>生效日期不是公司成立日期；不推算經營年限。</small></div>`:''}</div></div><section class="br-confirm"><p>預設只填空欄；有差異的欄位須逐項選擇保留或取代。</p>${ready?`<p class="br-status">已核對 · ${plans.filter(p=>p.write).length} 個欄位將寫入 · ${plans.filter(p=>!p.write).length} 個保留原值</p>`:'<label class="check"><input type="checkbox" id="br-checked">我已對照原件，核對勾選欄位及取代選項。</label>'}<p id="br-error" class="error" role="alert"></p></section>`,btn('取消，保留原資料','close')+(ready?btn('返回核對','br-return'):'')+btn(ready?'確認並套用':'已核對，準備套用',ready?'br-apply':'br-ready','primary',ready?'':'disabled'));
  if(b.page){const c=document.createElement('canvas');c.width=b.page.canvas.width;c.height=b.page.canvas.height;c.getContext('2d').drawImage(b.page.canvas,0,0);c.setAttribute('aria-label','BR 原件');$('#br-original-canvas').append(c);}
};
async function brReady(){
  const b=DEMO.br;if(!brAlive(b)||!$('#br-checked')?.checked)return;
  if(!brDefs.some(([k])=>b.selected.has(k)&&brValue(k))){$('#br-error').textContent='請至少選取一個已核對、非空白的欄位。';return;}
  let errors={};if(!b.demo){try{const [,parser]=await brLoadModules();errors=parser.validateFields(Object.fromEntries(Object.entries(b.fields).filter(([k])=>b.selected.has(k)||k==='startDate')));}catch{errors._load='驗證引擎未能載入，請重試。';}}
  else {if(b.selected.has('certificateNumber')&&!/^\d{8}-\d{3}-\d{2}-\d{2}-[A-Z0-9]$/i.test(brValue('certificateNumber')))errors.certificateNumber='請填寫完整登記證號碼，包含最後三段。';}
  if(!brAlive(b)||b.phase!=='review'||!$('#br-checked')?.checked)return;
  for(const [key,,target]of brDefs){if(!b.selected.has(key))continue;const val=v2Canonical(target,brValue(key));if(V2.options[target]&&val&&!V2.options[target].some(o=>o[0]===val))errors[key]='辨識值不符合此欄位的選項，請對照原件修正。';}
  for(const [k,msg]of Object.entries(errors)){const el=$(`[data-br-error="${k}"]`);if(el)el.textContent=msg;}
  if(Object.keys(errors).length){$('#br-error').textContent='請修正標示的欄位，或取消選取該項。';return;}brReview(true);
}
function brApply(){
  const b=DEMO.br;if(!brAlive(b)||!b.confirmed||b.phase!=='ready')return;
  if(state.fail)return brModal('資料寫入失敗','<div class="notice error">這次資料尚未寫入，原有申請內容已保留。</div><p>本頁仍保留核對結果。關閉失敗模擬後可重試。</p>',btn('取消','close')+btn('返回核對','br-return')+btn('關閉失敗模擬並重試','br-retry','primary'),'failure');
  const plans=brPlan(b),before=structuredClone(state.values),files=structuredClone(state.files);let fileURL;
  try{
    const apply=plans.filter(p=>p.write);for(const p of apply)state.values[p.target]=p.value;
    const oldLog=v2Model().ocr.filter(o=>!apply.some(p=>p.target===o.key));
    v2Model().ocr=[...oldLog,...apply.map(p=>({key:p.target,value:p.value,applied:p.value,source:b.demo?'BR 虛構示例':'BR · 本機辨識 · 第 '+b.pageNumber+' 頁',step:p.step,confidence:null,selected:true,method:b.result.method}))];
    if(b.file){fileURL=URL.createObjectURL(b.file);state.files['140101']={name:b.file.name,size:b.file.size,type:b.file.type,demo:false,needsReselect:false,page:b.pageNumber};}
    else if(!state.files['140101'])state.files['140101']={name:'SAMPLE-BR.pdf',size:0,demo:true};
    v2SyncDerived();state.errors={};state.savedAt=null;
    b.applied=true;b.phase='result';b.imported=apply.map(p=>p.label+'：'+v2Display(p.target,p.value));
    b.pending=plans.filter(p=>!p.write&&!p.same).map(p=>p.label+'：保留原有資料');
    for(const [k,l]of brDefs)if(!b.selected.has(k)&&brValue(k))b.pending.push(l+'：未選取，待核對');
    b.unrecognized=brDefs.filter(([k])=>!brValue(k)).map(([,l])=>l+'：未取得候選值');
    render();v2ImportResult(b.imported,b.pending,b.unrecognized,'close',plans.filter(p=>p.same));$('#modal').classList.remove('br-dialog');delete $('#modal').dataset.br;
    if(fileURL){const previous=DEMO.fileURLs.get('140101');DEMO.fileURLs.set('140101',fileURL);if(previous)URL.revokeObjectURL(previous);}
  }catch(e){b.phase='ready';b.applied=false;state.values=before;state.files=files;if(fileURL)URL.revokeObjectURL(fileURL);brModal('資料寫入失敗','<div class="notice error">未能完成套用，已還原申請資料。請重試或返回核對。</div>',btn('取消','close')+btn('返回核對','br-return')+btn('重試寫入','br-apply','primary'),'failure');}
}
Object.assign(actions,{'br-start':brStart,'br-recognize':()=>void brRecognize(),'br-ready':()=>void brReady(),'br-return':()=>brReview(),'br-apply':brApply,'br-retry':()=>{state.fail=false;brApply();},'br-cancel':()=>DEMO.br?.controller?.abort()});
document.addEventListener('change',e=>{const el=e.target;
  if(el.id==='demo-br-file')void brAccept(el.files[0]);
  if(el.id==='br-page')void brPage(+el.value);
  if(el.id==='br-checked'){$('[data-action="br-ready"]').disabled=!el.checked;}
  if(el.dataset.brSelect){el.checked?DEMO.br.selected.add(el.dataset.brSelect):DEMO.br.selected.delete(el.dataset.brSelect);brInvalidate();}
  if(el.dataset.brConflict){DEMO.br.choices[el.dataset.brConflict]=el.value;brInvalidate();}
});
document.addEventListener('input',e=>{if(e.target.dataset.brValue){const b=DEMO.br;b.fields[e.target.dataset.brValue].value=e.target.value;brInvalidate();}});
// Rebuild conflict controls after an edit, preserving keyboard focus and scroll.
document.addEventListener('change',e=>{if(e.target.dataset.brValue){const id=e.target.id,pos=$('.br-workbench')?.scrollTop||0;brReview();$('#'+id)?.focus();$('.br-workbench').scrollTop=pos;}});
$('#modal').addEventListener('close',()=>{brRelease();if($('#modal').classList.contains('br-dialog'))$('#modal').replaceChildren();$('#modal').classList.remove('br-dialog');delete $('#modal').dataset.br;});
addEventListener('pagehide',()=>brRelease());
const brOldPreview=actions['preview-demo-file'];
actions['preview-demo-file']=el=>{const f=state.files[el.dataset.id],url=DEMO.fileURLs.get(el.dataset.id);if(f&&url&&/\.pdf$/i.test(f.name))modal('文件預覽',`<p>${esc(f.name)}</p><iframe class="br-pdf-preview" src="${url}" title="所選 PDF 原件"></iframe><p class="hint">本機文件預覽，未上傳至伺服器。</p>`);else brOldPreview(el);};
Object.assign(window.AllinPayDemo,{version:'2026.09.23-backoffice-br-integrated',brLocalOCR:true});

actions['br-sources']=()=>modal('BR 辨識來源',v2ConsistencyCard(),btn('關閉','close')+btn('重新匯入 BR','br-start','primary'));

// Shared application status, derived from the supplied OATS V2 prototype.
// Advisory demo values only: never silently overwrite the merchant's fee settings.
const v2RiskPolicies={
 '1':{label:'低',cycle:'T1',deposit:'0%',limit:'單筆 20,000／月 500,000',path:'L1 抽檢 10% → 送 OATS',sla:'4 小時內'},
 '2':{label:'中',cycle:'T2',deposit:'收單 5%，釋放 30 天',limit:'單筆 30,000／月 1,000,000',path:'L1 全審 → L2 風控複審 → 送 OATS',sla:'T+1'},
 '3':{label:'高',cycle:'T3',deposit:'收單 10%，釋放 60 天；CNP 10%，釋放 180 天',limit:'逐戶設定，首月壓縮 50%',path:'L1 → L2 → L3 終審（須書面理由）',sla:'T+3'},
 D:{label:'拒件',cycle:'—',deposit:'—',limit:'—',path:'直接拒絕，30 天內不得重提',sla:'即時'}
};
const v2RiskOpen={risk:true,blocks:true};
function v2ProgressData(){
 const errors=validateAll(),required=[...v2Required()],unfilled=required.filter(k=>!v2Raw(k)),completed=required.length-unfilled.length,percent=Math.round(completed/required.length*100);
 const score=v2Score(),checks=v2Consistency(),missing=v2MissingDocs();
 const policy=v2RiskPolicies[score.reject?'D':v2Raw('riskLevel')]||v2RiskPolicies[score.level];
 const recommended=v2RiskPolicies[score.reject?'D':score.level];
 const blocks=[];
 if(unfilled.length)blocks.push({step:2,label:'尚有 '+unfilled.length+' 項必填未完成：'+unfilled.slice(0,3).map(v2Label).join('、')+(unfilled.length>3?'等':'')});
 for(const step of [2,3,4,5,6]){const entries=Object.entries(validateStep(step)).filter(([k])=>!unfilled.includes(k));if(entries.length)blocks.push({step,label:entries[0][1]+(entries.length>1?'（另有 '+(entries.length-1)+' 項）':'')});}
 if(missing.length)blocks.push({step:1,label:'缺件／需重新提供 '+missing.length+' 項：'+missing.slice(0,2).map(d=>d.name.split('\n')[0]).join('、')+(missing.length>2?'等':'')});
 return {errors,score,policy,recommended,required:required.length,completed,percent,unfilled,missing,checks,blocks};
}
function v2RiskOverview(){
 const d=v2ProgressData(),s=d.score,tier=s.reject?'D':s.level;
 const row=(label,value,cls='')=>`<div class="v2-status-line ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
 const details=(key,label,html)=>`<details data-v2-status-details="${key}" ${v2RiskOpen[key]?'open':''}><summary>${label}</summary>${html}</details>`;
 return `<section class="v2-status-overview" aria-label="申請即時狀態">
 <article class="v2-status-card" data-risk-tier="${tier}"><h2>風控評分（系統參考）</h2><div class="v2-status-score"><strong data-risk-score>${s.total}</strong><span>／100</span><div class="v2-status-tier"><b>${d.recommended.label}</b><small>系統建議</small></div></div><meter min="0" max="100" value="${s.total}" aria-label="風控評分"></meter><div class="v2-status-ticks"><span>0</span><span>20 低</span><span>45 中</span><span>70 高</span><span>100</span></div><p>採用風控級別：<b>${d.policy.label}</b>（${v2Model().manualRisk?'人工設定':'跟隨系統建議'}）</p>${details('risk','評分明細與處置',`<h3>評分明細</h3>${s.reject?row(esc(s.reject),'阻擋','danger'):''}${s.items.map(i=>row(esc(i.label),'+'+i.n)).join('')||'<p class="hint">暫無加分項</p>'}<h3>按風控級別處置 · 系統參考</h3><dl>${[['風控級別',s.reject?'—':v2Raw('riskLevel')],['結算週期',d.policy.cycle],['保證金',d.policy.deposit],['限額',d.policy.limit],['審批路徑',d.policy.path],['目標時效',d.policy.sla]].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><small class="hint">此為原型的系統參考，不代表實際審核結果；不會覆寫已填費率或結算設定。</small>`)}</article>
 <article class="v2-status-card"><h2>資料核對與缺件</h2>${row('資料不一致',d.checks.filter(c=>!c.same).length+' 項')}${row('差異待人工確認',d.checks.filter(c=>!c.same&&!c.confirmed).length+' 項')}${row('缺件／需重新提供',`<span data-risk-missing>${d.missing.length}</span> 項`,d.missing.length?'danger':'')}${row('補件通知',d.missing.length?'未發送':'無需','muted')}<div class="v2-status-links">${btn('查看核對明細 →','v2-status-checks','text-button')}${btn('查看缺件 →','step','text-button','data-step="1"')}</div></article>
 <article class="v2-status-card"><h2>提交完整度</h2><progress max="100" value="${d.percent}" aria-label="必填項目完成度"></progress><p class="v2-status-fill"><span><b data-risk-completed>${d.completed}</b>／${d.required} 必填項已填寫</span><strong>${d.percent}%</strong></p><small class="hint">填寫率不等於驗證通過；格式、文件與費率仍須核對。</small><div class="v2-status-blockers">${d.blocks.slice(0,2).map(b=>`<button data-action="step" data-step="${b.step}"><span>${esc(b.label)}</span><strong>阻擋</strong></button>`).join('')||'<p class="v2-status-ok">目前無阻擋項</p>'}</div>${d.blocks.length>2?details('blocks','另有 '+(d.blocks.length-2)+' 項待處理',d.blocks.slice(2).map(b=>`<button class="v2-status-extra" data-action="step" data-step="${b.step}">${esc(b.label)} →</button>`).join('')):''}</article></section>`;
}
const v2ApplicationWithoutStatus=application;
application=function(step){const html=v2ApplicationWithoutStatus(step),marker='<div class="v2-version">OATS V2 · 六步申請流程</div>',split=html.indexOf(marker)+marker.length;return html.slice(0,split)+'<div class="v2-application-columns"><div class="v2-application-main">'+html.slice(split,-6)+'</div><aside id="v2-application-status" aria-label="申請狀態側欄">'+v2RiskOverview()+'</aside></div></div>';};
actions['v2-status-checks']=()=>modal('資料核對明細',v2ConsistencyCard()+`<h3>缺件／需重新提供</h3><ul>${v2MissingDocs().map(d=>`<li>${esc(d.name.split('\n')[0])}</li>`).join('')||'<li>沒有缺件</li>'}</ul>`,btn('關閉','close')+btn('前往文件材料','step','primary','data-step="1"'));
function v2RefreshStatus(){const n=document.getElementById('v2-application-status');if(n&&route().page==='application'){const top=n.scrollTop;n.innerHTML=v2RiskOverview();n.scrollTop=top;}}
document.addEventListener('toggle',e=>{if(e.target.dataset.v2StatusDetails)v2RiskOpen[e.target.dataset.v2StatusDetails]=e.target.open;},true);
document.addEventListener('input',e=>{if(e.target.dataset.field||e.target.dataset.v2InlineKey)v2RefreshStatus();});
document.addEventListener('change',e=>{if(e.target.closest('.v2-form'))v2RefreshStatus();});
Object.assign(window.AllinPayDemo,{getApplicationStatus:()=>{const d=v2ProgressData();return {step:route().step,score:d.score,policy:d.policy,required:d.required,completed:d.completed,percent:d.percent,missing:d.missing.length,blockers:d.blocks.length};}});

// Internal review console. Local, synthetic demo only — never an authorization boundary.
const IR = {query:'',scope:'全部欄位',status:'Pending',page:1,size:5,selected:null,tab:'fields',doc:0,role:'L2',notes:{},checked:{},pending:null,fail:false};
const irStages={L1:'L1 初審／抽檢',L2:'L2 風控覆審',L3:'L3 終審',Done:'已核准／待同步',MoreInfo:'待補資料',Rejected:'已拒絕'};
const irReasons=['BR 圖片模糊／文件不完整','地址與門店照片不符','結算帳戶名稱不一致','缺少商戶與消費者 T&C（141601）','NAR1／NNC1 缺少或過期（141101）','缺少近 3 個月銀行帳單（141301）','MCC 與實際經營不符','其他（請說明）'];
const irDocTypes=[['商業登記證 BR','140101'],['NAR1 周年申報表','141101'],['負責人身份證正面','100301'],['結算銀行對帳單','140401'],['門店照片','101401'],['近 3 個月銀行帳單','141301']];
const irOldSidebar=sidebar;
sidebar=function(page){const item=can(7)?`<a class="nav-link ${page==='internal-review'?'active':''}" href="#/internal-review"><img class="ir-nav-icon" src="04d0d.svg" alt="">內審控制台</a>`:'';return irOldSidebar(page).replace('<div class="nav-divider">',item+'<div class="nav-divider">');};
function irBase(r){
  const index=Number(String(rowKey(r)).replace(/\D/g,''))||0,level=['B','C','A'][index%3];
  // Stable IDs, not queue positions: filtering/approving another case must not change this case.
  const stage=r.status==='Pending'?(rowKey(r)==='M000531'?'L2':rowKey(r)==='M000826'?'L3':index%3===2?'L1':index%2?'L1':'L2'):r.status==='MoreInfo'?'MoreInfo':r.status==='Rejected'?'Rejected':'Done';
  const normalized=stage==='L3'?'C':stage==='L2'&&level==='A'?'B':level;
  return {stage,tier:normalized,score:{A:12,B:33,C:68}[normalized],appId:'APP-20260924-'+String(index+1).padStart(4,'0'),revision:0,trail:[{time:'2026/09/24 09:12',actor:r.owner||'示例代理商',message:'提交申請（示例）'},{time:'2026/09/24 09:20',actor:'系統 Demo',message:'完成示例風險評分及 OCR 欄位核對'}],...r.internalReview};
}
const irRiskName=c=>({A:'低風險',B:'中風險',C:'高風險'}[c.tier]);
const irSLA=r=>rows.indexOf(r)%9===5?{text:'已逾時 3 小時',overdue:true}:{text:'剩餘 '+(3+rows.indexOf(r)%9)+' 小時',overdue:false};
const irVisible=()=>can(7)?scopedRows():[];
const irCurrent=()=>irVisible().find(r=>rowKey(r)===IR.selected);
const irSearchKeys=['客戶中文名稱','客戶英文名稱','公司 MID','BR','DBA no.','客戶聯繫人','銀行名稱','銀行帳號','主代理商代碼','次代理商代碼'];
function irFiltered(){const q=IR.query.trim().toLocaleLowerCase();return irVisible().filter(r=>(IR.status==='all'||r.status===IR.status)&&(!q||(IR.scope==='全部欄位'?irSearchKeys:[IR.scope]).some(k=>String(k==='銀行帳號'?(can(5)?r.bank:r[k]):r[k]||'').toLocaleLowerCase().includes(q))));}
function irStage(r){return ['Pending','MoreInfo','Rejected'].includes(r.status)?irStages[r.status==='Pending'?irBase(r).stage:r.status]:statusNames[r.status]||r.status;}
function irOptions(list,value){return list.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`}).join('');}
function irQueueBadges(r){const c=irBase(r),tone=c.stage==='L3'?'red':r.status==='Rejected'?'red':r.status==='MoreInfo'?'amber':['Approved','Synced'].includes(r.status)?'green':'neutral';return `<span class="ir-badges"><span class="pill ir-badge ${ {A:'green',B:'blue',C:'amber'}[c.tier]}" aria-label="${c.tier} ${irRiskName(c)}，${c.score} 分">${c.tier} · ${c.score} 分</span><span class="pill ir-badge ir-stage-badge ${tone}">${esc(irStage(r))}</span></span>`;}
function irQueue(list){
 const pages=Math.max(1,Math.ceil(list.length/IR.size));IR.page=Math.max(1,Math.min(IR.page,pages));const shown=list.slice((IR.page-1)*IR.size,IR.page*IR.size);
 return `<section class="ir-queue" aria-labelledby="ir-queue-title"><h2 id="ir-queue-title">待審隊列</h2><p class="hint" id="ir-count" aria-live="polite">顯示 ${list.length?(IR.page-1)*IR.size+1:0}–${Math.min(IR.page*IR.size,list.length)} 間，共 ${list.length} 間公司</p><div class="ir-queue-list">${shown.map(r=>{const c=irBase(r),id=rowKey(r);return `<button class="ir-case ${id===IR.selected?'selected':''}" data-action="ir-select" data-mid="${esc(id)}" aria-pressed="${id===IR.selected}"><strong>${esc(r['客戶中文名稱'])}</strong><small>${esc(c.appId)} · ${esc(id)}</small>${irQueueBadges(r)}<small class="${irSLA(r).overdue?'error':''}">${irSLA(r).text} · ${esc(r['主代理商代碼'])}</small></button>`}).join('')}</div><div class="ir-pages">${btn('上一頁','ir-page','',`data-page="${IR.page-1}" ${IR.page===1?'disabled':''}`)}<span aria-live="polite">${IR.page} / ${pages}</span>${btn('下一頁','ir-page','',`data-page="${IR.page+1}" ${IR.page===pages?'disabled':''}`)}</div><label class="ir-size">每頁 <select id="ir-size">${irOptions([5,10,20,50].map(n=>[n,n+' 間公司']),IR.size)}</select></label><p class="hint">逾時案件優先跟進。切換頁面不會變更目前選中的案件。</p></section>`;
}
function irDocument(r,index=IR.doc){
 const [name,code]=irDocTypes[index]||irDocTypes[0],id=rowKey(r),values=index===0?[['Business name',r['客戶英文名稱']],['BR Number',r.BR],['Valid until',r['BR 有效期']],['Business nature',r['行業類型']]]:index===1?[['公司名稱',r['客戶中文名稱']],['周年申報編號','DEMO-NAR1-'+id],['申報日期','2026/09/01']]:index===2?[['持有人',r['客戶聯繫人']],['證件編號','DEMO（遮蔽）'],['文件性質','示例文件，非真實身份證']]:index===4?[['門店名稱',r['客戶中文名稱']],['營業地區',r['地區']],['門店紀錄','Demo 文件佔位，非真實照片']]:[['帳戶名稱',r['客戶英文名稱']],['銀行名稱',r['銀行名稱']],['帳號',can(5)?r.bank:r['銀行帳號']],['結單期',index===5?'2026/06–2026/08':'2026/08']];
 return `<article class="ir-document"><h3>${esc(name)}</h3><small>DEMO 文件預覽 · ${code}</small><dl>${values.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||'未提供')}</dd></div>`).join('')}</dl><p class="hint">合成示例，不是商戶原始文件或真實 OCR。</p></article>`;
}
function irDocuments(r){return `<section class="card ir-docs"><h2>上傳文件</h2><div class="ir-document-list">${irDocTypes.map(([label,code],i)=>`<button class="ir-doc ${IR.doc===i?'selected':''}" data-action="ir-document" data-index="${i}" aria-pressed="${IR.doc===i}"><span aria-hidden="true">▤</span><span><strong>${label}</strong><small>${code}</small></span></button>`).join('')}</div><div id="ir-document-preview">${irDocument(r)}</div>${btn('放大預覽','ir-zoom')}</section>`;}
function irFields(r){const c=irBase(r),diff=c.tier!=='A',addr='Shop '+(100+rows.indexOf(r))+', 700 Nathan Road',bank=can(5)?r.bank:r['銀行帳號'];
 const values=[['中文名稱',r['客戶中文名稱'],r['客戶中文名稱']],['英文名稱',r['客戶英文名稱'],diff?r['客戶英文名稱'].replace(/LIMITED$/,'LTD'):r['客戶英文名稱']],['BR 號碼',r.BR,r.BR],['證書有效期',r['BR 有效期'],r['BR 有效期']],['營業地址（英文）',addr,diff?addr.replace('Road','Rd'):addr],['帳戶名稱',r['客戶英文名稱'],r['客戶英文名稱']],['銀行帳號',bank,bank],['MCC',r['MCC 行業代碼']+' · '+r['行業類型'],'無 OCR 來源']];
 return `<div class="ir-compare-scroll"><table class="ir-compare"><thead><tr><th scope="col">欄位</th><th scope="col">商戶填報</th><th scope="col">OCR / 外部核驗</th></tr></thead><tbody>${values.map(([key,a,b],i)=>`<tr class="${i!==7&&a!==b?'ir-diff':''}"><th scope="row">${key}${i!==7&&a!==b?'<small>資料差異</small>':''}</th><td>${esc(a||'未提供')}</td><td>${esc(b||'未提供')}</td></tr>`).join('')}</tbody></table></div><div class="ir-warning">${diff?'2 項資料不一致，請核實為填寫錯誤或實際不符後再審批。':'本示例未檢出資料差異，仍須核對原始文件及必填資料。'}</div>`;
}
function irRisk(r){const c=irBase(r),parts=c.tier==='C'?[['行業風險',12],['開通 CNP 產品',15],['OCR / 外部核驗差異',10],['新成立公司',8],['跨境業務',15],['其他風險因子',8]]:c.tier==='B'?[['行業風險',8],['開通 CNP 產品',10],['OCR / 外部核驗差異',10],['文件完整度',0],['開業未滿 12 個月',5]]:[['行業風險',4],['交易規模',3],['新合作商戶',5]];
 return `<h3>風控評分 ${c.score} / 100 · ${c.tier} ${irRiskName(c)}</h3><div class="ir-risk-parts">${parts.map(([k,n])=>`<div><span>${k}</span><strong>+${n}</strong></div>`).join('')}</div><h3>按風控級別處置</h3><dl class="ir-treatment">${[['審批路徑',c.tier==='A'?'L1 自動初審，抽檢 10% → 送 OATS':c.tier==='B'?'L1 全審 → L2 風控覆審 → 送 OATS':'L1 全審 → L2 風控覆審 → L3 終審 → 送 OATS'],['結算週期',c.tier==='C'?'T7':c.tier==='B'?'T2':'T1'],['保證金',c.tier==='C'?'10% · 90 天釋放':c.tier==='B'?'收單 5% · 30 天釋放':'無'],['限額',c.tier==='C'?'單筆 10,000／每月 300,000':c.tier==='B'?'單筆 30,000／每月 1,000,000':'單筆 50,000／每月 2,000,000'],['目標時效',c.tier==='C'?'T+2':c.tier==='B'?'T+1':'4 小時']].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><p class="hint">Demo 規則，並非正式風控政策；不會真正自動審批或傳送 OATS。</p>`;
}
function irTrail(r){return `<h3>審批紀錄（唯讀）</h3><ol class="ir-trail">${irBase(r).trail.map(t=>`<li><strong>${esc(t.time)} · ${esc(t.actor)}</strong><p>${esc(t.message)}</p></li>`).join('')}</ol><p class="hint">介面只允許新增紀錄，不提供刪改。資料儲存在本瀏覽器，並非正式不可竄改稽核系統。</p>`;}
function irAllowed(r,stage=irBase(r).stage){return can(7)&&r.owner!==BO.user.id&&r.status==='Pending'&&stage===IR.role&&irBase(r).stage===stage;}
function irDetail(r){const id=rowKey(r),c=irBase(r),own=r.owner===BO.user.id,allowed=irAllowed(r);
 return `<section class="card ir-detail" aria-labelledby="ir-company"><h2 id="ir-company">${esc(r['客戶中文名稱'])}</h2><p class="hint">${esc(c.appId)} · ${esc(id)} · ${esc(r['客戶英文名稱'])} · MCC ${esc(r['MCC 行業代碼'])}</p><p class="ir-case-meta">${c.tier} ${irRiskName(c)} · ${c.score} 分 ｜ 結算 ${c.tier==='C'?'T7':c.tier==='B'?'T2':'T1'} ｜ ${esc(r['主代理商代碼'])} ｜ <span class="${irSLA(r).overdue?'error':''}">${irSLA(r).text}</span></p><div class="ir-tabs" role="tablist" aria-label="案件內容">${[['fields','字段核對'],['risk','風控評分明細'],['trail','審批紀錄']].map(([key,label])=>btn(label,'ir-tab',IR.tab===key?'primary':'',`data-tab="${key}" role="tab" id="ir-tab-${key}" aria-controls="ir-tab-panel" aria-selected="${IR.tab===key}"`)).join('')}</div><div id="ir-tab-panel" role="tabpanel" aria-labelledby="ir-tab-${IR.tab}">${IR.tab==='risk'?irRisk(r):IR.tab==='trail'?irTrail(r):irFields(r)}</div><div class="ir-approval"><label class="check"><input id="ir-checked" type="checkbox" ${IR.checked[id]?'checked':''} ${!allowed?'disabled':''}>已逐項核對差異及原始文件</label><div class="field"><label for="ir-note">審批備註${c.stage==='L3'?' *':''}</label><textarea id="ir-note" rows="2" maxlength="1000" ${!allowed?'disabled':''} placeholder="記錄核對依據；高風險終審必須填寫理由">${esc(IR.notes[id]||'')}</textarea></div><div class="ir-actions">${btn('駁回／要求補件','ir-reject','',!allowed?'disabled':'')}${[['L1','初審通過 L1'],['L2','覆審通過 L2'],['L3','終審放行 L3']].map(([stage,label])=>btn(label,'ir-approve',irAllowed(r,stage)?'review-button':'',`data-stage="${stage}" ${!irAllowed(r,stage)?'disabled':''}`)).join('')}</div><p class="hint">${own?'填單人不得審批自己的申請。':r.status!=='Pending'?'此案件為「'+esc(irStage(r))+'」，目前唯讀。':allowed?'目前僅可執行 '+IR.role+'。駁回需選擇原因並補充說明。':'目前身份 '+IR.role+' 與案件階段 '+c.stage+' 不符，不能審批。'}</p><p class="error" id="ir-action-error" role="alert"></p></div></section>`;
}
function irConsole(){if(!can(7))return `${heading('內審控制台','')}<div class="readonly-banner">權限不足，不能查看內審公司、文件或審批紀錄。請聯絡管理員授權。</div>`;
 const all=irVisible(),list=irFiltered();if(!IR.selected||!irCurrent())IR.selected=rowKey(list[0])||null;const selected=irCurrent(),pending=all.filter(r=>r.status==='Pending'),events=all.flatMap(r=>(r.internalReview?.trail||[]).filter(t=>t.local)),today=new Date().toLocaleDateString('zh-HK');
 return `${heading('內審控制台','初審 L1 ／ 風控覆審 L2 ／ 終審 L3　｜　填單人不可審批自己的申請；所有操作均保留紀錄。')}<section class="card ir-overview">${[['待處理',pending.length+' 間'],['已逾時',pending.filter(r=>irSLA(r).overdue).length+' 間'],['今日已審',events.filter(t=>t.day===today).length+' 間'],['首次駁回率',events.length?(100*events.filter(t=>t.reject).length/events.length).toFixed(1)+'%':'—']].map(([k,v])=>`<div><small>${k}</small><strong>${v}</strong></div>`).join('')}<label>目前審批身份（Demo）<select id="ir-role">${irOptions([['L1','初審 L1'],['L2','風控覆審 L2'],['L3','終審 L3']],IR.role)}</select><small>${esc(BO.user.name)} · 切換僅用於展示，不是正式授權</small></label></section><form class="card search-grid ir-search" id="ir-search-form"><div><label for="ir-query">跨欄位搜尋</label><input id="ir-query" value="${esc(IR.query)}" placeholder="搜尋公司名稱、MID、BR、DBA、聯繫人、銀行名稱或帳號"></div><div><label for="ir-scope">搜尋範圍</label><select id="ir-scope">${irOptions(['全部欄位',...irSearchKeys],IR.scope)}</select></div><div><label for="ir-status">商戶狀態</label><select id="ir-status">${irOptions([['all','全部狀態'],['Pending','待審核'],['MoreInfo','待補資料'],['Approved','通過審核'],['Rejected','已拒絕'],['Synced','已同步']],IR.status)}</select></div>${btn('重設','ir-reset')}<button class="primary" type="submit">搜尋</button></form>${list.length?`<div class="ir-workspace">${irQueue(list)}${selected?irDocuments(selected)+irDetail(selected):''}</div>`:`<section class="card empty"><h2>找不到符合條件的公司</h2><p id="ir-count">共 0 間公司。請變更關鍵字、搜尋範圍或商戶狀態。</p>${btn('重設搜尋','ir-reset','primary')}</section>`}<div class="ir-demo-note"><span>240+ 筆假資料 · 文件及 OCR 為合成示例，審批僅留在本瀏覽器，不寄電郵或傳送 OATS。</span><label><input id="ir-fail" type="checkbox" ${IR.fail?'checked':''}>模擬儲存失敗</label></div>`;
}
const irPreviousRender=render;
render=function(){if(BO.user&&route().page==='internal-review'){closeColumn();$('#app').innerHTML=`${sidebar('internal-review')}${btn('選單','mobile-menu','mobile-menu')}<main class="main"><div class="content ir-console">${irConsole()}</div></main>`;$('#ir-search-form')?.addEventListener('submit',e=>{e.preventDefault();actions['ir-search']()});return;}irPreviousRender();};
function irCapture(){const r=irCurrent();if(r){const id=rowKey(r);if($('#ir-note'))IR.notes[id]=$('#ir-note').value;if($('#ir-checked'))IR.checked[id]=$('#ir-checked').checked;}}
function irError(message){const target=$('#ir-action-error');if(target)target.textContent=message;else toast(message);}
function irOpenDecision(type){irCapture();const r=irCurrent();if(!r||!irAllowed(r))return deny();const c=irBase(r),id=rowKey(r);if(type==='approve'&&!IR.checked[id])return irError('請先勾選「已逐項核對差異及原始文件」。');
 IR.pending={mid:id,type,stage:c.stage,revision:c.revision,decision:'MoreInfo',reason:'',note:IR.notes[id]||''};irDecisionForm();}
function irDecisionForm(){const p=IR.pending,r=accessibleRow(p?.mid);if(!r||!can(7))return deny();const final=p.type==='approve'&&p.stage==='L3';modal(p.type==='reject'?'駁回／要求補件':final?'高風險終審確認':'確認審批結果',`<p><strong>${esc(r['客戶中文名稱'])}</strong> · ${esc(irBase(r).appId)}</p>${p.type==='reject'?`<div class="field"><label for="ir-decision">處理方式</label><select id="ir-decision">${irOptions([['MoreInfo','要求補件'],['Rejected','駁回申請']],p.decision)}</select></div><div class="field"><label for="ir-reason">快速原因 *</label><select id="ir-reason">${irOptions([['','請選擇原因'],...irReasons],p.reason)}</select></div>`:`<p>確認通過 ${p.stage}？${p.stage==='L1'&&irBase(r).tier!=='A'?'將轉交 L2 風控覆審。':p.stage==='L2'&&irBase(r).tier==='C'?'將轉交 L3 終審。':'將標記為通過審核，等待同步。'}</p>`}<div class="field"><label for="ir-decision-note">${final?'終審理由 *':p.type==='reject'?'補充說明 *':'審批備註'}</label><textarea id="ir-decision-note" rows="4" maxlength="1000" placeholder="${final?'請說明接受風險的依據、管控條件及審查結論':'請輸入核對依據或需要商戶補正的內容'}">${esc(p.note)}</textarea></div><p class="hint">僅更新此 Demo；不會寄出通知或向正式 OATS 傳送資料。</p><p id="ir-decision-error" class="error" role="alert"></p>`,btn('取消','close')+btn(p.type==='reject'?'確認處理':'確認通過','ir-save',p.type==='reject'?'primary':'review-button'));}
Object.assign(actions,{
 'ir-select':el=>{if(!can(7))return deny();irCapture();if(!accessibleRow(el.dataset.mid))return deny();IR.selected=el.dataset.mid;IR.doc=0;IR.tab='fields';render();},
 'ir-search':()=>{if(!can(7))return deny();irCapture();IR.query=$('#ir-query').value;IR.scope=$('#ir-scope').value;IR.status=$('#ir-status').value;IR.page=1;IR.selected=null;IR.doc=0;render();},
 'ir-reset':()=>{Object.assign(IR,{query:'',scope:'全部欄位',status:'Pending',page:1,selected:null,doc:0});render();},
 'ir-page':el=>{irCapture();IR.page=+el.dataset.page;render();},
 'ir-tab':el=>{if(!can(7))return deny();irCapture();IR.tab=['fields','risk','trail'].includes(el.dataset.tab)?el.dataset.tab:'fields';render();},
 'ir-document':el=>{if(!can(7))return deny();irCapture();IR.doc=Math.max(0,Math.min(5,+el.dataset.index||0));render();},
 'ir-zoom':()=>{const r=irCurrent();if(!r)return deny();modal('文件預覽 · '+irDocTypes[IR.doc][0],`<div class="ir-zoom">${irDocument(r)}</div>`,btn('關閉','close','primary'));},
 'ir-reject':()=>irOpenDecision('reject'),'ir-approve':el=>{const r=irCurrent();if(!r||!irAllowed(r,el.dataset.stage))return deny();irOpenDecision('approve');},
 'ir-save':()=>{
  const p=IR.pending,r=accessibleRow(p?.mid),error=$('#ir-decision-error');if(!p||!r||!irAllowed(r,p.stage))return deny();p.note=$('#ir-decision-note').value.trim();IR.notes[p.mid]=p.note;if(p.type==='reject'){p.reason=$('#ir-reason').value;p.decision=$('#ir-decision').value;}
  if(p.type==='reject'&&(!irReasons.includes(p.reason)||!p.note)){error.textContent=!p.reason?'請先選擇拒絕／補件原因。':'請填寫補充說明。';return;}
  if(p.stage==='L3'&&p.type==='approve'&&!p.note){error.textContent='高風險終審必須填寫理由，不能留白。';return;}
  if(p.type==='approve'&&!IR.checked[p.mid]){error.textContent='請返回核對原始文件。';return;}
  if(IR.fail){error.textContent='模擬儲存失敗：原狀態未變更，備註已保留。請取消後關閉失敗模擬再重試。';return;}
  const before=structuredClone(r),c=irBase(r);if(c.revision!==p.revision){error.textContent='案件已被更新，請重新載入核對。';return;}
  const nextStage=p.type==='reject'?p.decision:p.stage==='L1'&&c.tier!=='A'?'L2':p.stage==='L2'&&c.tier==='C'?'L3':'Done';
  const now=new Date(),trail={time:now.toLocaleString('zh-HK',{hour12:false}),day:now.toLocaleDateString('zh-HK'),actor:BO.user.name+' · '+IR.role,message:(p.type==='reject'?statusNames[p.decision]+' · '+p.reason:'通過 '+p.stage+' → '+irStages[nextStage])+(p.note?'；'+p.note:''),local:true,reject:p.type==='reject'};
  r.internalReview={...c,stage:nextStage,revision:c.revision+1,trail:[...c.trail,trail]};r.status=nextStage==='Done'?'Approved':['MoreInfo','Rejected'].includes(nextStage)?nextStage:'Pending';r.reviewReason=p.reason;r.reviewNote=p.note;if(nextStage==='MoreInfo')r.missing=[p.reason,p.note];
  const oldAudit=[...BO.audit],oldNotice=state.noticeCount;audit('內審 '+r['客戶中文名稱']+' · '+trail.message);state.noticeCount++;
  if(!persistDemo()){for(const k of Object.keys(r))delete r[k];Object.assign(r,before);BO.audit=oldAudit;state.noticeCount=oldNotice;error.textContent='儲存失敗，原狀態未變更。請檢查瀏覽器儲存設定後再試。';return;}
  IR.notes[p.mid]='';IR.checked[p.mid]=false;IR.pending=null;render();modal('審批已更新（Demo）',`<div class="notice">${esc(r['客戶中文名稱'])}：${esc(irStage(r))}</div><p>隊列及商戶管理已同步更新，審批紀錄已新增。</p><p class="hint">僅儲存在本瀏覽器，未寄送電郵或傳送 OATS。</p>`,btn('完成','close','primary'));
 }
});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='ir-size'){irCapture();IR.size=[5,10,20,50].includes(+t.value)?+t.value:5;IR.page=1;render();}if(t.id==='ir-role'){irCapture();IR.role=['L1','L2','L3'].includes(t.value)?t.value:'L2';render();}if(t.id==='ir-fail')IR.fail=t.checked;});
document.addEventListener('input',e=>{if(e.target.id==='ir-note'&&IR.selected)IR.notes[IR.selected]=e.target.value;});
window.addEventListener('hashchange',()=>{if(!BO.user){IR.pending=null;IR.notes={};IR.checked={};IR.selected=null;}});

// Shared functional corrections from the supplied Word. No risk-policy changes.
const documentStepNames=['文件材料','主體資料','經營與聯繫','結算帳戶','產品與費率','確認提交'];
function syncBankName(changed) {
  const v=state.values, m=v2Model(), code=String(v.cardBankCode||'').trim().split(/\s+/)[0];
  v.cardBankCode=code;
  const name=v.cardCountryCode==='HKG'?ONBOARDING_BANKS[code]:null;
  if(name){v.cardBankName=name;m.bankAutoName=name;}
  else if(changed||m.bankAutoName===v.cardBankName){v.cardBankName='';delete m.bankAutoName;}
  const input=$('[data-v2-field="cardBankName"]');if(input){input.value=v.cardBankName||'';input.readOnly=!!name;}
}
const feedbackField=v2Field;
v2Field=function(f,...args){let html=feedbackField(f,...args);if(f.id==='cardBankName'&&v2Raw('cardCountryCode')==='HKG'&&ONBOARDING_BANKS[v2Raw('cardBankCode')])html=html.replace('type="text"','type="text" readonly');return html;};
const feedbackDerived=v2SyncDerived;
v2SyncDerived=function(){feedbackDerived();if(v2Raw('cardCountryCode')==='HKG'&&ONBOARDING_BANKS[v2Raw('cardBankCode')])syncBankName(false);};
const feedbackValidation=v2ValidateFields;
v2ValidateFields=function(index){const e=feedbackValidation(index),v=v2Raw('inspectionDate');if(index===0&&v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T00:00:00'))||new Date(v+'T00:00:00').toLocaleDateString('sv-SE')!==v))e.inspectionDate='請選擇有效考察日期';return e;};
const feedbackDocuments=v2Documents;
v2Documents=function(){return feedbackDocuments()
 .replace('多文件辨識示例','多文件辨識')
 .replace('BR 支援 PDF、JPG、PNG，文件僅在瀏覽器本機辨識；其他文件提供示例流程。','可一次選取多份 PDF、JPG、PNG，在瀏覽器本機辨識；先核對，再套用。')
 .replace('必交文件檢查','文件提供狀態')
 .replace('必交清單會隨法律主體、風險級別、產品及董事／股東設定更新。','所有文件均為選填。未提供不會阻擋下一步或提交；已填文字資料仍須驗證。')
 .replace('0／0 項必交文件已備妥',Object.keys(state.files).length+' 份文件已選取 · 全部為選填')
 .replaceAll(' · 示例信心 ',' · 辨識信心 ');};
const feedbackReview=v2Review;
v2Review=function(){return feedbackReview().replace('✓ 文件已備妥','文件為選填').replace('條件文件','選填文件');};
uploadRow=function(d){const f=state.files[d.id],id='document-file-'+d.id,error=state.errors['file-'+d.id];return `<div class="upload-row" data-upload-row="${d.id}" data-document-drop="${d.id}" data-file-drop data-file-input="${id}"><div class="upload-heading"><strong>${labelHTML(d.name)}</strong>${pill(f?'已選取':'選填',f?'green':'gray')}</div><p class="hint">${esc(d.hint)}</p>${fileDropControl({inputId:id,accept:'.pdf,.jpg,.jpeg,.png,.zip',hint:'PDF／JPG／PNG／ZIP · 每份上限 10 MB',selected:f?f.name+(f.needsReselect?' · 請重新選取':' · 僅本機'):'',attributes:`data-demo-upload="${d.id}"`})}${error?`<p class="error">${esc(error)}</p>`:''}${f?`<div class="upload-actions">${btn('預覽','preview-demo-file','',`data-id="${d.id}"`)+btn('移除',actions['document-remove-file']?'document-remove-file':'remove-file','danger',`data-id="${d.id}"`)}</div>`:''}</div>`;};
function acceptDocumentFile(id,files){
  if(files.length!==1)return toast('每個上傳位置接受一份文件；多頁可合併 PDF，多文件辨識請使用上方按鈕。');
  const f=files[0];if(!f||!f.size||f.size>10485760||!/\.(pdf|png|jpe?g|zip)$/i.test(f.name))return modal('文件格式不符','<p>請選擇非空白、10 MB 以下的 PDF／JPG／PNG／ZIP。原有文件不受影響。</p>');
  const old=DEMO.fileURLs.get(id);if(old)URL.revokeObjectURL(old);
  DEMO.fileURLs.set(id,URL.createObjectURL(f));state.files[id]={name:f.name,size:f.size,type:f.type,demo:false,needsReselect:false};delete state.errors['file-'+id];render();toast('已選取文件，沒有上傳至伺服器');
}
// Capture makes the picker and drag/drop use exactly the same validation path.
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.demoUpload){e.stopImmediatePropagation();acceptDocumentFile(t.dataset.demoUpload,[...t.files]);}},true);
document.addEventListener('change',e=>{if(['cardBankCode','cardCountryCode'].includes(e.target.dataset.v2Field)){syncBankName(true);const bank=$('[data-v2-field="cardBankName"]');if(bank)bank.dispatchEvent(new Event('input',{bubbles:true}));}});
document.addEventListener('input',e=>{if(e.target.dataset.v2Field==='cardBankCode'){state.values.cardBankCode=e.target.value;syncBankName(true);}});
Object.assign(window.AllinPayDemo,{version:'2026.09.29-full-br-unified-uploads'});
/* MULTI_DOCUMENT_WORKFLOW */

let documentBatch=null;
const documentTypes=[['AUTO','自動判斷'],['BR','BR 商業登記證'],['CI','CI 公司註冊證書'],['NAR1','NAR1／NNC1'],['ID','身份證'],['BANK','銀行月結單']];
const batchDocName=id=>V2.documents.find(d=>d.id===id)?.name.split('\n')[0]||'待手動分配';
function batchDispose(){const b=documentBatch;if(!b)return;b.cancelled=true;b.controller?.abort();for(const f of b.files)if(f.url)URL.revokeObjectURL(f.url);documentBatch=null;}
function batchOpen(){batchDispose();documentBatch={files:[],items:[],failures:[],phase:'upload'};batchUpload();}
function batchUpload(){const b=documentBatch;b.phase='upload';modal('多文件辨識',
 '<div class="notice">一次加入所有文件，辨識後預覽附件位置及表單欄位，再確認套用。文件只在本瀏覽器處理，不會上傳。</div>'+
 fileDropControl({inputId:'document-batch-files',accept:'.pdf,.png,.jpg,.jpeg,.zip',multiple:true,title:'拖曳一份或多份文件至此',hint:'最多 30 份／合計 100 MB · 每份 10 MB／PDF 5 頁',selected:b.files.length?'已加入 '+b.files.length+' 份文件':''})+
 '<div class="batch-files">'+b.files.map((f,i)=>'<div class="batch-file"><span>'+esc(f.file.name)+'</span><select aria-label="'+esc(f.file.name)+' 文件類型" data-document-type="'+i+'">'+documentTypes.map(([v,n])=>'<option value="'+v+'" '+(f.type===v?'selected':'')+'>'+n+'</option>').join('')+'</select>'+btn('移除','document-remove','','data-index="'+i+'"')+'</div>').join('')+'</div>'+
 '<p class="hint">按文件內容判斷 BR、CI、銀行月結單等；身份證持有人角色、照片及 ZIP 可能須手動分配。不確定或重複的位置不會自動覆蓋。</p>',
 btn('取消','close')+btn('開始辨識','document-recognize','primary',b.files.length?'':'disabled'));}
function batchAdd(files){
 const b=documentBatch;if(!b||b.phase!=='upload')return;
 if(b.files.length+files.length>30)return toast('每次最多 30 份文件');
 if([...b.files.map(f=>f.file),...files].reduce((n,f)=>n+f.size,0)>100*1048576)return toast('文件合計不可超過 100 MB');
 if(files.some(f=>!f.size||f.size>10485760||!/\.(pdf|png|jpe?g|zip)$/i.test(f.name)))return toast('請選擇非空白、10 MB 以下 PDF／PNG／JPG／ZIP；原有清單不受影響');
 for(const file of files)b.files.push({file,type:'AUTO',url:URL.createObjectURL(file),destination:'',include:false,replace:false});batchUpload();
}
async function batchRecognize(){
 const b=documentBatch;if(!b?.files.length||b.phase!=='upload')return;b.phase='reading';b.controller=new AbortController();
 modal('多文件辨識中','<p id="document-progress" role="status">正在載入本機辨識引擎…</p><progress id="document-progress-bar" max="100" value="0"></progress><p class="hint">辨識文件種類及可填欄位。可隨時取消，現有資料不受影響。</p>',btn('取消辨識','close'));let timer;
 try{
  const [[engine],parser]=await Promise.all([brLoadModules(),import('./br-engine/multi-document.mjs?v=20260929-uploads')]);
  for(let i=0;i<b.files.length;i++){
   if(b.cancelled)return;const entry=b.files[i];entry.text=[];let doc;const classifications=[];
   try{
    if(/\.zip$/i.test(entry.file.name)){entry.reason='ZIP 不自動解壓或辨識，請選擇附件位置';continue;}
    doc=await engine.loadDocument(entry.file);
    for(let p=1;p<=doc.pages;p++){
     if(b.cancelled)return;let view;
     try{
      view=await doc.render(p);timer=setTimeout(()=>b.controller.abort(),120000);
      const progress=n=>{if(!b.cancelled)$('#document-progress').textContent=(i+1)+'／'+b.files.length+' · '+entry.file.name+' · 第 '+p+' 頁 · '+Math.round(n*100)+'%';};
      const tryBR=entry.type==='BR'||entry.type==='AUTO'&&(!view.text.trim()||parser.classifyDocument(view.text).id==='140101');
      const br=tryBR?await engine.recognizeDocument({...view,page:p,signal:b.controller.signal,onProgress:x=>progress(x.progress)}):null;
      const result=br?.recognized?{text:br.rawText,method:br.method,confidence:br.ocrConfidence}:await engine.extractDocumentText({...view,signal:b.controller.signal,onProgress:progress});clearTimeout(timer);
      if(b.cancelled)return;entry.text.push(result.text);classifications.push(parser.classifyDocument(result.text,{brRecognized:!!br?.recognized}));
      const candidates=br?.recognized?parser.candidatesFromBR(br):parser.extractCandidates(result.text,entry.type);
      for(const candidate of candidates){const value=v2Canonical(candidate.key,candidate.value);if(!b.items.some(o=>o.key===candidate.key&&o.value===value&&o.fileIndex===i))b.items.push({...candidate,value,fileIndex:i,page:p,source:(br?.recognized?'BR · ':'')+entry.file.name+' · 第 '+p+' 頁',method:result.method,confidence:candidate.confidence??result.confidence,selected:false,replace:false});}
     }finally{clearTimeout(timer);if(view)view.canvas.width=1;}
    }
    const ids=[...new Set(classifications.map(c=>c.id).filter(Boolean))];
    entry.destination=ids.length===1&&!classifications.some(c=>c.ambiguous)?ids[0]:'';
    entry.reason=entry.destination?'按文件內文判斷：'+batchDocName(entry.destination):'未能確定唯一文件種類，請選擇附件位置';
   }catch(error){if(b.cancelled)return;entry.reason='未完成辨識，仍可手動分配附件';b.failures.push(entry.file.name+'：'+(error.name==='AbortError'?'辨識逾時，請重試或手動分配。':error.message));if(b.controller.signal.aborted)b.controller=new AbortController();}
   finally{await doc?.destroy();if(!b.cancelled)$('#document-progress-bar').value=(i+1)/b.files.length*100;}
  }
  if(b.cancelled)return;
  for(const f of b.files)f.include=!!f.destination&&!state.files[f.destination]&&b.files.filter(x=>x.destination===f.destination).length===1;
  for(const o of b.items)o.selected=!!b.files[o.fileIndex].destination&&o.autoSelect!==false&&!v2Raw(o.key)&&b.items.filter(x=>x.key===o.key).length===1;
  batchReview();
 }catch(error){if(!b.cancelled){b.failures.push(error.message);batchReview();}}finally{clearTimeout(timer);}
}
function batchAssignments(ready){const b=documentBatch;return '<h3>文件自動分配</h3><p class="hint">確認每份文件的上傳位置。重複位置或已有附件須自行選擇；未勾選的文件不會加入。</p><div class="batch-assignments">'+b.files.map((f,i)=>{
 const duplicate=f.destination&&b.files.filter(x=>x.destination===f.destination).length>1,old=state.files[f.destination];
 return '<section class="batch-assignment"><strong>'+esc(f.file.name)+'</strong><small>'+esc(f.reason||'請選擇附件位置')+'</small><label>對應上傳位置<select aria-label="文件 '+(i+1)+' 對應上傳位置" data-document-destination="'+i+'" '+(ready?'disabled':'')+'><option value="">待手動分配／略過</option>'+
 V2.documents.map(d=>'<option value="'+d.id+'" '+(f.destination===d.id?'selected':'')+'>'+esc(batchDocName(d.id))+'</option>').join('')+'</select></label>'+
 (duplicate?'<p class="error">多份文件對應同一位置，請只選一份，或合併 PDF 後重新加入。</p>':'')+
 (old?'<p class="hint">原有附件：'+esc(old.name)+'</p><label class="check"><input type="checkbox" data-document-file-replace="'+i+'" '+(f.replace?'checked':'')+' '+(ready?'disabled':'')+'>確認取代此位置原有附件</label>':'')+
 '<label class="check"><input type="checkbox" data-document-include="'+i+'" '+(f.include?'checked':'')+' '+(ready||!f.destination?'disabled':'')+'>將此文件加入對應位置</label></section>';
 }).join('')+'</div>';}
function batchReview(ready=false){
 const b=documentBatch;if(!b)return;b.phase=ready?'ready':'review';if(!ready)b.confirmed=false;
 modal(ready?'已核對，準備套用':'核對多文件辨識結果',
 '<div class="notice warn">已預填可確定的分配位置及候選值；請核對後一次套用。沒有讀取到的資料不會猜測。</div>'+
 '<div class="batch-source-list">'+b.files.map((f,i)=>btn('查看文件 '+(i+1),'document-source','','data-index="'+i+'"')).join('')+'</div>'+
 batchAssignments(ready)+'<h3>表單欄位</h3><div class="batch-candidates">'+
 (b.items.map((o,i)=>{const existing=v2Raw(o.key),conflict=existing&&existing!==o.value;return '<section class="batch-candidate"><label class="check"><input type="checkbox" data-document-select="'+i+'" '+(o.selected?'checked':'')+' '+(ready?'disabled':'')+'><strong>'+esc(v2Label(o.key))+'</strong></label><input aria-label="核對 '+esc(v2Label(o.key))+'" data-document-value="'+i+'" value="'+esc(o.value)+'" '+(ready?'readonly':'')+'><small>'+esc(o.source)+' · '+esc(o.method)+'</small>'+
 (existing?'<p class="hint">原有內容：'+esc(existing)+'</p>':'')+(conflict?'<label class="check"><input type="checkbox" data-document-replace="'+i+'" '+(o.replace?'checked':'')+' '+(ready?'disabled':'')+'>確認以此值取代原有內容</label>':'')+'</section>';}).join('')||'<p>沒有可帶入的候選欄位；仍可將文件分配到附件位置。</p>')+'</div>'+
 (b.failures.length?'<div class="notice warn"><strong>仍需手動補充</strong><ul>'+b.failures.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul></div>':'')+
 (ready?'':'<label class="check"><input type="checkbox" id="batch-reviewed">我已核對文件位置、欄位內容及取代選項</label>')+'<p id="document-error" class="error" role="alert"></p>',
 btn('取消，保留原資料','close')+(ready?btn('返回核對','document-review'):'')+btn(ready?'確認並套用':'已核對，準備套用',ready?'document-apply':'document-ready','primary'));
}
function batchValidate(){
 const b=documentBatch,selected=b.items.filter(o=>o.selected),files=b.files.filter(f=>f.include),keys=new Set(),slots=new Set();
 if(!selected.length&&!files.length)return '請至少選擇一份文件或一個已核對欄位。';
 for(const f of files){if(!V2.documents.some(d=>d.id===f.destination))return '請選擇有效的文件位置。';if(slots.has(f.destination))return batchDocName(f.destination)+'有多份文件，請只選一份。';slots.add(f.destination);if(state.files[f.destination]&&!f.replace)return '請確認取代「'+batchDocName(f.destination)+'」的原有附件。';}
 for(const o of selected){if(!o.value.trim())return '選取的欄位不可空白。';if(keys.has(o.key))return v2Label(o.key)+'有多個結果，請只選一個。';keys.add(o.key);if(o.key==='registerCertNo'&&!/^\d{8}-\d{3}-\d{2}-\d{2}-[A-Z0-9]$/i.test(o.value))return '請按原件核對完整登記證號碼，包含最後三段。';if(v2Raw(o.key)&&v2Raw(o.key)!==o.value&&!o.replace)return '請確認要取代「'+v2Label(o.key)+'」的原有內容。';}
 return '';
}
function batchReady(){const error=batchValidate()||(!$('#batch-reviewed')?.checked?'請先確認已核對文件位置及欄位。':'');if(error){$('#document-error').textContent=error;return;}documentBatch.confirmed=true;batchReview(true);}
function batchApply(){
 const b=documentBatch;if(b?.phase!=='ready'||!b.confirmed)return;const error=batchValidate();if(error){batchReview();$('#document-error').textContent=error;return;}
 if(state.fail)return modal('資料寫入失敗','<p>原有表單、附件及辨識結果均保留，可返回核對。</p>',btn('取消','close')+btn('返回核對','document-review','primary'));
 const before=structuredClone(state.values),beforeFiles=structuredClone(state.files),beforePeople={...state.people},changed=[];
 try{
  const selected=b.items.filter(o=>o.selected),files=b.files.filter(f=>f.include);
  for(const o of selected){if(o.key.startsWith('directors[0]'))state.people.directors=Math.max(1,state.people.directors);state.values[o.key]=o.value;v2Model().ocr.push({key:o.key,value:o.value,source:o.source,step:o.step,applied:o.value,method:o.method,confidence:o.confidence});}
  for(const f of files){const id=f.destination,url=URL.createObjectURL(f.file);changed.push({id,url,old:DEMO.fileURLs.get(id)});DEMO.fileURLs.set(id,url);state.files[id]={name:f.file.name,size:f.file.size,type:f.file.type,demo:false,needsReselect:false};}
  v2SyncDerived();const done=[...files.map(f=>batchDocName(f.destination)+'：'+f.file.name),...selected.map(o=>v2Label(o.key)+'：'+v2Display(o.key,o.value))],pending=[...b.files.filter(f=>!f.include).map(f=>f.file.name+'：尚未加入附件位置'),...b.items.filter(o=>!o.selected).map(o=>v2Label(o.key)+'：'+o.value)],failures=[...b.failures];
  render();v2ImportResult(done,pending,failures);$('#modal .v2-import-success h3').textContent='完成匯入 · '+files.length+' 份文件、'+selected.length+' 個欄位';$('#modal .v2-import-pending h3').textContent='仍待核對 · '+pending.length+' 個項目未帶入';for(const x of changed)if(x.old)URL.revokeObjectURL(x.old);batchDispose();
 }catch(error){state.values=before;state.files=beforeFiles;state.people=beforePeople;for(const x of changed){URL.revokeObjectURL(x.url);if(x.old)DEMO.fileURLs.set(x.id,x.old);else DEMO.fileURLs.delete(x.id);}modal('資料寫入失敗','<p>已還原原有資料及附件，請重新核對。</p>',btn('返回核對','document-review','primary'));}
}
Object.assign(actions,{'v2-ocr':batchOpen,'document-recognize':batchRecognize,'document-ready':batchReady,'document-apply':batchApply,'document-review':()=>batchReview(),'document-remove':el=>{const f=documentBatch.files.splice(+el.dataset.index,1)[0];URL.revokeObjectURL(f.url);batchUpload();},'document-source':el=>{const f=documentBatch.files[+el.dataset.index];modal('原始文件與辨識文字','<p>'+esc(f.file.name)+'</p>'+(/\.pdf$/i.test(f.file.name)?'<iframe class="batch-preview" title="原始 PDF" src="'+f.url+'"></iframe>':/\.(png|jpe?g)$/i.test(f.file.name)?'<img class="batch-preview" alt="原始文件" src="'+f.url+'">':'<p>ZIP 不在瀏覽器解壓，請在本機查看。</p>')+'<details><summary>查看辨識文字（只保留於記憶體）</summary><pre class="batch-text">'+esc((f.text||[]).join('\n\n'))+'</pre></details>',btn('返回核對','document-review','primary'));}});
document.addEventListener('change',e=>{const t=e.target,b=documentBatch;if(t.id==='document-batch-files')batchAdd([...t.files]);if(!b)return;if(t.dataset.documentType!==undefined)b.files[+t.dataset.documentType].type=t.value;if(t.dataset.documentSelect!==undefined)b.items[+t.dataset.documentSelect].selected=t.checked;if(t.dataset.documentReplace!==undefined)b.items[+t.dataset.documentReplace].replace=t.checked;if(t.dataset.documentDestination!==undefined){const f=b.files[+t.dataset.documentDestination];f.destination=t.value;f.include=!!t.value;f.replace=false;batchReview();}if(t.dataset.documentInclude!==undefined)b.files[+t.dataset.documentInclude].include=t.checked;if(t.dataset.documentFileReplace!==undefined)b.files[+t.dataset.documentFileReplace].replace=t.checked;});
document.addEventListener('input',e=>{if(e.target.dataset.documentValue!==undefined)documentBatch.items[+e.target.dataset.documentValue].value=e.target.value;});
$('#modal').addEventListener('close',()=>{if(documentBatch){batchDispose();render();}});
window.addEventListener('pagehide',batchDispose);

/* UI dictionary. Keep customer-entered names, identifiers, documents and business records unchanged. */
const AZURE_EN={
 '主選單':'Main menu','儀表板':'Dashboard','商戶入網':'Merchant onboarding','新增商戶':'New merchant','新增客戶':'New customer','批量導入':'Bulk import','商戶管理':'Merchants','內審控制台':'Internal review','查閱更新記錄':'Activity log','帳號管理':'Accounts','已儲存的草稿':'Saved drafts','設定':'Settings','登出':'Sign out',
 '登入':'Sign in','登 入':'Sign in','商戶登入':'Merchant sign-in','電郵地址':'Email address','密碼':'Password','請輸入':'Enter a value','請輸入 Demo 密碼':'Enter Demo password','忘記密碼？':'Forgot password?','或':'or','使用 Google 登入':'Continue with Google','使用電郵驗證碼登入':'Sign in with email code','未有帳戶？ 建立帳戶':'No account? Register','返回登入':'Back to sign in','開啟外部商戶申請':'Open external application','建立帳戶':'Create account','姓名':'Name','設定密碼':'Create password','確認密碼':'Confirm password','立即申請':'Apply now','商戶註冊':'Merchant registration','提取已儲存草稿':'Retrieve a saved draft','我的申請':'My applications',
 '文件材料':'Documents','主體資料':'Entity information','經營與聯繫':'Business & contacts','結算帳戶':'Settlement account','產品與費率':'Products & fees','確認提交':'Review & submit','KTC 認證':'KTC verification','上一步':'Back','下一步':'Next','儲存草稿':'Save draft','提交申請':'Submit application','完成':'Done','關閉':'Close','取消':'Cancel','確認':'Confirm','清除':'Clear','重設':'Reset','搜尋':'Search','上一頁':'Previous','下一頁':'Next','填入完整示例':'Fill demo data','清空表單':'Clear form','全部欄位':'All fields','全部狀態':'All statuses','搜尋範圍':'Search scope','商戶狀態':'Merchant status','跨欄位搜尋':'Search all fields','欄位設定':'Columns','匯出 CSV':'Export CSV',
 '兩步驟驗證':'Two-step verification','驗證器驗證碼':'Authenticator code','請輸入 6 位數驗證碼':'Enter the 6-digit code','驗證並登入':'Verify and sign in','改用備用碼':'Use a backup code','綁定驗證器':'Set up authenticator','驗證並啟用':'Verify and enable','保存備用碼':'Save backup codes','下載備用碼（Demo）':'Download backup codes (Demo)','我已保存備用碼':'I have saved the backup codes','完成註冊':'Complete registration','使用備用碼':'Use a backup code','備用碼':'Backup code','驗證備用碼':'Verify backup code','返回驗證器':'Back to authenticator','驗證電郵地址':'Verify email address','電郵驗證碼':'Email verification code','驗證電郵':'Verify email',
 '開啟驗證器，輸入此帳戶的 6 位數驗證碼。':'Open your authenticator and enter the 6-digit code.','Demo 請輸入 123456；此處不驗證真實 TOTP。':'Enter 123456 for this demo. No real TOTP is verified.','Demo 請輸入 123456，不使用真實驗證器。':'Use 123456 in this demo, not a real authenticator.','前端 Demo · 電郵、OTP 與帳戶保護皆為模擬。請勿輸入真實密碼。':'Frontend demo: email, OTP and account protection are simulated. Do not enter real credentials.','驗證碼不正確，Demo 請輸入 123456。':'Incorrect code. Use 123456 for this demo.','驗證工作階段已過期，請返回登入後重試。':'Verification session expired. Return to sign in and try again.','備用碼不正確或已使用，請換一組。':'Invalid or already-used backup code. Try another code.','每組示例備用碼僅能在本瀏覽器使用一次。':'Each demo backup code can be used once in this browser.','請先保存備用碼並勾選確認。':'Save your backup codes and tick the confirmation.','請妥善保存備用碼。每組只能使用一次。':'Keep your backup codes safe. Each can be used only once.','兩步驟驗證已啟用（Demo）。以下不是正式帳戶憑證。':'Two-step verification enabled (Demo). These are not production credentials.',
 '邀請客戶填寫':'Invite a customer','分享我的申請連結':'Share my application link','風控評分（系統參考）':'Risk score (reference)','系統建議':'System recommendation','資料核對與缺件':'Data checks & missing documents','提交完整度':'Application completeness','評分明細與處置':'Score details & handling','資料不一致':'Data mismatches','差異待人工確認':'Differences awaiting review','缺件／需重新提供':'Missing / replacement required','補件通知':'Supplement request','未發送':'Not sent','查看核對明細 →':'View checks →','查看缺件 →':'View missing documents →','目前無阻擋項':'No blocking issues','處理':'Process','查看商戶':'View merchant',
 '核對身分證資訊':'Review ID information','開始 KTC 認證':'Start KTC verification','重新進行 KTC 認證':'Restart KTC verification','查看／核對已導入身分證資訊':'Review imported ID information','確認資料正確':'Confirm information','返回 KTC':'Back to KTC','返回文件材料':'Back to documents','下一步：主體資料':'Next: entity information','手機拍照 — 身分證':'Take an ID photo','人像識別':'Face verification','識別成功（Demo）':'Verification successful (Demo)','識別成功':'Verification successful','需要手機拍照及人像識別':'ID photo and face verification required','使用手機完成 KTC 認證':'Complete KTC on your phone','識別連結已過期':'Verification link expired','重新產生 QR Code':'Generate a new QR code','取消識別':'Cancel verification','模擬識別成功回傳':'Simulate successful callback','模擬連結過期':'Simulate expired link','手機 Demo 回傳碼':'Mobile demo return code','確認手機回傳碼':'Confirm mobile return code','開啟手機識別 Demo ↗':'Open mobile verification demo ↗','繼續下一步':'Continue','查看 KTC':'View KTC','請先完成 KTC 認證':'Complete KTC verification first','回傳碼不正確':'Incorrect return code','安全身分認證 · KTC · Demo':'Identity verification · KTC · Demo','開始認證':'Start verification','使用示例照片':'Use demo photo','確認並繼續':'Confirm and continue','重新拍照':'Retake photo','完成人像識別（Demo）':'Complete face verification (Demo)','預覽無法識別':'Preview failed verification','暫時無法識別':'Unable to verify','重新進行人像識別':'Retry face verification','我了解並同意進行 Demo 演示':'I understand and agree to run this demo','已核對示例辨識資料':'I have reviewed the demo ID information','身分證相機預覽（示意）':'ID camera preview (illustration)',
 '選擇文件':'Choose file','重新選擇':'Choose again','移除':'Remove','預覽':'Preview','匯入 BR':'Import BR','多文件辨識':'Multi-document recognition','開始辨識':'Start recognition','完成匯入':'Imported','仍待核對 · 未帶入':'Awaiting review · not imported','無法辨識 · 未帶入':'Unrecognised · not imported','未選取':'Not selected','已選取':'Selected','請選擇':'Select','選填':'Optional','核對辨識結果':'Review recognition results','已核對，準備套用':'Reviewed, ready to apply','確認並套用':'Confirm and apply','文件上傳與識別':'Document upload & recognition','辨識結果及來源':'Recognition results & sources','必交文件檢查':'Required document checks','收費類型':'Pricing type','適用範圍':'Scope','費率（%）':'Rate (%)','每筆費用（HKD）':'Per-transaction fee (HKD)','保底（HKD）':'Minimum (HKD)','封頂（HKD）':'Maximum (HKD)','本地卡':'Local cards','跨境卡':'Cross-border cards','優惠費率':'Preferential rate','產品配置':'Product configuration','特計商戶':'Special merchant','開通':'Enable','卡組織':'Card network','特計商戶類型':'Special merchant type','收單':'Acquiring','線下掃碼支付':'In-store QR payments','線上掃碼支付':'Online QR payments','帳戶驗證':'Account verification','驗證':'Verify','返回登入頁面':'Back to sign in','最高管理員':'Administrator','基本管理員':'Manager','主代理商':'Primary agent','次代理商':'Sub-agent'
};

/* Shared, explicitly simulated second-factor flow. No credentials leave this browser. */
const azureAuth={stage:null,pending:null,expires:0,error:'',register:false,verified:false};
const azureBackupCodes=['DEMO-4821','DEMO-6039','DEMO-1754','DEMO-9286','DEMO-3107','DEMO-8462'];
function azureQR(text){const qr=qrcode(0,'M');qr.addData(text);qr.make();return qr.createSvgTag({cellSize:4,margin:16,scalable:true});}
function azureStartAuth(pending,register=false){azureAuth.pending=pending;azureAuth.register=register;azureAuth.stage=register?'email':'otp';azureAuth.expires=Date.now()+600000;azureAuth.error='';azureAuth.verified=false;go('azure-'+azureAuth.stage);}
function azureAuthCard(){
 const s=azureAuth.stage,email=AZURE_EXTERNAL?state.email:azureAuth.pending?.email||BO.loginEmail;
 const code=label=>`<label for="azure-code">${label}</label><input id="azure-code" inputmode="${s==='recovery'?'text':'numeric'}" autocomplete="one-time-code" maxlength="${s==='recovery'?16:6}" placeholder="${s==='recovery'?'DEMO-4821':'請輸入 6 位數驗證碼'}" aria-describedby="azure-auth-error">`;
 let body='';
 if(s==='email')body='<h1>驗證電郵地址</h1><p>請核對電郵並輸入示例驗證碼；完成後設定兩步驟驗證。</p><p>'+esc(email)+'</p>'+code('電郵驗證碼')+btn('驗證電郵','azure-auth-check','primary');
 if(s==='setup')body='<h1>綁定驗證器</h1><p>電郵已驗證。此 QR Code 與金鑰只作 Demo 示意，請勿加入真實帳戶。</p><div class="azure-qr">'+azureQR('AZURE DEMO ONLY - NOT A REAL AUTHENTICATOR SECRET')+'</div><p>示例金鑰：JBSW Y3DP EHPK 3PXP</p>'+code('驗證器驗證碼')+'<small>Demo 請輸入 123456，不使用真實驗證器。</small>'+btn('驗證並啟用','azure-auth-check','primary');
 if(s==='otp')body='<h1>兩步驟驗證</h1><p>開啟驗證器，輸入此帳戶的 6 位數驗證碼。</p><p>'+esc(email)+'</p>'+code('驗證器驗證碼')+'<small>Demo 請輸入 123456；此處不驗證真實 TOTP。</small>'+btn('驗證並登入','azure-auth-check','primary')+btn('改用備用碼','azure-auth-recovery');
 if(s==='recovery')body='<h1>使用備用碼</h1><p>每組示例備用碼僅能在本瀏覽器使用一次。</p>'+code('備用碼')+btn('驗證備用碼','azure-auth-check','primary')+btn('返回驗證器','azure-auth-otp');
 if(s==='backup')body='<h1>保存備用碼</h1><p>兩步驟驗證已啟用（Demo）。以下不是正式帳戶憑證。</p><div class="notice warn">請妥善保存備用碼。每組只能使用一次。</div><div class="azure-backup">'+azureBackupCodes.map(c=>'<strong>'+c+'</strong>').join('')+'</div>'+btn('下載備用碼（Demo）','azure-backup-download')+'<label class="check"><input type="checkbox" id="azure-backup-saved">我已保存備用碼</label>'+btn('完成註冊','azure-auth-finish','primary');
 return `<form class="azure-auth-card" id="azure-auth-form">${body}<p class="error" id="azure-auth-error" role="alert">${esc(azureAuth.error)}</p>${btn('返回登入','azure-auth-cancel')}<small>前端 Demo · 電郵、OTP 與帳戶保護皆為模擬。請勿輸入真實密碼。</small></form>`;
}
function azureShowAuth(){
 if(!azureAuth.pending||!azureAuth.stage){azureAuth.stage=null;go('login');return;}
 if(AZURE_EXTERNAL){$('#app').innerHTML=auth('login');$('.auth-form').outerHTML=azureAuthCard();}
 else {$('#app').innerHTML=authPage('login');$('.login-card').outerHTML=azureAuthCard();}
 $('#azure-auth-form').addEventListener('submit',e=>{e.preventDefault();actions[azureAuth.stage==='backup'?'azure-auth-finish':'azure-auth-check']();});
}
function azureFinishAuth(){
 if(!azureAuth.pending||!azureAuth.verified)return;
 const pending=azureAuth.pending,registered=azureAuth.register;azureAuth.stage=null;azureAuth.pending=null;
 if(AZURE_EXTERNAL){state.session=true;state.emailVerified=true;if(state.pendingDraft){const d=state.pendingDraft;state.pendingDraft=null;loadRecord(d);}else if(registered){const seed=state.registerSeed;newApplication();if(seed){state.values.merchantEnglishName=seed.companyEn||'';state.values.contactName=[seed.lastName,seed.firstName].filter(Boolean).join(' ');}state.registerSeed=null;go('form/1');}else go('applications');}
 else {if(registered){pending.status='已啟用';accounts.push(pending);if(!saveAccounts()){accounts.pop();azureAuth.pending=pending;azureAuth.stage='backup';return;}}azureOriginalLogin(pending);}
}
Object.assign(actions,{
 'azure-auth-check':()=>{
  if(!azureAuth.pending)return;
  if(Date.now()>azureAuth.expires){azureAuth.error='驗證工作階段已過期，請返回登入後重試。';render();return;}
  const code=$('#azure-code')?.value.trim().toUpperCase()||'',s=azureAuth.stage;
  if(s==='recovery'){
   const key='azure-demo-used-backup-'+(AZURE_EXTERNAL?state.email:azureAuth.pending.email);let used=[];
   try{used=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
   if(!azureBackupCodes.includes(code)||used.includes(code)){azureAuth.error='備用碼不正確或已使用，請換一組。';render();return;}
   try{localStorage.setItem(key,JSON.stringify([...used,code]));}catch{azureAuth.error='無法保存備用碼使用紀錄，請改用驗證器。';render();return;}
  }else if(code!=='123456'){azureAuth.error='驗證碼不正確，Demo 請輸入 123456。';render();return;}
  azureAuth.error='';
  if(s==='email'){azureAuth.stage='setup';go('azure-setup');}
  else if(s==='setup'){azureAuth.verified=true;azureAuth.stage='backup';go('azure-backup');}
  else {azureAuth.verified=true;azureFinishAuth();}
 },
 'azure-auth-recovery':()=>{azureAuth.stage='recovery';azureAuth.error='';go('azure-recovery');},
 'azure-auth-otp':()=>{azureAuth.stage='otp';azureAuth.error='';go('azure-otp');},
 'azure-auth-cancel':()=>{Object.assign(azureAuth,{pending:null,stage:null,error:'',verified:false});go('login');},
 'azure-auth-finish':()=>{if(!$('#azure-backup-saved')?.checked){azureAuth.error='請先保存備用碼並勾選確認。';render();return;}azureFinishAuth();},
 'azure-backup-download':()=>{const url=URL.createObjectURL(new Blob(['Azure DEMO ONLY\n'+azureBackupCodes.join('\n')],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='Azure-Demo-backup-codes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
let azureOriginalLogin;
if(!AZURE_EXTERNAL){
 azureOriginalLogin=loginAs;
 loginAs=function(a){if(!a||a.status!=='已啟用')return azureOriginalLogin(a);BO.user=null;azureStartAuth(a);};
 actions['bo-register']=()=>{const n=$('#reg-name').value.trim(),email=$('#login-email').value.trim().toLowerCase(),p=$('#reg-password').value;
  if(!n||!/^\S+@\S+\.\S+$/.test(email)||p.length<8||!/[A-Za-z]/.test(p)||!/\d/.test(p)||p!==$('#reg-confirm').value||!$('#reg-terms').checked){BO.authError='請填妥資料、至少 8 位英數密碼、相同確認密碼及條款。';render();return;}
  if(accounts.some(a=>a.email.toLowerCase()===email)){BO.authError='示例帳號已存在。';render();return;}
  BO.loginEmail=email;BO.authError='';azureStartAuth({id:'ACC-'+Date.now(),name:n,email,role:roles[3],agency:'—',last:'—',permissions:rolePermissions(roles[3]),scope:'本人及獲指派的商戶'},true);
 };
 actions['security-settings']=()=>modal('登入安全設定','<p>本 Demo 已包含註冊電郵驗證、驗證器綁定、登入 OTP 與一次性備用碼演示。</p><div class="notice warn">純前端流程不提供正式安全防護；正式環境須由伺服器驗證 TOTP、管理憑證及限制重試。</div>');
}else{
 actions.verify=()=>{const code=$$('[data-otp]').map(i=>i.value).join('');if(Date.now()>state.otpExpires||code!=='123456'){state.otpError='驗證碼不正確或已過期，請重新發送。';render();return;}azureStartAuth({email:state.email},!!state.registerSeed);if(state.registerSeed){azureAuth.stage='setup';go('azure-setup');}};
}

/* Seven visible steps; retain existing stable six data-step IDs for legacy drafts/links. */
const azureStepLabels=['文件材料','KTC 認證','主體資料','經營與聯繫','結算帳戶','產品與費率','確認提交'];
const azureStepIds=['1','ktc','2','3','4','5','6'];
let ktcPending=null,ktcReview=false,ktcMobileStage='consent';
const ktcChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('azure-ktc-demo'):null;
const ktcValues=()=>state.values.__ktc||(state.values.__ktc={});
const ktcFingerprint=()=>JSON.stringify(['directors[0].name','directors[0].idcardNo','directors[0].birthDay'].map(k=>state.values[k]||'').concat(Object.entries(state.files).filter(([id])=>V2.documents.find(d=>d.id===id)?.name.match(/身[份分].*證/)).map(([id,f])=>[id,f.name,f.size])));
const ktcPassed=()=>ktcValues().passed===true&&ktcValues().fingerprint===ktcFingerprint();
function ktcImported(){return ['directors[0].name','directors[0].idcardNo'].every(key=>v2Model().ocr.some(o=>o.key===key&&o.applied&&String(o.value)===v2Raw(key)))&&Object.keys(state.files).some(id=>V2.documents.find(d=>d.id===id)?.name.match(/身[份分].*證/));}
const ktcCanSkip=()=>ktcImported()&&ktcValues().confirmed===ktcFingerprint();
function ktcGo(){go((AZURE_EXTERNAL?'form/':'application/')+'ktc');}
function ktcSteps(current){return `<nav class="${AZURE_EXTERNAL?'external-v2-steps':'stepper'}" aria-label="申請步驟">${azureStepIds.map((id,i)=>`<button type="button" class="step ${String(current)===id?'active':''}" data-action="${id==='ktc'?'ktc-open':'step'}" data-step="${id}" ${String(current)===id?'aria-current="step"':''}><span class="number">${i+1}</span>${azureStepLabels[i]}</button>`).join('')}</nav>`;}
function ktcRenderPanel(){
 const passed=ktcPassed(),skip=ktcCanSkip(),expired=ktcPending&&Date.now()>ktcPending.expires;
 let body='';
 if(ktcReview){body=`<h1>核對身分證資訊</h1><p>只有成功匯入且已核對的身分證資訊才可略過手機拍照。</p><div class="ktc-check"><dl><dt>姓名</dt><dd>${esc(v2Raw('directors[0].name')||'尚未導入')}</dd><dt>身分證號碼</dt><dd>${esc(v2Raw('directors[0].idcardNo')||'尚未導入')}</dd></dl></div><label class="check"><input id="ktc-id-confirm" type="checkbox" ${ktcImported()?'':'disabled'}>我已核對原始證件及以上欄位，確認正確</label><p class="hint">${ktcImported()?'確認後只需進行人像識別。':'尚未成功導入身分證姓名及號碼，請返回文件材料使用多文件辨識，或進行手機拍照示例。'}</p><div class="actions">${btn('返回 KTC','ktc-review-back')}${btn('確認資料正確','ktc-confirm-id','primary',ktcImported()?'':'disabled')}${btn('返回文件材料','step','','data-step="1"')}</div>`;}
 else if(ktcPending){const link=new URL('external.html',location.href);link.hash='/ktc-mobile/'+ktcPending.token+'/'+ktcPending.mode+'/'+ktcPending.expires;body=`<h1>${expired?'識別連結已過期':'使用手機完成 KTC 認證'}</h1><p>${skip?'身分證資訊已確認，只進行人像識別。':'手機拍照 — 身分證 → 核對資料 → 人像識別'}</p>${expired?'<div class="notice warn">請重新產生 QR Code。舊連結及回傳已失效。</div>':`<div class="azure-qr">${azureQR(link.href)}</div><p class="center">等待識別結果 · 連結有效 10 分鐘</p><a class="ktc-link" href="${esc(link.href)}" target="_blank" rel="noopener">開啟手機識別 Demo ↗</a><p class="hint">同一瀏覽器分頁可自動回傳；跨手機因沒有後端，完成後須輸入手機顯示的 Demo 回傳碼。</p><label for="ktc-return-code">手機 Demo 回傳碼</label><input id="ktc-return-code" inputmode="numeric" maxlength="6" placeholder="手機完成後顯示的 6 位數"><div class="actions">${btn('確認手機回傳碼','ktc-return')}</div>`}<div class="actions">${btn('重新產生 QR Code','ktc-start','primary')}${btn('取消識別','ktc-cancel')}${!expired?btn('模擬識別成功回傳','ktc-demo-success')+btn('模擬連結過期','ktc-expire'):''}</div>`;}
 else {body=`<h1>KTC 認證</h1><p>完成身分證資料核對及人像識別後，繼續填寫主體資料。</p><div class="notice ${passed?'success':skip?'':'warn'}"><strong>${passed?'識別成功（Demo）':skip?'身分證資訊已核對，只需人像識別':'需要手機拍照及人像識別'}</strong><p>${passed?'此狀態只代表已完成原型演示，不是正式身分認證。':skip?'已成功導入並確認身分證資訊，可跳過手機拍照。':'目前尚未有已成功導入、並經你確認的身分證資訊。'}</p></div><div class="ktc-check"><h2>1. 手機拍照 — 身分證</h2><p>${skip?'已核對，可跳過此步驟':'使用手機拍攝證件，核對辨識後的資料。'}</p></div><div class="ktc-check"><h2>2. 人像識別</h2><p>掃描 QR Code 開啟手機識別頁，依提示完成操作。</p></div><div class="actions">${btn(passed?'重新進行 KTC 認證':'開始 KTC 認證','ktc-start','primary')}${btn('查看／核對已導入身分證資訊','ktc-review')}</div>`;}
 return `<div class="ktc-layout"><section class="ktc-panel">${body}<p class="azure-demo-label">Demo：不連接身分驗證服務，不拍攝或上傳人像；請勿使用真實身分證。正式跨裝置回傳需接入服務端。</p><div class="actions">${btn('上一步','step','','data-step="1"')}${btn('儲存草稿',AZURE_EXTERNAL?'save':'save-draft')}${btn('下一步：主體資料','ktc-next','primary',passed?'':'disabled')}</div></section>${typeof v2RiskOverview==='function'?'<aside>'+v2RiskOverview()+'</aside>':''}</div>`;
}
function ktcReturnCode(token){let n=0;for(const c of token)n=(n*31+c.charCodeAt(0))%1000000;return String(n).padStart(6,'0');}
function ktcReceive(data){
 if(!ktcPending||data?.token!==ktcPending.token||data.status!=='success'||Date.now()>ktcPending.expires||ktcPending.fingerprint!==ktcFingerprint())return false;
 ktcValues().passed=true;ktcValues().fingerprint=ktcFingerprint();ktcValues().completedAt=new Date().toISOString();ktcValues().demo=true;ktcPending=null;render();
 modal('識別成功','<div class="notice success">已完成 KTC 認證示例</div><p>可以繼續下一步：主體資料。</p><p class="hint">此為 Demo 成功回傳，未執行真實身分／人像驗證。</p>',btn('繼續下一步','ktc-next','primary'));return true;
}
ktcChannel?.addEventListener('message',e=>ktcReceive(e.data));
window.addEventListener('storage',e=>{if(e.key==='azure-ktc-demo-result'){try{ktcReceive(JSON.parse(e.newValue));}catch{}}});
Object.assign(actions,{
 'ktc-open':()=>{ktcReview=false;ktcGo();},'ktc-review':()=>{ktcReview=true;render();},'ktc-review-back':()=>{ktcReview=false;render();},
 'ktc-confirm-id':()=>{if(!ktcImported()||!$('#ktc-id-confirm')?.checked)return toast('請核對資料並勾選確認');ktcValues().confirmed=ktcFingerprint();ktcReview=false;render();},
 'ktc-start':()=>{ktcPending={token:crypto.randomUUID(),mode:ktcCanSkip()?'face':'full',expires:Date.now()+600000,fingerprint:ktcFingerprint()};ktcValues().passed=false;ktcReview=false;render();},
 'ktc-cancel':()=>{ktcPending=null;render();},'ktc-expire':()=>{if(ktcPending)ktcPending.expires=Date.now()-1;render();},
 'ktc-demo-success':()=>{if(!ktcReceive({token:ktcPending?.token,status:'success'}))toast('識別連結已失效，請重新開始');},
 'ktc-return':()=>{if($('#ktc-return-code')?.value!==ktcReturnCode(ktcPending?.token||''))return toast('回傳碼不正確');actions['ktc-demo-success']();},
 'ktc-next':()=>{if(!ktcPassed())return toast('請先完成 KTC 認證');$('#modal').close();go('application/2');}
});
// Mobile HTML has no biometric implementation: exercise consent, photo/review, face, failure and callback states.
function ktcMobile(){
 const parts=location.hash.slice(2).split('/'),token=parts[1],mode=parts[2],expires=+parts[3];
 const valid=/^[a-f0-9-]{36}$/.test(token||'')&&['full','face'].includes(mode)&&expires>Date.now()&&expires<Date.now()+660000;
 const logo=AZURE_EXTERNAL?ASSETS['azure-logo.png']:'azure-logo.png';let body='';
 const face='<div class="ktc-photo" style="height:310px"><div style="width:164px;height:210px;border:2px solid #3973f4;border-radius:50%"></div></div>';
 if(!valid)body='<h1>識別連結已過期或無效</h1><p>請返回電腦頁面，重新產生 QR Code。</p>';
 else if(ktcMobileStage==='consent')body='<h1>KTC 認證</h1><p>'+ (mode==='face'?'身分證資訊已核對，只需完成人像識別。':'手機拍照 — 身分證 → 核對資料 → 人像識別。')+'</p><div class="notice warn">這是操作原型。不會啟動相機、不會收集證件或人像。</div><label class="check"><input type="checkbox" id="ktc-consent">我了解並同意進行 Demo 演示</label>'+btn('開始認證','ktc-mobile-start','primary');
 else if(ktcMobileStage==='photo')body='<h1>手機拍照 — 身分證</h1><p>請將完整證件四角置於框內，確保光線均勻。</p><div class="ktc-photo">身分證相機預覽（示意）</div>'+btn('使用示例照片','ktc-mobile-photo','primary');
 else if(ktcMobileStage==='review')body='<h1>核對身分證資訊</h1><div class="ktc-check"><p>姓名：DEMO USER</p><p>證件號碼：DEMO-ID-001</p><small>純示例，不會覆寫目前申請人的真實欄位。</small></div><label class="check"><input type="checkbox" id="ktc-mobile-confirm">已核對示例辨識資料</label>'+btn('確認並繼續','ktc-mobile-face','primary')+btn('重新拍照','ktc-mobile-retake');
 else if(ktcMobileStage==='face')body='<h1>人像識別</h1><p>請正視鏡頭，將臉部保持在框內，依画面提示完成動作。</p>'+face+btn('完成人像識別（Demo）','ktc-mobile-success','primary')+btn('預覽無法識別','ktc-mobile-failure');
 else if(ktcMobileStage==='failed')body='<h1>暫時無法識別</h1><p>請移除遮擋、保持光線充足後重試。</p>'+btn('重新進行人像識別','ktc-mobile-retry','primary');
 else body='<h1 class="ktc-success">識別成功（Demo）</h1><p>已發出示例回傳。同一瀏覽器的電腦分頁會自動顯示成功。</p><div class="ktc-check"><h2>跨手機 Demo 回傳碼</h2><strong style="font-size:28px">'+ktcReturnCode(token)+'</strong></div><p>使用另一部手機時，請在電腦輸入此碼以完成模擬回傳。</p>';
 $('#app').innerHTML='<main class="ktc-mobile"><a class="brand" href="#/login"><img src="'+logo+'" alt="Azure"></a><small>安全身分認證 · KTC · Demo</small>'+body+'<p class="azure-demo-label">僅供功能演示，不代表通過正式身分認證。</p></main>';
}
Object.assign(actions,{
 'ktc-mobile-start':()=>{if(!$('#ktc-consent')?.checked)return toast('請先確認 Demo 說明');ktcMobileStage=location.hash.split('/')[3]==='face'?'face':'photo';render();},
 'ktc-mobile-photo':()=>{ktcMobileStage='review';render();},'ktc-mobile-retake':()=>{ktcMobileStage='photo';render();},
 'ktc-mobile-face':()=>{if(!$('#ktc-mobile-confirm')?.checked)return toast('請先核對示例資料');ktcMobileStage='face';render();},
 'ktc-mobile-failure':()=>{ktcMobileStage='failed';render();},'ktc-mobile-retry':()=>{ktcMobileStage='face';render();},
 'ktc-mobile-success':()=>{if(ktcMobileStage!=='face')return;const parts=location.hash.slice(2).split('/');if(+parts[3]<Date.now())return render();const data={token:parts[1],status:'success'};ktcChannel?.postMessage(data);try{localStorage.setItem('azure-ktc-demo-result',JSON.stringify(data));localStorage.removeItem('azure-ktc-demo-result');}catch{}ktcMobileStage='success';render();}
});
const azureNext=actions.next,azurePrevious=actions.previous,azureStep=actions.step;
actions.next=()=>{if(route().step===1){ktcGo();return;}azureNext();};
if(!AZURE_EXTERNAL)actions.previous=()=>route().step===2?ktcGo():azurePrevious();
const azureSubmit=actions.submit,azureConfirmSubmit=actions['confirm-submit'];
for(const [key,fn] of [['submit',azureSubmit],['confirm-submit',azureConfirmSubmit]])actions[key]=el=>{if(!ktcPassed()){modal('請先完成 KTC 認證','<p>完成身分證核對及人像識別示例後，才可提交申請。</p>',btn('前往 KTC 認證','ktc-open','primary'));return;}fn(el);};
Object.assign(window.AllinPayDemo,{getKTC:()=>({passed:ktcPassed(),canSkipPhoto:ktcCanSkip(),imported:ktcImported(),importedFields:(v2Model().ocr||[]).filter(o=>o.applied&&String(o.value)===v2Raw(o.key)).map(o=>o.key),pending:!!ktcPending,demo:true})});

const azureIsKTC=()=>/^#\/(application|form)\/ktc$/.test(location.hash);
const azureLanguageSelect=()=>'<select class="azure-language" aria-label="語言" data-azure-language><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option><option value="en">English</option></select>';
if(!AZURE_EXTERNAL){
 const baseOverview=v2RiskOverview;
 v2RiskOverview=function(){return (route().page==='application'&&route().step===1&&!azureIsKTC()?invitation():'')+baseOverview();};
}
function azureAfterRender(){
 document.title=AZURE_EXTERNAL?'Azure · 商戶申請 Demo':'Azure · 後台管理 Demo';
 document.documentElement.dataset.release='2026.10.09-azure-otp-ktc';
 const ktc=azureIsKTC(),r=route(),form=r.page==='application';
 if(form&&(AZURE_EXTERNAL?state.session:BO.user)){
  const nav=$(AZURE_EXTERNAL?'.external-v2-steps':'.stepper');if(nav)nav.outerHTML=ktcSteps(ktc?'ktc':r.step);
  if(!AZURE_EXTERNAL){$$('.agency-invitation').forEach(n=>{if(!n.closest('#v2-application-status'))n.remove();});}
  if(ktc){
   if(AZURE_EXTERNAL){$('.external-v2 .v2-form')?.remove();$('.external-v2 .form-actions')?.remove();$('.external-v2')?.insertAdjacentHTML('beforeend',ktcRenderPanel());}
   else{$('.form-content').innerHTML=ktcRenderPanel();$('.footer')?.remove();}
  }else{
   const title=$('.v2-version');if(title)title.textContent='Azure · 七步申請流程';
   const summary=$('.footer .actions .hint');if(summary)summary.textContent='Step '+(r.step===1?1:r.step+1)+'／7';
   if(AZURE_EXTERNAL&&r.step===2){const b=$('.form-actions [data-step="1"]');if(b)b.dataset.action='ktc-open';}
   if(r.step===6){const review=$('.v2-form');review?.insertAdjacentHTML('afterbegin','<div class="notice '+(ktcPassed()?'success':'warn')+'">KTC 認證：'+(ktcPassed()?'已完成（Demo）':'尚未完成')+' '+btn('查看 KTC','ktc-open')+'</div>');}
  }
 }
 $$('.brand').forEach(n=>{n.setAttribute('aria-label','Azure');n.querySelector('img')?.setAttribute('alt','Azure');});
 const sidebarBottom=$('.sidebar-bottom');if(sidebarBottom&&!sidebarBottom.querySelector('[data-azure-language]')){
  [...sidebarBottom.children].find(c=>c.textContent.trim()==='繁體中文')?.remove();sidebarBottom.insertAdjacentHTML('afterbegin',azureLanguageSelect());
 }
 const login=$('.login-wrap');if(login&&!login.querySelector('[data-azure-language]'))login.insertAdjacentHTML('afterbegin',azureLanguageSelect());
 $$('.auth-top select,.header-actions>select').forEach(n=>{if(!n.dataset.azureLanguage)n.outerHTML=azureLanguageSelect();});
 azureLocalize();
}
const azureRender=render;
render=function(){
 if(location.hash.startsWith('#/ktc-mobile/')){ktcMobile();azureLocalize();return;}
 if(location.hash.startsWith('#/azure-')){azureShowAuth();azureAfterRender();return;}
 azureRender();azureAfterRender();
};
const azureModal=modal;
modal=function(...args){azureModal(...args);azureLocalize($('#modal'));};
// Localisation changes presentation only. Inputs, option values, customer records and draft keys stay original.
let azureLocale='zh-Hant';try{azureLocale=localStorage.getItem('azure-demo-language')||'zh-Hant';}catch{}
if(!['zh-Hant','zh-Hans','en'].includes(azureLocale))azureLocale='zh-Hant';
const azureToSimplified=OpenCC.Converter({from:'tw',to:'cn'});
const azureTextCache=new WeakMap();
for(const f of v2Fields){const parts=f.label.split(/\s{2,}/);if(parts[1])AZURE_EN[parts[0].replace('*','').trim()]=parts.slice(1).join(' ').trim();}
function azureTranslate(text,migrateSteps=false){
 let t=text.replace('六步申請流程','七步申請流程').replace('六個步驟','七個步驟');
 if(migrateSteps)t=t.replace(/Step ([2-6])(?!\d)/g,(_,s)=>'Step '+(+s+1));
 if(azureLocale==='zh-Hans')return azureToSimplified(t);
 if(azureLocale!=='en')return t;
 if(AZURE_EN[t.trim()])return t.replace(t.trim(),AZURE_EN[t.trim()]);
 const english=t.match(/^\s*[^a-zA-Z]*?\s{2,}([A-Za-z][\s\S]*)$/);if(english)return english[1];
 return t;
}
function azureLocalize(root=document.body){
 document.documentElement.lang=azureLocale;
 $$('[data-azure-language]').forEach(el=>el.value=azureLocale);
 let preview=$('#azure-locale-preview');if(azureLocale==='en'&&!preview){preview=document.createElement('div');preview.id='azure-locale-preview';preview.className='azure-locale-preview';preview.textContent='English UI preview: some detailed guidance remains in Chinese. Customer records stay in their original language.';document.body.append(preview);}else if(azureLocale!=='en')preview?.remove();
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const n of nodes){const p=n.parentElement;if(!p||p.closest('script,style,textarea,input,svg,[data-azure-language],.batch-text,dd,td,.file-state'))continue;
  if(!n.textContent.trim())continue;
  if(p.tagName==='OPTION'&&!p.hasAttribute('value'))p.value=p.textContent;
  const old=azureTextCache.get(n),original=old&&n.textContent===old.result?old.original:n.textContent,result=azureTranslate(original,!p.closest('.footer,.ktc-panel,.ktc-mobile,.azure-auth-card,.external-v2-steps,.stepper'));
  azureTextCache.set(n,{original,result});if(n.textContent!==result)n.textContent=result;
 }
 root.querySelectorAll?.('input[placeholder],textarea[placeholder]').forEach(el=>{el.dataset.azurePlaceholder??=el.placeholder;el.placeholder=azureTranslate(el.dataset.azurePlaceholder);});
}
document.addEventListener('change',e=>{if(e.target.hasAttribute('data-azure-language')){azureLocale=e.target.value;try{localStorage.setItem('azure-demo-language',azureLocale);}catch{}azureLocalize();}});
new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))azureLocalize();}).observe(document.body,{childList:true,subtree:true});
setInterval(()=>{if(ktcPending&&Date.now()>ktcPending.expires&&!ktcPending.expiredRendered){ktcPending.expiredRendered=true;if(azureIsKTC())render();}},1000);
Object.assign(window.AllinPayDemo,{version:'2026.10.09-azure-otp-ktc',getRelease:()=>({version:'2026.10.09-azure-otp-ktc',steps:azureStepLabels,locale:azureLocale,otp:'simulated',ktc:'simulated',crossDeviceCallback:'manual-demo-code',ocr:'browser-local'})});

render();
})();