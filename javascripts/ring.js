var CR = Em.Application.create({
  MAX_TOKEN: (new BigNumber(2)).pow(127),
  max_token_f: function() {
    return this.get('MAX_TOKEN').intPart() * 1;
  }.property('MAX_TOKEN'),
  calculateBalancedTokens: function(token_count) {
    var tokens = [];
    for (var i = 0; i < token_count; i++) {
      var full_token = this.MAX_TOKEN.multiply(i).divide(token_count);
      tokens.push(full_token.intPart().toString());
    }
    return tokens;
  },
  floatTokenToString: function(token) {
    token = token + '';
    var match = token.match(/([0-9.]+)e[-+]?([0-9]+)/);
    if (match) {
      var parts = match[1].split('.');
      token = parts.join('');
      var zeros = match[2] * 1;
      zeros = zeros - parts[1].length;
      while (zeros > 0) {
        token = token + '' + '0';
        zeros--;
      }
    }
    return token;
  }
});

CR.Node = Em.Object.extend({
  token: null,
  color: 'blue',
  percentage: 0,
  delete: function() {
    this.set('token', null);
    return false;
  },
  prettyPercentage: function() {
    var p = Math.round(100 * this.get('percentage')) + '';
    if (p.length == 1) {
      p = '0' + p;
    }
    return p;
  }.property('percentage'),
  setTokenPercent: function(percent) {
    var max_token = CR.get('MAX_TOKEN');
    var big_percent = new BigNumber(percent);
    this.set('token', big_percent.multiply(max_token).intPart().toString());
  }
});

CR.Ring = Em.ArrayProxy.extend({
  selected: null,
  init: function() {
    this._super();
    this.set('content', []);
  },
  addBalancedNodes: function(count) {
    var tokens = CR.calculateBalancedTokens(count);
    var self = this;
    $.each(tokens, function(i, token) {
      var node = CR.Node.create({token: token});
      self.pushObject(node);
    });
  },
  updateHues: function() {
    var delta = 360 / this.get('length');
    this.forEach(function(node, i) {
      var hue = (i+1) * delta;
      node.set('color', Raphael.hsl(hue, 50, 50));
    });
  }.observes('@each'),
  deleteRing: function() {
    CR.get('ringController').removeObject(this);
  },
  addToken: function() {
    var tokens = this.map(function(n) { return [n.get('percentage'), n]; });
    tokens.sort(function (a,b) {
      return b[0] - a[0];
    });

    var max_token = CR.get('MAX_TOKEN');

    var offset = max_token.multiply(new BigNumber(tokens[0][0])).divide(new BigNumber(2));

    var new_token = new BigNumber(tokens[0][1].get('token')).subtract(offset);
    if (new_token < 0) {
      new_token = max_token.add(new_token);
    }
    var node = CR.Node.create({token: new_token.intPart().toString()});
    this.pushObject(node);
  },
  rebalance: function() {
    var new_tokens = CR.calculateBalancedTokens(this.get('length'));
    this.forEach(function (node) {
      node.set('token', new_tokens.shift());
    });
  },
  tokenChanged: function() {
    var null_items = this.filterProperty('token', null);
    this.removeObjects(null_items);

    if (this.get('length') === 0) {
      this.deleteRing();
      return;
    }

    var tokens = this.map(function(item) {
      return [item, item.get('token') * 1];
    });

    if (tokens.length == 1) {
      tokens[0][0].set('percentage', 1);
    } else if (tokens.length > 1) {
      tokens.sort(function(a,b) {
        return a[1] - b[1];
      });

      var max_token = CR.get('max_token_f');
      for (var i = tokens.length -1; i > 0; i--) {
        var token_node = tokens[i][0];
        var token = tokens[i][1];
        var next = tokens[i-1][1];
        var percent = (token - next) / max_token;
        token_node.set('percentage', percent);
      }

      var token_node = tokens[0][0];
      var token = tokens[0][1];
      var distance = token;
      distance = distance + (max_token - tokens[tokens.length-1][1]);
      var percent = distance / max_token;

      token_node.set('percentage', percent);
    }
  }.observes('@each.token')
});

CR.set('ringController', Em.ArrayProxy.create({
  content: [],
  nodeCount: 3,
  load: function() {
    var params = location.href;
    var rings = {};
    var self = this;
    params.replace(/([^?#=&]+)=([^#=&]+)&?/g, function(m, ringid, tokens) {
      var ring = CR.Ring.create();
      $.each(tokens.split(','), function(i, token) {
        var node = CR.Node.create({token: token});
        ring.pushObject(node);
      });
      self.pushObject(ring);
    });
    if (this.get('length') == 0) {
      console.log('newRing');
      this.newRing();
    }
  },
  newRing: function() {
    var ring = CR.Ring.create();
    ring.addBalancedNodes(this.get('nodeCount'));
    this.unshiftObject(ring);
  },
  importRing: function(tokens) {
    var ring = CR.Ring.create();
    var self = this;
    $.each(tokens, function(i, token) {
      var node = CR.Node.create({token: token});
      ring.pushObject(node);
    });
    this.unshiftObject(ring);
  },
  importRingDialog: function() {
    var view = CR.ImportView.create();
    view.append();
  }
}));

CR.ImportView = Em.View.extend({
  templateName: 'import',
  nodetoolOutput: null,
  tokens: Em.A(),
  close: function() {
    this.remove();
  },
  import: function() {
    var tokens = this.get('tokens');
    CR.get('ringController').importRing(tokens);
    this.remove();
  },
  parseTokens: function() {
    var output = this.get('nodetoolOutput') ;
    var lines = output.split("\n");
    var tokens = [];
    $.each(lines, function(i, line) {
      var match = line.match(/%\s+(\d+)\s*$/);
      if (match) {
        tokens.push(match[1]);
      }
    });
    this.set('tokens', tokens);
  }.observes('nodetoolOutput'),
  modalBackDrop: Em.View.extend({
    classNames: ['modal-backdrop', 'fade', 'in'],
    mouseDown: function() {
      this.get('parentView').close();
    }
  })
});

CR.TokenInfoView = Em.View.extend({
  selectedNode: null,
  node: null,
  classNames: ['token-info'],
  classNameBindings: ['selected'],
  selected: function() {
    return this.get('node') == this.get('selectedNode');
  }.property('node', 'selectedNode'),
  mouseDown: function() {
    this.setPath('selectedNode', this.get('node'));
  }
});

CR.NodeView = Em.View.extend({
  raphael_node: null,
  raphael_arc: null,
  parent: function() {
    return this.nearestInstanceOf(CR.RingView);
  }.property().cacheable(),
  moveNode: function() {
    var old = this.get('raphael_node');
    if (old) {
      old.remove();
      this.get('raphael_arc').remove();
    }

    var max_token = CR.get('max_token_f');
    var node = this.get('content');
    var token = node.get('token');

    if (token === null) {
      return;
    }

    var tokenf = token * 1;
    var deg = tokenf * 360 / max_token;
    var rad = Raphael.rad(deg);

    var parent = this.get('parent');
    var radius = parent.get('radius');
    var ring_x = parent.get('ring_x');
    var ring_y = parent.get('ring_y');

    var offset_left = parent.get('offset_left');
    var offset_top = parent.get('offset_top');

    var x = ring_x + radius * Math.sin(rad);
    var y = ring_y + -1 * radius * Math.cos(rad);

    var color = node.get('color');

    var node_attrs = {
      fill: color,
      stroke: "#000",
      "stroke-width": 2,
      "stroke-opacity": 0.5,
      cursor: "pointer"
    };

    if (this.getPath('parent.ring.selected') == node) {
      node_attrs['stroke'] = 'blue';
      node_attrs['stroke-opacity'] = 1;
      node_attrs['stroke-width'] = 2;
    }

    var raphael_node = parent.get('paper').circle(x, y, 20).attr(node_attrs);

    var percentage = node.get('percentage');
    if (percentage == 1) {
      //make drawing a full circle work without drawing a true full circle
      percentage = 0.99;
    }
    var prev = tokenf - (percentage * max_token);

    var pdeg = prev * 360 / max_token;
    var prad = Raphael.rad(pdeg);

    var px = ring_x + radius * Math.sin(prad);
    var py = ring_y + -1 * radius * Math.cos(prad);

    var large_arc = percentage > 0.5 ? 1 : 0;

    var path = 'M' + px +' ' + py + ' A 200 200 0 ' + large_arc + ' 1 ' + x + ' ' + y;

    var raphael_arc = parent.get('paper').path(path).attr({
      stroke: color,
      "stroke-width": 4
    }).toBack();

    raphael_node.click(function() {
      parent.get('ring').set('selected', node);
    });

    raphael_node.mousedown(function() {
      parent.get('ring').set('selected', node);
      var move_handler = function(e) {
        var x = e.pageX - offset_left;
        var y = e.pageY - offset_top;

        var angle = (Raphael.angle(250, 250, x, y) + 270) % 360;
        node.setTokenPercent(angle / 360);
      };
      var up_handler = function() {
        $(document.body).unbind('mousemove', move_handler);
        $(document.body).unbind('mouseup', up_handler);
      };
      $(document.body).bind('mouseup', up_handler);
      $(document.body).bind('mousemove', move_handler);
    });

    this.set('raphael_node', raphael_node);
    this.set('raphael_arc', raphael_arc);
  },
  nodeTokenChanged: function() {
    this.moveNode();
  }.observes('content.token', 'content.color', 'content.percentage'),
  nodeSelectedChanged: function() {
    var node = this.get('content');
    if (this.getPath('parent.ring.selected') == node) {
      this.get('raphael_node').attr({
        stroke: "blue",
        "stroke-opacity": 1,
        "stroke-width": 2
      });
    } else {
      this.get('raphael_node').attr({
        stroke: "#000",
        "stroke-opacity": 0.5,
        "stroke-width": 2
      });
    }
  }.observes('parent.ring.selected'),
  didInsertElement: function() {
    this.moveNode();
  }
});

CR.TokenTextField = Em.TextField.extend({
  token: null,
  value: function(key, val) {
    if (val !== undefined) {
      console.log('val', key, val);
      this.set('token', (''+val).replace(/[^0-9]/g, ''));
    }
    return this.get('token');
  }.property('token').cacheable()
});

CR.RingView = Em.View.extend({
  ring: null,
  paper: null,
  ring_x: 250,
  ring_y: 250,
  radius: 200,
  offset_left: null,
  offset_top: null,
  didInsertElement: function() {
    var width = 500;
    var height = 500;

    this.set('offset_left', this.$().offset().left);
    this.set('offset_top', this.$().offset().top);
    this.set('paper', Raphael(this.$().attr('id'), width, height));
  }
});

CR.RangeView = Ember.View.extend({
  tagName: 'input',
  type: 'range',
  attributeBindings: ['type', 'min', 'max', 'value'],

  min: null,
  max: null,
  value: null,

  change: function() {
    this.set('value', this.$().prop('value'));
  }
});

CR.TokenSliderView = CR.RangeView.extend({
  token: null,
  min: 0,
  max: 10000,
  _value: null,
  value: function(key, val) {
    if (val !== undefined) {
      var percent = val / this.get('max');
      var max_token = CR.get('MAX_TOKEN');

      var token = max_token.multiply(new BigNumber(percent)).intPart().toString();
      this.set('token', token);
    }
    var max_token = CR.get('max_token_f');
    return this.get('max') * (this.get('token') /  max_token);
  }.property('token', '_value').cacheable()
});

CR.ColorIndicator = Em.View.extend({
  color: null,
  tagName: '',
  style: function() {
    return "background-color: " + this.get('color') + ";";
  }.property('color'),
  defaultTemplate: function() {
    return Ember.Handlebars.compile('<div class=color-indicator {{bindAttr style="view.style"}}></div>');
  }.property().cacheable()
});

if (!Modernizr.inputtypes.range) {
  $('body').toggleClass('no-range');
}

$(document).ready(function() {
  CR.ringController.load();
});
