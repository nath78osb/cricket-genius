import { WeatherData } from "./cchiLogic";

const WEATHERAPI_KEY = import.meta.env.VITE_WEATHERAPI_KEY;

const geocodeCache = new Map<string, string>();

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e: any) {
    clearTimeout(id);
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms. Please try again.`);
    }
    throw e;
  }
};

async function fetchWeatherApiData(lat: number, lng: number, timeout = 15000): Promise<WeatherData | null> {
  if (!WEATHERAPI_KEY) return null;

  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lng}&aqi=no`;
    const res = await fetchWithTimeout(url, {}, timeout);
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.current) return null;
    
    const current = data.current;
    const location = data.location;

    return {
      location: `${location.name}, ${location.region}, ${location.country}`,
      station: `WeatherAPI.com Station: ${location.name} (Lat: ${location.lat}, Lng: ${location.lon})`,
      temperature: current.temp_c || 0,
      humidity: current.humidity || 0,
      windSpeed: current.wind_mph || 0,
      cloudCover: current.cloud || 0,
      precipitation: current.precip_mm || 0,
      visibility: current.vis_km || 10,
      uvIndex: current.uv || 0,
      timeOfDay: current.is_day ? "day" : "night"
    };
  } catch (e) {
    // Silently fail and return null so the caller can fall back to Open-Meteo
    return null;
  }
}

export interface HourlyWeatherData extends WeatherData {
  time: string;
}

export interface WeatherFetchResult {
  current: WeatherData;
  hourly?: HourlyWeatherData[];
  minute?: HourlyWeatherData[];
}

export async function fetchBulkCurrentWeather(locations: {lat: number, lng: number}[], enableSmoothing: boolean = true): Promise<WeatherData[]> {
  if (locations.length === 0) return [];
  
  let weatherApiResults: (WeatherData | null)[] = new Array(locations.length).fill(null);
  let openMeteoResults: (WeatherData | null)[] = new Array(locations.length).fill(null);
  
  const weatherApiPromise = WEATHERAPI_KEY ? Promise.all(
    locations.map(loc => fetchWeatherApiData(loc.lat, loc.lng, 4000))
  ) : Promise.resolve(weatherApiResults);

  const lats = locations.map(l => l.lat).join(',');
  const lngs = locations.map(l => l.lng).join(',');
  const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,is_day,visibility,uv_index,shortwave_radiation&timezone=auto&wind_speed_unit=mph`;
  
  const openMeteoPromise = fetchWithTimeout(omUrl, {}, 10000)
    .then(async res => {
      if (res.ok) {
        const data = await res.json();
        const omDataArray = Array.isArray(data) ? data : [data];
        return omDataArray.map((result, idx) => {
          const current = result.current || {};
          return {
            location: `${locations[idx].lat.toFixed(4)}, ${locations[idx].lng.toFixed(4)}`,
            station: "Open-Meteo Bulk",
            temperature: current.temperature_2m || 0,
            humidity: current.relative_humidity_2m || 0,
            windSpeed: current.wind_speed_10m || 0,
            cloudCover: current.cloud_cover || 0,
            precipitation: current.precipitation || 0,
            visibility: (current.visibility || 10000) / 1000,
            uvIndex: current.uv_index || 0,
            timeOfDay: current.is_day ? "day" : "night"
          } as WeatherData;
        });
      }
      return openMeteoResults;
    })
    .catch(e => {
      console.error("Open-Meteo bulk failed", e);
      return openMeteoResults;
    });

  [weatherApiResults, openMeteoResults] = await Promise.all([weatherApiPromise, openMeteoPromise]);

  const smooth = (live: number, forecast: number, threshold: number) => {
    if (Math.abs(live - forecast) > threshold) {
      return Number(((live + forecast * 2) / 3).toFixed(1));
    }
    return live;
  };

  return locations.map((loc, i) => {
    const live = weatherApiResults[i];
    const om = openMeteoResults[i];

    if (live && om && enableSmoothing) {
      live.temperature = smooth(live.temperature, om.temperature, 10);
      live.humidity = smooth(live.humidity, om.humidity, 30);
      live.windSpeed = smooth(live.windSpeed, om.windSpeed, 20);
      live.precipitation = smooth(live.precipitation, om.precipitation, 10);
      live.uvIndex = smooth(live.uvIndex, om.uvIndex, 3);
      return live;
    }
    
    if (live) return live;
    if (om) return om;

    return {
      location: `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`,
      station: "Unknown",
      temperature: 0, humidity: 0, windSpeed: 0, cloudCover: 0,
      precipitation: 0, visibility: 10, uvIndex: 0, timeOfDay: "day"
    };
  });
}

export async function fetchWeatherData(lat: number, lng: number, mode: 'live' | 'forecast' | 'minute', enableSmoothing: boolean = true): Promise<WeatherFetchResult> {
  console.log(`Fetching weather data for ${lat}, ${lng} in mode: ${mode}`);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`Invalid coordinates: ${lat}, ${lng}`);
  }

  const getGeocodedLocationName = async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }
    
    let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      // Use a shorter timeout for geocoding so it doesn't block the UI for long
      const geoRes = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`, {}, 2500);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.address) {
          const a = geoData.address;
          const specific = a.amenity || a.building || a.road || a.neighbourhood || a.suburb || a.village || a.town || a.city;
          const region = a.city || a.state || a.country;
          if (specific && region && specific !== region) {
            locationName = `${specific}, ${region}`;
          } else {
            locationName = specific || region || locationName;
          }
          geocodeCache.set(cacheKey, locationName);
        }
      }
    } catch (e) {
      console.warn("Geocoding failed or timed out", e);
    }
    return locationName;
  };

  if (mode === 'minute') {
    try {
      // Use Open-Meteo minutely_15 for completely free short-term forecasting
      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,is_day&minutely_15=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto&wind_speed_unit=mph`;
      
      // Run geocoding and weather fetch in parallel
      const [res, locationName] = await Promise.all([
        fetchWithTimeout(openMeteoUrl, {}, 15000).catch(e => {
          return null;
        }),
        getGeocodedLocationName(lat, lng)
      ]);
      
      if (!res || !res.ok) {
        // Return dummy data on failure
        const current: WeatherData = {
          location: locationName,
          station: "Offline Mode",
          temperature: 70,
          humidity: 50,
          windSpeed: 5,
          cloudCover: 0,
          precipitation: 0,
          visibility: 10,
          uvIndex: 5,
          timeOfDay: "day"
        };
        const minute: HourlyWeatherData[] = [];
        const now = new Date();
        for (let i = 0; i < 120; i++) {
          minute.push({
            ...current,
            time: new Date(now.getTime() + i * 60000).toISOString(),
          });
        }
        return { current, minute };
      }
      const data = await res.json();

      const current: WeatherData = {
        location: locationName,
        station: "Open-Meteo Short-Term",
        temperature: data.current.temperature_2m || 0,
        humidity: data.current.relative_humidity_2m || 0,
        windSpeed: data.current.wind_speed_10m || 0,
        cloudCover: data.current.cloud_cover || 0,
        precipitation: data.current.precipitation || 0,
        visibility: 10,
        uvIndex: 5,
        timeOfDay: data.current.is_day ? "day" : "night"
      };

      const minute: HourlyWeatherData[] = [];
      const now = new Date();
      const minutelyTimes = data.minutely_15.time;
      
      let startIndex = minutelyTimes.findIndex((t: string) => new Date(t).getTime() >= now.getTime());
      if (startIndex === -1) startIndex = 0;
      if (startIndex > 0) startIndex -= 1; // Include the immediate past interval for interpolation

      for (let i = 0; i < 120; i++) {
        const targetTime = new Date(now.getTime() + i * 60000);
        
        let idx1 = startIndex;
        while (idx1 < minutelyTimes.length - 1 && new Date(minutelyTimes[idx1 + 1]).getTime() <= targetTime.getTime()) {
          idx1++;
        }
        let idx2 = Math.min(idx1 + 1, minutelyTimes.length - 1);

        const t1 = new Date(minutelyTimes[idx1]).getTime();
        const t2 = new Date(minutelyTimes[idx2]).getTime();
        
        let ratio = 0;
        if (t2 > t1) {
          ratio = (targetTime.getTime() - t1) / (t2 - t1);
        }

        const temp1 = data.minutely_15.temperature_2m[idx1] ?? current.temperature;
        const temp2 = data.minutely_15.temperature_2m[idx2] ?? current.temperature;
        const temp = temp1 + (temp2 - temp1) * ratio;

        const precip1 = data.minutely_15.precipitation[idx1] ?? 0;
        const precip2 = data.minutely_15.precipitation[idx2] ?? 0;
        const precip = precip1 + (precip2 - precip1) * ratio;

        const wind1 = data.minutely_15.wind_speed_10m[idx1] ?? current.windSpeed;
        const wind2 = data.minutely_15.wind_speed_10m[idx2] ?? current.windSpeed;
        const wind = wind1 + (wind2 - wind1) * ratio;

        const hum1 = data.minutely_15.relative_humidity_2m[idx1] ?? current.humidity;
        const hum2 = data.minutely_15.relative_humidity_2m[idx2] ?? current.humidity;
        const hum = hum1 + (hum2 - hum1) * ratio;

        minute.push({
          ...current,
          time: targetTime.toISOString(),
          temperature: Number(temp.toFixed(1)),
          precipitation: Number(precip.toFixed(2)),
          windSpeed: Number(wind.toFixed(1)),
          humidity: Number(hum.toFixed(0)),
        });
      }

      return { current, minute };
    } catch (e) {
      // Fallback to dummy data if anything else fails
      const current: WeatherData = {
        location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        station: "Offline Mode",
        temperature: 70, humidity: 50, windSpeed: 5, cloudCover: 0,
        precipitation: 0, visibility: 10, uvIndex: 5, timeOfDay: "day"
      };
      const minute: HourlyWeatherData[] = [];
      const now = new Date();
      for (let i = 0; i < 120; i++) {
        minute.push({
          ...current,
          time: new Date(now.getTime() + i * 60000).toISOString(),
        });
      }
      return { current, minute };
    }
  }

  // Define the parallel tasks
  const weatherApiTask = (mode === 'live' && WEATHERAPI_KEY) 
    ? fetchWeatherApiData(lat, lng) 
    : Promise.resolve(null);

  const geocodeTask = getGeocodedLocationName(lat, lng);

  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,is_day&hourly=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,is_day,visibility,uv_index,shortwave_radiation&timezone=auto&wind_speed_unit=mph`;
  const openMeteoTask = fetchWithTimeout(openMeteoUrl, {}, 15000)
    .then(async res => {
      if (!res.ok) {
        return null;
      }
      return res.json();
    })
    .catch(e => {
      return null;
    });

  // Run all tasks in parallel
  const [liveData, geoName, weatherData] = await Promise.all([
    weatherApiTask,
    geocodeTask,
    openMeteoTask
  ]);

  // 1. Process location name from geocode or WeatherAPI
  let locationName = geoName;
  if (liveData?.location) {
    locationName = liveData.location;
  }

  if (!weatherData) {
    if (mode === 'live' && liveData) {
      return { current: liveData, hourly: [] };
    }
    // Return dummy data on failure
    const current: WeatherData = {
      location: locationName,
      station: "Offline Mode",
      temperature: 70,
      humidity: 50,
      windSpeed: 5,
      cloudCover: 0,
      precipitation: 0,
      visibility: 10,
      uvIndex: 5,
      timeOfDay: "day"
    };
    const hourly: HourlyWeatherData[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      hourly.push({
        ...current,
        time: new Date(now.getTime() + i * 3600000).toISOString(),
      });
    }
    return { current, hourly };
  }

  const current = weatherData.current;
  const hourly = weatherData.hourly;
  const elevation = weatherData.elevation || 0;
  
  // Find current index
  const currentTimeStr = current.time;
  let currentIndex = hourly.time.findIndex((t: string) => t === currentTimeStr);
  if (currentIndex === -1) {
    const now = new Date();
    const currentHourStr = now.toISOString().slice(0, 14) + "00";
    currentIndex = hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
    if (currentIndex === -1) currentIndex = 0;
  }

  const getWeatherDataAtIndex = (index: number, name: string, stationInfo: string): HourlyWeatherData => {
    return {
      time: hourly.time[index],
      location: name,
      station: stationInfo,
      temperature: hourly.temperature_2m[index] || 0,
      humidity: hourly.relative_humidity_2m[index] || 0,
      windSpeed: hourly.wind_speed_10m[index] || 0,
      cloudCover: hourly.cloud_cover[index] || 0,
      precipitation: hourly.precipitation[index] || 0,
      visibility: (hourly.visibility[index] || 10000) / 1000,
      uvIndex: hourly.uv_index[index] || 0,
      timeOfDay: hourly.is_day[index] ? "day" : "night"
    };
  };

  // Prepare 48h hourly forecast (to cover at least the end of the next day)
  const hourlyForecast: HourlyWeatherData[] = [];
  for (let i = currentIndex; i < currentIndex + 48 && i < hourly.time.length; i++) {
    hourlyForecast.push(getWeatherDataAtIndex(i, locationName, `Open-Meteo Forecast (Grid Point: ${lat.toFixed(2)}, ${lng.toFixed(2)})`));
  }

  if (mode === 'live' && liveData) {
    if (enableSmoothing) {
      // Sanity check live data against forecast
      const smooth = (live: number, forecast: number, threshold: number) => {
        if (Math.abs(live - forecast) > threshold) {
          return Number(((live + forecast * 2) / 3).toFixed(1)); // go towards forecast
        }
        return live;
      };
      
      liveData.temperature = smooth(liveData.temperature, current.temperature_2m || 0, 10);
      liveData.humidity = smooth(liveData.humidity, current.relative_humidity_2m || 0, 30);
      liveData.windSpeed = smooth(liveData.windSpeed, current.wind_speed_10m || 0, 20);
      liveData.precipitation = smooth(liveData.precipitation, current.precipitation || 0, 10);
      liveData.uvIndex = smooth(liveData.uvIndex, hourly.uv_index[currentIndex] || 0, 3);
    }

    return { current: liveData, hourly: hourlyForecast };
  }

  const stationPrefix = mode === 'live' ? (WEATHERAPI_KEY ? "Open-Meteo Fallback" : "Open-Meteo Station Network") : "Open-Meteo Global Model";
  const stationInfo = `${stationPrefix} (Grid Point: ${lat.toFixed(2)}, ${lng.toFixed(2)}, Elev: ${elevation}m)`;
  
  const currentWeatherData: WeatherData = {
    location: locationName + (mode === 'forecast' ? " (Forecast)" : " (Live)"),
    station: stationInfo,
    temperature: current.temperature_2m || 0,
    humidity: current.relative_humidity_2m || 0,
    windSpeed: current.wind_speed_10m || 0,
    cloudCover: current.cloud_cover || 0,
    precipitation: current.precipitation || 0,
    visibility: (hourly.visibility[currentIndex] || 10000) / 1000,
    uvIndex: hourly.uv_index[currentIndex] || 0,
    timeOfDay: current.is_day ? "day" : "night"
  };

  return { current: currentWeatherData, hourly: hourlyForecast };
}
