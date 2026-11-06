import type { Config, Condition, WeatherData } from "../types";
import { WeatherIcon } from "./WeatherIcon";
const scenes: Record<
  Condition,
  { name: string; headline: string; detail: string }
> = {
  rain: {
    name: "Rain",
    headline: "A slower kind of morning.",
    detail: "Cool light. Passing showers. Room to breathe.",
  },
  clear: {
    name: "Clear",
    headline: "Let a little sunshine in.",
    detail: "Open skies and a bright start to the day.",
  },
  cloudy: {
    name: "Cloudy",
    headline: "Under a softer sky.",
    detail: "Clouds roll through. The day is still yours.",
  },
  storm: {
    name: "Storm",
    headline: "A little drama in the sky.",
    detail: "Deep clouds, electric light. Stay weather aware.",
  },
  night: {
    name: "Night",
    headline: "The quiet before the day.",
    detail: "A moonlit pause under a wide desert sky.",
  },
};
export function WeatherScene({
  config,
  data,
  onChange,
  loading,
}: {
  config: Config;
  data: WeatherData;
  onChange: (c: Config) => void;
  loading: boolean;
}) {
  const condition = data.condition,
    scene = scenes[condition];
  const temp = (value: number) =>
    Math.round(
      config.weather.units === "celsius" ? ((value - 32) * 5) / 9 : value,
    );
  return (
    <section className="weather-composer" aria-label="Weather atmosphere">
      <div className={`weather-scene scene-${condition}`}>
        <div className="weather-cloud cloud-one" />
        <div className="weather-cloud cloud-two" />
        <div className="weather-light" />
        <div className="weather-rain" aria-hidden="true">
          {Array.from({ length: 35 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                animationDelay: `${(i % 9) * -0.31}s`,
                animationDuration: `${0.65 + (i % 5) * 0.12}s`,
              }}
            />
          ))}
        </div>
        <div className="weather-scene-content">
          <div className="weather-eyebrow">
            <span>{data.location}</span>
            <span className="weather-mode">
              {loading
                ? "Fetching live…"
                : data.provenance.mode === "sample"
                  ? "SIMULATED"
                  : "LIVE FORECAST"}
            </span>
          </div>
          <div className="weather-now">
            <div>
              <span className="weather-temperature">
                {temp(data.temperature)}°
              </span>
              <span className="weather-unit">
                {config.weather.units === "celsius" ? "C" : "F"}
              </span>
            </div>
            <WeatherIcon condition={condition} size={84} />
          </div>
          <h2>{scene.headline}</h2>
          <p>{scene.detail}</p>
          <div className="weather-stats">
            <span>Feels like {temp(data.feelsLike)}°</span>
            <span>Humidity {data.humidity}%</span>
            <span>
              Wind{" "}
              {Math.round(
                config.weather.units === "celsius"
                  ? data.wind * 1.609
                  : data.wind,
              )}{" "}
              {config.weather.units === "celsius" ? "km/h" : "mph"}
            </span>
          </div>
        </div>
      </div>
      <div className="condition-controls">
        <div className="field-eyebrow">
          EXPLORE THE WEATHER <span>Sample conditions</span>
        </div>
        <div className="condition-buttons">
          {(Object.keys(scenes) as Condition[]).map((key) => (
            <button
              key={key}
              title={`Simulate ${scenes[key].name.toLowerCase()}`}
              aria-pressed={
                config.weather.mode === "sample" &&
                config.weather.condition === key
              }
              onClick={() =>
                onChange({
                  ...config,
                  weather: {
                    ...config.weather,
                    mode: "sample",
                    condition: key,
                  },
                })
              }
            >
              <WeatherIcon condition={key} size={18} />
              {scenes[key].name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
