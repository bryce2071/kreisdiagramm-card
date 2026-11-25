/*
 * Kreisdiagramm-Karte für Home Assistant  –  v1.2.0
 * Zeigt mehrere Werte als Anteile eines Ganzen (Donut), die Summe steht in der Mitte.
 * Mit den Pfeilen oder dem Kalender oben rechts lassen sich frühere Tage ansehen: heute zeigt die
 * Karte die aktuellen Werte der Entitäten, frühere Tage kommen aus deren Langzeitstatistik
 * (Änderung über den Tag). Ein Tipp auf eine Zeile der Legende öffnet den Verlauf der Entität.
 * Alle Einstellungen gehen auch im Bearbeiten-Dialog der Karte (seit 1.2.0).
 *
 * type: custom:kreisdiagramm-card
 * title: Hausverbrauch                        # optional, Überschrift
 * total_entity: sensor.hausverbrauch_heute    # optional, sonst Summe der Teile
 * center_label: gesamt                        # optional, Text unter dem Mittelwert
 * decimals: 1                                 # optional, Nachkommastellen
 * unit: kWh                                   # optional, sonst Einheit der Entitäten
 * datum_wahl: true                            # optional, Pfeile und Kalender (false blendet sie aus)
 * entities:
 *   - entity: sensor.hausverbrauch_heute_aus_netz
 *     name: Netz                              # optional
 *     color: "#488fc2"                        # optional
 *
 * Quelle: https://github.com/bryce2071/kreisdiagramm-card (MIT-Lizenz)
 */
(() => {
  const TAG = "kreisdiagramm-card";
  const EDITOR_TAG = `${TAG}-editor`;
  const VERSION = "1.2.0";
  if (customElements.get(TAG)) return;

  const PALETTE = ["#488fc2", "#ff9800", "#4db6ac", "#8353d1", "#f06292", "#9ccc65", "#ffca28", "#78909c"];
  const R = 50;
  const CIRC = 2 * Math.PI * R;
  const GAP = 1.6; // Lücke zwischen zwei Stücken, in SVG-Einheiten
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const ENERGY_UNITS = ["Wh", "kWh", "MWh", "GWh", "TWh", "J", "kJ", "MJ", "GJ"];
  const DIVIDER = "var(--divider-color, rgba(127, 127, 127, 0.3))";

  const STYLE = `
    :host { display: block; }
    [hidden] { display: none !important; }
    ha-card { height: 100%; box-sizing: border-box; }
    .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; padding: 16px 16px 4px; }
    .title {
      flex: 1 1 140px; min-width: 0;
      font-family: var(--ha-card-header-font-family, inherit);
      font-size: var(--ha-card-header-font-size, 24px);
      color: var(--ha-card-header-color, var(--primary-text-color));
      line-height: 32px; letter-spacing: -0.012em;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .controls { flex: none; display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .chip {
      font: inherit; font-size: 12px; line-height: 16px; padding: 4px 11px; margin: 0; cursor: pointer; white-space: nowrap;
      border: 1px solid ${DIVIDER}; border-radius: 999px; background: none; color: var(--primary-color);
    }
    .nav { display: inline-flex; align-items: stretch; overflow: hidden; border: 1px solid ${DIVIDER}; border-radius: 999px; }
    .nav button {
      font: inherit; margin: 0; padding: 0 5px; border: 0; background: none; cursor: pointer; min-height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--primary-text-color); --mdc-icon-size: 20px;
    }
    .nav button:disabled { color: var(--disabled-text-color, rgba(127, 127, 127, 0.45)); cursor: default; }
    .nav button:not(:disabled):hover, .pick:hover { background: rgba(var(--rgb-primary-text-color, 0, 0, 0), .06); }
    .pick {
      position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; cursor: pointer;
      border-left: 1px solid ${DIVIDER}; border-right: 1px solid ${DIVIDER};
      color: var(--primary-text-color); font-size: 13px; line-height: 16px; white-space: nowrap;
      font-variant-numeric: tabular-nums; --mdc-icon-size: 16px;
    }
    .pick ha-icon { color: var(--secondary-text-color); }
    .pick input {
      position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0;
      opacity: 0; cursor: pointer; font-size: 16px; color-scheme: light dark;
    }
    .content { padding: 16px; container-type: inline-size; }
    .content.with-title { padding-top: 8px; }
    .layout { transition: opacity .2s ease; }
    .content.loading .layout { opacity: .45; }
    .donut { position: relative; width: min(200px, 72%); aspect-ratio: 1; margin: 4px auto 0; }
    @container (min-width: 500px) {
      .layout { display: grid; grid-template-columns: 200px 1fr; align-items: center; column-gap: 32px; }
      .donut { width: 200px; margin: 0; }
      .legend { margin-top: 0; }
    }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .track { fill: none; stroke: var(--divider-color, rgba(127,127,127,.25)); stroke-width: 15; }
    .slice {
      fill: none; stroke-width: 15; cursor: pointer;
      transition: stroke-dasharray .8s ease, stroke-dashoffset .8s ease, opacity .2s ease, stroke-width .2s ease;
    }
    .dim .slice { opacity: .35; }
    .dim .slice.active { opacity: 1; stroke-width: 17; }
    .center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; pointer-events: none;
    }
    .center .inner { pointer-events: auto; cursor: default; }
    .center .inner.clickable { cursor: pointer; }
    .value { color: var(--primary-text-color); font-size: 28px; line-height: 1.15; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .value .unit { font-size: 16px; margin-left: 3px; color: var(--secondary-text-color); }
    .label { color: var(--secondary-text-color); font-size: 13px; margin-top: 2px; }
    .legend { margin-top: 16px; display: flex; flex-direction: column; gap: 2px; }
    .row {
      display: grid; grid-template-columns: 12px 1fr auto 3.4em; align-items: center; column-gap: 12px;
      padding: 7px 8px; border-radius: 8px; cursor: pointer; outline: none;
      color: var(--primary-text-color); font-size: 14px;
    }
    .row:hover, .row.active, .row:focus-visible { background: rgba(var(--rgb-primary-text-color, 0, 0, 0), .06); }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .val { color: var(--secondary-text-color); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .pct { font-weight: 500; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .note { margin-top: 10px; text-align: center; color: var(--error-color, #db4437); font-size: 13px; }
  `;

  // Prozentwerte, die zusammen genau 100 ergeben (größter Rest bekommt die Rundung)
  const percents = (values) => {
    const sum = values.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return values.map(() => 0);
    const raw = values.map((v) => (v / sum) * 100);
    const out = raw.map(Math.floor);
    let rest = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - out[i], i])
      .sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => { if (rest > 0) { out[i] += 1; rest -= 1; } });
    return out;
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toMs = (v) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v));
  // Tage als "JJJJ-MM-TT" – Rechnen im Kalender, unabhängig von Sommer-/Winterzeit
  const addDays = (key, n) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };
  const utcNoon = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  };

  class KreisdiagrammCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._sig = null;
      this._active = -1;
      this._day = null; // null = heute (aktuelle Werte), sonst "JJJJ-MM-TT"
      this._cache = new Map();
    }

    setConfig(config) {
      if (!config || !Array.isArray(config.entities) || config.entities.length === 0) {
        throw new Error("Bitte unter 'entities' mindestens eine Entität angeben.");
      }
      const entities = config.entities.map((e, i) => {
        const item = typeof e === "string" ? { entity: e } : { ...e };
        if (!item.entity) throw new Error(`Eintrag ${i + 1} unter 'entities' hat keine 'entity'.`);
        return item;
      });
      const d = Number(config.decimals);
      this._config = {
        ...config,
        entities,
        decimals: Number.isInteger(d) && d >= 0 && d <= 4 ? d : 1,
        datum_wahl: config.datum_wahl !== false,
      };
      this._built = false;
      this._sig = null;
      this._day = null;
      this._dayValues = null;
      this._loading = false;
      this._error = null;
      this._loadToken = null;
      this._cache = new Map();
      this._firstDay = null;
      this._firstDayAsked = false;
      if (this._hass) this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._config && this._config.datum_wahl && !this._firstDayAsked) {
        this._firstDayAsked = true;
        const cfg = this._config;
        this._loadFirstDay().then((day) => {
          if (cfg !== this._config) return;
          this._firstDay = day;
          this._render();
        });
      }
      this._render();
    }

    getCardSize() {
      return 6;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6 };
    }

    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig(hass) {
      const ids = Object.keys(hass.states)
        .filter((id) => id.startsWith("sensor.") && hass.states[id].attributes.unit_of_measurement === "kWh")
        .slice(0, 3);
      return { title: "Kreisdiagramm", entities: ids.length ? ids : ["sensor.beispiel"] };
    }

    // ---------- Daten ----------

    _numberLocale() {
      const loc = (this._hass && this._hass.locale) || {};
      switch (loc.number_format) {
        case "comma_decimal": return ["en-US", "en"];
        case "decimal_comma": return ["de", "es", "it"];
        case "space_comma": return ["fr", "sv", "cs"];
        case "system": return undefined;
        default: return loc.language || (this._hass && this._hass.language) || "de";
      }
    }

    _lang() {
      const hass = this._hass || {};
      return (hass.locale && hass.locale.language) || hass.language || "de";
    }

    _fmt(value, decimals) {
      try {
        return new Intl.NumberFormat(this._numberLocale(), {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
      } catch (e) {
        return value.toFixed(decimals);
      }
    }

    // Kalendertag in der Zeitzone von Home Assistant – dort enden auch die Tageswerte der Statistik
    _dateKey(date) {
      const tz = (this._hass && this._hass.config && this._hass.config.time_zone) || undefined;
      if (!this._dtf || this._dtfTz !== tz) {
        try {
          this._dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
        } catch (e) {
          this._dtf = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
        }
        this._dtfTz = tz;
      }
      const parts = {};
      this._dtf.formatToParts(date).forEach((p) => { parts[p.type] = p.value; });
      return `${parts.year}-${parts.month}-${parts.day}`;
    }

    _todayKey() {
      return this._dateKey(new Date());
    }

    _modelFrom(valueOf) {
      const hass = this._hass;
      const cfg = this._config;
      const items = cfg.entities.map((e, i) => {
        const st = hass.states[e.entity];
        const num = valueOf(e.entity);
        const ok = Number.isFinite(num);
        return {
          entity: e.entity,
          name: e.name || (st && st.attributes.friendly_name) || e.entity,
          color: e.color || PALETTE[i % PALETTE.length],
          ok,
          value: ok && num > 0 ? num : 0,
          unit: st ? st.attributes.unit_of_measurement || "" : "",
        };
      });
      const pct = percents(items.map((it) => it.value));
      items.forEach((it, i) => { it.pct = pct[i]; });
      const sum = items.reduce((a, it) => a + it.value, 0);
      let total = sum;
      if (cfg.total_entity) {
        const n = valueOf(cfg.total_entity);
        if (Number.isFinite(n)) total = Math.max(n, 0);
      }
      const unit = cfg.unit !== undefined ? cfg.unit : (items.find((it) => it.unit) || {}).unit || "";
      return { items, sum, total, unit };
    }

    _liveValue(entityId) {
      const st = this._hass.states[entityId];
      return st ? Number.parseFloat(st.state) : Number.NaN;
    }

    _dayValue(entityId) {
      const v = this._dayValues ? this._dayValues[entityId] : undefined;
      return typeof v === "number" ? v : Number.NaN;
    }

    _statIds() {
      const ids = this._config.entities.map((e) => e.entity);
      if (this._config.total_entity && !ids.includes(this._config.total_entity)) ids.push(this._config.total_entity);
      return ids;
    }

    _statsRequest(ids, start, end, period) {
      const req = {
        type: "recorder/statistics_during_period",
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        statistic_ids: ids,
        period,
        types: ["change"],
      };
      const first = this._hass.states[this._config.entities[0].entity];
      const unit = this._config.unit !== undefined ? this._config.unit : first && first.attributes.unit_of_measurement;
      if (ENERGY_UNITS.includes(unit)) req.units = { energy: unit };
      return this._hass.callWS(req);
    }

    // Tageswerte (Änderung über den Tag) aus der Langzeitstatistik
    async _loadDay(day) {
      const ids = this._statIds();
      const noon = utcNoon(day).getTime();
      const res = (await this._statsRequest(ids, noon - 48 * HOUR, noon + 48 * HOUR, "day")) || {};
      const values = {};
      ids.forEach((id) => {
        const row = (res[id] || []).find((r) => this._dateKey(new Date(toMs(r.start))) === day);
        if (row && Number.isFinite(row.change)) values[id] = row.change;
      });
      // Gestern kann sich noch ändern, bis die letzte Stunde geschrieben ist
      this._cache.set(day, { values, at: Date.now(), final: day < addDays(this._todayKey(), -1) });
      return values;
    }

    _cached(day) {
      const c = this._cache.get(day);
      return c && (c.final || Date.now() - c.at < 10 * 60 * 1000) ? c.values : null;
    }

    // Erster vollständiger Tag mit Statistik (der erste Tag ist meist nur angebrochen)
    async _loadFirstDay() {
      const id = this._config.total_entity || this._config.entities[0].entity;
      try {
        const now = Date.now();
        const months = (await this._statsRequest([id], now - 20 * 365 * DAY, now + DAY, "month")) || {};
        const month = (months[id] || [])[0];
        if (!month) return null;
        const start = toMs(month.start);
        const days = (await this._statsRequest([id], start - DAY, start + 33 * DAY, "day")) || {};
        const first = (days[id] || [])[0];
        return first ? addDays(this._dateKey(new Date(toMs(first.start))), 1) : null;
      } catch (err) {
        console.warn(`${TAG}: erster Tag der Statistik nicht ermittelbar`, err);
        return null;
      }
    }

    // ---------- Tag wählen ----------

    _goto(day) {
      const today = this._todayKey();
      let next = day && day < today ? day : null;
      if (next && this._firstDay && next < this._firstDay) next = this._firstDay;
      if (next === this._day) {
        this._sig = null;
        this._render();
        return;
      }
      this._day = next;
      this._error = null;
      this._loadToken = null;
      if (!next) {
        this._loading = false;
        this._dayValues = null;
        this._render();
        return;
      }
      const cached = this._cached(next);
      if (cached) {
        this._dayValues = cached;
        this._loading = false;
        this._render();
        return;
      }
      this._loading = true;
      this._render();
      const token = (this._loadToken = {});
      this._loadDay(next).then(
        (values) => {
          if (token !== this._loadToken) return;
          this._dayValues = values;
          this._loading = false;
          this._render();
        },
        (err) => {
          if (token !== this._loadToken) return;
          console.warn(`${TAG}:`, err);
          this._dayValues = {};
          this._error = "Die Tageswerte konnten nicht geladen werden.";
          this._loading = false;
          this._render();
        },
      );
    }

    _step(n) {
      this._goto(addDays(this._day || this._todayKey(), n));
    }

    _dayLabel(day, today) {
      if (day === today) return "Heute";
      if (day === addDays(today, -1)) return "Gestern";
      const opts = { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" };
      if (day.slice(0, 4) !== today.slice(0, 4)) opts.year = "2-digit";
      try {
        return new Intl.DateTimeFormat(this._lang(), opts).format(utcNoon(day));
      } catch (e) {
        return day;
      }
    }

    _longDate(day) {
      try {
        return new Intl.DateTimeFormat(this._lang(), {
          weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
        }).format(utcNoon(day));
      } catch (e) {
        return day;
      }
    }

    // ---------- Darstellung ----------

    _render() {
      if (!this._config || !this._hass) return;
      const today = this._config.datum_wahl ? this._todayKey() : "";
      if (this._day && this._day >= today) {
        this._day = null; // nach Mitternacht oder falsch gewählt: zurück zu heute
        this._loading = false;
        this._error = null;
      }
      let m;
      if (!this._day) m = this._modelFrom((id) => this._liveValue(id));
      else if (this._loading) m = this._lastModel || this._modelFrom(() => Number.NaN);
      else m = this._modelFrom((id) => this._dayValue(id));
      this._lastModel = m;
      const sig = JSON.stringify([
        m.items.map((it) => [it.value.toFixed(4), it.ok, it.name, it.color]),
        m.total.toFixed(4), m.unit, this._numberLocale(),
        this._day, this._loading, this._error, today, this._firstDay,
      ]);
      if (sig === this._sig) return;
      this._sig = sig;
      if (!this._built) this._build(m);
      this._update(m);
      this._updateNav(today);
    }

    _build(m) {
      const cfg = this._config;
      const title = cfg.title ? esc(cfg.title) : "";
      const nav = cfg.datum_wahl
        ? `
            <div class="controls">
              <button type="button" class="chip today" hidden>Heute</button>
              <div class="nav" role="group" aria-label="Tag wählen">
                <button type="button" class="prev" title="Vortag" aria-label="Vortag"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
                <div class="pick" title="Datum wählen">
                  <span class="day"></span><ha-icon icon="mdi:calendar-month-outline"></ha-icon>
                  <input type="date" aria-label="Datum wählen">
                </div>
                <button type="button" class="next" title="Nächster Tag" aria-label="Nächster Tag"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
              </div>
            </div>`
        : "";
      const head = title || nav ? `<div class="head"><div class="title">${title}</div>${nav}</div>` : "";
      const slices = m.items
        .map((it, i) => `<circle class="slice" data-i="${i}" cx="60" cy="60" r="${R}" stroke-dasharray="0 ${CIRC}"><title></title></circle>`)
        .join("");
      const rows = m.items
        .map((it, i) => `
          <div class="row" data-i="${i}" role="button" tabindex="0">
            <span class="dot"></span><span class="name"></span><span class="val"></span><span class="pct"></span>
          </div>`)
        .join("");
      this.shadowRoot.innerHTML = `
        <style>${STYLE}</style>
        <ha-card>
          ${head}
          <div class="content ${head ? "with-title" : ""}">
            <div class="layout">
              <div class="donut" role="img">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="track" cx="60" cy="60" r="${R}"></circle>
                  <g class="slices" transform="rotate(-90 60 60)">${slices}</g>
                </svg>
                <div class="center">
                  <div class="inner ${cfg.total_entity ? "clickable" : ""}">
                    <div class="value"><span class="num"></span><span class="unit"></span></div>
                    <div class="label"></div>
                  </div>
                </div>
              </div>
              <div class="legend">${rows}</div>
            </div>
            <div class="note" hidden></div>
          </div>
        </ha-card>`;

      const root = this.shadowRoot;
      root.querySelectorAll(".slice, .row").forEach((el) => {
        const i = Number(el.dataset.i);
        el.addEventListener("click", () => this._moreInfo(this._config.entities[i].entity));
        el.addEventListener("pointerenter", () => this._highlight(i));
        el.addEventListener("pointerleave", () => this._highlight(-1));
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this._moreInfo(this._config.entities[i].entity);
          }
        });
      });
      if (cfg.total_entity) {
        root.querySelector(".center .inner").addEventListener("click", () => this._moreInfo(cfg.total_entity));
      }
      if (cfg.datum_wahl) {
        root.querySelector(".prev").addEventListener("click", () => this._step(-1));
        root.querySelector(".next").addEventListener("click", () => this._step(1));
        root.querySelector(".today").addEventListener("click", () => this._goto(null));
        const input = root.querySelector(".pick input");
        input.addEventListener("click", () => {
          if (typeof input.showPicker === "function") {
            try {
              input.showPicker();
            } catch (e) {
              /* dann öffnet der Browser den Kalender selbst */
            }
          }
        });
        input.addEventListener("change", () => {
          if (input.value) this._goto(input.value);
        });
      }
      this._built = true;
      this._firstDraw = true;
    }

    _update(m) {
      const root = this.shadowRoot;
      const cfg = this._config;
      const d = cfg.decimals;
      const unitTxt = m.unit ? ` ${m.unit}` : "";
      const nonZero = m.items.filter((it) => it.value > 0).length;
      const empty = !!this._day && !this._loading && !m.items.some((it) => it.ok);

      root.querySelector(".content").classList.toggle("loading", !!this._loading);
      root.querySelector(".num").textContent = empty ? "–" : this._fmt(m.total, d);
      root.querySelector(".value .unit").textContent = empty ? "" : m.unit;
      root.querySelector(".label").textContent = empty
        ? "keine Daten"
        : cfg.center_label !== undefined ? cfg.center_label : "gesamt";
      const note = root.querySelector(".note");
      note.hidden = !this._error;
      note.textContent = this._error || "";
      root.querySelector(".donut").setAttribute(
        "aria-label",
        `${cfg.title || "Kreisdiagramm"}${this._day ? ` (${this._longDate(this._day)})` : ""}: ` +
          m.items.map((it) => `${it.name} ${this._fmt(it.value, d)}${unitTxt} (${it.pct} %)`).join(", "),
      );

      let offset = 0;
      const geometry = m.items.map((it) => {
        const len = m.sum > 0 ? (it.value / m.sum) * CIRC : 0;
        const draw = len <= 0 ? 0 : nonZero > 1 ? Math.max(len - GAP, Math.min(len, 0.8)) : len;
        const g = { dash: `${draw} ${CIRC}`, offset: -offset };
        offset += len;
        return g;
      });

      root.querySelectorAll(".slice").forEach((el, i) => {
        const it = m.items[i];
        el.style.stroke = it.color;
        el.querySelector("title").textContent = it.ok
          ? `${it.name}: ${this._fmt(it.value, d)}${unitTxt} (${it.pct} %)`
          : `${it.name}: ${this._day ? "keine Daten" : "nicht verfügbar"}`;
        el.setAttribute("stroke-dashoffset", geometry[i].offset);
        if (this._firstDraw) {
          el.setAttribute("stroke-dasharray", `0 ${CIRC}`);
        } else {
          el.setAttribute("stroke-dasharray", geometry[i].dash);
        }
      });
      if (this._firstDraw) {
        this._firstDraw = false;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          root.querySelectorAll(".slice").forEach((el, i) => el.setAttribute("stroke-dasharray", geometry[i].dash));
        }));
      }

      root.querySelectorAll(".row").forEach((row, i) => {
        const it = m.items[i];
        row.querySelector(".dot").style.background = it.color;
        row.querySelector(".name").textContent = it.name;
        row.querySelector(".val").textContent = it.ok ? `${this._fmt(it.value, d)}${unitTxt}` : "–";
        row.querySelector(".pct").textContent = it.ok && m.sum > 0 ? `${it.pct} %` : "–";
        row.setAttribute("aria-label", row.querySelector(".name").textContent);
      });
      this._highlight(this._active);
    }

    _updateNav(today) {
      if (!this._config.datum_wahl) return;
      const root = this.shadowRoot;
      const day = this._day || today;
      root.querySelector(".pick .day").textContent = this._dayLabel(day, today);
      root.querySelector(".pick").title = `${this._longDate(day)} – anderes Datum wählen`;
      const input = root.querySelector(".pick input");
      if (input.max !== today) input.max = today;
      if (this._firstDay && input.min !== this._firstDay) input.min = this._firstDay;
      if (input.value !== day) input.value = day;
      root.querySelector(".prev").disabled = !!this._firstDay && day <= this._firstDay;
      root.querySelector(".next").disabled = !this._day;
      root.querySelector(".today").hidden = !this._day;
    }

    _highlight(i) {
      this._active = i;
      const root = this.shadowRoot;
      const slices = root.querySelector(".slices");
      if (!slices) return;
      slices.classList.toggle("dim", i >= 0);
      root.querySelectorAll(".slice").forEach((el, k) => el.classList.toggle("active", k === i));
      root.querySelectorAll(".row").forEach((el, k) => el.classList.toggle("active", k === i));
    }

    _moreInfo(entityId) {
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId };
      this.dispatchEvent(ev);
    }
  }

  // ---------- Bearbeiten-Dialog ----------

  // HA lädt seine Formular-Bausteine (ha-form, Auswahlfelder) erst mit einem Editor –
  // notfalls einmal den Editor der Entitäten-Karte laden, dann sind sie da.
  let formVersprechen = null;
  const haFormLaden = () => {
    if (!formVersprechen) {
      formVersprechen = (async () => {
        try {
          if (!customElements.get("ha-form") && window.loadCardHelpers) {
            const helpers = await window.loadCardHelpers();
            const c = await helpers.createCardElement({ type: "entities", entities: [] });
            if (c && c.constructor && c.constructor.getConfigElement) await c.constructor.getConfigElement();
          }
        } catch (e) {
          /* dann bleibt der Code-Editor */
        }
      })();
    }
    return formVersprechen.then(() => customElements.whenDefined("ha-form"));
  };

  const hexZuRgb = (s) => {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(s || "").trim());
    if (!m) return undefined;
    const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const rgbZuHex = (rgb) =>
    Array.isArray(rgb) && rgb.length === 3
      ? "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, "0")).join("")
      : undefined;

  const ED_STYLE = `
    :host { display: block; }
    .ed { display: flex; flex-direction: column; gap: 8px; }
    h3 { margin: 16px 0 0; font-size: 1em; font-weight: 500; color: var(--primary-color); }
    .hinweis { font-size: .85em; color: var(--secondary-text-color); margin: -4px 2px 2px; line-height: 1.4; }
    .liste { display: flex; flex-direction: column; gap: 8px; }
    .eintrag { border: 1px solid var(--divider-color, rgba(127, 127, 127, .3)); border-radius: 10px; padding: 4px 8px 6px; }
    .leiste { display: flex; align-items: center; gap: 2px; }
    .leiste .nr { flex: 1; min-width: 0; font-size: .9em; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .punkt { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
    .kn { border: 0; background: none; color: var(--secondary-text-color); padding: 4px; border-radius: 50%; cursor: pointer; display: inline-flex; }
    .kn:hover { background: rgba(127, 127, 127, .15); }
    .kn[disabled] { opacity: .35; cursor: default; background: none; }
    .kn.rot { color: var(--error-color, #db4437); }
    .kn ha-icon { --mdc-icon-size: 20px; }
    .neu { display: block; border: 1px dashed var(--divider-color, rgba(127, 127, 127, .4)); border-radius: 10px; padding: 6px 8px 2px; }
  `;

  const knopf = (icon, titel, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kn" + (cls ? ` ${cls}` : "");
    b.title = titel;
    b.setAttribute("aria-label", titel);
    b.innerHTML = `<ha-icon icon="${icon}"></ha-icon>`;
    return b;
  };

  const ED_LABEL = {
    title: "Überschrift",
    total_entity: "Wert in der Mitte (optional)",
    center_label: "Text unter dem Wert",
    unit: "Einheit",
    decimals: "Nachkommastellen",
    datum_wahl: "Frühere Tage wählbar",
    entity: "Entität",
    name: "Name",
    color: "Farbe",
    neu: "Teil hinzufügen",
  };
  const ED_HILFE = {
    total_entity: "Leer = Summe der Teile.",
    center_label: "Leer = „gesamt“.",
    unit: "Leer = Einheit der Entitäten.",
    datum_wahl: "Pfeile und Kalender oben rechts; frühere Tage kommen aus der Langzeitstatistik.",
    name: "Leer = Name der Entität.",
    neu: "Entität auswählen – sie wird als neues Teil angehängt.",
  };
  const ED_SCHEMA = [
    { name: "title", selector: { text: {} } },
    { name: "total_entity", selector: { entity: {} } },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "center_label", selector: { text: {} } },
        { name: "unit", selector: { text: {} } },
      ],
    },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "decimals", selector: { number: { min: 0, max: 4, step: 1, mode: "box" } } },
        { name: "datum_wahl", selector: { boolean: {} } },
      ],
    },
  ];
  const TEIL_SCHEMA = [
    { name: "entity", required: true, selector: { entity: {} } },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "name", selector: { text: {} } },
        { name: "color", selector: { color_rgb: {} } },
      ],
    },
  ];
  const NEU_SCHEMA = [{ name: "neu", selector: { entity: {} } }];
  const ORDNUNG = ["type", "title", "total_entity", "center_label", "unit", "decimals", "datum_wahl", "entities"];

  class KreisdiagrammCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._cfg = {};
      this._formen = [];
      this._koepfe = [];
    }

    set hass(hass) {
      this._hass = hass;
      this.shadowRoot.querySelectorAll("ha-form").forEach((f) => {
        f.hass = hass;
      });
    }

    setConfig(config) {
      this._cfg = { ...(config || {}) };
      this._zeichnen();
    }

    connectedCallback() {
      if (this._gestartet) return;
      this._gestartet = true;
      haFormLaden().then(() => {
        this._bereit = true;
        this._zeichnen();
      });
    }

    _teile() {
      return (Array.isArray(this._cfg.entities) ? this._cfg.entities : []).map((e) => (typeof e === "string" ? { entity: e } : { ...e }));
    }

    _form(schema, onChange) {
      const f = document.createElement("ha-form");
      f.computeLabel = (s) => ED_LABEL[s.name] || s.name;
      f.computeHelper = (s) => ED_HILFE[s.name] || "";
      f.hass = this._hass;
      f.schema = schema;
      f.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        onChange({ ...((ev.detail && ev.detail.value) || {}) });
      });
      return f;
    }

    // Aufbau nur, wenn sich die Zahl der Teile ändert – sonst bekommen die Formulare nur neue Daten
    // (so bleibt beim Tippen der Fokus im Feld)
    _zeichnen() {
      if (!this._bereit) return;
      const teile = this._teile();
      if (this._anzahl !== teile.length) {
        this._anzahl = teile.length;
        this._aufbauen(teile.length);
      }
      const c = this._cfg;
      const kopf = {
        title: c.title || "",
        total_entity: c.total_entity || "",
        center_label: c.center_label === undefined ? "" : String(c.center_label),
        unit: c.unit === undefined ? "" : String(c.unit),
        decimals: c.decimals === undefined || c.decimals === "" ? 1 : Number(c.decimals),
        datum_wahl: c.datum_wahl !== false,
      };
      this._daten(this._kopf, kopf);
      teile.forEach((t, i) => {
        const farbe = t.color || PALETTE[i % PALETTE.length];
        this._daten(this._formen[i], { entity: t.entity || "", name: t.name || "", color: hexZuRgb(farbe) });
        const st = t.entity && this._hass ? this._hass.states[t.entity] : null;
        const name = t.name || (st && st.attributes.friendly_name) || t.entity || "";
        this._koepfe[i].innerHTML = `<span class="punkt" style="background:${esc(farbe)}"></span>Teil ${i + 1}${name ? ` · ${esc(name)}` : ""}`;
      });
    }

    _daten(f, d) {
      if (f && JSON.stringify(f.data) !== JSON.stringify(d)) f.data = d;
    }

    _aufbauen(n) {
      const root = this.shadowRoot;
      root.innerHTML = `<style>${ED_STYLE}</style><div class="ed"></div>`;
      const ed = root.querySelector(".ed");
      this._kopf = this._form(ED_SCHEMA, (v) => this._kopfGeaendert(v));
      ed.appendChild(this._kopf);
      const h = document.createElement("h3");
      h.textContent = "Teile";
      const hinweis = document.createElement("div");
      hinweis.className = "hinweis";
      hinweis.textContent = "Ohne eigene Farbe gilt die Farbe nach der Reihenfolge.";
      const liste = document.createElement("div");
      liste.className = "liste";
      ed.append(h, hinweis, liste);
      this._formen = [];
      this._koepfe = [];
      for (let i = 0; i < n; i += 1) {
        const box = document.createElement("div");
        box.className = "eintrag";
        box.dataset.teil = String(i);
        const leiste = document.createElement("div");
        leiste.className = "leiste";
        const nr = document.createElement("span");
        nr.className = "nr";
        const hoch = knopf("mdi:arrow-up", "nach oben");
        const runter = knopf("mdi:arrow-down", "nach unten");
        const weg = knopf("mdi:delete-outline", "Teil entfernen", "rot");
        hoch.disabled = i === 0;
        runter.disabled = i === n - 1;
        hoch.addEventListener("click", () => this._verschieben(i, -1));
        runter.addEventListener("click", () => this._verschieben(i, 1));
        weg.addEventListener("click", () => this._entfernen(i));
        leiste.append(nr, hoch, runter, weg);
        const f = this._form(TEIL_SCHEMA, (v) => this._teilGeaendert(i, v));
        box.append(leiste, f);
        liste.appendChild(box);
        this._formen.push(f);
        this._koepfe.push(nr);
      }
      const neu = this._form(NEU_SCHEMA, (v) => {
        if (!v.neu) return;
        neu.data = { neu: "" };
        this._senden({ ...this._cfg, entities: [...this._teile(), { entity: v.neu }] });
      });
      neu.className = "neu";
      neu.data = { neu: "" };
      ed.appendChild(neu);
    }

    _kopfGeaendert(v) {
      const c = { ...this._cfg };
      const setze = (k, wert, standard) => {
        if (wert === undefined || wert === null || wert === "" || wert === standard) delete c[k];
        else c[k] = wert;
      };
      setze("title", v.title);
      setze("total_entity", v.total_entity);
      setze("center_label", v.center_label);
      setze("unit", v.unit);
      const d = v.decimals === undefined || v.decimals === null || v.decimals === "" ? undefined : Number(v.decimals);
      setze("decimals", Number.isInteger(d) ? d : undefined, 1);
      if (v.datum_wahl === false) c.datum_wahl = false;
      else delete c.datum_wahl;
      this._senden(c);
    }

    _teilGeaendert(i, v) {
      const teile = this._teile();
      const alt = teile[i] || {};
      const neu = { ...alt };
      if (v.entity) neu.entity = v.entity; // leeren geht nicht – zum Entfernen den Papierkorb nehmen
      if (v.name) neu.name = v.name;
      else delete neu.name;
      const hex = rgbZuHex(v.color);
      if (hex) {
        // Standardfarbe nicht festschreiben, solange sie niemand geändert hat
        if (alt.color || hex !== PALETTE[i % PALETTE.length]) neu.color = hex;
      } else if (!(alt.color && !hexZuRgb(alt.color))) {
        delete neu.color; // eine eigene CSS-Farbe (z. B. var(--…)) bleibt, die zeigt der Farbwähler nicht
      }
      teile[i] = neu;
      this._senden({ ...this._cfg, entities: teile });
    }

    _verschieben(i, d) {
      const teile = this._teile();
      const j = i + d;
      if (j < 0 || j >= teile.length) return;
      [teile[i], teile[j]] = [teile[j], teile[i]];
      this._senden({ ...this._cfg, entities: teile });
    }

    _entfernen(i) {
      const teile = this._teile();
      teile.splice(i, 1);
      this._senden({ ...this._cfg, entities: teile });
    }

    _senden(c) {
      // feste Reihenfolge, damit der Code-Editor übersichtlich bleibt
      const aus = {};
      ORDNUNG.forEach((k) => {
        if (c[k] !== undefined) aus[k] = c[k];
      });
      Object.keys(c).forEach((k) => {
        if (!(k in aus)) aus[k] = c[k];
      });
      this._cfg = aus;
      this._zeichnen();
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: aus }, bubbles: true, composed: true }));
    }
  }

  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, KreisdiagrammCardEditor);
  customElements.define(TAG, KreisdiagrammCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: TAG,
    name: "Kreisdiagramm",
    description: "Anteile mehrerer Werte als Kreisdiagramm (Donut) mit der Summe in der Mitte, frühere Tage per Pfeil oder Kalender.",
  });
  console.info(`%c KREISDIAGRAMM-CARD %c ${VERSION} `, "color:#fff;background:#ff9800;font-weight:600", "color:#ff9800");
})();
