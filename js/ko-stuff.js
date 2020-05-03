var api_base = "https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql";
//custom KO bindings

function iconURLByMode(mode, selected) {
  var prefix = selected?"selected_":"";
  let iconurl;
  switch (mode) {
      case "SUBWAY":
          iconurl = "img/"+prefix+"underground.png";
          break;
      case "RAIL":
          iconurl = "img/"+prefix+"train.png";
          break;
      case "TRAM":
        iconurl = "img/"+prefix+"tramway.png";
        break;
      case "FERRY":
        iconurl = "img/"+prefix+"ferry.png";
        break;
      case "BUS":
      default:
          iconurl = "img/"+prefix+"bus.png";
          break;
  }
  return iconurl;
}

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
        var val =ko.unwrap(valueAccessor());
        var iconurl = iconURLByMode(val);
        $(element).attr("src", iconurl);
    }
};

//automatically scroll the bar so that the selected item is visible.
ko.bindingHandlers.viewportAdjuster = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {

    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {

        var $e = $(element);
        //fix this later
        /*if(ko.unwrap(valueAccessor()).length) {
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
        }*/
    }
};

/*
 * Useful extension found in
 * https://github.com/knockout/knockout/issues/914
 */
ko.subscribable.fn.subscribeChanged = function (callback) {
    var savedValue = this.peek();
    return this.subscribe(function (latestValue) {
        var oldValue = savedValue;
        savedValue = latestValue;
        callback(latestValue, oldValue);
    });
};

var Stop = function(obj, parent) {
    var c = [obj.lat, obj.lon];
    this.id = obj.gtfsId;
    this.codeShort = obj.code;
    this.name = obj.name;
    this.latitude = obj.lat;
    this.longitude = obj.lon;
    this.latlng = new google.maps.LatLng(obj.lat, obj.lon);
    this.address = obj.desc;
    this.city = "?";
    this.url = obj.url;
    this.fullname = this.name + " ("+this.codeShort+")";
    this.fulladdress = this.address;
    this.mode = obj.vehicleMode;

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
    self.departures = ko.observable([]);
    self.stopDetail = ko.observable();
    self.lines = ko.observable();
    self.currentStop = ko.observable("");
    self.stops =  ko.observableArray([]);
    self.prevStop = null;

    self.filter = ko.observable("");

    self.filter.subscribeChanged(function(newValue, oldValue) {
        if(newValue!==oldValue) {
            if(newValue.trim().length) {
                listPanel.showFilter(true, newValue.trim());
            } else {
                listPanel.showFilter(false);
            }
        }
    });

    self.filteredStops = ko.computed(function() {
        if(self.filter().trim().length > 0) {
            return ko.utils.arrayFilter(self.stops(), function(stop) {
                return (stop.name.toLowerCase() + stop.codeShort).indexOf(self.filter().trim().toLowerCase()) > -1;
            });
        }
        else {
            return self.stops();
        }
    });


    self.stopDetail.subscribe(function(newValue) {
        if(newValue) {
            var departures = newValue && newValue.stoptimesForPatterns && newValue.stoptimesForPatterns && newValue.stoptimesForPatterns.reduce((a, o) => [...a, ...o.stoptimes], []) || [];
            var temp = [];
            for(var i = 0, code, departure, o; i < departures.length; i++) {
                departure = departures[i];
                code = departure.trip.routeShortName;

                o = {
                        id:code,
                        short_id: code,
                        type: departure && departure.trip && departure.trip.route && departure.trip.route.mode || newValue.vehicleMode,
                        destination: departure.trip.stops.pop().name,
                        rawTime: departure.scheduledArrival,
                        time:moment.utc(departure.scheduledArrival*1000).format('HH:mm:ss')
                }
                temp.push(o);
            }
            self.departures(temp.sort((a,b) => a.rawTime-b.rawTime));
            stopInfoPanel.setText(newValue.name + " (" + newValue.code + ")");
            stopInfoPanel.showLoader(false, function() {
                stopInfoPanel.enableToggleButton(true);
                stopInfoPanel.toggle();
            });

            if(self.prevStop) {
              const prevMarker = self.markers[self.prevStop];
              if(prevMarker) {
                const mode = prevMarker.mode;
                if(mode) {
                  prevMarker.setIcon(iconURLByMode(mode));
                }
              }
            }
            self.markers[newValue.gtfsId].setIcon(iconURLByMode(newValue.vehicleMode, true));
            self.markers[newValue.gtfsId].setZIndex(Date.now());
        } else {
            stopInfoPanel.showLoader(false, function() {
              stopInfoPanel.enableToggleButton(false);
              stopInfoPanel.showHead(false, function() {
                  stopInfoPanel.setText("");
              });
            });
        }
    });

    //everytime currentStop changes query server
    self.currentStop.subscribe(function(newValue) {
        if(newValue.length) {
            self.getStopDetails(newValue);

            //$.each(self.markers, function(key, obj) {
                //obj.setIcon(iconURLByMode(obj.mode));
            //};
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
        var numfiltered = self.stops().length - num;

        var filtertext= numfiltered?" ("+numfiltered+" filtered out)":"";
        listPanel.setText(num+" stop"+plural+" found"+filtertext);
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
            icon: iconURLByMode(stop.mode),
            zIndex: 0,
            optimized: false
        });

        marker.mode = stop.mode;

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
            self.prevStop = self.currentStop();
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

    self.loadStops = function(response) {
        const data = response.data;
        var coords, c, val;
        var bounds = map.getBounds();
        var temp = $.map(data.stopsByRadius.edges, function(obj) {
            val = null;
            var stop = obj.node.stop;
            coords = new google.maps.LatLng(stop.lat, stop.lon);
            if(bounds.contains(coords)) {
                val = new Stop(stop, self);
            }
            return val;
        });
        listPanel.showWarning(false);
        self.stops(temp.sort(self.sort));
    };

    self.getStops = function() {
        var center = map.getCenter();
        var bounds = map.getBounds();

        var distance = Math.floor(google.maps.geometry.spherical.computeDistanceBetween(bounds.getSouthWest(), bounds.getNorthEast()));

        if(self.mapQuery)
            self.mapQuery.abort();

        var data = {
          "query":  `{
            stopsByRadius(lat:${center.lat()}, lon:${center.lng()}, radius:3000) {
              edges {
                node {
                  stop {
                    gtfsId
                    name
                    lat
                    lon
                    code
                    desc
                    locationType
                    vehicleType
                    vehicleMode
                    platformCode
                    url
                    zoneId
                  }
                  distance
                }
              }
            }
          }`
        }

        self.mapQuery = $.ajax({
            type: "POST",
            url: api_base,
            dataType: 'json',
            success: self.loadStops,
            timeout: maxtimeout,
            contentType: "application/json",
            data: JSON.stringify(data),
            complete: function(jqXHR, textStatus) {
                self.hideLoadAnimation($gif);
                if(textStatus !== 'success' && textStatus !== 'abort') {
                    listPanel.showWarning(true, textStatus);
                }
            }
        });

        //deselect stop if it's not within bounds
        if(self.stopDetail() && self.stopDetail().latlng &&!(bounds.contains(self.stopDetail().latlng))) {
            self.currentStop("");
            self.stopDetail(null);
        }
    };

    self.loadStopDetails = function(response) {
        var details = response && response.data && response.data.stop;
        self.stopDetail(details);
    };

    self.getStopDetails = function(code) {
        if(self.detailQuery) {
            self.detailQuery.abort();
            if(self.lineQuery)
                self.lineQuery.abort();
        }

        stopInfoPanel.showHead(true);
        stopInfoPanel.showLoader(true);

        self.detailQuery = $.ajax({
            type: "POST",
            url: api_base,
            dataType: 'json',
            success: self.loadStopDetails,
            contentType: "application/json",
            data: JSON.stringify({
              "query": `{
                  stop(id: \"${code}\") {
                    gtfsId
                    name
                    lat
                    lon
                    code
                    desc
                    locationType
                    vehicleType
                    vehicleMode
                    platformCode
                    url
                    zoneId
                    stoptimesForPatterns(timeRange: 3600, omitNonPickups: true) {
                      stoptimes {
                        scheduledArrival
                        realtimeArrival
                        arrivalDelay
                        realtime
                        headsign
                        trip {
                          gtfsId
                          routeShortName
                          tripGeometry {
                            length
                            points
                          }
                          stops {
                            gtfsId
                            name
                            code
                            desc
                            zoneId
                            url
                          }
                        }
                      }
                    }
                  }
              }`
            }),
            //don't cache this requests cause we need up to date info
            cache:false,
            timeout: maxtimeout,
            complete: function(jqXHR, textStatus) {
                if(textStatus != "success" && textStatus != 'abort') {
                    stopInfoPanel.showLoader(false, _ => stopInfoPanel.showWarning(true, textStatus))
                }
            }
        });
    };

    self.listMouseOver = function(stop) {
        if(isTouchDevice)
            self.markers[stop.id].setAnimation(google.maps.Animation.BOUNCE);
    };

    self.listMouseOut = function(stop) {
        if(isTouchDevice)
            self.markers[stop.id].setAnimation(null);
    };

    self.showLoadAnimation = function(gif) {
        gif.clearQueue();
        gif.fadeIn(200);
    }

    self.hideLoadAnimation = function (gif) {
        gif.clearQueue();
        gif.fadeOut(200);
    };

    self.sort = function(a, b) {
        return a.name.localeCompare(b.name);
    };
};
