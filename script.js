let map;
let service;
let markers = [];

function initMap() {
    const casablanca = { lat: 33.5731, lng: -7.5898 };
    map = new google.maps.Map(document.getElementById('map'), {
        center: casablanca,
        zoom: 13
    });
    service = new google.maps.places.PlacesService(map);
    document.getElementById('searchBtn').addEventListener('click', searchPlaces);
    searchPlaces();
}

function clearMarkers() {
    for (const m of markers) {
        m.setMap(null);
    }
    markers = [];
}

function searchPlaces() {
    const minRating = parseFloat(document.getElementById('minRating').value) || 0;
    const minReviews = parseInt(document.getElementById('minReviews').value) || 0;
    const keyword = document.getElementById('keyword').value || '';
    const request = {
        location: map.getCenter(),
        radius: 5000,
        type: ['restaurant', 'bar'],
        keyword: keyword
    };
    service.nearbySearch(request, (results, status, pagination) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
            alert('Places search failed');
            return;
        }
        clearMarkers();
        for (const place of results) {
            if (place.rating >= minRating &&
                place.user_ratings_total >= minReviews) {
                addMarker(place);
            }
        }
    });
}

function addMarker(place) {
    const marker = new google.maps.Marker({
        map,
        position: place.geometry.location,
        title: place.name
    });
    markers.push(marker);
    const infowindow = new google.maps.InfoWindow({
        content: `<strong>${place.name}</strong><br>Rating: ${place.rating} (${place.user_ratings_total} reviews)`
    });
    marker.addListener('click', () => {
        infowindow.open(map, marker);
    });
}
