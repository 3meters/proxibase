
function genId(schemaId, timeUTC) {

  assert(parseInt(schemaId) >= 0 && timeUTC, "Invalid call to genId");

  // pad a number to a fixed-lengh string with leading zeros
  function pad(number, digits) {
    var s = number.toString();
    assert(s.indexOf('-') < 0 && s.indexOf('.') < 0 && s.length <= digits, "Invalid id seed: " + s);
    for (var i = digits - s.length, zeros = ''; i--;) {
      zeros += '0';
    }
    return zeros + s;
  }

  // schemaId, integer 0-9999
  var schema = pad(schemaId, 4);

  // UTC date, YYMMDD
  var nowUTC = new Date(timeUTC);
  // log('now', now.getTime());
  // log('nowUTC', nowUTC.getTime());
  var year = pad((nowUTC.getFullYear() - 2000), 2);  // start from 2000
  var month = pad((nowUTC.getMonth() + 1), 2); // read Jan as 01, not 00
  var day = pad((nowUTC.getDate()), 2);
  var dateUTC = year + month + day; 

  // seconds since midnight today, UTC
  var midnightUTC = new Date(nowUTC.getFullYear(), nowUTC.getMonth(), nowUTC.getDate());
  var secondsUTC = pad(Math.floor((nowUTC.getTime() - midnightUTC.getTime()) / 1000), 5); // max 86400

  var millisecs = pad((nowUTC.getMilliseconds()), 3);
  var rand = pad((Math.floor(Math.random() * 1000000)), 6)

  var id = [schema, dateUTC, secondsUTC, millisecs, rand].join('.');
  // log('_id', id);
  return id;
}

// returns milliseconds from 1/1/1970 preadjusted to UTC
var getTimeUTC = function() {
  var now = new Date();
  var nowUTC = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  return nowUTC.getTime();
}
