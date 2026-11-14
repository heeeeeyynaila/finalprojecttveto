/* Field Shift – Backend API Integration */
(function() {
  "use strict";
  const API_BASE = window.FS_API_URL || "http://localhost:8000";

  let deviceId = localStorage.getItem("fs_device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    try { localStorage.setItem("fs_device_id", deviceId); } catch (e) {}
  }

  const API = {
    base: API_BASE,
    deviceId,
    online: false,

    async checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined });
        if (res.ok) {
          const data = await res.json();
          this.online = !!data.ok;
          return this.online;
        }
      } catch (e) {
        this.online = false;
      }
      return false;
    },

    async getNearestLocation(lat, lon) {
      try {
        const res = await fetch(`${API_BASE}/v1/locations/nearest?lat=${lat}&lon=${lon}`);
        if (res.status === 200) {
          return await res.json();
        }
        if (res.status === 202) {
          const body = await res.json();
          return body.fallback || null;
        }
      } catch (e) {
        console.warn("[FieldShift API] Nearest location fallback to offline:", e.message);
      }
      return null;
    },

    async saveFarm(lat, lon, farmInputs) {
      try {
        const res = await fetch(`${API_BASE}/v1/farms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            lat: Number(lat),
            lon: Number(lon),
            inputs: farmInputs || {}
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.farm_id) {
            try { localStorage.setItem("fs_farm_id", data.farm_id); } catch (e) {}
            return data;
          }
        }
      } catch (e) {
        console.warn("[FieldShift API] Save farm offline fallback:", e.message);
      }
      return null;
    },

    async recordAttempt(farmId, rotation, score, details) {
      if (!farmId) {
        try { farmId = localStorage.getItem("fs_farm_id"); } catch (e) {}
      }
      if (!farmId) return null;
      try {
        const res = await fetch(`${API_BASE}/v1/farms/${farmId}/attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rotation: Array.isArray(rotation) && rotation.length ? rotation : ["wheat"],
            score: score != null ? Number(score) : null,
            details: details || {}
          })
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn("[FieldShift API] Record attempt offline fallback:", e.message);
      }
      return null;
    },

    async getCropTraits(cropId) {
      try {
        const url = cropId ? `${API_BASE}/v1/crops/${cropId}` : `${API_BASE}/v1/crops`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn("[FieldShift API] Crop traits offline fallback:", e.message);
      }
      return null;
    },

    async getSuitability(lat, lon, crop, lastCrop) {
      try {
        const q = new URLSearchParams({ lat, lon, crop, last_crop: lastCrop || "" });
        const res = await fetch(`${API_BASE}/v1/suitability?${q.toString()}`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn("[FieldShift API] Suitability offline fallback:", e.message);
      }
      return null;
    }
  };

  window.FS_API = API;
  try {
    API.checkHealth().then((ok) => {
      if (ok) console.log("🌾 FieldShift connected to API at " + API_BASE);
    });
  } catch (e) {}
})();
