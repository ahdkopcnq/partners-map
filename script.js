const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj3dCbexK-9lDsQ0v7sVTCb86GTwO9Ee0oOxasYUfzwHNQhwvWxqxk1U-3l-h72Tj7v6-d8oWd7qHU/pub?gid=0&single=true&output=csv";

let map;
let partners = [];
let markers = [];
let infoWindow;
let geocoder;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 50.5039, lng: 4.4699 },
    zoom: 8,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });

  infoWindow = new google.maps.InfoWindow();
  geocoder = new google.maps.Geocoder();

  initAutocomplete();
  loadPartners();
}

function initAutocomplete() {
    const input = document.getElementById("searchInput");
  
    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ["geometry", "formatted_address", "address_components"],
      types: ["geocode"],
      componentRestrictions: {
        country: ["be", "fr", "lu", "ch", "de", "nl"]
      }
    });
  
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
  
      if (!place.geometry || !place.geometry.location) {
        return;
      }
  
      showClosestPartners(
        place.geometry.location.lat(),
        place.geometry.location.lng()
      );
    });
  }

function loadPartners() {
  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      partners = results.data.filter(p => p.Latitude && p.Longitude);
      console.log("Partners loaded:", partners.length);
      renderMarkers(partners);
      renderList(partners);
    }
  });
}

function renderMarkers(data) {
  markers.forEach(marker => marker.setMap(null));
  markers = [];

  data.forEach(partner => {
    const lat = parseFloat(partner.Latitude);
    const lng = parseFloat(partner.Longitude);
    const isCertified = (partner["Partner type"] || "").toLowerCase().includes("certified");

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: partner.Partner,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isCertified ? 9 : 7,
        fillColor: isCertified ? "#b98a2d" : "#111111",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
    });

    marker.addListener("click", () => openPartner(partner, marker));
    markers.push(marker);
  });

  fitMapToMarkers(markers);
}

function renderList(data) {
  const list = document.getElementById("list");
  list.innerHTML = "";

  data.forEach((partner, index) => {
    const isCertified = (partner["Partner type"] || "").toLowerCase().includes("certified");

    const card = document.createElement("div");
    card.className = "partner-card";
    card.innerHTML = `
      <span class="badge ${isCertified ? "certified" : "ear"}">${partner["Partner type"] || "Partner"}</span>
      <h3>${partner.Partner || ""}</h3>
      <p>${formatAddress(partner.Address)}</p>
    `;

    card.addEventListener("click", () => {
      openPartner(partner, markers[index]);
      map.panTo(markers[index].getPosition());
      map.setZoom(13);
    });

    list.appendChild(card);
  });
}

function openPartner(partner, marker) {
  const lat = partner.Latitude;
  const lng = partner.Longitude;
  const phone = partner.Phone || "";
  const website = partner.Website || "";
  const email = partner.Mail || "";

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const phoneUrl = phone ? `tel:${phone.replace(/\s/g, "")}` : "";
  const websiteUrl = website ? (website.startsWith("http") ? website : `https://${website}`) : "";

  const content = `
    <div class="info-window">
      <h3>${partner.Partner || ""}</h3>
      <p>${formatAddress(partner.Address)}</p>
      ${phone ? `<p>📞 ${phone}</p>` : ""}
      ${email ? `<p>✉️ ${email}</p>` : ""}
      <div class="info-actions">
        <a href="${directionsUrl}" target="_blank">Itinéraire</a>
        ${phone ? `<a class="light" href="${phoneUrl}">Appeler</a>` : ""}
        ${website ? `<a class="light" href="${websiteUrl}" target="_blank">Site web</a>` : ""}
      </div>
    </div>
  `;

  infoWindow.setContent(content);
  infoWindow.open(map, marker);
}

function formatAddress(address) {
  return (address || "").replace(/\n/g, "<br>");
}

function fitMapToMarkers(markerList) {
  if (!markerList.length) return;

  const bounds = new google.maps.LatLngBounds();
  markerList.forEach(marker => bounds.extend(marker.getPosition()));
  map.fitBounds(bounds);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchBtn").addEventListener("click", searchPartners);

  document.getElementById("searchInput").addEventListener("keydown", event => {
    if (event.key === "Enter") searchPartners();
  });

  document.getElementById("geoBtn").addEventListener("click", useGeolocation);
  document.getElementById("resetBtn").addEventListener("click", resetSearch);
});

function searchPartners() {
  const queryRaw = document.getElementById("searchInput").value.trim();

  if (!queryRaw) {
    resetSearch();
    return;
  }

  geocodeLocation(queryRaw);
}

function geocodeLocation(queryRaw) {
  geocoder.geocode(
    {
      address: queryRaw,
      bounds: {
        north: 53.8,
        south: 42.0,
        east: 12.5,
        west: -6.5
      }
    },
    function(results, status) {
      if (status !== "OK" || !results.length) {
        alert("Aucun lieu trouvé pour cette recherche.");
        return;
      }

      const allowedCountries = ["BE", "FR", "LU", "CH", "DE", "NL"];

      const validResult = results.find(result => {
        const country = result.address_components.find(component =>
          component.types.includes("country")
        );

        return country && allowedCountries.includes(country.short_name);
      });

      if (!validResult) {
        alert("Cette recherche est en dehors de la zone couverte.");
        return;
      }

      const location = validResult.geometry.location;
      showClosestPartners(location.lat(), location.lng());
    }
  );
}

function showClosestPartners(centerLat, centerLng) {
  const closest = [...partners]
    .map(p => ({
      ...p,
      distance: calculateDistance(
        centerLat,
        centerLng,
        parseFloat(p.Latitude),
        parseFloat(p.Longitude)
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  renderMarkers(closest);
  renderList(closest);

  map.setCenter({ lat: centerLat, lng: centerLng });
  map.setZoom(11);
}

function resetSearch() {
  document.getElementById("searchInput").value = "";
  infoWindow.close();

  renderMarkers(partners);
  renderList(partners);
  fitMapToMarkers(markers);
}

function useGeolocation() {
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas disponible sur ce navigateur.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const userPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      showClosestPartners(userPos.lat, userPos.lng);
    },
    () => {
      alert("Impossible d'obtenir votre position.");
    }
  );
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) *
    Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}