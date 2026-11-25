# Kreisdiagramm

Zeigt mehrere Werte als Anteile eines Ganzen (Donut), die Summe steht in der Mitte, daneben bzw.
darunter eine Legende mit Wert und Prozent. Mit den Pfeilen oder dem Kalender oben rechts lassen sich
frühere Tage ansehen: Heute zeigt die Karte die aktuellen Werte der Entitäten, frühere Tage kommen aus
deren Langzeitstatistik (Änderung über den Tag). Gut geeignet z. B. für „Hausverbrauch heute aus Netz,
PV und Akku“.

*English: Donut chart of several values with the total in the centre; browse previous days (from
long-term statistics) with arrows or a date picker. German user interface.*

## Installation

1. **Einstellungen → Marketplace → Über Link hinzufügen** und
   `https://github.com/bryce2071/kreisdiagramm-card` eintragen (Typ *Dashboard*), dann **Kreisdiagramm**
   herunterladen. Die Ressource trägt der Marketplace selbst ein.
2. Browser bzw. App einmal neu laden. Danach steht „Kreisdiagramm“ in der Kartenauswahl.

## Beispiel

```yaml
type: custom:kreisdiagramm-card
title: Hausverbrauch
total_entity: sensor.hausverbrauch_heute
center_label: gesamt
decimals: 1
entities:
  - entity: sensor.hausverbrauch_heute_aus_netz
    name: Netz
    color: "#488fc2"
  - entity: sensor.hausverbrauch_heute_aus_pv
    name: PV
    color: "#ff9800"
  - entity: sensor.hausverbrauch_heute_aus_akku
    name: Akku
    color: "#4db6ac"
```

## Optionen

| Feld | Bedeutung |
|---|---|
| `entities` | Liste der Teile: `entity`, optional `name` und `color` (sonst eine feste Farbreihe) |
| `title` | optional, Überschrift |
| `total_entity` | optional, Wert in der Mitte – sonst die Summe der Teile |
| `center_label` | optional, Text unter dem Mittelwert (Standard „gesamt“) |
| `decimals` | optional, Nachkommastellen 0–4 (Standard 1) |
| `unit` | optional, Einheit – sonst die der Entitäten |
| `datum_wahl` | optional, `false` blendet Pfeile und Kalender aus |

## Bearbeiten-Dialog

Alles lässt sich auch im Bearbeiten-Dialog einstellen: oben Überschrift, Wert in der Mitte, Text unter dem
Wert, Einheit, Nachkommastellen und „Frühere Tage wählbar“; darunter die Teile – je Teil Entität, Name
und Farbe (Farbwähler). Mit den Pfeilen umsortieren, mit dem Papierkorb entfernen; über „Teil
hinzufügen“ eine weitere Entität anhängen. Ohne eigene Farbe gilt die Farbe nach der Reihenfolge.

## Bedienung

- Tipp auf ein Stück oder eine Zeile der Legende öffnet den Verlauf der Entität, Tipp auf die Mitte den der
  `total_entity`. Mit der Maus hebt das Darüberfahren das Stück hervor.
- Frühere Tage: Pfeile, Kalender oder „Heute“. Der früheste wählbare Tag ist der erste vollständige Tag mit
  Statistik. Für frühere Tage brauchen die Entitäten eine Langzeitstatistik (`state_class: total` oder
  `total_increasing`), z. B. Tageszähler oder Energiezähler.
- Energie-Einheiten (Wh, kWh, MWh …) werden für frühere Tage in die Einheit der ersten Entität umgerechnet.

## Hinweise

- Wer die Datei vorher von Hand eingebunden hatte (`/local/kreisdiagramm-card.js`), entfernt diese
  Ressource (**Einstellungen → Dashboards → ⋮ → Ressourcen**), sonst lädt der Browser die ältere Fassung.

## Lizenz

MIT
