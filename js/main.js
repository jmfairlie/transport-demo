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
var maxtimeout = 10000;
var model;
var pinga, palo;

$(document).ready(function() {
    $gif  =$("<div>").addClass("overlay").appendTo("#static");
});

/*
 * Class that handles the sliding content
 *
 */
 var slidingPanel = function(content, down, clas) {
    this.down = down;
    this.opacity = 1;
    this.open = false;
    this.winHeight = $(window).height();
    this.headHeight = this.winHeight/10;
    this.bodyHeight = this.winHeight - this.headHeight;
    this.startTop = down?this.winHeight - this.headHeight: this.headHeight - this.winHeight;
    this.endTop = 0;
    this.id = Date.now();
    this.$container = $("<div>").appendTo("#static").css({top: this.startTop, position: 'absolute', 'z-index': 10000, width: '100%'}).attr("id", this.id);
    this.$loader = $("<div>").addClass("white-loader").appendTo("#static").hide();
    this.$body = $("<div>");
    this.$headText =  $("<span>").addClass("headText").attr("aria-hidden","true");
    this.$head = $("<div>").addClass("padding-10").append(this.$headText);

    this.$head.height(this.headHeight).addClass(clas);
    this.$body.height(this.bodyHeight).css({backgroundColor: "rgba(0,0,0,0.6)"});
    this.$content = $(content).addClass("shadowRight");

    if(down) {
        this.$container.append(this.$head, this.$body);
    } else {
        this.$container.append(this.$body, this.$head);
    }

    this.$body.append(this.$content.height(this.bodyHeight).hide());

    this.resize();
    var self = this;
    this.$head.click(function() {
        self.toggle();
    });

};

slidingPanel.prototype.setText = function(text) {
    this.$headText.text(text);
};

//open close the panel
slidingPanel.prototype.toggle = function() {
    if(!this.open) {
        this.$content.show();
        this.opacity = this.$head.css("opacity");
        this.$head.css({opacity:1});
    }
    this.$container.css({'z-index':10001});
    var caca = this.open?this.startTop: this.endTop;
    var self = this;
    this.$container.animate({
        top: caca
    },
    'fast',
    function() {
        self.open = !self.open;
        if(!self.open) {
            self.$content.hide();
            self.$head.css({opacity:self.opacity});
        }
        var newz = self.open?10001:10000;
        self.$container.css({'z-index':newz});
    });
}

//rearange panel according to window size
slidingPanel.prototype.resize = function() {
    this.winHeight = $(window).innerHeight();
    this.headHeight = this.winHeight/10;
    this.bodyHeight = this.winHeight - this.headHeight;
    this.startTop = this.down?this.winHeight - this.headHeight: this.headHeight - this.winHeight;
    this.$container.height(this.winHeight);
    this.$body.height(this.bodyHeight);
    this.$content.height(this.bodyHeight);
    this.$container.css({top: this.open?this.endTop:this.startTop});
    this.$headText.css({"font-size":this.headHeight/3});
    var offset = this.$container.offset();
    this.$loader.css({top: offset.top, left: offset.left, height:this.headHeight, width: this.$container.width()});
};


//show/hide loader on top of panel head
slidingPanel.prototype.showLoader = function(show, callback) {
    if(show) {
        this.$loader.show();
        this.$loader.animate({opacity:1},600);
        this.$headText.fadeOut();
    }
    else {
        this.$loader.animate({opacity:0},600, function() {
            $(this).hide();
            if(callback)
                callback();
        });
        this.$headText.fadeIn();
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
    },
    {
        "featureType": "poi",
        "stylers": [{ "visibility": "off" }]
    }
    ];

    var initialLocation = new google.maps.LatLng(60.1732044, 24.9402744);
    map = new google.maps.Map(document.getElementById('map'), {
        zoomControl: true,
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

    pinga = new slidingPanel("#listblock", false, "shadowDown reddish semitransparent");
    palo = new slidingPanel("#stop-details", true, "shadowUp blueish semitransparent");

    $(window).resize(function(ev) {
        pinga.resize();
        palo.resize();
    });
}