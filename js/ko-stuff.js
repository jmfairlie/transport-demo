
//custom KO bindings

//automatically choose the right icon according to transport line type(tram, bus, metro, bus)
ko.bindingHandlers.transportIcon = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        // This will be called when the binding is first applied to an element
        // Set up any initial state, event handlers, etc. here
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        // This will be called once when the binding is first applied to an element,
        // and again whenever any observables/computeds that are accessed change
        // Update the DOM element based on the supplied values here.
        var iconurl;
        var val = parseInt(ko.unwrap(valueAccessor()));
        switch (val) {
            case 1:
            case 3:
            case 4:
            case 5:
            case 8:
                iconurl = "img/bus.png";
                break;
            case 2:
                iconurl = "img/tramway.png";
                break;
            case 6:
                iconurl = "img/underground.png";
                break;
            case 12:
                iconurl = "img/train.png";
                break;
        }
        $(element).attr("src", iconurl);
    }
};

//automatically scroll the bar so that the selected item is visible.
ko.bindingHandlers.viewportAdjuster = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {

    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var $e = $(element);
        if(ko.unwrap(valueAccessor()).length) {
            var $selected = $e.find("#"+ko.unwrap(valueAccessor()));
            var offset = 0;
            if($selected.length) {
                var top = $selected.position().top - 34;
                //if the item is not visible
                if(top  > $e.height() || top < 0)
                {
                    offset = Math.max(0, top + $e.scrollTop() - $e.height()/2 + $selected.outerHeight()/2);
                    $e.animate({scrollTop: offset});
                }
            }
        }
    }
};


var Stop = function(obj, parent) {
    var c = (obj.wgs_coords || obj.coords).split(",");
    this.id = obj.code;
    this.codeShort = obj.code_short || obj.codeShort || "n/a";
    this.name = obj.short_name || obj.name_fi || obj.name;
    this.latitude = c[1];
    this.longitude = c[0];
    this.latlng = new google.maps.LatLng(parseFloat(c[1]), parseFloat(c[0]));
    this.address = obj.address_fi || obj.address;
    this.city = obj.city_fi || obj.city;
    this.url ="#";
    this.fullname = this.name + " ("+this.codeShort+")";
    this.fulladdress = this.address + ", " + this.city;

    var dep = obj.departures || [];
    var line_ids = $.map(dep, function(obj) { return obj.code;});

    this.departures = [];

    for(var i = 0, code, t, o; i < line_ids.length; i++) {
        code = line_ids[i];
        //times are weirdly specified with this API
        t = ("0000"+ parseInt(dep[i].time)%2400).slice(-4);
        o = {
                id:code,
                short_id: parent.lineDetails[code].code_short,
                type: parent.lineDetails[code].transport_type_id,
                destination: parent.lineDetails[code].line_end,
                time: t.substring(0,2)+":"+t.substring(2)
        }
        this.departures.push(o);
    }

    this.isSelected = function() {
        return (parent.currentStop() == this.id);
    };
};


//knockout viewmodel
var StopsViewModel = function(map) {
    var self = this;
    self.mapQuery = null;
    self.detailQuery = null;
    self.lineQuery = null;

    self.map = map;
    self.infoWindow = new google.maps.InfoWindow({
        content: "",
        disableAutoPan: true
    });

    self.markers = {};
    self.stopDetail = ko.observable();
    self.lines = ko.observable();
    self.currentStop = ko.observable("");
    self.stops =  ko.observableArray([]);

    self.filter = ko.observable("");

    self.filteredStops = ko.computed(function() {
        if(self.filter().length > 0) {
            return ko.utils.arrayFilter(self.stops(), function(stop) {
                return (stop.name + stop.codeShort).indexOf(self.filter()) > -1;
            });
        }
        else {
            return self.stops();
        }
    });

    this.lineDetails = {};

    self.stopDetail.subscribe(function(newValue) {
        if(newValue) {
            stopInfoPanel.setText(newValue.fullname);
            stopInfoPanel.showLoader(false, function() {
                stopInfoPanel.showWarning(false);
                stopInfoPanel.enableToggleButton(true);
                stopInfoPanel.toggle();
            });
        }
        else {
            stopInfoPanel.enableToggleButton(false);
            stopInfoPanel.showHead(false, function() {
                stopInfoPanel.setText("");
            });
        }
    });

    //everytime currentStop changes query server
    self.currentStop.subscribe(function(newValue) {
        if(newValue.length) {
            self.getStopDetails(newValue);

            $.each(self.markers, function(key, obj) {
                obj.setIcon("img/busstop_red.png");
            });

            self.markers[newValue].setIcon("img/busstop_blue.png");

            stopInfoPanel.showHead(true, function() {
                stopInfoPanel.showLoader(true);
            });
        }
    });

    self.filteredStops.subscribe(function(newValue) {
        var num = newValue.length;
        if(num > 0) {
            listPanel.enableToggleButton(true);
        }
        else {
            listPanel.enableToggleButton(false);
        }

        self.updateMarkers(newValue);
        var plural = num==1?"":"s";
        listPanel.setText(num+" stop"+plural+" found");
    });

    self.updateMarkers = function(newval) {
        var ids = $.map(newval, function(stop) {return stop.id;});
        $.each(self.markers, function (stopid, marker) {
            if($.inArray(stopid, ids) == -1) {
                marker.setMap(null);
                delete self.markers[stopid];
            }
        });
        $.each(newval, function (index, stop) {
            if(!(stop.id in self.markers)) {
                self.addMarker(stop);
            }
        });
    };

    self.addMarker = function(stop) {
        var marker = new google.maps.Marker({
            map: self.map,
            position: stop.latlng,
            icon: "img/busstop_red.png"
        });

        self.markers[stop.id] = marker;

        if(!isTouchDevice) {
            google.maps.event.addListener(marker, 'mouseover', function() {
                self.infoWindow.setContent(self.createMarkerContent(stop).html());
                self.infoWindow.open(self.map, marker);
            });
        }

        google.maps.event.addListener(marker, 'mouseout', function() {
            self.infoWindow.close();
        });

        google.maps.event.addListener(marker, 'click', function() {
            self.currentStop(stop.id);
        });
    };

    self.createMarkerContent = function(stop) {
        $div = $("<div></div>");
        $div.append($("<h4></h4>").text(stop.fullname));
        $div.append($("<p></p>").text(stop.fulladdress));
        $div.append($("<p></p>").text("Latitude: "+stop.latitude));
        $div.append($("<p></p>").text("Longitude: "+stop.longitude));
        return $div;
    };

    self.selectStop = function(stop) {
        self.currentStop(stop.id);
        listPanel.toggle();
    };

    self.refreshStop = function() {
        self.currentStop.valueHasMutated();
    };

    self.loadStops = function(data) {
        var coords, c, val;
        var bounds = map.getBounds();
        var temp = $.map(data, function(obj) {
            val = null;
            var c = obj.coords.split(",");
            coords = new google.maps.LatLng(parseFloat(c[1]), parseFloat(c[0]));
            if(bounds.contains(coords)) {
                val = new Stop(obj, self);
            }
            return val;
        });
        listPanel.showWarning(false);
        self.stops(temp.sort(self.sort));
    };

    self.getStops = function() {
        var center = map.getCenter();
        var bounds = map.getBounds();
        //using CORS proxy to avoid CORS issues.
        var distance = Math.floor(google.maps.geometry.spherical.computeDistanceBetween(bounds.getSouthWest(), bounds.getNorthEast()));
        var url = cors_proxy + "http://api.reittiopas.fi/hsl/prod/?user=jmfairlie&pass=12345&request=stops_area&epsg_in=wgs84&epsg_out=wgs84&diameter="+distance+"&limit=2000&center_coordinate=" + center.lng() +","+center.lat();

        if(self.mapQuery)
            self.mapQuery.abort();

        self.mapQuery = $.ajax({
            url: url,
            dataType: 'json',
            success: self.loadStops,
            timeout: maxtimeout,
            complete: function(jqXHR, textStatus) {
                self.hideLoadAnimation($gif);
                if(textStatus != 'success' && textStatus != 'abort') {
                    listPanel.showWarning(true, textStatus);
                }
            }
        });

        //deselect stop if it's not within bounds
        if(self.stopDetail() && !(bounds.contains(self.stopDetail().latlng))) {
            self.currentStop("");
            self.stopDetail(null);
        }
    };

    self.loadStopDetails = function(datos) {
        var linerequest = [];
        var data = datos[0];
        var lines = data.lines;
        var a;
        for(var j=0, max=lines?lines.length:0; j< max; j++) {
            a = lines[j].split(":");

            if(!(a[0] in self.lineDetails)) {
                linerequest.push(a[0]);
            }
        }

        self.getLines(linerequest.join("|"), data);
    };

    self.getStopDetails = function(code) {
        var url = cors_proxy + "http://api.reittiopas.fi/hsl/prod/?user=jmfairlie&pass=12345&request=stop&time_limit=360&code="+code;

        if(self.detailQuery) {
            self.detailQuery.abort();
            if(self.lineQuery)
                self.lineQuery.abort();
        }

        self.detailQuery = $.ajax({
            url: url,
            dataType: 'json',
            success: self.loadStopDetails,
            //don't cache this requests cause we need up to date info
            cache:false,
            timeout: maxtimeout,
            complete: function(jqXHR, textStatus) {
                if(textStatus != "success" && textStatus != 'abort') {
                    stopInfoPanel.showWarning(true, textStatus);
                    stopInfoPanel.showLoader(false);
                }
            }
        });
    };

    self.loadLines = function(data) {
        for(var i = 0; i< data.length; i++)
        {
            self.lineDetails[data[i].code] = data[i];
        }
    };

    self.getLines = function(line_ids, stop) {
        if(line_ids.length) {
            var url = cors_proxy + "http://api.reittiopas.fi/hsl/prod/?user=jmfairlie&pass=12345&request=lines&query="+line_ids;
            self.lineQuery = $.ajax({
                url: url,
                dataType: 'json',
                success: function (data) {
                    self.loadLines(data);
                },
                timeout: maxtimeout,
                complete: function(jqXHR, textStatus) {
                    if(textStatus == 'success') {
                        self.stopDetail(new Stop(stop, self));
                    } else if(textStatus != 'abort') {
                        stopInfoPanel.showWarning(true, textStatus);
                        stopInfoPanel.showLoader(false);
                    }
                }
            });
        } else {
            self.stopDetail(new Stop(stop, self));
        }
    };

    self.listMouseOver = function(stop) {
        if(isTouchDevice)
            self.markers[stop.id].setAnimation(google.maps.Animation.BOUNCE);
    };

    self.listMouseOut = function(stop) {
        if(isTouchDevice)
            self.markers[stop.id].setAnimation(null);
    };

    self.showLoadAnimation = function(gif, node) {
        var offset = node.offset();
        var w = node.outerWidth();
        var h = node.height();
        gif.css({top:offset.top, left:offset.left, width:w, height:h});
        gif.show();
        gif.animate({opacity:0.7},600);

    }

    self.hideLoadAnimation = function (gif) {
        gif.clearQueue();
        gif.animate({opacity:0}, 'fast', function() {gif.hide();});
    };

    self.sort = function(a, b) {
        return a.name.localeCompare(b.name);
    };
};
