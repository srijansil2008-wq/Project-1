const weatherDescriptions = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "🌧️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorms", "⛈️"],
  96: ["Thunderstorms", "⛈️"],
  99: ["Thunderstorms", "⛈️"],
};

const state = {
  latitude: null,
  longitude: null,
  locationName: "",
  timezone: "auto",
  unit: "celsius",
  weather: null,
  suggestions: [],
  activeSuggestion: -1,
  suggestionRequest: 0,
  suggestionTimer: null,
};

const elements = {
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#city-search"),
  suggestions: document.querySelector("#city-suggestions"),
  locationButton: document.querySelector("#location-button"),
  unitToggle: document.querySelector("#unit-toggle"),
  refreshButton: document.querySelector("#refresh-button"),
  status: document.querySelector("#status-message"),
  place: document.querySelector("#place-name"),
  date: document.querySelector("#current-date"),
  icon: document.querySelector("#current-icon"),
  temperature: document.querySelector("#current-temp"),
  condition: document.querySelector("#current-condition"),
  high: document.querySelector("#today-high"),
  low: document.querySelector("#today-low"),
  feelsLike: document.querySelector("#feels-like"),
  humidity: document.querySelector("#humidity"),
  wind: document.querySelector("#wind-speed"),
  precipitation: document.querySelector("#precipitation"),
  uv: document.querySelector("#uv-index"),
  hourly: document.querySelector("#hourly-forecast"),
  daily: document.querySelector("#daily-forecast"),
  sunrise: document.querySelector("#sunrise"),
  sunset: document.querySelector("#sunset"),
  updated: document.querySelector("#updated-at"),
};

function weatherForCode(code) {
  return weatherDescriptions[code] ?? ["Variable conditions", "🌤️"];
}

function temperature(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--°";
  const converted = state.unit === "fahrenheit" ? (value * 9) / 5 + 32 : value;
  return `${Math.round(converted)}°`;
}

function formatClock(value) {
  if (!value) return "--:--";
  return value.slice(11, 16);
}

function localTimeLabel(value) {
  const hour = Number(value.slice(11, 13));
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function formatDay(value, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function displayWind(speed) {
  if (speed === null || speed === undefined) return "--";
  return state.unit === "fahrenheit"
    ? `${Math.round(speed * 0.621371)} mph`
    : `${Math.round(speed)} km/h`;
}

function displayPrecipitation(amount) {
  if (amount === null || amount === undefined) return "--";
  return state.unit === "fahrenheit"
    ? `${(amount / 25.4).toFixed(2)} in`
    : `${amount.toFixed(1)} mm`;
}

function setStatus(message = "") {
  elements.status.textContent = message;
}

function setLoading(loading) {
  elements.refreshButton.classList.toggle("is-loading", loading);
  elements.refreshButton.disabled = loading;
}

function showUnavailable() {
  if (state.weather) return;
  elements.place.textContent = "Weather unavailable";
  elements.date.textContent = "Try searching again or refreshing";
  elements.temperature.innerHTML = "--<span>°</span>";
  elements.condition.textContent = "Forecast unavailable";
  elements.high.textContent = "--°";
  elements.low.textContent = "--°";
  elements.feelsLike.textContent = "--°";
  elements.humidity.textContent = "--%";
  elements.wind.textContent = "--";
  elements.precipitation.textContent = "--";
  elements.uv.textContent = "--";
  elements.sunrise.textContent = "--:--";
  elements.sunset.textContent = "--:--";
  elements.hourly.innerHTML = '<p class="loading-copy">Hourly forecast unavailable.</p>';
  elements.daily.innerHTML = '<p class="loading-copy">7-day forecast unavailable.</p>';
}

async function findCity(city) {
  const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
  endpoint.search = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json",
  });
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("Could not reach the city search service. Please try again.");
  const result = await response.json();
  const match = result.results?.[0];
  if (!match) throw new Error(`We couldn't find "${city}". Check the spelling and try again.`);
  return {
    ...locationFromResult(match),
  };
}

function locationFromResult(result) {
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: [result.name, result.admin1, result.country].filter((part, index, list) => part && list.indexOf(part) === index).join(", "),
    timezone: result.timezone || "auto",
  };
}

async function findCities(city) {
  const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
  endpoint.search = new URLSearchParams({
    name: city,
    count: "5",
    language: "en",
    format: "json",
  });
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("City suggestions are unavailable. Press Search to try anyway.");
  const result = await response.json();
  return (result.results ?? []).map(locationFromResult);
}

function closeSuggestions() {
  state.suggestions = [];
  state.activeSuggestion = -1;
  elements.suggestions.replaceChildren();
  elements.suggestions.hidden = true;
  elements.searchInput.setAttribute("aria-expanded", "false");
  elements.searchInput.removeAttribute("aria-activedescendant");
}

function renderSuggestions(message = "") {
  elements.suggestions.replaceChildren();
  if (!state.suggestions.length && !message) {
    closeSuggestions();
    return;
  }

  if (message) {
    const note = document.createElement("p");
    note.className = "suggestion-message";
    note.textContent = message;
    elements.suggestions.append(note);
  } else {
    state.suggestions.forEach((location, index) => {
      const option = document.createElement("button");
      option.className = `suggestion-option${index === state.activeSuggestion ? " is-active" : ""}`;
      option.id = `city-suggestion-${index}`;
      option.type = "button";
      option.role = "option";
      option.setAttribute("aria-selected", String(index === state.activeSuggestion));
      const city = document.createElement("span");
      city.className = "suggestion-city";
      city.textContent = location.name.split(", ")[0];
      const detail = document.createElement("span");
      detail.className = "suggestion-detail";
      detail.textContent = location.name.split(", ").slice(1).join(", ");
      option.append(city, detail);
      option.addEventListener("click", () => selectSuggestion(index));
      elements.suggestions.append(option);
    });
  }

  elements.suggestions.hidden = false;
  elements.searchInput.setAttribute("aria-expanded", "true");
  elements.searchInput.removeAttribute("aria-activedescendant");
  if (state.activeSuggestion >= 0) {
    elements.searchInput.setAttribute("aria-activedescendant", `city-suggestion-${state.activeSuggestion}`);
  }
}

async function selectSuggestion(index) {
  const location = state.suggestions[index];
  if (!location) return;
  closeSuggestions();
  elements.searchInput.value = "";
  await loadLocation(location);
}

async function updateSuggestions(query) {
  const request = ++state.suggestionRequest;
  if (query.length < 2) {
    closeSuggestions();
    return;
  }

  renderSuggestions("Searching cities...");
  try {
    const locations = await findCities(query);
    if (request !== state.suggestionRequest || elements.searchInput.value.trim() !== query) return;
    state.suggestions = locations;
    state.activeSuggestion = -1;
    renderSuggestions(locations.length ? "" : "No matching cities. Try a different search.");
  } catch (error) {
    if (request !== state.suggestionRequest) return;
    renderSuggestions(error instanceof Error ? error.message : "City suggestions are unavailable. Press Search to try anyway.");
  }
}

async function fetchWeather(location) {
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
    timezone: location.timezone,
    forecast_days: "7",
  });
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("Could not load the forecast. Please check your connection and try again.");
  return response.json();
}

function renderHourly(weather) {
  const now = weather.current.time;
  let startIndex = weather.hourly.time.findIndex((time) => time >= now);
  if (startIndex < 0) startIndex = 0;
  const times = weather.hourly.time.slice(startIndex, startIndex + 12);
  elements.hourly.replaceChildren();
  for (const [offset, time] of times.entries()) {
    const index = startIndex + offset;
    const item = document.createElement("div");
    item.className = `hour-item${offset === 0 ? " is-now" : ""}`;
    const icon = weatherForCode(weather.hourly.weather_code[index])[1];
    item.innerHTML = `<span class="hour-time">${offset === 0 ? "Now" : localTimeLabel(time)}</span>
      <span class="hour-icon" aria-hidden="true">${icon}</span>
      <strong class="hour-temp">${temperature(weather.hourly.temperature_2m[index])}</strong>
      <span class="hour-rain">💧 ${weather.hourly.precipitation_probability[index] ?? 0}%</span>`;
    elements.hourly.append(item);
  }
}

function renderDaily(weather) {
  elements.daily.replaceChildren();
  weather.daily.time.forEach((day, index) => {
    const item = document.createElement("div");
    item.className = "day-item";
    item.innerHTML = `<span class="day-name">${formatDay(day, index)}</span>
      <span class="day-icon" aria-label="${weatherForCode(weather.daily.weather_code[index])[0]}">${weatherForCode(weather.daily.weather_code[index])[1]}</span>
      <span class="day-temps"><strong>${temperature(weather.daily.temperature_2m_max[index])}</strong><span>${temperature(weather.daily.temperature_2m_min[index])}</span></span>`;
    elements.daily.append(item);
  });
}

function renderWeather() {
  const weather = state.weather;
  if (!weather) return;
  const current = weather.current;
  const currentCondition = weatherForCode(current.weather_code);
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${weather.daily.time[0]}T12:00:00Z`));

  elements.place.textContent = state.locationName;
  elements.date.textContent = date;
  elements.icon.textContent = current.is_day ? currentCondition[1] : (current.weather_code === 0 ? "🌙" : currentCondition[1]);
  elements.temperature.innerHTML = `${temperature(current.temperature_2m).replace("°", "")}<span>°</span>`;
  elements.condition.textContent = currentCondition[0];
  elements.high.textContent = temperature(weather.daily.temperature_2m_max[0]);
  elements.low.textContent = temperature(weather.daily.temperature_2m_min[0]);
  elements.feelsLike.textContent = temperature(current.apparent_temperature);
  elements.humidity.textContent = `${current.relative_humidity_2m}%`;
  elements.wind.textContent = displayWind(current.wind_speed_10m);
  elements.precipitation.textContent = displayPrecipitation(current.precipitation);
  elements.uv.textContent = String(Math.round(weather.daily.uv_index_max[0]));
  elements.sunrise.textContent = formatClock(weather.daily.sunrise[0]);
  elements.sunset.textContent = formatClock(weather.daily.sunset[0]);
  elements.updated.textContent = `Updated ${new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: state.timezone,
  }).format(new Date())}`;
  renderHourly(weather);
  renderDaily(weather);
  elements.unitToggle.innerHTML = `<span class="${state.unit === "celsius" ? "active-unit" : ""}">°C</span> / <span class="${state.unit === "fahrenheit" ? "active-unit" : ""}">°F</span>`;
  elements.unitToggle.setAttribute("aria-label", `Switch to ${state.unit === "celsius" ? "Fahrenheit" : "Celsius"}`);
}

async function loadLocation(location) {
  setStatus("");
  setLoading(true);
  try {
    const weather = await fetchWeather(location);
    state.latitude = location.latitude;
    state.longitude = location.longitude;
    state.locationName = location.name;
    state.timezone = location.timezone;
    state.weather = weather;
    renderWeather();
  } catch (error) {
    showUnavailable();
    setStatus(error instanceof Error ? error.message : "Something went wrong while loading the forecast.");
  } finally {
    setLoading(false);
  }
}

elements.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.activeSuggestion >= 0) {
    await selectSuggestion(state.activeSuggestion);
    return;
  }
  const city = elements.searchInput.value.trim();
  if (!city) {
    setStatus("Enter a city name to search.");
    elements.searchInput.focus();
    return;
  }
  closeSuggestions();
  try {
    const location = await findCity(city);
    elements.searchInput.value = "";
    await loadLocation(location);
  } catch (error) {
    showUnavailable();
    setStatus(error instanceof Error ? error.message : "Something went wrong while searching.");
  }
});

elements.searchInput.addEventListener("input", () => {
  clearTimeout(state.suggestionTimer);
  state.suggestionRequest += 1;
  closeSuggestions();
  const query = elements.searchInput.value.trim();
  state.suggestionTimer = setTimeout(() => updateSuggestions(query), 250);
});

elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSuggestions();
    return;
  }
  if (!state.suggestions.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    state.activeSuggestion = (state.activeSuggestion + direction + state.suggestions.length) % state.suggestions.length;
    renderSuggestions();
  } else if (event.key === "Enter" && state.activeSuggestion >= 0) {
    event.preventDefault();
    selectSuggestion(state.activeSuggestion);
  }
});

elements.searchInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!elements.suggestions.contains(document.activeElement)) closeSuggestions();
  }, 120);
});

elements.searchInput.addEventListener("focus", () => {
  if (state.suggestions.length) renderSuggestions();
});

elements.locationButton.addEventListener("click", () => {
  closeSuggestions();
  if (!navigator.geolocation) {
    setStatus("Location services are not supported by this browser.");
    return;
  }
  setStatus("");
  setLoading(true);
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      await loadLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        name: "Your location",
        timezone: "auto",
      });
    },
    (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? "Location access was denied. You can still search for a city."
        : "Could not determine your location. Please try searching for a city.";
      setStatus(message);
      setLoading(false);
    },
    { enableHighAccuracy: false, timeout: 10000 },
  );
});

elements.unitToggle.addEventListener("click", () => {
  state.unit = state.unit === "celsius" ? "fahrenheit" : "celsius";
  renderWeather();
});

elements.refreshButton.addEventListener("click", () => {
  if (state.latitude === null || state.longitude === null) return;
  loadLocation({
    latitude: state.latitude,
    longitude: state.longitude,
    name: state.locationName,
    timezone: state.timezone,
  });
});

loadLocation({
  latitude: 40.7128,
  longitude: -74.006,
  name: "New York, New York, United States",
  timezone: "America/New_York",
});
