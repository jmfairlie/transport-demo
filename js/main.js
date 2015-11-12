var map;
var items = {};
var filtered;
var markers = [];
var infoWindow;
var prevCenter;
var selectedStop;
//map loader gif
var $gif;
var alllines = {};
var stops = {};
//ajax timeout
var maxtimeout = 10000;
var model;
var listPanel, stopInfoPanel;
var button;
var oldw, oldh;
var isTouchDevice;
var cors_proxy = "https://crossorigin.me/";

$(document).ready(function() {
    isTouchDevice = Modernizr.touch;
//create the html nodes associated to the map loading gif
    $gif  =$("<div>").addClass("overlay").appendTo("#static");
//create sliding panels
    listPanel = new slidingPanel("#listblock", false, "shadowDown reddish semitransparent", "#static", false);
    stopInfoPanel = new slidingPanel("#stop-details", true, "shadowUp blueish semitransparent", "#static", true);
    button = new fullscreenButton("#static", function(fullscreen) {
        if(fullscreen) {
            $("#header").hide();
            $("#static").height("100%");
        }
        else {
            $("#header").show();
            $("#static").height("90%");
        }
        $(window).trigger('resize');
    });
    oldw = $("#static").width();
    oldh = $("#static").height();

});

$(window).resize(function(ev) {
    neww = $("#static").width();
    newh = $("#static").height();
    if(newh != oldh || neww != oldw) {
        listPanel.resize();
        stopInfoPanel.resize();
        button.resize();
        oldw = neww;
        oldh = newh;
    }
});

/* toggle fullscreen mode, specially useful on mobile*/
var fullscreenButton = function(container, callback) {
    this.callback = callback;
    this.fullscreen = false;
    this.span = $("<span>").addClass("glyphicon glyphicon-resize-full");
    this.button = $("<div>").addClass("fullscreenbutton shadowDown").append(this.span).appendTo(container);
    this.container = $(container);
    this.resize();
    var self = this;
    this.button.click(function() {
        self.toggle();
    });

    if(!isTouchDevice) {
        this.button.mouseover(function() {
            self.span.stop(true, false);
            self.span.animate({'font-size': self.dimension*2/3}, 'fast');
            self.span.css({'text-shadow': '0 0 20px #fffa98'});

        });

        this.button.mouseout(function() {
            self.span.stop(true, false);
            self.span.animate({'font-size': self.dimension*2/4}, 'fast');
            self.span.css({'text-shadow': 'none'});
        });
    }
    else {
        this.span.css({'text-shadow': '0 0 20px #fffa98'});
    }
};

fullscreenButton.prototype.resize = function() {

    this.dimension = this.container.height()/10;

    this.span.css('font-size', this.dimension*2/4);
    this.span.css('line-height', this.dimension + "px");

    this.button.offset({
        top: this.container.offset().top + this.dimension*1.5,
        left: this.container.offset().left + this.dimension*0.5
    });

    this.button.height(this.dimension);
    this.button.width(this.dimension);
};

fullscreenButton.prototype.toggle = function() {
    if(this.fullscreen) {
        this.span.removeClass('glyphicon-resize-small');
        this.span.addClass('glyphicon-resize-full');
    } else {
        this.span.removeClass('glyphicon-resize-full');
        this.span.addClass('glyphicon-resize-small');
    }

    this.fullscreen = !this.fullscreen;
    //this.resize();
    this.toggleFullScreen();
    this.callback(this.fullscreen);
};

fullscreenButton.prototype.toggleFullScreen = function() {
  if ((document.fullScreenElement && document.fullScreenElement !== null) ||
   (!document.mozFullScreen && !document.webkitIsFullScreen)) {
    if (document.documentElement.requestFullScreen) {
      document.documentElement.requestFullScreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullScreen) {
      document.documentElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.cancelFullScreen) {
      document.cancelFullScreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitCancelFullScreen) {
      document.webkitCancelFullScreen();
    }
  }
};

/*
 * Class that handles the sliding content
 *
 */
 var slidingPanel = function(content, down, headerClass, anchor, hidden) {
    this.down = down;
    this.headOpacity = 1;
    this.bodyOpacity = 0.6;
    this.open = false;
    this.anchor = $(anchor);
    this.hidden = hidden;
    this.toggable = false;

    this.id = Date.now();
    this.$container = $("<div>").appendTo(this.anchor).css({position: 'absolute', 'z-index': 10000, width: '100%'}).attr("id", this.id);

    this.$body = $("<div>");

    var direction = down?"up":"down";

    this.$button = $("<span>").addClass("glyphicon glyphicon-collapse-" + direction+ " headText").css({color: 'darkgray'});
    this.$headText =  $("<span>").addClass("headText");
    this.$warning = $("<span>").addClass("head-warning glyphicon glyphicon-exclamation-sign");

    var headStyle = {
        'vertical-align': 'middle',
        position: 'relative'
    };

    this.$head = $("<div>").css(headStyle).append(this.$button, this.$headText, this.$warning);

    this.$head.addClass(headerClass);
    this.$body.css({background: "rgba(0,0,0,"+ this.bodyOpacity+") url('img/dot.png')"});
    this.$content = $(content).addClass("shadowRight");

    this.$loader = $("<div>").addClass("white-loader").appendTo(this.$head).hide();

    if(down) {
        this.$container.append(this.$head, this.$body);
    } else {
        this.$container.append(this.$body, this.$head);
    }

    this.$body.append(this.$content.hide());

    this.resize();

    var self = this;
    this.$head.click(function() {
        if(!self.hidden && self.toggable) {
            self.toggle();
        }
    });

    this.$body.click(function() {
        self.toggle();
    });

    if(!isTouchDevice) {
        this.$head.mouseover(function() {
            if(self.toggable) {
                self.$button.stop(true, false);
                self.$button.animate({'font-size': self.headHeight*2/3}, 'fast');
                self.$button.css({'text-shadow': '0 0 20px #fffa98'});
            }
        });

        this.$head.mouseout(function() {
            if(self.toggable) {
                self.$button.stop(true, false);
                self.$button.animate({'font-size': self.headHeight/2}, 'fast');
                self.$button.css({'text-shadow': 'none'});
            }
        });
    }
    else {
        this.$button.css({'text-shadow': '0 0 20px #fffa98'});
    }
};

slidingPanel.prototype.enableToggleButton = function(enable) {
    this.toggable = enable;
    var buttonStyle;
    if(this.toggable) {
        buttonStyle = {color:'white'};

    } else {
        buttonStyle = {color:'#222'};
    }
    this.$button.css(buttonStyle);
}

slidingPanel.prototype.showHead = function(show, callback) {
    if(show == this.hidden) {
        var self = this;
        var offset = (this.down == show)?-this.headHeight:+this.headHeight;
        this.$container.animate({
            top: self.startTop + offset
        },
        'fast',
        function() {
            self.hidden = !show;
            self.resize();
            if(callback)
                callback();
        });
    }
    else {
        if(callback)
            callback();
    }
};

slidingPanel.prototype.setText = function(text) {
    this.$headText.text(text);
};

//open close the panel
slidingPanel.prototype.toggle = function() {
    if(!this.open) {
        this.$content.show();
        this.headOpacity = this.$head.css("opacity");
        this.$head.css({opacity:1});
    }

    this.$container.css({'z-index':10001});
    var top = this.open?this.startTop: this.endTop;
    var self = this;
    this.$container.animate({
        top: top,
    },
    'fast',
    function() {
        var remove, add;
        self.open = !self.open;

        if(!self.open) {
            add = !self.down?"down":"up";
            remove = !self.down?"up":"down";
            self.$content.hide();
            self.$head.css({opacity:self.headOpacity});
        }
        else {
            add =  !self.down?"up":"down";
            remove = !self.down?"down":"up";
        }
        self.$button.removeClass("glyphicon-collapse-"+ remove);
        self.$button.addClass("glyphicon-collapse-"+ add);

        var newz = self.open?10001:10000;
        self.$container.css({'z-index':newz});
    });
}

//rearange panel according to window size
slidingPanel.prototype.resize = function() {
    this.winHeight = this.anchor.height();
    this.headHeight = this.winHeight/10;
    this.bodyHeight = this.winHeight - this.headHeight;
    this.endTop = 0;
    var o = this.hidden?0:this.headHeight;
    this.startTop = this.down? this.winHeight - o: this.endTop + o - this.winHeight;
    var textStyle = {
        'line-height': this.headHeight + "px",
        'font-size': this.headHeight/3 + "px",
        'vertical-align': 'middle'
    }

    var buttonStyle = {
        'line-height': this.headHeight + "px",
        'font-size': this.headHeight/2 + "px",
        'vertical-align': 'middle'
    }


    this.$container.css({top: this.open?this.endTop+"px":this.startTop+"px"});
    this.$container.height(this.winHeight);
    this.$head.height(this.headHeight);
    this.$body.height(this.bodyHeight);

    this.$button.css(buttonStyle);
    this.$headText.css(textStyle);
    this.$warning.css(buttonStyle);

    this.$loader.css({top: 0, left: 0, height:this.headHeight, width: this.$container.width()});
};


//show/hide loader on top of panel head
slidingPanel.prototype.showLoader = function(show, callback) {
    if(show) {
        this.$loader.show();
        this.$loader.animate({opacity:1},600);
        this.$headText.animate({opacity:0},600, function() {
            $(this).hide();
        });
    }
    else {
        var self = this;
        this.$headText.stop(true, true);
        this.$loader.animate({opacity:0},200, function() {
            $(this).hide();
            self.$headText.show();
            self.$headText.animate({opacity:1},200, function() {
                if(callback)
                    callback();
            });
        });
    }

};

//show visual feedback on ajax error
slidingPanel.prototype.showWarning = function(show, message, callback) {
    if(show) {
        var detail = message?": " + message:" problem...";
        this.setText("Connection" + detail);
        this.enableToggleButton(false);
        this.$warning.show();
        this.$warning.animate({opacity:1},600, function() {
            if(callback) {
                calback();
            }
        });
    }
    else {
        this.$warning.animate({opacity:0},600,function() {
            $(this).hide();
            if(callback) {
                calback();
            }
        });
    }
};


function initMap() {
    //helsinki metro area bounds
    var strictBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(60.10, 24.22),
        new google.maps.LatLng(60.43, 25.51));


    infoWindow = new google.maps.InfoWindow({
        content: "contentString",
        disableAutoPan: true
    });

    //remove google transit, and poi related icons from map
    var style = [
    {
        "featureType": "transit",
        "stylers": [{ "visibility": "off" }]
    }
    ];

    var initialLocation = new google.maps.LatLng(60.1732044, 24.9402744);
    map = new google.maps.Map(document.getElementById('map'), {
        zoomControl: true,
        zoomControlOptions: {
            position: google.maps.ControlPosition.LEFT_CENTER
        },
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        scrollwheel: true,
        minZoom: 16,
        maxZoom: 18,
        styles:style
    });


    map.setCenter(initialLocation);
    map.setZoom(16);
    prevCenter = new google.maps.LatLng(0, 0);

    google.maps.event.addListener(map, "idle", function() {
        // send the new bounds back to your server
        model.getStops();
    });


    google.maps.event.addListener(map, "center_changed", function() {
        model.showLoadAnimation($gif, $("#map"));
    });

    //keep map within Helsinki Metropolitan Area
    google.maps.event.addListener(map, 'dragend', function() {
        if (strictBounds.contains(map.getCenter())) return;

        // We're out of bounds - Move the map back within the bounds
        var c = map.getCenter(),
        x = c.lng(),
        y = c.lat(),
        maxX = strictBounds.getNorthEast().lng(),
        maxY = strictBounds.getNorthEast().lat(),
        minX = strictBounds.getSouthWest().lng(),
        minY = strictBounds.getSouthWest().lat();

        if (x < minX) x = minX;
        if (x > maxX) x = maxX;
        if (y < minY) y = minY;
        if (y > maxY) y = maxY;

        map.setCenter(new google.maps.LatLng(y, x));
    });
    model = new StopsViewModel(map);
    ko.applyBindings(model);
}
