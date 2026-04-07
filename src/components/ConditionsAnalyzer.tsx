import React, { useState, ChangeEvent, useMemo, useEffect } from "react";
import { calculateCCHI, WeatherData, CCHIResponse } from "@/lib/cchiLogic";
import { fetchWeatherData, HourlyWeatherData, fetchBulkCurrentWeather } from "@/lib/weatherApi";
import LocationPicker from "@/components/LocationPicker";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Star, Search, MapPin } from "lucide-react";

export const CRICKET_GROUNDS = [
  { name: "Lord's, London (Middlesex)", lat: 51.529775, lng: -0.172186 },
  { name: "The Oval, London (Surrey)", lat: 51.483765, lng: -0.114889 },
  { name: "Edgbaston, Birmingham (Warwickshire)", lat: 52.455050, lng: -1.902644 },
  { name: "Old Trafford, Manchester (Lancashire)", lat: 53.456641, lng: -2.286847 },
  { name: "Headingley, Leeds (Yorkshire)", lat: 53.817544, lng: -1.580665 },
  { name: "Trent Bridge, Nottingham (Nottinghamshire)", lat: 52.937172, lng: -1.132536 },
  { name: "Riverside Ground, Chester-le-Street (Durham)", lat: 54.846543, lng: -1.564539 },
  { name: "Utilita Bowl, Southampton (Hampshire)", lat: 50.924464, lng: -1.322143 },
  { name: "Sophia Gardens, Cardiff (Glamorgan)", lat: 51.488523, lng: -3.190538 },
  { name: "County Ground, Taunton (Somerset)", lat: 51.018985, lng: -3.100057 },
  { name: "County Ground, Bristol (Gloucestershire)", lat: 51.477028, lng: -2.585031 },
  { name: "County Ground, Chelmsford (Essex)", lat: 51.732003, lng: 0.468019 },
  { name: "County Ground, Hove (Sussex)", lat: 50.831006, lng: -0.165034 },
  { name: "St Lawrence Ground, Canterbury (Kent)", lat: 51.267497, lng: 1.092042 },
  { name: "County Ground, Northampton (Northamptonshire)", lat: 52.244018, lng: -0.875026 },
  { name: "New Road, Worcester (Worcestershire)", lat: 52.189993, lng: -2.228045 },
  { name: "Grace Road, Leicester (Leicestershire)", lat: 52.610015, lng: -1.140032 },
  { name: "County Ground, Derby (Derbyshire)", lat: 52.925011, lng: -1.455029 }
];

// Simple heuristic for CCHI score in the frontend for hourly trend
export const calculateHeuristicCCHI = (data: WeatherData): number => {
  let score = 100;
  
  // Rain penalty
  if (data.precipitation > 0) {
    score -= Math.min(80, data.precipitation * 20);
  }
  
  // Temp penalty (Ideal 18-28)
  if (data.temperature < 18) score -= (18 - data.temperature) * 3;
  if (data.temperature > 28) score -= (data.temperature - 28) * 4;
  
  // Wind penalty
  if (data.windSpeed > 10) score -= (data.windSpeed - 10) * 3;
  
  // Humidity penalty (Ideal 40-60)
  if (data.humidity < 40) score -= (40 - data.humidity) * 0.5;
  if (data.humidity > 70) score -= (data.humidity - 70) * 1;
  
  // Visibility penalty
  if (data.visibility < 5) score -= (5 - data.visibility) * 10;
  
  // Time of day
  if (data.timeOfDay === "night") score -= 50;

  return Math.max(0, Math.min(100, Math.round(score)));
};

interface ConditionsAnalyzerProps {
  groundScores: Record<string, number>;
  setGroundScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  favouriteScores: Record<string, number>;
  setFavouriteScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  favourites: {name: string, lat: number, lng: number}[];
  setFavourites: React.Dispatch<React.SetStateAction<{name: string, lat: number, lng: number}[]>>;
}

const ConditionsAnalyzer = ({ 
  groundScores, 
  setGroundScores, 
  favouriteScores, 
  setFavouriteScores,
  favourites,
  setFavourites
}: ConditionsAnalyzerProps) => {
  const [dataSource, setDataSource] = useState<'live' | 'forecast' | 'minute'>('live');
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyWeatherData[]>([]);
  const [minuteData, setMinuteData] = useState<HourlyWeatherData[]>([]);
  
  const [formData, setFormData] = useState<WeatherData>({
    location: "London, UK",
    station: "Manual Entry",
    temperature: 22,
    humidity: 60,
    windSpeed: 10,
    cloudCover: 40,
    precipitation: 0,
    visibility: 10,
    uvIndex: 5,
    timeOfDay: "day",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [result, setResult] = useState<CCHIResponse | null>(null);
  const [selectedHourTime, setSelectedHourTime] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [enableSmoothing, setEnableSmoothing] = useState(true);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=en`);
          const data = await res.json();
          setSearchResults(data);
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const toggleFavourite = (name: string, lat: number, lng: number) => {
    setFavourites(prev => {
      const exists = prev.find(f => f.name === name);
      if (exists) {
        return prev.filter(f => f.name !== name);
      } else {
        return [...prev, { name, lat, lng }];
      }
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "location" || name === "timeOfDay" ? value : Number(value),
    }));
  };

  const performAnalysis = async (data: WeatherData) => {
    setIsLoading(true);
    try {
      const response = await calculateCCHI(data);
      setResult(response);
      toast.success(`CCHI Calculated for ${data.location}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to calculate CCHI");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = () => performAnalysis(formData);

  const handleHourClick = (hour: HourlyWeatherData) => {
    setSelectedHourTime(hour.time);
    const updatedData: WeatherData = {
      ...hour,
      location: hour.location + " (" + new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ")"
    };
    setFormData(updatedData);
    performAnalysis(updatedData);
  };

  const fetchDataForLocation = async (lat: number, lng: number, mode: 'live' | 'forecast' | 'minute', smoothing: boolean = enableSmoothing) => {
    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Invalid coordinates selected.");
      return;
    }
    setIsFetchingWeather(true);
    try {
      const { current, hourly, minute } = await fetchWeatherData(lat, lng, mode, smoothing);
      setFormData(current);
      if (hourly) {
        setHourlyData(hourly);
      }
      if (minute) {
        setMinuteData(minute);
      }
      setSelectedHourTime(null);
      toast.success(`${mode === 'live' ? 'Live station' : mode === 'minute' ? 'Short-Term Forecast' : 'Forecast'} data loaded for ${current.location}`);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Failed to fetch weather data for this location.";
      toast.error(msg);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleLocationSelect = async (lat: number, lng: number) => {
    console.log(`Location selected: ${lat}, ${lng}`);
    setSelectedLocation({ lat, lng });
    fetchDataForLocation(lat, lng, dataSource);
  };

  const handleDataSourceChange = (mode: 'live' | 'forecast' | 'minute') => {
    setDataSource(mode);
    if (selectedLocation) {
      fetchDataForLocation(selectedLocation.lat, selectedLocation.lng, mode, enableSmoothing);
    }
  };

  const handleSmoothingToggle = () => {
    const newSmoothing = !enableSmoothing;
    setEnableSmoothing(newSmoothing);
    if (selectedLocation) {
      fetchDataForLocation(selectedLocation.lat, selectedLocation.lng, dataSource, newSmoothing);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-blue-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 30) return "text-orange-500";
    return "text-red-500";
  };

  const chartData = useMemo(() => {
    return hourlyData.map(h => {
      const date = new Date(h.time);
      const timeStr = isNaN(date.getTime()) ? "??:??" : `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      return {
        time: timeStr,
        score: calculateHeuristicCCHI(h),
        temp: h.temperature,
        rain: h.precipitation
      };
    });
  }, [hourlyData]);

  const minuteChartData = useMemo(() => {
    return minuteData.map(m => {
      const date = new Date(m.time);
      const timeStr = isNaN(date.getTime()) ? "??:??" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        time: timeStr,
        score: calculateHeuristicCCHI(m),
        temp: m.temperature,
        rain: m.precipitation
      };
    });
  }, [minuteData]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Cricket Conditions Happiness Index (CCHI)</h2>
        <p className="text-muted-foreground">Select a location on the map to fetch live weather, or enter data manually.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Location Selection Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
            <h3 className="text-lg font-semibold border-b border-border pb-2 mb-1">Select Location</h3>
            <p className="text-[10px] text-muted-foreground mb-4 italic leading-tight">
              The scores to the right in the lists below represent the player rating for each ground.
            </p>
            
            {/* Search Bar */}
            <div className="relative mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search location..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        handleLocationSelect(parseFloat(res.lat), parseFloat(res.lon));
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 border-b border-border/50 last:border-0 truncate"
                    >
                      {res.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-2 mb-4 flex-wrap">
              <button
                onClick={() => handleDataSourceChange('live')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  dataSource === 'live' ? "bg-accent text-accent-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                Live Station
              </button>
              <button
                onClick={() => handleDataSourceChange('minute')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  dataSource === 'minute' ? "bg-accent text-accent-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                Short-Term
              </button>
              <button
                onClick={() => handleDataSourceChange('forecast')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  dataSource === 'forecast' ? "bg-accent text-accent-foreground shadow-md" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                48h Forecast
              </button>
            </div>

            {dataSource === 'live' && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <label className="text-xs font-medium text-muted-foreground cursor-pointer flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={enableSmoothing} 
                    onChange={handleSmoothingToggle}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  AI Sanity Check (Smooth unrealistic live data)
                </label>
              </div>
            )}

            <div className="flex-1 min-h-[250px] relative mb-4">
              {isFetchingWeather && (
                <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <div className="animate-pulse font-mono text-sm uppercase tracking-wider text-primary">Fetching Weather...</div>
                </div>
              )}
              <LocationPicker onLocationSelect={handleLocationSelect} />
            </div>
            
            {/* Favourites */}
            {favourites.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Favourites</span>
                  <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full animate-pulse">Live</span>
                </h4>
                <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                  {favourites.map((fav, i) => (
                    <div key={i} className="flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 rounded-lg p-2 transition-colors border border-border/50">
                      <button 
                        onClick={() => handleLocationSelect(fav.lat, fav.lng)}
                        className="flex-1 text-left text-xs font-medium truncate pr-2"
                      >
                        {fav.name}
                      </button>
                      <div className="flex items-center gap-2">
                        {favouriteScores[fav.name] !== undefined ? (
                          <div className="flex flex-col items-end" title="Current CCHI Score">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-md bg-background shadow-sm border border-border/50 ${getScoreColor(favouriteScores[fav.name])}`}>
                              {favouriteScores[fav.name]}
                            </span>
                          </div>
                        ) : (
                          <div className="w-6 h-4 bg-secondary animate-pulse rounded-md"></div>
                        )}
                        <button onClick={() => toggleFavourite(fav.name, fav.lat, fav.lng)} className="text-yellow-500 hover:text-yellow-600 ml-1">
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Professional Grounds */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> UK Pro Grounds</span>
                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full animate-pulse">Live</span>
              </h4>
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                {CRICKET_GROUNDS.map((ground, i) => {
                  const isFav = favourites.some(f => f.name === ground.name);
                  return (
                    <div key={i} className="flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 rounded-lg p-2 transition-colors border border-border/50">
                      <button 
                        onClick={() => handleLocationSelect(ground.lat, ground.lng)}
                        className="flex-1 text-left text-xs font-medium truncate pr-2"
                      >
                        {ground.name}
                      </button>
                      <div className="flex items-center gap-2">
                        {groundScores[ground.name] !== undefined ? (
                          <div className="flex flex-col items-end" title="Current CCHI Score">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-md bg-background shadow-sm border border-border/50 ${getScoreColor(groundScores[ground.name])}`}>
                              {groundScores[ground.name]}
                            </span>
                          </div>
                        ) : (
                          <div className="w-6 h-4 bg-secondary animate-pulse rounded-md"></div>
                        )}
                        <button onClick={() => toggleFavourite(ground.name, ground.lat, ground.lng)} className={`ml-1 ${isFav ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}>
                          <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Data Input Column */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2">Weather Data</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider">Location</label>
                {selectedLocation && (
                  <button 
                    onClick={() => toggleFavourite(formData.location.split(' (')[0], selectedLocation.lat, selectedLocation.lng)}
                    className="text-xs flex items-center gap-1 text-muted-foreground hover:text-yellow-500 transition-colors"
                  >
                    <Star className={`w-3 h-3 ${favourites.some(f => f.name === formData.location.split(' (')[0]) ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    {favourites.some(f => f.name === formData.location.split(' (')[0]) ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {formData.station && (
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Data Source / Station</label>
                <div className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-[10px] font-mono text-muted-foreground leading-tight">
                  {formData.station}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Temp (°C)</label>
                <input
                  type="number"
                  name="temperature"
                  value={formData.temperature}
                  onChange={handleChange}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Humidity (%)</label>
                <input
                  type="number"
                  name="humidity"
                  value={formData.humidity}
                  onChange={handleChange}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Wind (MPH)</label>
                <input
                  type="number"
                  name="windSpeed"
                  value={formData.windSpeed}
                  onChange={handleChange}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Cloud (%)</label>
                <input
                  type="number"
                  name="cloudCover"
                  value={formData.cloudCover}
                  onChange={handleChange}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Rain (mm)</label>
                <input
                  type="number"
                  name="precipitation"
                  value={formData.precipitation}
                  onChange={handleChange}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Vis (km)</label>
                <input
                  type="number"
                  name="visibility"
                  value={formData.visibility}
                  onChange={handleChange}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">UV Index</label>
                <input
                  type="number"
                  name="uvIndex"
                  value={formData.uvIndex}
                  onChange={handleChange}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Time of Day</label>
              <select
                name="timeOfDay"
                value={formData.timeOfDay}
                onChange={handleChange}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                <option value="day">Day</option>
                <option value="night">Night</option>
              </select>
            </div>

            <button
              onClick={handleCalculate}
              disabled={isLoading || isFetchingWeather}
              className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Calculating..." : "Calculate CCHI"}
            </button>

            <div className="pt-4 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                <span>Weather Data</span>
                <div className="flex flex-wrap justify-end gap-2">
                  <a href="https://www.weatherapi.com/" target="_blank" rel="noreferrer" className="text-accent hover:underline">WeatherAPI</a>
                  <span>/</span>
                  <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-accent hover:underline">Open-Meteo</a>
                </div>
              </div>
              {!import.meta.env.VITE_WEATHERAPI_KEY && (
                <p className="text-[9px] text-muted-foreground italic leading-tight">
                  Note: WeatherAPI.com key required for station-level data. Falling back to Open-Meteo.
                </p>
              )}
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                <span>Geocoding</span>
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-accent hover:underline">OpenStreetMap</a>
              </div>
            </div>
          </div>
        </div>

        {/* Results & Hourly Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Detailed Result */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
            <h3 className="text-lg font-semibold border-b border-border pb-2 mb-4">Detailed Analysis Result</h3>
            
            {result ? (
              <div className="flex flex-col md:flex-row gap-8">
                <div className="text-center space-y-2 md:w-1/3">
                  <div className={`text-6xl font-black tracking-tighter ${getScoreColor(result.score)}`}>
                    {result.score}
                  </div>
                  <div className="text-xl font-bold uppercase tracking-widest text-foreground">
                    {result.label}
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    in {result.location}
                  </p>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="bg-secondary/30 p-4 rounded-lg border border-border/50">
                    <p className="text-sm leading-relaxed">{result.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-secondary/20 p-3 rounded-lg border border-border/50 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Spectator Happiness</span>
                      <div className={`text-3xl font-black tracking-tighter ${getScoreColor(result.spectatorHappinessScore)}`}>
                        {result.spectatorHappinessScore}
                      </div>
                    </div>
                    
                    <div className="bg-secondary/20 p-3 rounded-lg border border-border/50 space-y-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-1 block">Recommended Clothing</span>
                      <div className="space-y-1.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary text-[9px] uppercase tracking-wider">Spectators</span>
                          <span className="text-muted-foreground text-xs">{result.recommendedClothing.spectators}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary text-[9px] uppercase tracking-wider">Players</span>
                          <span className="text-muted-foreground text-xs">{result.recommendedClothing.players}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-1">Factor Breakdown</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex flex-col"><span className="font-semibold text-primary text-[10px] uppercase tracking-wider">Temperature</span> <span className="text-muted-foreground text-xs">{result.factors.temp}</span></div>
                      <div className="flex flex-col"><span className="font-semibold text-primary text-[10px] uppercase tracking-wider">Wind</span> <span className="text-muted-foreground text-xs">{result.factors.wind}</span></div>
                      <div className="flex flex-col"><span className="font-semibold text-primary text-[10px] uppercase tracking-wider">Humidity</span> <span className="text-muted-foreground text-xs">{result.factors.humidity}</span></div>
                      <div className="flex flex-col"><span className="font-semibold text-primary text-[10px] uppercase tracking-wider">Rain</span> <span className="text-muted-foreground text-xs">{result.factors.rain}</span></div>
                      <div className="flex flex-col"><span className="font-semibold text-primary text-[10px] uppercase tracking-wider">UV</span> <span className="text-muted-foreground text-xs">{result.factors.uv}</span></div>
                      <div className="flex flex-col"><span className="font-semibold text-accent text-[10px] uppercase tracking-wider">Overall Impact</span> <span className="text-foreground text-xs font-medium">{result.factors.overall}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-8 border-2 border-dashed border-border/50 rounded-xl">
                Select a location or enter data to calculate the detailed CCHI analysis.
              </div>
            )}
          </div>

          {/* Trend Section */}
          {dataSource !== 'live' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold border-b border-border pb-2 mb-4">
                {dataSource === 'minute' ? '120-Minute Short-Term Forecast' : '48-Hour CCHI Trend'}
              </h3>
              
              {dataSource === 'minute' ? (
              minuteData.length > 0 ? (
                <div className="space-y-6">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={minuteChartData}>
                        <defs>
                          <linearGradient id="colorScoreMinute" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="time" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          interval={9}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontSize: '12px', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--primary))' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="hsl(var(--primary))" 
                          fillOpacity={1} 
                          fill="url(#colorScoreMinute)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex overflow-x-auto gap-2 pb-4 snap-x">
                    {minuteData.map((m, i) => {
                      const score = calculateHeuristicCCHI(m);
                      const isSelected = selectedHourTime === m.time;
                      return (
                        <button 
                          key={i} 
                          onClick={() => handleHourClick(m)}
                          disabled={isLoading}
                          className={`flex-shrink-0 w-16 p-2 text-center space-y-1 rounded-lg border transition-all hover:scale-105 active:scale-95 snap-start ${
                            isSelected 
                              ? "bg-primary/20 border-primary shadow-md ring-1 ring-primary" 
                              : "bg-secondary/20 border-border/50 hover:bg-secondary/40"
                          }`}
                        >
                          <div className="text-[9px] font-mono text-muted-foreground">
                            {(() => {
                              const d = new Date(m.time);
                              return isNaN(d.getTime()) ? "??:??" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            })()}
                          </div>
                          <div className={`text-lg font-bold ${getScoreColor(score)}`}>
                            {score}
                          </div>
                          {m.precipitation > 0 && (
                            <div className="text-[8px] text-blue-400 font-bold">
                              {m.precipitation}mm
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-8 border-2 border-dashed border-border/50 rounded-xl">
                  Select a location on the map to see the minute-by-minute forecast.
                </div>
              )
            ) : (
              hourlyData.length > 0 ? (
                <div className="space-y-6">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="time" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          interval={5}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontSize: '12px', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--primary))' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="hsl(var(--primary))" 
                          fillOpacity={1} 
                          fill="url(#colorScore)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {hourlyData.map((h, i) => {
                      const score = calculateHeuristicCCHI(h);
                      const isSelected = selectedHourTime === h.time;
                      return (
                        <button 
                          key={i} 
                          onClick={() => handleHourClick(h)}
                          disabled={isLoading}
                          className={`p-2 text-center space-y-1 rounded-lg border transition-all hover:scale-105 active:scale-95 ${
                            isSelected 
                              ? "bg-primary/20 border-primary shadow-md ring-1 ring-primary" 
                              : "bg-secondary/20 border-border/50 hover:bg-secondary/40"
                          }`}
                        >
                          <div className="text-[9px] font-mono text-muted-foreground">
                            {(() => {
                              const d = new Date(h.time);
                              return isNaN(d.getTime()) ? "??:??" : `${d.toLocaleDateString([], { weekday: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                            })()}
                          </div>
                          <div className={`text-lg font-bold ${getScoreColor(score)}`}>
                            {score}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {h.temperature}°C
                          </div>
                          {h.precipitation > 0 && (
                            <div className="text-[8px] text-blue-400 font-bold">
                              {h.precipitation}mm
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-8 border-2 border-dashed border-border/50 rounded-xl">
                  Select a location on the map to see the 48-hour hourly CCHI forecast.
                </div>
              )
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConditionsAnalyzer;
