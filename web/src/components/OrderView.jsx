import React, { useRef, useEffect, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import OSM from "ol/source/OSM";
import { Vector as VectorSource } from "ol/source";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat, toLonLat } from "ol/proj";
import { Icon, Style } from "ol/style";
import Geocoder from "ol-geocoder";
import "ol-geocoder/dist/ol-geocoder.min.css";

const BTC_ADDR = "bc1q8r428cum3f0hc00900wuktz6lffna20qh3z6l0";

function msToDHM(ms) {
  const t = Math.max(0, ms);
  const days = Math.floor(t / (1000 * 60 * 60 * 24));
  const hours = Math.floor((t / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((t / (1000 * 60)) % 60);
  return `${days} Tag${days === 1 ? "" : "e"}, ${hours} Std, ${mins} Min`;
}

export default function OrderView({
  warenkorb,
  produkte,
  onBestellungAbsenden,
  user,
  onGoBack,
}) {
  const mapRef = useRef();
  const [markerCoord, setMarkerCoord] = useState(null);
  const [orderZahlung, setOrderZahlung] = useState("bar");
  const [orderKryptoWaehrung] = useState("BTC");
  const [orderNotiz, setOrderNotiz] = useState("");
  const [error, setError] = useState("");
  const [btcKurs, setBtcKurs] = useState(null);

  useEffect(() => {
    async function fetchKurs() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur"
        );
        const data = await res.json();
        if (data?.bitcoin?.eur) setBtcKurs(data.bitcoin.eur);
      } catch (e) {
        setBtcKurs(null);
      }
    }
    fetchKurs();
  }, []);

  const warenkorbPreis = warenkorb.reduce((sum, item) => {
    const p = produkte.find((pr) => pr.id === item.produktId);
    if (item.gratis) return sum;
    return sum + (p?.preis || 0) * item.menge;
  }, 0);

  let aktiverPass = null;
  if (user?.pass && user.pass.gültigBis > Date.now()) aktiverPass = user.pass;

  let passRabatt = 0;
  let passRabattMax = 0;
  let passRabattÜbrig = 0;

  if (aktiverPass && orderZahlung === "krypto") {
    passRabattMax = aktiverPass.maxRabatt ?? 0;
    const schonGespart = aktiverPass.gespartAktuell ?? 0;
    passRabatt =
      Math.round(((warenkorbPreis * (aktiverPass.rabatt ?? 0)) / 100) * 100) /
      100;
    passRabattÜbrig = Math.max(0, passRabattMax - schonGespart);
    passRabatt = Math.min(passRabatt, passRabattÜbrig);
  }

  let _rabatt = 0;
  if (orderZahlung === "krypto") {
    if (aktiverPass) {
      _rabatt = passRabatt;
    } else {
      if (warenkorbPreis <= 250) _rabatt = warenkorbPreis * 0.05;
      else _rabatt = warenkorbPreis * 0.1;
    }
  }

  _rabatt = Math.round(_rabatt * 100) / 100;
  const _gesamt = warenkorbPreis;
  const _endpreis = Math.max(_gesamt - _rabatt, 0);

  const kryptoBetrag =
    orderZahlung === "krypto" && btcKurs
      ? (_endpreis / btcKurs).toFixed(6)
      : "…";

  const notEnoughStock = warenkorb.some((item) => {
    const p = produkte.find((pr) => pr.id === item.produktId);
    return !p || p.bestand < item.menge;
  });

  const notEnoughGuthaben =
    orderZahlung === "krypto" && user && (user.guthaben || 0) < _endpreis;

  useEffect(() => {
    const initialCoord = fromLonLat([7, 51.5]);
    const markerSource = new VectorSource();

    const markerLayer = new VectorLayer({
      source: markerSource,
      style: new Style({
        image: new Icon({
          src: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          anchor: [0.5, 1],
          scale: 1,
        }),
      }),
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        markerLayer,
      ],
      view: new View({
        center: initialCoord,
        zoom: 13,
      }),
    });

    map.on("click", (evt) => {
      markerSource.clear();
      const coord = evt.coordinate;
      setMarkerCoord(coord);

      const marker = new Feature({
        geometry: new Point(coord),
      });
      markerSource.addFeature(marker);
    });

    const geocoder = new Geocoder("nominatim", {
      provider: "osm",
      lang: "de-DE",
      placeholder: "Adresse suchen...",
      targetType: "text-input",
      limit: 5,
      debug: false,
      autoComplete: true,
      keepOpen: false,
    });
    map.addControl(geocoder);

    geocoder.on("addresschosen", function (evt) {
      markerSource.clear();
      setMarkerCoord(evt.coordinate);
      const marker = new Feature({
        geometry: new Point(evt.coordinate),
      });
      markerSource.addFeature(marker);
      map.getView().animate({ center: evt.coordinate, zoom: 16 });
    });

    return () => map.setTarget(undefined);
  }, []);

  const getLatLon = () => {
    if (!markerCoord) return null;
    const [lon, lat] = toLonLat(markerCoord);
    return { lat, lon };
  };

  const handleComplete = () => {
    setError("");
    const ll = getLatLon();
    if (!warenkorb.length) {
      setError("Warenkorb leer!");
      return;
    }
    if (!ll) {
      setError("Bitte Treffpunkt auf der Karte wählen!");
      return;
    }
    for (let item of warenkorb) {
      const p = produkte.find((pr) => pr.id === item.produktId);
      if (!p || p.bestand < item.menge) {
        setError("Nicht genug Bestand für: " + (p?.name || "?"));
        return;
      }
    }
    if (orderZahlung === "krypto" && notEnoughGuthaben) {
      setError(
        `Nicht genug Guthaben für diese Bestellung! Du brauchst mindestens ${_endpreis.toFixed(
          2
        )} € Guthaben.`
      );
      return;
    }

    // ✅ Telegram Nachricht absenden
    const message = encodeURIComponent(
      `📦 Neue Bestellung von ${user?.username || "Unbekannt"}!\n\nProdukte:\n${warenkorb
        .map((item) => {
          const p = produkte.find((pr) => pr.id === item.produktId);
          return `• ${item.menge} × ${p?.name || "?"}`;
        })
        .join("\n")}\n\nEndpreis: ${_endpreis.toFixed(
        2
      )} €\nZahlung: ${orderZahlung.toUpperCase()}`
    );

    fetch(
      `https://api.telegram.org/bot<DEIN_BOT_TOKEN>/sendMessage?chat_id=<DEIN_CHAT_ID>&text=${message}`
    );

    // Bestellung senden
    onBestellungAbsenden({
      warenkorb,
      gesamt: _gesamt,
      rabatt: _rabatt,
      endpreis: _endpreis,
      zahlung: orderZahlung,
      kryptoWaehrung: "BTC",
      notiz: orderNotiz,
      treffpunkt: [ll.lat, ll.lon],
      kryptoBetrag: orderZahlung === "krypto" && btcKurs ? kryptoBetrag : null,
      kryptoKurs: btcKurs,
    });
  };


  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#18181b",
        color: "#fff",
        fontFamily: "'Inter',sans-serif",
        padding: 30,
      }}
    >
      <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 17 }}>
        🚀 Bestellung abschließen
      </h2>

      {/* Warenkorb Übersicht */}
      <div style={{ marginBottom: 13 }}>
        {warenkorb.map((item) => {
          const p = produkte.find((pr) => pr.id === item.produktId);
          const istGratis = !!item.gratis;
          return (
            <div
              key={item.produktId || item.id}
              style={{ fontSize: 15, marginBottom: 7 }}
            >
              {p?.name || "?"} × {item.menge}{" "}
              <b>
                (
                {istGratis
                  ? "0,00 €"
                  : ((p?.preis || 0) * item.menge).toFixed(2) + " €"}
                )
              </b>
              <span style={{ color: "#a1a1aa" }}>
                {" "}
                (Bestand: {p?.bestand ?? 0})
              </span>
              {istGratis && (
                <div
                  style={{ color: "#a3e635", fontSize: 14, fontWeight: 700 }}
                >
                  Kostenlos durch Inventar-Gewinn!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- Pass Anzeige hübsch --- */}
      {aktiverPass && (
        <div
          style={{
            background: "linear-gradient(113deg,#2b3139 55%,#a3e63544 100%)",
            color: "#fff",
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
            border: "2px solid #a3e63544",
            boxShadow: "0 2px 16px #a3e63522, 0 1.5px 10px #0002",
            fontSize: 16,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#a3e635",
              marginRight: 6,
            }}
          >
            {aktiverPass.name}
          </span>
          <span style={{ color: "#38bdf8", fontWeight: 700 }}>
            {aktiverPass.rabatt}% Rabatt
          </span>
          <br />
          <span style={{ fontSize: 15.2, color: "#e5e7eb", fontWeight: 600 }}>
            Max. Rabatt in diesem Zeitraum:{" "}
            <b>{(aktiverPass.maxRabatt ?? 0).toFixed(2)} €</b>
            {typeof aktiverPass.gespartAktuell === "number" && (
              <>
                {" "}
                | Bereits gespart:{" "}
                <span style={{ color: "#38bdf8" }}>
                  {(aktiverPass.gespartAktuell ?? 0).toFixed(2)} €
                </span>
                {" | "}
                <span style={{ color: "#a3e635", fontWeight: 700 }}>
                  Übrig:{" "}
                  {(
                    (aktiverPass.maxRabatt ?? 0) -
                    (aktiverPass.gespartAktuell ?? 0)
                  ).toFixed(2)}{" "}
                  €
                </span>
              </>
            )}
          </span>
          <br />
          <span style={{ color: "#a1a1aa", fontSize: 14, fontWeight: 600 }}>
            Gültig noch:{" "}
            <span style={{ color: "#a3e635", fontWeight: 800 }}>
              {msToDHM(aktiverPass.gültigBis - Date.now())}
            </span>
          </span>
        </div>
      )}

      {/* Rabatt Anzeige falls vorhanden */}
      {orderZahlung === "krypto" && _rabatt > 0 && (
        <div style={{ marginBottom: 8, color: "#a3e635", fontWeight: 700 }}>
          Rabatt für diese Bestellung: –{_rabatt.toFixed(2)} €
          <br />
          <span style={{ fontSize: 14, color: "#b4ff38" }}>
            {aktiverPass
              ? `${aktiverPass.rabatt}% Pass-Rabatt (max. ${(
                  aktiverPass.maxRabatt ?? 0
                ).toFixed(2)} € / übrig: ${(
                  (aktiverPass.maxRabatt ?? 0) -
                  (aktiverPass.gespartAktuell ?? 0)
                ).toFixed(2)} €)`
              : warenkorbPreis <= 250
              ? "5% Krypto-Rabatt (bis 250 €)"
              : "10% Krypto-Rabatt (ab 250 €)"}
          </span>
        </div>
      )}

      {/* Endpreis */}
      <div style={{ marginBottom: 13, fontWeight: 700, fontSize: 17 }}>
        Zu zahlender Endpreis: {_endpreis.toFixed(2)} €
        {warenkorb.some((item) => item.gratis) && (
          <div style={{ color: "#a3e635", fontSize: 14, fontWeight: 700 }}>
            Produkte aus deinem Inventar sind automatisch kostenlos!
          </div>
        )}
      </div>

      {/* Zahlungsart */}
      <div style={{ marginBottom: 13 }}>
        <b>Zahlungsart:</b>{" "}
        <button
          style={{
            background: orderZahlung === "bar" ? "#a3e635" : "#23262e",
            color: orderZahlung === "bar" ? "#18181b" : "#fff",
            border: 0,
            borderRadius: 7,
            padding: "7px 18px",
            fontWeight: 700,
            marginRight: 8,
          }}
          onClick={() => setOrderZahlung("bar")}
        >
          💶 Bar
        </button>
        <button
          style={{
            background: orderZahlung === "krypto" ? "#38bdf8" : "#23262e",
            color: orderZahlung === "krypto" ? "#18181b" : "#fff",
            border: 0,
            borderRadius: 7,
            padding: "7px 18px",
            fontWeight: 700,
          }}
          onClick={() => setOrderZahlung("krypto")}
        >
          🪙 Krypto
        </button>
      </div>

      {orderZahlung === "krypto" && (
        <div
          style={{
            background: "#23262e",
            color: "#a3e635",
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
            fontSize: 15,
            maxWidth: 420,
          }}
        >
          <b>Dein Guthaben: {user?.guthaben?.toFixed(2) ?? "0.00"} €</b>
          <br />
          {notEnoughGuthaben && (
            <span style={{ color: "#f87171" }}>
              ❗Nicht genug Guthaben für diese Bestellung!
            </span>
          )}
          <br />
          Zu sendender Betrag: {kryptoBetrag} BTC
          <br />
          Adresse:{" "}
          <span style={{ color: "#38bdf8", fontWeight: 700 }}>{BTC_ADDR}</span>
          <br />
          Aktueller Bitcoin-Kurs:{" "}
          {btcKurs
            ? btcKurs.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              }) + " €"
            : "…"}
        </div>
      )}

      {/* Treffpunkt Auswahl */}
      <div style={{ marginBottom: 13 }}>
        <b>Treffpunkt auf der Karte auswählen oder Adresse suchen:</b>
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: 260,
            borderRadius: 12,
            marginTop: 10,
            background: "#23262e",
          }}
        />
        {markerCoord && (
          <div style={{ marginTop: 8 }}>
            <a
              href={`https://maps.google.com/?q=${getLatLon().lat},${
                getLatLon().lon
              }`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#38bdf8",
                fontWeight: 700,
                textDecoration: "underline",
                fontSize: 15,
              }}
            >
              ➡️ In Google Maps öffnen
            </a>
          </div>
        )}
      </div>

      {/* Notiz */}
      <div style={{ marginBottom: 13 }}>
        <textarea
          value={orderNotiz}
          onChange={(e) => setOrderNotiz(e.target.value)}
          placeholder="Wunsch oder Notiz (optional)"
          style={{
            width: "100%",
            minHeight: 40,
            borderRadius: 8,
            border: 0,
            padding: 7,
            background: "#23262e",
            color: "#fff",
            fontSize: 16,
          }}
        />
      </div>

      {/* Abschließen */}
      <button
        style={{
          background:
            notEnoughStock || (orderZahlung === "krypto" && notEnoughGuthaben)
              ? "#f87171"
              : "#a3e635",
          color: "#18181b",
          fontWeight: 900,
          borderRadius: 9,
          border: 0,
          padding: "13px 33px",
          fontSize: 19,
          marginBottom: 15,
          cursor:
            notEnoughStock || (orderZahlung === "krypto" && notEnoughGuthaben)
              ? "not-allowed"
              : "pointer",
        }}
        disabled={
          notEnoughStock || (orderZahlung === "krypto" && notEnoughGuthaben)
        }
        onClick={handleComplete}
      >
        ✅ Bestellung abschließen
      </button>
      <button
        onClick={onGoBack}
        style={{
          marginLeft: 15,
          background: "#23262e",
          color: "#fff",
          borderRadius: 8,
          border: 0,
          padding: "10px 22px",
          fontSize: 17,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ⬅️ Zurück
      </button>

      {error && (
        <div style={{ color: "#f87171", marginTop: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
    </div>
  );
}
