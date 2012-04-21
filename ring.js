(function () {
  var paper = Raphael("canvas", 640, 480);

  var radius = 200;
  var ring_x = 320;
  var ring_y = 240;

  paper.circle(ring_x, ring_y, radius).attr({fill: "#223fa3", stroke: "#000", "stroke-width": 2, "stroke-opacity": 0.5});

  var big_two = new BigNumber(2);
  var max_token_full = big_two.pow(127);
  var max_token = Math.pow(2,127);
  var token_count = 3;
  var offset = 0;

  var arrow_len = 12;
  var arrow_width = 3;

  var ax = ring_x + radius;
  var ay = ring_y;
  var lx = ring_x + radius + arrow_len;
  var ly = ring_y + arrow_len;
  var arrow_attrs = {"stroke-width": arrow_width};
  paper.path('M' + ax + ' ' + ay + ' L' + lx + ' ' + ly).attr(arrow_attrs);

  lx = ring_x + radius - arrow_len;
  paper.path('M' + ax + ' ' + ay + ' L' + lx + ' ' + ly).attr(arrow_attrs);

  ax = ring_x - radius;
  lx = ring_x - radius - arrow_len;
  ly = ring_y - arrow_len;
  paper.path('M' + ax + ' ' + ay + ' L' + lx + ' ' + ly).attr(arrow_attrs);

  lx = ring_x - radius + arrow_len;
  paper.path('M' + ax + ' ' + ay + ' L' + lx + ' ' + ly).attr(arrow_attrs);


  var draw_tokens = function(tokens, color) {
    tokens.forEach(function(token) {
      var tokenf = token * 1;

      var deg = tokenf * 360 / max_token;
      var rad = Raphael.rad(deg);

      var x = ring_x + radius * Math.sin(rad);
      var y = ring_y + -1 * radius * Math.cos(rad);
      paper.circle(x, y, 20).attr({fill: color, stroke: "#000", "stroke-width": 2, "stroke-opacity": 0.5, "opacity": 0.7});
      paper.text(x, y, token);
    });
  };

  var calc_tokens = [];
  for (var i = 0; i < token_count; i++) {
    var full_token = max_token_full.multiply(i).divide(token_count);
    calc_tokens.push(full_token.intPart().toString());
  }
  draw_tokens(calc_tokens, 'green');

  var current_tokens = ['0', '56713727820156410577229101238628035242', '104589014539464777373489146682422959125'];
  draw_tokens(current_tokens, 'red');

}());
