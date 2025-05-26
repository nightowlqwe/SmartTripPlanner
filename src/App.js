import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Custom icon (unchanged)
const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FlyToLocation({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, {
        duration: 1.5,
      });
    }
  }, [position, map]);
  return null;
}

function App() {
  const [mode, setMode] = useState('location');
  const [city, setCity] = useState('');
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]);
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const mapRef = useRef();

  // Fetch coordinates on mode/location change (unchanged)
  useEffect(() => {
    if (mode === 'location') {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setMapCenter(coords);
        fetchPlaces(coords);
      });
    }
  }, [mode]);

  // City search (unchanged)
  const handleCitySearch = async () => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${city}`
    );
    const data = await res.json();
    if (data[0]) {
      const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      setMapCenter(coords);
      fetchPlaces(coords);
    }
  };

  // Improved fetchPlaces
  const fetchPlaces = async ([lat, lon]) => {
    setPlaces([]);
    const radius = 3000; // Increased radius for better coverage

    // Expanded Overpass query with way + relation for all tags
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["historic"](around:${radius},${lat},${lon});
        way["historic"](around:${radius},${lat},${lon});
        relation["historic"](around:${radius},${lat},${lon});

        node["tourism"="museum"](around:${radius},${lat},${lon});
        way["tourism"="museum"](around:${radius},${lat},${lon});

        node["tourism"="gallery"](around:${radius},${lat},${lon});
        way["tourism"="gallery"](around:${radius},${lat},${lon});

        node["tourism"="zoo"](around:${radius},${lat},${lon});
        way["tourism"="zoo"](around:${radius},${lat},${lon});

        node["tourism"="theme_park"](around:${radius},${lat},${lon});
        way["tourism"="theme_park"](around:${radius},${lat},${lon});

        node["tourism"="attraction"](around:${radius},${lat},${lon});
        way["tourism"="attraction"](around:${radius},${lat},${lon});

        node["leisure"="park"](around:${radius},${lat},${lon});
        way["leisure"="park"](around:${radius},${lat},${lon});
        relation["leisure"="park"](around:${radius},${lat},${lon});

        node["leisure"="garden"](around:${radius},${lat},${lon});
        way["leisure"="garden"](around:${radius},${lat},${lon});

        node["leisure"="nature_reserve"](around:${radius},${lat},${lon});
        way["leisure"="nature_reserve"](around:${radius},${lat},${lon});

        node["amenity"="restaurant"](around:${radius},${lat},${lon});
        node["amenity"="cafe"](around:${radius},${lat},${lon});
        node["amenity"="pub"](around:${radius},${lat},${lon});
        node["amenity"="bar"](around:${radius},${lat},${lon});
      );
      out center;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery,
      });
      const json = await response.json();

      const results = json.elements.map((el) => {
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        return {
          id: el.id,
          name: el.tags.name || 'Unnamed place',
          lat,
          lon,
        };
      });

      // Wikipedia fetch in parallel for speed
      const enrichedResults = await Promise.all(
        results.map(async (place) => {
          try {
            const wikiRes = await fetch(
              `https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=pageimages|description|info&inprop=url&generator=search&gsrsearch=${encodeURIComponent(
                place.name
              )}`
            );
            const wikiJson = await wikiRes.json();
            const pages = wikiJson.query?.pages;
            const first = pages && Object.values(pages)[0];
            if (first) {
              place.image = first.thumbnail?.source;
              place.description = first.description;
              place.link = first.fullurl;
            }
          } catch (err) {
            console.log('Wikipedia fetch failed for', place.name);
          }
          return place;
        })
      );

      setPlaces(enrichedResults);
    } catch (err) {
      console.error('Overpass fetch error:', err);
      setPlaces([]);
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <h2>ExploreLocal</h2>
        <div className="mode-toggle">
          <label>
            <input
              type="radio"
              checked={mode === 'location'}
              onChange={() => setMode('location')}
            />
            Use My Location
          </label>
          <label>
            <input
              type="radio"
              checked={mode === 'city'}
              onChange={() => setMode('city')}
            />
            Search City
          </label>
        </div>

        {mode === 'city' && (
          <div className="city-search">
            <input
              type="text"
              placeholder="Enter city..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <button onClick={handleCitySearch}>Search</button>
          </div>
        )}

        <ul className="place-list">
          {places.map((place) => (
            <li
              key={place.id}
              className={selectedPlace?.id === place.id ? 'selected' : ''}
              onClick={() => {
                setSelectedPlace(place);
                setMapCenter([place.lat, place.lon]);
              }}
            >
              <strong>{place.name}</strong>
              {place.image && <img src={place.image} alt={place.name} />}
              {place.description && <p>{place.description}</p>}
              {place.link && (
                <a href={place.link} target="_blank" rel="noreferrer">
                  View on Wikipedia
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="developer-credit">Developed by Alif CSE-15 BRUR</div>


      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={13}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {places.map((place) => (
            <Marker
              key={place.id}
              position={[place.lat, place.lon]}
              icon={icon}
            >
              <Popup>
                <strong>{place.name}</strong>
                {place.description && <p>{place.description}</p>}
                {place.link && (
                  <a href={place.link} target="_blank" rel="noreferrer">
                    View on Wikipedia
                  </a>
                )}
              </Popup>
            </Marker>
          ))}
          {selectedPlace && (
            <FlyToLocation position={[selectedPlace.lat, selectedPlace.lon]} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
