import { Cloud, CloudLightning, CloudRain, MoonStar, Sun } from "lucide-react";
import type { Condition } from "../types";

/** Cohesive Lucide SVG icons, ISC license; see public/weather/LICENSE. */
export function WeatherIcon({
  condition,
  size = 24,
  className,
}: {
  condition: Condition;
  size?: number;
  className?: string;
}) {
  const Icon = {
    rain: CloudRain,
    clear: Sun,
    cloudy: Cloud,
    storm: CloudLightning,
    night: MoonStar,
  }[condition];
  return (
    <Icon
      size={size}
      className={className}
      strokeWidth={1.6}
      aria-hidden="true"
    />
  );
}
