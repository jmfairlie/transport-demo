//Google Maps API key AIzaSyA9ST-_SzzBRJxzg_7OaB2XRvp4nNuZahE

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
var maxtimeout = 5000;

$(document).ready(function() {
    $("#search" ).bind('input', textInput);
    $gif = $("<img>").attr("id", "overlay").attr("src", "img/ajax-loader.gif");
    $gif.hide();
    $("#static").append($gif);
    $gif2 = $("<img>").attr("id", "overlay").attr("src", "img/ajax-loader.gif");
    $gif2.hide();
    $("#static").append($gif2);
});

function deselectList() {
    $(".list-group-item").removeClass("active");
}

function selectInList(code) {
    var offset = 0;
    var $list = $("#list");
    if(code && code.length) {
        var $s = $("#"+code);
        if($s.length) {
            offset = Math.max(0, $s.position().top + $list.scrollTop() - 41 - $list.height()/2);
            $s.addClass("active");
            selectedStop = code;
            $list.scrollTop(offset);
            return true;
        }
    }
    return false;
}

function sortStop(a, b) {
    return items[a].name.localeCompare(items[b].name);
}

function populateList(results) {

    var $list = $("#list");
    $list.empty();
    var sorted = Object.keys(results).sort(sortStop);
    for (var i in sorted) {
      var code = sorted[i];
      var name = results[code].name;
      var $elem = $("<a></a>");
      $list.append($elem.addClass("list-group-item").attr("href", "#").attr("id", code).text(name));
    }

    deselectList();
    selectInList(selectedStop);

    $(".list-group-item").hover(
        function() {
            var code = parseInt($(this).attr("id"));
            markers[code].setAnimation(google.maps.Animation.BOUNCE);
        },
        function() {
            var code = parseInt($(this).attr("id"));
            markers[code].setAnimation(null);
        });

    $(".list-group-item").click(
        function(e) {
            $(".list-group-item").removeClass("active");
            var code = $(this).attr("id");

            markers[code].setAnimation(null);
            unhiliteMarkers();
            hiliteMarker(markers[code]);
            selectedStop = code;
            $(this).addClass("active");
            infoWindow.setContent(createMarkerContent(filtered[code]).html());
            infoWindow.open(map, markers[code]);
            $("#stop-details").empty();
            showLoadAnimation($gif2, $("#stop-details"));
            requestStopDetails(code);
        });
}

function populateMap(results) {
    for(var code in markers) {
        if(!(code in results)) {
            markers[code].setMap(null);
            delete markers[code];
        }
    }

    for(var code in results) {
        if(!(code in markers)) {
            createMarker(results[code]);
        }
    }
}

function subset_a(string) {
    var subset;
    if(string.length !== 0)
    {
        subset = {};
        for (var code in items) {
          if(items[code].name.indexOf(string) > -1) {
            subset[code] = items[code];
          }
        }
    }
    else {
        subset = $.extend({}, items);
    }

    return subset;
}

function textInput(e) {
    var value = $("#search").val();
    filtered = subset_a(value);
    populateList(filtered);
    populateMap(filtered);
}

function createMarkerContent(place) {
    $div = $("<div></div>");
    $div.append($("<h4></h4>").text(place.name));
    $div.append($("<p></p>").text(place.address));
    $div.append($("<p></p>").text("Latitude: "+place.geometry.location.lat()));
    $div.append($("<p></p>").text("Longitude: "+place.geometry.location.lng()));
    return $div;
}


function unhiliteMarkers() {
    for (code in markers) {
        markers[code].setIcon("img/busstop_red.png");
    }
}

function hiliteMarker(marker) {
    marker.setIcon("img/busstop_blue.png");
}

function createMarker(place) {
    var placeLoc = place.geometry.location;
    var marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
        icon: "img/busstop_red.png"
    });

    marker.code = place.code;

    markers[place.code] = marker;

    if(place.code == selectedStop) {
        infoWindow.setContent(createMarkerContent(place).html());
        infoWindow.open(map, marker);
        hiliteMarker(marker);
    }

    google.maps.event.addListener(marker, 'click', function() {
        infoWindow.setContent(createMarkerContent(place).html());
        infoWindow.open(map, this);
        unhiliteMarkers();
        hiliteMarker(this);
        deselectList();
        selectInList(place.code);
    });
}

function loadLines(data, stopcode) {
    for(var i = 0; i< data.length; i++)
    {
        alllines[data[i].code] = data[i];
    }

    populateStopDetails(stopcode);
}

function requestLines(lines, stopcode) {
    var url = "https://crossorigin.me/http://api.reittiopas.fi/hsl/prod/?user=jmfairlie&pass=12345&request=lines&query="+lines;
    $.ajax({
        url: url,
        dataType: 'json',
        success: function (data) {
            loadLines(data, stopcode);
        },
        timeout: maxtimeout,
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(url, textStatus, errorThrown);
            hideLoadAnimation($gif2);
        }
    });
}

function loadStops(data) {
    var coords;
    items = {};
    for(var i = 0, max= data.length; i < max; i++) {
        coords = data[i].coords.split(",");

        var place = {};
        place.geometry = {};
        place.geometry.location = new google.maps.LatLng(parseFloat(coords[1]), parseFloat(coords[0]));
        place.code = data[i].code;
        if(map.getBounds().contains(place.geometry.location) && place.code.length) {
            coors = data[i].coords.split(",");
            place.name = data[i].name + " ("+data[i].codeShort+")";
            place.address = data[i].address;
            items[place.code] = place;
        }
    }

    textInput();
}

function populateStopDetails(stopcode) {
    var data = stops[stopcode];
    var name = data.short_name || data.name_fi;
    var shortCode =  data.code_short;
    var address = data.address_fi;
    var city = data.city_fi;

    var departures = data.departures;
    var lines = data.lines;

    $panel = $('<div class="panel panel-default"></div>')
    $heading = $('<div class="panel-heading"></div>').append($("<h3></h3>").text(name+" ("+shortCode+")"));
    $body = $('<div class="panel-body"></div>').text(address+", "+city);
    $table = $('<table class="table-striped timetable"><caption>Upcoming Departures</caption><thead><tr><th>Line</th><th></th><th>Destination</th><th>Time</th></tr></thead><tbody id="tablebody"></tbody></table>');

    $("#stop-details").append($panel, $heading, $body, $table);

    $content = $("#tablebody");
    for(var i=0, max = departures?departures.length:0; i< max; i++) {
        var linedetail = alllines[departures[i].code];
        var typesrc = "img/bus.png";

        switch (parseInt(linedetail.transport_type_id)) {
            case 1:
            case 3:
            case 4:
            case 5:
                typesrc = "img/bus.png";
                break;
            case 2:
                typesrc = "img/tramway.png";
                break;
            case 6:
                typesrc = "img/underground.png";
                break;
            case 12:
                typesrc = "img/train.png";
                break;
        }

        var t = ("0000" + departures[i].time).slice(-4);
        $row  = $("<tr></tr>");
        $line = $("<td></td>").text(linedetail.code_short);
        $type = $("<td></td>").append($("<img>").attr("src",typesrc));
        $destination = $("<td></td>").text(linedetail.line_end);
        $time = $("<td></td>").text(t.substring(0,2)+":"+t.substring(2));

        $row.append($line, $type, $destination, $time);
        $content.append($row);
    }
    hideLoadAnimation($gif2);
}

function loadStopDetails(datos) {
    var linerequest = "";

    var data = datos[0];


    stops[data.code] = data;

    var lines = data.lines;

    var line_dic = {};

    var a;
    for(var j=0, max=lines?lines.length:0; j< max; j++) {
        a = lines[j].split(":");
        line_dic[a[0]] = a[1];

        if(!(a[0] in alllines)) {
            linerequest = linerequest + a[0] + "|";
        }
    }

    if(linerequest.length) {
        requestLines(linerequest.substring(0,linerequest.length - 1), data.code);
    }
    else {
        populateStopDetails(data.code);
    }
}

function requestStops() {
    var center = map.getCenter();
    var bounds = map.getBounds();
    //using CORS proxy to avoid CORS issues.
    var distance = Math.floor(google.maps.geometry.spherical.computeDistanceBetween(bounds.getSouthWest(), bounds.getNorthEast()));
    var url = "https://crossorigin.me/http://api.reittiopas.fi/hsl/prod/?user=jmfairlie&pass=12345&request=stops_area&epsg_in=wgs84&epsg_out=wgs84&diameter="+distance+"&limit=2000&center_coordinate=" + center.lng() +","+center.lat();
    $.ajax({
        url: url,
        dataType: 'json',
        success: loadStops,
        timeout: maxtimeout,
        complete: function(jqXHR, textStatus) {
            console.log(url, textStatus);
            hideLoadAnimation($gif);
            if(textStatus!=="success")
            {
                $("#list").empty();
            }
        }
    });
}

function requestStopDetails(code) {
    var url = "https://crossorigin.me/http://api.reittiopas.fi/hsl/prod/?user=jmfairlie&pass=12345&request=stop&time_limit=60&code="+code;

    $.ajax({
        url: url,
        dataType: 'json',
        success: loadStopDetails,
        timeout: maxtimeout,
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(url, textStatus, errorThrown);
            hideLoadAnimation($gif2);
        }
    });
}

function showLoadAnimation(gif, node) {
        var offset = node.offset();
        var w = node.width();
        var h = node.height();
        gif.css({top: offset.top + h/2 - gif.width()/2, left:offset.left + w/2 - gif.height()/2});
        gif.show();
}

function hideLoadAnimation(gif) {
    gif.hide();
}

function initMap() {
    //helinki metro area bounds
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


    google.maps.event.addListener(map, "click", function() {
        infoWindow.close();
        deselectList();
        selectedStop = null;
        unhiliteMarkers();
    });

    google.maps.event.addListener(map, "idle", function() {
        // send the new bounds back to your server
        requestStops();
    });

    google.maps.event.addListener(map, "center_changed", function() {
        showLoadAnimation($gif, $("#map"));
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

}

//Please credit: Maps Icons Collection https://mapicons.mapsmarker.com


