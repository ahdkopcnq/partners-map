const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj3dCbexK-9lDsQ0v7sVTCb86GTwO9Ee0oOxasYUfzwHNQhwvWxqxk1U-3l-h72Tj7v6-d8oWd7qHU/pub?gid=0&single=true&output=csv";

let map;
let partners = [];
let markers = [];
let infoWindow;
let geocoder;
let isSearchMode = false;
let currentSortedPartners = [];

window.closePartnerPopup = () => infoWindow.close();

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

  map.addListener("dragstart", () => {
    if (isSearchMode) {
      showAllPartnersWithoutFit();
    }
  });

  map.addListener("click", () => {
    infoWindow.close();
  });

}

function showAllPartnersWithoutFit() {
    isSearchMode = false;
    infoWindow.close();
  
    // Tous les marqueurs réapparaissent sur la carte
    renderMarkers(currentSortedPartners, false);
  
    // La liste reste triée par distance
    renderList(currentSortedPartners);
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

function renderMarkers(data, shouldFit = true) {
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
  
    if (shouldFit) {
      fitMapToMarkers(markers);
    }
  }
  
  function renderMarkersWithoutFit(data) {
    renderMarkers(data, false);
  }


  function renderList(data) {
    const list = document.getElementById("list");
    list.innerHTML = "";
  
    data.forEach((partner, index) => {
      const isCertified = (partner["Partner type"] || "")
        .toLowerCase()
        .includes("certified");
  
      const lat = partner.Latitude;
      const lng = partner.Longitude;
      const phone = partner.Phone || "";
      const email = partner.Mail || "";

      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      const phoneUrl = phone ? `tel:${phone.replace(/\s/g, "")}` : "";

const contactSubject = encodeURIComponent("Appointment request via decilo");
const contactBody = encodeURIComponent(
`Dear,

I found your contact details through the decilo partner network.

I would like to schedule an appointment.

Could you please let me know your availability?

Thank you in advance.

Best regards,`
);

const mailUrl = email
  ? `mailto:${encodeURIComponent(email)}?subject=${contactSubject}&body=${contactBody}`
  : "";

const contactButton = email
  ? `<a class="partner-btn" href="${mailUrl}" onclick="event.stopPropagation();">
       <span class="card-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/></svg></span>
       Contact
     </a>`
  : "";

  
      const callButton = phone
        ? `<a class="partner-btn" href="${phoneUrl}" onclick="event.stopPropagation();">
             <span class="card-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.8L7.7 9.6a16 16 0 0 0 6.7 6.7l1.3-1.3a2 2 0 0 1 1.8-.6l2.8.5a2 2 0 0 1 1.7 2z"/></svg></span>
             Call
           </a>`
        : "";

  
      const card = document.createElement("div");
      card.className = "partner-card";
  
      card.innerHTML = `
        <span class="badge ${isCertified ? "certified" : "ear"}">
          ${partner["Partner type"] || "Partner"}
        </span>
  
        <h3>${partner.Partner || ""}</h3>
  
        <p class="partner-address">${formatAddress(partner.Address)}</p>
  
        <div class="partner-actions-row">
          <div class="partner-actions">

${callButton}
${contactButton}

<a class="partner-btn partner-btn-light" href="${directionsUrl}" target="_blank" onclick="event.stopPropagation();">

            <span class="card-icon"><svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2z"/></svg></span>
            Directions
          </a>
          </div>
  
        ${
          partner.distance
            ? `<div class="partner-distance-inline">
                 <span class="distance-pin">📍</span>
                 ${partner.distance.toFixed(1)} km
               </div>`
            : ""
        }
      </div>
    `;
  
card.addEventListener("click", () => {
  openPartner(partner, markers[index]);
  map.panTo(markers[index].getPosition());
  map.setZoom(13);

  if (window.innerWidth <= 900) {
    document.getElementById("map").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
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
  
    const isCertified =
      (partner["Partner type"] || "")
        .toLowerCase()
        .includes("certified");
  
    const badge = isCertified
      ? `<div class="info-badge certified">
           ⭐ decilo Certified Partner
         </div>`
      : `<div class="info-badge ear">
           Ear Impressions Partner
         </div>`;
  
    const directionsUrl =
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  
    const phoneUrl =
      phone ? `tel:${phone.replace(/\s/g, "")}` : "";
  
    const websiteUrl =
      website
        ? (website.startsWith("http")
            ? website
            : `https://${website}`)
        : "";

        const contactSubject = encodeURIComponent("Appointment request via decilo");
const contactBody = encodeURIComponent(
`Dear,

I found your contact details through the decilo partner network.

I would like to schedule an appointment.

Could you please let me know your availability?

Thank you in advance.

Best regards,`
);

const mailUrl = email
  ? `mailto:${email}?subject=${contactSubject}&body=${contactBody}`
  : "";
  
        const content = `
        <div class="info-window">
      
<button class="custom-close"
        onclick="window.closePartnerPopup()">
</button>
      
          ${badge}
      
          <h3>${partner.Partner || ""}</h3>
  
        <p>${formatAddress(partner.Address)}</p>
  
        ${phone || email ? `
            <div class="info-contact">
              ${phone ? `<div>${phone}</div>` : ""}
              ${email ? `<div>${email}</div>` : ""}
            </div>
          ` : ""}
  
<div class="info-actions popup-actions">

  ${phone ? `
<a class="partner-btn partner-btn-light"
       href="${phoneUrl}">
      <span class="card-icon">
        <svg viewBox="0 0 24 24">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.8L7.7 9.6a16 16 0 0 0 6.7 6.7l1.3-1.3a2 2 0 0 1 1.8-.6l2.8.5a2 2 0 0 1 1.7 2z"/>
        </svg>
      </span>
      Call
    </a>
  ` : ""}

  ${email ? `
  <a class="partner-btn" href="${mailUrl}">
    <span class="card-icon">
      <svg viewBox="0 0 24 24">
        <path d="M4 4h16v16H4z"/>
        <path d="m22 6-10 7L2 6"/>
      </svg>
    </span>
    Contact
  </a>
` : ""}

<a class="partner-btn partner-btn-light popup-btn"
   href="${directionsUrl}"
   target="_blank">
  <span class="card-icon">
    <svg viewBox="0 0 24 24">
      <path d="M22 2 11 13"/>
      <path d="M22 2 15 22 11 13 2 9 22 2z"/>
    </svg>
  </span>
  Directions
</a>

${/*
  ${website ? `
    <a class="partner-btn partner-btn-light popup-btn"
       href="${websiteUrl}"
       target="_blank">
      Website
    </a>
  ` : ""}
  */""}

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
        alert("No location found.");
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
        alert("This location is outside the covered area.");
                return;
      }

      const location = validResult.geometry.location;
      showClosestPartners(location.lat(), location.lng());
    }
  );
}

function showClosestPartners(centerLat, centerLng) {
    isSearchMode = true;
  
    currentSortedPartners = [...partners]
      .map(p => ({
        ...p,
        distance: calculateDistance(
          centerLat,
          centerLng,
          parseFloat(p.Latitude),
          parseFloat(p.Longitude)
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  
    const closest = currentSortedPartners.slice(0, 10);
  
    renderMarkers(closest);
    renderList(closest);
  
    map.setCenter({ lat: centerLat, lng: centerLng });
    map.setZoom(11);
  }

function resetSearch() {
  document.getElementById("searchInput").value = "";
  infoWindow.close();
  isSearchMode = false;
  currentSortedPartners = [];

  renderMarkers(partners);
  renderList(partners);
  fitMapToMarkers(markers);
}

function useGeolocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by this browser.");
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
        alert("Unable to retrieve your location.");
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

const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearSearchBtn");

searchInput.addEventListener("input", () => {
  clearBtn.style.display =
    searchInput.value.trim() ? "block" : "none";
});

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearBtn.style.display = "none";
  resetSearch();
});