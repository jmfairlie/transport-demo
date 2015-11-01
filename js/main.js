var map;
var items = {};
var filtered;
var markers = [];
var infoWindow;
var prevCenter;
var selectedStop;
var $gif, $gif2;
var alllines = {};
var stops = {};
var maxtimeout = 10000;
var model;

$(document).ready(function() {
   // $gif = $("<img>").addClass("overlay").attr("src", "img/ajax-loader.gif").appendTo("#static");
   // $gif2 =$("<img>").addClass("overlay").attr("src", "img/ajax-loader.gif").appendTo("#static");

    $gif  =$("<div>").addClass("overlay").appendTo("#static");
    $gif2 =$("<div>").addClass("overlay").appendTo("#static");

    $(".overlay").hide();
});

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
        minZoom: 14,
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