import { useMapEvents, Marker } from "react-leaflet";
import L from "leaflet";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function TreffpunktSelector({ value, onChange }) {
  useMapEvents({
    click(e) {
      onChange?.([e.latlng.lat, e.latlng.lng]);
    },
  });

  if (!value) return null;

  return <Marker position={value} icon={icon} />;
}
