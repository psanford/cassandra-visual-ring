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
  }
});

CR.Node = Em.Object.extend({
  token: null,
  percentage: 0,
  delete: function() {
    this.set('token', null);
  },
  prettyPercentage: function() {
    var p = Math.round(100 * this.get('percentage')) + '';
    if (p.length == 1) {
      p = '0' + p;
    }
    return p;
  }.property('percentage')
});

CR.Ring = Em.ArrayProxy.extend({
  selected: null,
  addBalancedNodes: function(count) {
    var tokens = CR.calculateBalancedTokens(count);
    var self = this;
    $.each(tokens, function(i, token) {
      var node = CR.Node.create({token: token});
      self.pushObject(node);
    });
  },
  deleteRing: function() {
    CR.get('ringController').removeObject(this);
  },
  addToken: function() {
    var i = this.get('firstObject').get('token');
    i++;
    while (this.some(function(item) { return item.get('token') == i;})) {
      i++;
    }
    this.pushObject(CR.Node.create({token: i}));
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
    if (tokens.length > 1) {
      tokens.sort(function(a,b) {
        return b[1] < a[1];
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
  newRing: function() {
    var ring = CR.Ring.create({content: []});
    ring.addBalancedNodes(this.get('nodeCount'));
    this.pushObject(ring);
  }
}));

CR.TokenInfoView = Em.View.extend({
  classNames: ['token-info'],
  classNameBindings: ['selected'],
  selected: function() {
    return this.get('content') == this.getPath('parentView.content.selected');
  }.property('parentView.content.selected'),
  mouseDown: function() {
    this.setPath('parentView.content.selected', this.get('content'));
  }
});

CR.NodeView = Em.View.extend({
  raphael_object: null,
  color: 'green',
  parent: function() {
    return this.nearestInstanceOf(CR.RingView);
  }.property().cacheable(),
  moveNode: function() {
    var max_token = CR.get('max_token_f');
    var node = this.get('content');
    var token = node.get('token');

    var tokenf = token * 1;
    var deg = tokenf * 360 / max_token;
    var rad = Raphael.rad(deg);

    var parent = this.get('parent');
    var radius = parent.get('radius');
    var ring_x = parent.get('ring_x');
    var ring_y = parent.get('ring_y');

    var x = ring_x + radius * Math.sin(rad);
    var y = ring_y + -1 * radius * Math.cos(rad);

    var old = this.get('raphael_object');
    if (old) {
      old.remove();
    }
    var raphael_object = parent.get('paper').circle(x, y, 20).attr({
      fill: this.get('color'),
      stroke: "#000",
      "stroke-width": 2,
      "stroke-opacity": 0.5,
      "opacity": 0.7
    });
    raphael_object.click(function() {
      parent.get('ring').set('selected', node);
    });
    this.set('raphael_object', raphael_object);
  },
  nodeTokenChanged: function() {
    this.moveNode();
  }.observes('content.token'),
  nodeSelectedChanged: function() {
    var node = this.get('content');
    if (this.getPath('parent.ring.selected') == node) {
      this.get('raphael_object').attr({
        stroke: "blue",
        "stroke-opacity": 1,
        "stroke-width": 2
      });
    } else {
      this.get('raphael_object').attr({
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

CR.RingView = Em.View.extend({
  ring: null,
  paper: null,
  ring_x: 250,
  ring_y: 250,
  radius: 200,
  didInsertElement: function() {
    var width = 500;
    var height = 500;
    this.set('paper', Raphael(this.$().attr('id'), width, height));

    var radius = this.get('radius');
    var ring_x = this.get('ring_x');
    var ring_y = this.get('ring_y');

    this.get('paper').circle(ring_x, ring_y, radius).attr({stroke: "#223fa3", "stroke-width": 4});
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
  min: 0,
  maxBinding: 'CR.max_token_f',
  change: function() {
    var val = this.$().prop('value');
    var match = val.match(/([0-9.]+)e[-+]?([0-9]+)/);
    if (match) {
      var parts = match[1].split('.');
      val = parts.join('');
      var zeros = match[2] * 1;
      zeros = zeros - parts[1].length;
      while (zeros > 0) {
        val = val + '' + '0';
        zeros--;
      }
    }
    this.set('value', val);
  }
});
