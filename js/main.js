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
var maxtimeout = 20000;
var model;
var listPanel, stopInfoPanel;
var button;
var oldw, oldh;
var isTouchDevice;

//if loading file directly use cors proxy
var fromfile = window.location.protocol==="file:";
var cors_proxy = fromfile?"https://crossorigin.me/":"";

$(document).ready(function() {
    isTouchDevice = Modernizr.touch;
//create the html nodes associated to the map loading gif
    $gif  =$("<div>").addClass("overlay").append($("<span>").addClass("fa fa-spinner fa-pulse")).appendTo("#static");
//create sliding panels
    listPanel = new slidingPanel("#listblock", false, "shadowDown reddish semitransparent", "#static", false, function(e) {
        model.filter("");
        //$("#listblock #search").val("");
        e.stopPropagation();
    });
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

    if(isTouchDevice) {
        this.button.addClass("fullscreenbutton-touch")
    }
};

fullscreenButton.prototype.resize = function() {

    this.dimension = this.container.height()/10;

    this.button.css('font-size', this.dimension*2/4);
    this.button.css('line-height', this.dimension + "px");

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
 var slidingPanel = function(content, down, headerClass, anchor, hidden, clearFilterCB) {
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

    this.$button = $("<span class='panel-button disabled'>").addClass("glyphicon glyphicon-collapse-" + direction+ " headText");
    this.$headText =  $("<span>").addClass("headText");
    this.$warning = $("<span>").addClass("head-warning glyphicon glyphicon-exclamation-sign");

    var $remove = $("<span title='remove filter'>").addClass("glyphicon glyphicon-remove remove");
    this.$filter = $("<span class='filter-text'>");
    this.$clearFilter = $("<span class='filter-container'>").append(this.$filter, $remove);

    var headStyle = {
        'vertical-align': 'middle',
        position: 'relative'
    };

    this.$head = $("<div class='panel-head'>").css(headStyle).append(this.$button, this.$headText, this.$warning, this.$clearFilter);

    this.$head.addClass(headerClass);
    this.$body.css({background: "rgba(0,0,0,"+ this.bodyOpacity+") url('img/dot.png')"});
    this.$content = $(content).addClass("shadowRight");

    this.$loader = $("<div>").addClass("white-loader").append($("<span>").addClass("fa fa-refresh fa-spin")).appendTo(this.$head).hide();

    if(down) {
        this.$container.append(this.$head, this.$body);
    } else {
        this.$container.append(this.$body, this.$head);
    }

    this.$body.append(this.$content.hide());

    this.resize();

    var self = this;
    var togglefunc = function() {
        if(!self.hidden && self.toggable) {
            self.toggle();
        }
    }

    this.$body.click(function() {
        self.toggle();
    });

    if(clearFilterCB) {
        this.$clearFilter.click(clearFilterCB);
    }

    if(isTouchDevice) {
        this.$button.addClass("panel-button-touch");
        this.$head.click(togglefunc);
    } else {
        this.$button.click(togglefunc);
    }
};

slidingPanel.prototype.enableToggleButton = function(enable) {
    this.toggable = enable;
    this.$button.toggleClass("disabled", !enable);
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
        this.$head.removeClass("semitransparent");
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
            self.$head.addClass("semitransparent");
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

    var filterStyle = {
        'line-height': this.headHeight + "px",
        'font-size': this.headHeight/4 + "px",
        'vertical-align': 'middle'
    }


    this.$container.css({top: this.open?this.endTop+"px":this.startTop+"px"});
    this.$container.height(this.winHeight);
    this.$head.height(this.headHeight);
    this.$body.height(this.bodyHeight);

    this.$button.css(buttonStyle);
    this.$headText.css(textStyle);
    this.$warning.css(buttonStyle);
    this.$clearFilter.css(filterStyle);

    this.$loader.css({top: 0, left: 0, height:this.headHeight, width: this.$container.width()});
};


//show/hide loader on top of panel head
slidingPanel.prototype.showLoader = function(show, callback) {
    if(show) {
        this.$loader.fadeIn(600);
        this.$headText.fadeOut();
    }
    else {
        this.$headText.stop(true, true);
        this.$headText.fadeIn(200);
        this.$loader.fadeOut(200, callback);
    }
};

//show visual feedback on ajax error
slidingPanel.prototype.showWarning = function(show, message, callback) {
    if(show) {
        var detail = message?": " + message:" problem...";
        this.setText("Connection" + detail);
        this.enableToggleButton(false);
        this.$warning.fadeIn(300, callback);
    }
    else {
        this.$warning.fadeOut(300, callback);
    }
};

//show remove filter button
slidingPanel.prototype.showFilter = function(show, filter, callback) {
    if(show) {
        this.$filter.text(filter);
        this.$clearFilter.fadeIn(200, callback);
    }
    else {
        //$tem.fadeOut(600, callback);
        this.$clearFilter.fadeOut(200, callback);
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
        model.showLoadAnimation($gif);
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
