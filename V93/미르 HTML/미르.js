(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // assets/project-validation.js
  var require_project_validation = __commonJS({
    "assets/project-validation.js"(exports, module) {
      (function(root2) {
        function validateProject(data, defs) {
          const fail = (message) => {
            throw new Error("\uD504\uB85C\uC81D\uD2B8 \uD30C\uC77C \uC624\uB958: " + message);
          };
          const obj = (v) => v && typeof v === "object" && !Array.isArray(v);
          if (!obj(data) || data.format !== "mir-wiring/1" || !Array.isArray(data.instances) || !Array.isArray(data.wires)) fail("\uBBF8\uB974 \uBC30\uC120 \uD30C\uC77C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
          if (data.instances.length > 2e3 || data.wires.length > 1e4) fail("\uBD80\uD488 \uB610\uB294 \uBC30\uC120 \uAC1C\uC218\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4.");
          if (data.title != null && typeof data.title !== "string") fail("\uD504\uB85C\uC81D\uD2B8 \uC774\uB984\uC744 \uD655\uC778\uD558\uC138\uC694.");
          const side = (value) => ["left", "right", "top", "bottom"].includes(value);
          const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
          if (data.partDefinitions !== void 0) {
            const parts = data.partDefinitions;
            if (!Array.isArray(parts) || parts.length > data.instances.length) fail("\uD3EC\uD568\uB41C \uBD80\uD488 \uBAA9\uB85D\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            const ids2 = /* @__PURE__ */ new Set(), used = new Set(data.instances.map((i) => i?.part));
            for (const part of parts) {
              if (!obj(part) || !used.has(part.id) || ids2.has(part.id) || typeof part.name !== "string" || !part.name.trim() || typeof part.category !== "string" || !Array.isArray(part.pins) || part.pins.length > 1e3) fail("\uD3EC\uD568\uB41C \uBD80\uD488 \uC815\uC758\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
              ids2.add(part.id);
              const pins = /* @__PURE__ */ new Set();
              for (const pin2 of part.pins) {
                if (!obj(pin2) || typeof pin2.id !== "string" || !pin2.id.trim() || pins.has(pin2.id) || !side(pin2.side) || pin2.label != null && typeof pin2.label !== "string" || pin2.type != null && typeof pin2.type !== "string" || pin2.functions != null && !strings(pin2.functions)) fail(part.id + "\uC758 \uD3EC\uD568\uB41C \uD540 \uC815\uC758\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
                pins.add(pin2.id);
              }
              if (part.sources != null && !strings(part.sources) || part.unresolvedFields != null && !strings(part.unresolvedFields)) fail(part.id + "\uC758 \uBD80\uD488 \uCD9C\uCC98 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
              if (part.behavior != null && (!obj(part.behavior) || part.behavior.forwardVoltage != null && !Number.isFinite(part.behavior.forwardVoltage) || part.behavior.ohms != null && !Number.isFinite(part.behavior.ohms) || part.behavior.color != null && !/^#[0-9a-f]{3,8}$/i.test(part.behavior.color))) fail(part.id + "\uC758 \uBD80\uD488 \uB3D9\uC791 \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
              if (part.imageData != null && (typeof part.imageData !== "string" || !/^data:image\/(?:svg\+xml|png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(part.imageData))) fail(part.id + "\uC758 \uBD80\uD488 \uADF8\uB9BC\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
              if (part._layout != null) {
                const layout = part._layout;
                if (!obj(layout) || !Number.isFinite(layout.w) || !Number.isFinite(layout.h) || layout.w <= 0 || layout.h <= 0 || !Number.isFinite(layout.top) || !obj(layout.pos) || Object.keys(layout.pos).length !== pins.size || part.pins.some((pin2) => {
                  const pos = layout.pos[pin2.id];
                  return !obj(pos) || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !side(pos.side);
                })) fail(part.id + "\uC758 \uD540 \uC704\uCE58\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
              }
            }
          }
          const refs = /* @__PURE__ */ new Map(), ids = /* @__PURE__ */ new Set();
          for (const i of data.instances) {
            if (!obj(i) || typeof i.ref !== "string" || !i.ref.trim() || i.ref.includes(".") || refs.has(i.ref)) fail("\uBD80\uD488 \uCC38\uC870\uAC00 \uC5C6\uAC70\uB098 \uC911\uBCF5\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
            if (typeof i.part !== "string" || !i.part.trim()) fail(i.ref + "\uC758 \uBD80\uD488 ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
            if (!Number.isFinite(i.x) || !Number.isFinite(i.y) || Math.abs(i.x) > 1e7 || Math.abs(i.y) > 1e7) fail(i.ref + "\uC758 \uC704\uCE58\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            if (i.rotation != null && !Number.isFinite(i.rotation)) fail(i.ref + "\uC758 \uD68C\uC804 \uAC12\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            if (i.mirrored != null && typeof i.mirrored !== "boolean") fail(i.ref + "\uC758 \uBC18\uC804 \uC0C1\uD0DC\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            if (i.props != null && !obj(i.props)) fail(i.ref + "\uC758 \uC18D\uC131 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            if (i.label != null && typeof i.label !== "string") fail(i.ref + "\uC758 \uC774\uB984 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            if (defs && !defs.has(i.part)) fail(i.part + " \uBD80\uD488 JSON\uC744 \uBA3C\uC800 \uBD80\uD488\uD568\uC5D0 \uCD94\uAC00\uD574 \uC8FC\uC138\uC694.");
            refs.set(i.ref, i);
          }
          function pin(key2) {
            if (typeof key2 !== "string") fail("\uD540 \uCC38\uC870\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
            const dot = key2.indexOf("."), ref = key2.slice(0, dot), pid = key2.slice(dot + 1), i = refs.get(ref);
            if (dot < 1 || !pid || !i) fail("\uC5C6\uB294 \uBD80\uD488\uC758 \uD540 \uC5F0\uACB0: " + key2);
            if (defs && !defs.get(i.part).pins.some((p) => p.id === pid)) fail("\uC5C6\uB294 \uD540 \uC5F0\uACB0: " + key2);
          }
          for (const w of data.wires) {
            if (!obj(w) || typeof w.id !== "string" || !w.id || ids.has(w.id)) fail("\uBC30\uC120 ID\uAC00 \uC5C6\uAC70\uB098 \uC911\uBCF5\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
            ids.add(w.id);
            pin(w.from);
            pin(w.to);
            if (w.from === w.to) fail("\uAC19\uC740 \uD540\uB07C\uB9AC \uC5F0\uACB0\uB41C \uC120\uC774 \uC788\uC2B5\uB2C8\uB2E4.");
            if (w.kind != null && !["power", "gnd", "sda", "scl", "signal", "contact"].includes(w.kind)) fail("\uC54C \uC218 \uC5C6\uB294 \uC120 \uC0C9\uC0C1 \uC885\uB958\uC785\uB2C8\uB2E4.");
          }
          return data;
        }
        if (typeof module === "object" && module.exports) module.exports = { validateProject };
        if (typeof window === "object") root2.MirProjectValidation = { validateProject };
      })(globalThis);
    }
  });

  // assets/server-connection.js
  var require_server_connection = __commonJS({
    "assets/server-connection.js"(exports, module) {
      (function(root2) {
        function normalizeServerUrl(value) {
          const url = new URL(value);
          if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("\uC11C\uBC84 \uC8FC\uC18C\uB294 \uACBD\uB85C\xB7\uACC4\uC815 \uC815\uBCF4 \uC5C6\uC774 \uC785\uB825\uD558\uC138\uC694.");
          if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("\uC678\uBD80 \uC11C\uBC84\uC5D0\uB294 HTTPS \uC8FC\uC18C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
          return url.origin;
        }
        const routes = /^\/(?:chat\/(?:config|diagnostics|sessions(?:\/[a-f0-9]+(?:\/messages(?:\/[a-f0-9]+)?)?)?)|verification\/(?:config|projects(?:\/[a-f0-9]{32}(?:\/verify)?)?|jobs\/[a-f0-9-]+\/artifacts\/(?:erc\.json|erc\.log|export\.cir|export\.log|run\.cir|ngspice\.log))|jobs\/[a-f0-9-]+|components\/search(?:\?limit=100(?:&offset=[0-9]{1,5})?)?|components\/[a-zA-Z0-9_.%-]+(?:\/image)?|circuits(?:\/[a-zA-Z0-9-]+(?:\/validate)?)?)$/;
        function updateConnection(previous, input2) {
          if (input2.mode !== "remote") return { mode: "local", url: "", key: "" };
          const url = normalizeServerUrl(input2.url.trim());
          const key2 = input2.key?.trim() || (previous.url === url ? previous.key : "");
          if (!key2 || key2.length < 24 || /[\r\n]/.test(key2)) throw new Error("\uBC30\uC120 API \uD0A4\uB97C \uC785\uB825\uD558\uC138\uC694. \uC11C\uBC84 \uC8FC\uC18C\uB97C \uBC14\uAFB8\uBA74 \uD0A4\uB3C4 \uB2E4\uC2DC \uC785\uB825\uD574\uC57C \uD569\uB2C8\uB2E4.");
          return { mode: "remote", url, key: key2 };
        }
        function createTransport({ read, fetcher = (...args) => fetch(...args) }) {
          return async (route, options = {}) => {
            if (!routes.test(route) || !["GET", "POST", "PUT", "DELETE"].includes(options.method || "GET")) throw new Error("\uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC740 API \uC694\uCCAD\uC785\uB2C8\uB2E4.");
            const config = read();
            const remote = config.mode === "remote";
            if (remote && !config.key) throw new Error("\uC5F0\uACB0 \uC124\uC815\uC5D0\uC11C \uBC30\uC120 API \uD0A4\uB97C \uB2E4\uC2DC \uC785\uB825\uD558\uC138\uC694.");
            const direct = remote || options.headers?.["X-API-Key"];
            const response = await fetcher(direct ? (remote ? normalizeServerUrl(config.url) : "http://127.0.0.1:8000") + route : "http://127.0.0.1:8002/local-connection/request", {
              method: direct ? options.method || "GET" : "POST",
              headers: { "Content-Type": "application/json", ...direct ? { "X-API-Key": remote ? config.key : options.headers["X-API-Key"] } : {} },
              ...direct ? options.body ? { body: options.body } : {} : { body: JSON.stringify({ path: route, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null }) },
              redirect: "error",
              cache: "no-store",
              signal: AbortSignal.timeout(route.startsWith("/chat/") ? 45e3 : 2e4)
            });
            let body;
            try {
              body = await response.json();
            } catch {
              throw new Error("\uC11C\uBC84\uAC00 JSON\uC744 \uBC18\uD658\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD130\uB110 \uC2E4\uD589 \uC0C1\uD0DC\uC640 \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.");
            }
            return !direct && response.ok ? body : { status: response.status, body };
          };
        }
        const api2 = { normalizeServerUrl, updateConnection, createTransport };
        if (typeof module === "object" && module.exports) module.exports = api2;
        if (typeof window === "object") root2.MirServerConnection = api2;
      })(globalThis);
    }
  });

  // assets/app.js
  var import_project_validation = __toESM(require_project_validation());

  // assets/confirm-dialog.js
  function confirmAction(message, { title: heading2 = "\uC791\uC5C5 \uD655\uC778", cancelLabel = "\uCDE8\uC18C", acceptLabel = "\uD655\uC778", extraLabel = null, defaultAction = "cancel" } = {}) {
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const dialog2 = document.createElement("dialog");
      dialog2.className = "mir-confirm";
      const title = document.createElement("h2");
      title.textContent = heading2;
      const text2 = document.createElement("p");
      text2.textContent = message;
      const actions = document.createElement("div");
      actions.className = "modal-actions";
      const cancel = document.createElement("button");
      cancel.textContent = cancelLabel;
      const accept = document.createElement("button");
      accept.textContent = acceptLabel;
      accept.className = "primary";
      if (extraLabel) {
        cancel.textContent = "\xD7";
        cancel.className = "confirm-close";
        cancel.setAttribute("aria-label", "\uACC4\uC18D \uD3B8\uC9D1");
        title.append(cancel);
      } else actions.append(cancel);
      if (extraLabel) {
        const extra = document.createElement("button");
        extra.textContent = extraLabel;
        extra.className = "primary";
        extra.onclick = () => {
          result = "save";
          dialog2.close();
        };
        actions.append(extra);
        accept.className = "";
      }
      actions.append(accept);
      dialog2.append(title, text2, actions);
      document.body.append(dialog2);
      let result = false;
      cancel.onclick = () => dialog2.close();
      accept.onclick = () => {
        result = true;
        dialog2.close();
      };
      dialog2.onclose = () => {
        dialog2.remove();
        if (previous?.isConnected) previous.focus();
        resolve(result);
      };
      dialog2.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        const buttons2 = [...dialog2.querySelectorAll("button:not(:disabled)")];
        const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const index = buttons2.indexOf(document.activeElement);
        event.preventDefault();
        buttons2[(index + direction + buttons2.length) % buttons2.length].focus();
      });
      dialog2.showModal();
      (defaultAction === "accept" ? accept : cancel).focus();
    });
  }

  // assets/agent-result.js
  async function applyAgentResult(result, { backend: backend2, hasInstances, drawWiring, isCurrent = () => true, isDemo = false }) {
    if (result.clarification) return "clarification";
    if (!isDemo) await backend2.refreshAfterAgent();
    if (!isCurrent()) return "stale";
    if (result.circuit) {
      if (!hasInstances()) {
        const loaded = await backend2.openCircuit(result.circuit.circuit_id || result.circuit.id, { showPanel: false, automatic: true });
        return loaded ? "circuit-loaded" : "circuit-available";
      }
      return "circuit-available";
    }
    if (result.wiring) {
      drawWiring(result.wiring);
      return "wiring-proposed";
    }
    return "text-only";
  }

  // assets/builtin-parts.js
  var builtInParts = [{ "id": "bme280-3v3", "name": "BME280 \uC628\uC2B5\uB3C4\xB7\uAE30\uC555 \uC13C\uC11C (3.3V \uC804\uC6A9)", "category": "sensor", "color": "#5b2a86", "description": "\uB808\uADE4\uB808\uC774\uD130\uAC00 \uC5C6\uB294 3.3V \uC804\uC6A9 BME280 \uBAA8\uB4C8. I2C \uC8FC\uC18C 0x76.", "behavior": { "kind": "i2c-device", "vcc": "VCC", "gnd": "GND", "sda": "SDA", "scl": "SCL", "address": "0x76" }, "pins": [{ "id": "VCC", "label": "VCC", "side": "left", "type": "power_in", "minVoltage": 1.71, "maxVoltage": 3.6, "functions": ["\uC804\uC6D0"] }, { "id": "GND", "label": "GND", "side": "left", "type": "gnd" }, { "id": "SCL", "label": "SCL", "side": "left", "type": "input", "maxVoltage": 3.6, "functions": ["I2C SCL"] }, { "id": "SDA", "label": "SDA", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["I2C SDA"] }], "sources": ["Bosch BME280 datasheet"], "source": "builtin", "file": "bme280-3v3.json" }, { "id": "dc-12v-adapter", "name": "DC 12V \uC5B4\uB311\uD130 (2A)", "category": "power", "color": "#212529", "description": "\uC678\uBD80 \uC804\uC6D0. \uCD9C\uB825 12V 2A.", "behavior": { "kind": "supply" }, "pins": [{ "id": "V+", "label": "+12V", "side": "left", "type": "power_out", "voltage": 12, "maxCurrent": 2e3, "functions": ["12V \uCD9C\uB825"] }, { "id": "GND", "label": "GND", "side": "left", "type": "gnd" }], "source": "builtin", "file": "dc-12v-adapter.json" }, { "id": "dht22-module", "name": "DHT22 \uC628\uC2B5\uB3C4 \uC13C\uC11C \uBAA8\uB4C8", "category": "sensor", "color": "#e9edf2", "description": "3\uD540 DHT22 \uBAA8\uB4C8(\uD480\uC5C5 \uC800\uD56D \uB0B4\uC7A5). \uB2E8\uC77C \uB370\uC774\uD130\uC120 \uD1B5\uC2E0. 3.3~5.5V \uB3D9\uC791.", "behavior": { "kind": "sensor", "vcc": "VCC", "gnd": "GND", "signal": "DATA" }, "pins": [{ "id": "VCC", "label": "+", "side": "left", "type": "power_in", "minVoltage": 3.3, "maxVoltage": 5.5, "functions": ["\uC804\uC6D0"] }, { "id": "DATA", "label": "OUT", "side": "left", "type": "output", "voltage": "VCC", "functions": ["1-Wire \uB370\uC774\uD130"], "note": "\uCD9C\uB825 HIGH \uC804\uC555 = VCC \uC804\uC555. 5V\uB85C \uC4F0\uBA74 3.3V \uBCF4\uB4DC\uC5D0 5V \uC2E0\uD638\uAC00 \uB4E4\uC5B4\uAC10" }, { "id": "GND", "label": "-", "side": "left", "type": "gnd" }], "sources": ["Aosong AM2302/DHT22 datasheet"], "source": "builtin", "file": "dht22-module.json" }, { "id": "diode-1n4007", "name": "\uB2E4\uC774\uC624\uB4DC 1N4007", "category": "passive", "color": "#343a40", "description": "\uC815\uB958/\uC5ED\uAE30\uC804\uB825 \uBCF4\uD638\uC6A9 \uB2E4\uC774\uC624\uB4DC. \uB760\uAC00 \uC788\uB294 \uCABD\uC774 K(\uCE90\uC18C\uB4DC). \uCF54\uC77C\uACFC \uBCD1\uB82C\uB85C \uBC18\uB300 \uBC29\uD5A5(K\uB97C +\uCABD)\uC73C\uB85C \uC5F0\uACB0.", "behavior": { "kind": "diode", "anode": "A", "cathode": "K" }, "pins": [{ "id": "A", "label": "A", "side": "left", "type": "passive", "functions": ["\uC560\uB178\uB4DC"] }, { "id": "K", "label": "K(\uB760)", "side": "right", "type": "passive", "functions": ["\uCE90\uC18C\uB4DC"] }], "source": "builtin", "file": "diode-1n4007.json" }, { "id": "esp32-devkitc", "name": "ESP32 DevKitC V4", "category": "board", "description": "ESP32-WROOM-32 \uAC1C\uBC1C \uBCF4\uB4DC. \uB85C\uC9C1 3.3V, USB 5V \uC804\uC6D0. GPIO\uB294 5V\uB97C \uACAC\uB514\uC9C0 \uBABB\uD568.", "logicVoltage": 3.3, "color": "#1d3557", "behavior": { "kind": "board" }, "pins": [{ "id": "3V3", "label": "3V3", "side": "left", "type": "power_out", "voltage": 3.3, "maxCurrent": 500, "functions": ["3.3V \uCD9C\uB825"] }, { "id": "EN", "label": "EN", "side": "left", "type": "input", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["\uB9AC\uC14B"] }, { "id": "GPIO36", "label": "VP/36", "side": "left", "type": "input", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["\uC785\uB825 \uC804\uC6A9", "ADC1_CH0"] }, { "id": "GPIO39", "label": "VN/39", "side": "left", "type": "input", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["\uC785\uB825 \uC804\uC6A9", "ADC1_CH3"] }, { "id": "GPIO34", "label": "34", "side": "left", "type": "input", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["\uC785\uB825 \uC804\uC6A9", "ADC1_CH6"] }, { "id": "GPIO35", "label": "35", "side": "left", "type": "input", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["\uC785\uB825 \uC804\uC6A9", "ADC1_CH7"] }, { "id": "GPIO32", "label": "32", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "ADC1_CH4", "Touch9"] }, { "id": "GPIO33", "label": "33", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "ADC1_CH5", "Touch8"] }, { "id": "GPIO25", "label": "25", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "DAC1", "ADC2_CH8"] }, { "id": "GPIO26", "label": "26", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "DAC2", "ADC2_CH9"] }, { "id": "GPIO27", "label": "27", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "ADC2_CH7"] }, { "id": "GPIO14", "label": "14", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "HSPI CLK"], "note": "\uBD80\uD305 \uC2DC PWM \uC2E0\uD638\uAC00 \uB098\uC634" }, { "id": "GPIO12", "label": "12", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "HSPI MISO"], "note": "\uC2A4\uD2B8\uB798\uD551 \uD540: \uBD80\uD305 \uC2DC HIGH\uBA74 \uBD80\uD305 \uC2E4\uD328 \uAC00\uB2A5" }, { "id": "GND1", "label": "GND", "side": "left", "type": "gnd" }, { "id": "GPIO13", "label": "13", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "HSPI MOSI"] }, { "id": "SD2", "label": "SD2/9", "side": "left", "type": "nc", "functions": ["\uB0B4\uBD80 \uD50C\uB798\uC2DC"], "note": "\uB0B4\uBD80 \uD50C\uB798\uC2DC \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "SD3", "label": "SD3/10", "side": "left", "type": "nc", "functions": ["\uB0B4\uBD80 \uD50C\uB798\uC2DC"], "note": "\uB0B4\uBD80 \uD50C\uB798\uC2DC \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "CMD", "label": "CMD/11", "side": "left", "type": "nc", "functions": ["\uB0B4\uBD80 \uD50C\uB798\uC2DC"], "note": "\uB0B4\uBD80 \uD50C\uB798\uC2DC \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "5V", "label": "5V", "side": "left", "type": "power_out", "voltage": 5, "functions": ["USB 5V \uCD9C\uB825/\uC785\uB825"], "note": "USB \uC804\uC6D0\uC77C \uB54C \uC57D 5V\uAC00 \uB098\uC634" }, { "id": "GND2", "label": "GND", "side": "right", "type": "gnd" }, { "id": "GPIO23", "label": "23", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "VSPI MOSI"] }, { "id": "GPIO22", "label": "22", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "I2C SCL"] }, { "id": "GPIO1", "label": "TX/1", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["UART0 TX"], "note": "USB \uC2DC\uB9AC\uC5BC\uACFC \uACF5\uC720 - \uAC00\uAE09\uC801 \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "GPIO3", "label": "RX/3", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["UART0 RX"], "note": "USB \uC2DC\uB9AC\uC5BC\uACFC \uACF5\uC720 - \uAC00\uAE09\uC801 \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "GPIO21", "label": "21", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "I2C SDA"] }, { "id": "GND3", "label": "GND", "side": "right", "type": "gnd" }, { "id": "GPIO19", "label": "19", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "VSPI MISO"] }, { "id": "GPIO18", "label": "18", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "VSPI SCK"] }, { "id": "GPIO5", "label": "5", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "VSPI CS"], "note": "\uC2A4\uD2B8\uB798\uD551 \uD540" }, { "id": "GPIO17", "label": "17", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "UART2 TX"] }, { "id": "GPIO16", "label": "16", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "UART2 RX"] }, { "id": "GPIO4", "label": "4", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "ADC2_CH0"] }, { "id": "GPIO0", "label": "0", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "BOOT \uBC84\uD2BC"], "note": "\uC2A4\uD2B8\uB798\uD551 \uD540: \uBD80\uD305 \uC2DC LOW\uBA74 \uB2E4\uC6B4\uB85C\uB4DC \uBAA8\uB4DC" }, { "id": "GPIO2", "label": "2", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "\uBCF4\uB4DC LED"], "note": "\uC2A4\uD2B8\uB798\uD551 \uD540" }, { "id": "GPIO15", "label": "15", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.6, "functions": ["GPIO", "HSPI CS"], "note": "\uC2A4\uD2B8\uB798\uD551 \uD540" }, { "id": "SD1", "label": "SD1/8", "side": "right", "type": "nc", "functions": ["\uB0B4\uBD80 \uD50C\uB798\uC2DC"], "note": "\uB0B4\uBD80 \uD50C\uB798\uC2DC \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "SD0", "label": "SD0/7", "side": "right", "type": "nc", "functions": ["\uB0B4\uBD80 \uD50C\uB798\uC2DC"], "note": "\uB0B4\uBD80 \uD50C\uB798\uC2DC \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "CLK", "label": "CLK/6", "side": "right", "type": "nc", "functions": ["\uB0B4\uBD80 \uD50C\uB798\uC2DC"], "note": "\uB0B4\uBD80 \uD50C\uB798\uC2DC \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }], "internalNets": [["GND1", "GND2", "GND3"]], "sources": ["Espressif ESP32-DevKitC V4 Getting Started Guide", "ESP32 Datasheet (Espressif)"], "source": "builtin", "file": "esp32-devkitc.json" }, { "id": "led-red", "name": "\uBE68\uAC04 LED (5mm)", "category": "output", "color": "#ffffff", "description": "\uC21C\uBC29\uD5A5 \uC804\uC555 \uC57D 2.0V, \uCD5C\uB300 20mA. \uBC18\uB4DC\uC2DC \uC9C1\uB82C \uC800\uD56D\uC774 \uD544\uC694\uD568.", "behavior": { "kind": "led", "anode": "A", "cathode": "K", "color": "#ff3b30", "forwardVoltage": 2, "maxCurrent": 20 }, "pins": [{ "id": "A", "label": "A(+)", "side": "left", "type": "passive", "functions": ["\uC560\uB178\uB4DC(\uAE34 \uB2E4\uB9AC)"] }, { "id": "K", "label": "K(-)", "side": "right", "type": "passive", "functions": ["\uCE90\uC18C\uB4DC(\uC9E7\uC740 \uB2E4\uB9AC)"] }], "source": "builtin", "file": "led-red.json" }, { "id": "push-button", "name": "\uD0DD\uD2B8 \uC2A4\uC704\uCE58", "category": "input", "color": "#555b6e", "description": "\uB204\uB974\uB294 \uB3D9\uC548 1-2\uAC00 \uC5F0\uACB0\uB418\uB294 \uBC84\uD2BC. \uAC00\uC0C1 \uC804\uC6D0 ON \uC0C1\uD0DC\uC5D0\uC11C \uD074\uB9AD\uD558\uBA74 \uB20C\uB9BC.", "behavior": { "kind": "button", "a": "P1", "b": "P2" }, "pins": [{ "id": "P1", "label": "1", "side": "left", "type": "passive" }, { "id": "P2", "label": "2", "side": "right", "type": "passive" }], "source": "builtin", "file": "push-button.json" }, { "id": "raspberry-pi-4", "name": "Raspberry Pi 4 (40\uD540 \uD5E4\uB354)", "category": "board", "description": "\uB77C\uC988\uBCA0\uB9AC\uD30C\uC774 40\uD540 GPIO \uD5E4\uB354. \uB85C\uC9C1 3.3V\uC774\uBA70 GPIO\uB294 5V\uB97C \uACAC\uB514\uC9C0 \uBABB\uD568. \uC67C\uCABD=\uD640\uC218 \uD540, \uC624\uB978\uCABD=\uC9DD\uC218 \uD540.", "logicVoltage": 3.3, "color": "#7a1f3d", "behavior": { "kind": "board" }, "pins": [{ "id": "3V3_1", "label": "1 3V3", "side": "left", "type": "power_out", "voltage": 3.3, "functions": ["3.3V \uCD9C\uB825"] }, { "id": "5V_2", "label": "2 5V", "side": "right", "type": "power_out", "voltage": 5, "functions": ["5V \uCD9C\uB825"] }, { "id": "GPIO2", "label": "3 GPIO2", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "I2C1 SDA"], "note": "1.8k\u03A9 \uD480\uC5C5 \uB0B4\uC7A5" }, { "id": "5V_4", "label": "4 5V", "side": "right", "type": "power_out", "voltage": 5, "functions": ["5V \uCD9C\uB825"] }, { "id": "GPIO3", "label": "5 GPIO3", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "I2C1 SCL"], "note": "1.8k\u03A9 \uD480\uC5C5 \uB0B4\uC7A5" }, { "id": "GND_6", "label": "6 GND", "side": "right", "type": "gnd" }, { "id": "GPIO4", "label": "7 GPIO4", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "GPCLK0", "1-Wire \uAE30\uBCF8"] }, { "id": "GPIO14", "label": "8 GPIO14", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "UART TXD"] }, { "id": "GND_9", "label": "9 GND", "side": "left", "type": "gnd" }, { "id": "GPIO15", "label": "10 GPIO15", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "UART RXD"] }, { "id": "GPIO17", "label": "11 GPIO17", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GPIO18", "label": "12 GPIO18", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "PWM0", "PCM CLK"] }, { "id": "GPIO27", "label": "13 GPIO27", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GND_14", "label": "14 GND", "side": "right", "type": "gnd" }, { "id": "GPIO22", "label": "15 GPIO22", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GPIO23", "label": "16 GPIO23", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "3V3_17", "label": "17 3V3", "side": "left", "type": "power_out", "voltage": 3.3, "functions": ["3.3V \uCD9C\uB825"] }, { "id": "GPIO24", "label": "18 GPIO24", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GPIO10", "label": "19 GPIO10", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "SPI0 MOSI"] }, { "id": "GND_20", "label": "20 GND", "side": "right", "type": "gnd" }, { "id": "GPIO9", "label": "21 GPIO9", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "SPI0 MISO"] }, { "id": "GPIO25", "label": "22 GPIO25", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GPIO11", "label": "23 GPIO11", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "SPI0 SCLK"] }, { "id": "GPIO8", "label": "24 GPIO8", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "SPI0 CE0"] }, { "id": "GND_25", "label": "25 GND", "side": "left", "type": "gnd" }, { "id": "GPIO7", "label": "26 GPIO7", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "SPI0 CE1"] }, { "id": "ID_SD", "label": "27 ID_SD", "side": "left", "type": "nc", "note": "HAT EEPROM \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "ID_SC", "label": "28 ID_SC", "side": "right", "type": "nc", "note": "HAT EEPROM \uC804\uC6A9 - \uC0AC\uC6A9 \uAE08\uC9C0" }, { "id": "GPIO5", "label": "29 GPIO5", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GND_30", "label": "30 GND", "side": "right", "type": "gnd" }, { "id": "GPIO6", "label": "31 GPIO6", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GPIO12", "label": "32 GPIO12", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "PWM0"] }, { "id": "GPIO13", "label": "33 GPIO13", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "PWM1"] }, { "id": "GND_34", "label": "34 GND", "side": "right", "type": "gnd" }, { "id": "GPIO19", "label": "35 GPIO19", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "PWM1", "PCM FS"] }, { "id": "GPIO16", "label": "36 GPIO16", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GPIO26", "label": "37 GPIO26", "side": "left", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO"] }, { "id": "GPIO20", "label": "38 GPIO20", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "PCM DIN"] }, { "id": "GND_39", "label": "39 GND", "side": "left", "type": "gnd" }, { "id": "GPIO21", "label": "40 GPIO21", "side": "right", "type": "gpio", "voltage": 3.3, "maxVoltage": 3.3, "functions": ["GPIO", "PCM DOUT"] }], "internalNets": [["GND_6", "GND_9", "GND_14", "GND_20", "GND_25", "GND_30", "GND_34", "GND_39"], ["3V3_1", "3V3_17"], ["5V_2", "5V_4"]], "sources": ["Raspberry Pi Documentation - GPIO and the 40-pin header", "pinout.xyz"], "source": "builtin", "file": "raspberry-pi-4.json" }, { "id": "relay-module-5v", "name": "5V \uB9B4\uB808\uC774 \uBAA8\uB4C8 (1\uCC44\uB110)", "category": "module", "color": "#1565c0", "description": "\uCF54\uC77C 5V \uB9B4\uB808\uC774 \uBAA8\uB4C8(\uD2B8\uB79C\uC9C0\uC2A4\uD130\xB7\uB2E4\uC774\uC624\uB4DC \uB0B4\uC7A5). IN\uC774 HIGH\uBA74 COM-NO \uC5F0\uACB0. \uC81C\uD488\uC5D0 \uB530\uB77C LOW \uD2B8\uB9AC\uAC70\uB3C4 \uC788\uC73C\uB2C8 \uD655\uC778 \uD544\uC694.", "behavior": { "kind": "relay", "vcc": "VCC", "gnd": "GND", "in": "IN", "com": "COM", "no": "NO", "nc": "NC", "trigger": "high", "minTrigger": 2.5 }, "pins": [{ "id": "VCC", "label": "VCC", "side": "left", "type": "power_in", "minVoltage": 4.5, "maxVoltage": 5.5, "functions": ["\uCF54\uC77C \uC804\uC6D0"] }, { "id": "GND", "label": "GND", "side": "left", "type": "gnd" }, { "id": "IN", "label": "IN", "side": "left", "type": "input", "maxVoltage": 5.5, "functions": ["\uC81C\uC5B4 \uC2E0\uD638"], "note": "\uC57D 2.5V \uC774\uC0C1\uC774\uBA74 \uB3D9\uC791(3.3V \uC2E0\uD638\uB85C \uB300\uBD80\uBD84 \uB3D9\uC791)" }, { "id": "NO", "label": "NO", "side": "right", "type": "contact", "maxVoltage": 250, "maxCurrent": 1e4, "functions": ["\uD3C9\uC0C1\uC2DC \uC5F4\uB9BC"] }, { "id": "COM", "label": "COM", "side": "right", "type": "contact", "maxVoltage": 250, "maxCurrent": 1e4, "functions": ["\uACF5\uD1B5"] }, { "id": "NC", "label": "NC", "side": "right", "type": "contact", "maxVoltage": 250, "maxCurrent": 1e4, "functions": ["\uD3C9\uC0C1\uC2DC \uB2EB\uD798"] }], "source": "builtin", "file": "relay-module-5v.json" }, { "id": "resistor-10k", "name": "\uC800\uD56D 10k\u03A9", "category": "passive", "color": "#d9b26f", "description": "\uD480\uC5C5/\uD480\uB2E4\uC6B4\uC6A9 10k\u03A9 \uC800\uD56D.", "behavior": { "kind": "resistor", "ohms": 1e4 }, "pins": [{ "id": "P1", "label": "1", "side": "left", "type": "passive" }, { "id": "P2", "label": "2", "side": "right", "type": "passive" }], "source": "builtin", "file": "resistor-10k.json" }, { "id": "resistor-220", "name": "\uC800\uD56D 220\u03A9", "category": "passive", "color": "#d9b26f", "description": "LED \uC804\uB958 \uC81C\uD55C\uC6A9 220\u03A9 1/4W \uC800\uD56D.", "behavior": { "kind": "resistor", "ohms": 220 }, "pins": [{ "id": "P1", "label": "1", "side": "left", "type": "passive" }, { "id": "P2", "label": "2", "side": "right", "type": "passive" }], "source": "builtin", "file": "resistor-220.json" }, { "id": "solenoid-valve-12v", "name": "12V \uC194\uB808\uB178\uC774\uB4DC \uBC38\uBE0C", "category": "actuator", "color": "#6c757d", "description": "DC 12V, \uC57D 0.5A. \uC804\uC6D0\uC744 \uB123\uC73C\uBA74 \uC5F4\uB9BC. \uCF54\uC77C\uC774\uB77C \uC5ED\uAE30\uC804\uB825 \uBCF4\uD638 \uB2E4\uC774\uC624\uB4DC \uAD8C\uC7A5.", "behavior": { "kind": "load", "plus": "V+", "minus": "V-", "ratedVoltage": 12, "label": "\uBC38\uBE0C", "onText": "\uC5F4\uB9BC", "offText": "\uB2EB\uD798" }, "pins": [{ "id": "V+", "label": "+", "side": "left", "type": "power_in", "minVoltage": 10.8, "maxVoltage": 13.2, "maxCurrent": 500, "functions": ["\uCF54\uC77C +"] }, { "id": "V-", "label": "-", "side": "left", "type": "passive", "functions": ["\uCF54\uC77C -"] }], "source": "builtin", "file": "solenoid-valve-12v.json" }, { "id": "ssd1306-oled", "name": '0.96" OLED (SSD1306, I2C)', "category": "display", "color": "#0b132b", "description": "128x64 I2C OLED \uBAA8\uB4C8. 3.3~5V \uB3D9\uC791(\uBAA8\uB4C8 \uB808\uADE4\uB808\uC774\uD130 \uB0B4\uC7A5). I2C \uC8FC\uC18C 0x3C.", "behavior": { "kind": "i2c-device", "display": true, "vcc": "VCC", "gnd": "GND", "sda": "SDA", "scl": "SCL", "address": "0x3C" }, "pins": [{ "id": "GND", "label": "GND", "side": "top", "type": "gnd" }, { "id": "VCC", "label": "VCC", "side": "top", "type": "power_in", "minVoltage": 3.3, "maxVoltage": 5.5, "functions": ["\uC804\uC6D0"] }, { "id": "SCL", "label": "SCL", "side": "top", "type": "input", "maxVoltage": 5.5, "functions": ["I2C SCL"] }, { "id": "SDA", "label": "SDA", "side": "top", "type": "gpio", "voltage": "VCC", "maxVoltage": 5.5, "functions": ["I2C SDA"], "note": "\uBAA8\uB4C8 \uD480\uC5C5\uC774 VCC\uC5D0 \uC5F0\uACB0\uB41C \uC81C\uD488\uC774 \uB9CE\uC74C" }], "sources": ["Solomon Systech SSD1306 datasheet"], "source": "builtin", "file": "ssd1306-oled.json" }];
  var partTemplate = {
    "_help": "\uC774 \uD30C\uC77C\uC744 \uBCF5\uC0AC\uD574\uC11C \uB0B4 \uBD80\uD488\uC744 \uB9CC\uB4DC\uC138\uC694. \uBC11\uC904(_)\uB85C \uC2DC\uC791\uD558\uB294 \uD56D\uBAA9\uC740 \uC124\uBA85\uC774\uB77C \uC9C0\uC6CC\uB3C4 \uB429\uB2C8\uB2E4. \uD30C\uC77C \uC774\uB984\uC774 _\uB85C \uC2DC\uC791\uD558\uBA74 \uD504\uB85C\uADF8\uB7A8\uC774 \uC77D\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
    "id": "my-sensor",
    "_id_help": "\uC601\uBB38 \uC18C\uBB38\uC790\xB7\uC22B\uC790\xB7\uD558\uC774\uD508(-)\uB9CC. \uB2E4\uB978 \uBD80\uD488\uACFC \uACB9\uCE58\uBA74 \uC548 \uB428",
    "name": "\uB0B4 \uC13C\uC11C \uBAA8\uB4C8",
    "category": "sensor",
    "_category_help": "board / sensor / display / output / input / module / actuator / power / passive \uC911 \uD558\uB098",
    "description": "\uBD80\uD488 \uC124\uBA85 (\uB370\uC774\uD130\uC2DC\uD2B8\uC5D0\uC11C \uD655\uC778\uD55C \uD575\uC2EC \uC0AC\uC591)",
    "color": "#2a9d8f",
    "behavior": {
      "kind": "sensor",
      "vcc": "VCC",
      "gnd": "GND",
      "signal": "OUT"
    },
    "_behavior_help": "kind: board(\uBCF4\uB4DC) / sensor / i2c-device / led / resistor / button / relay / load(\uBAA8\uD130\xB7\uBC38\uBE0C) / supply(\uC804\uC6D0) / diode. \uC790\uC138\uD55C \uD56D\uBAA9\uC740 docs/\uBD80\uD488-JSON-\uC591\uC2DD.md \uCC38\uACE0",
    "pins": [
      {
        "id": "VCC",
        "label": "VCC",
        "side": "left",
        "type": "power_in",
        "minVoltage": 3.3,
        "maxVoltage": 5.5,
        "functions": [
          "\uC804\uC6D0"
        ]
      },
      {
        "id": "GND",
        "label": "GND",
        "side": "left",
        "type": "gnd"
      },
      {
        "id": "OUT",
        "label": "OUT",
        "side": "left",
        "type": "output",
        "voltage": "VCC",
        "functions": [
          "\uB514\uC9C0\uD138 \uCD9C\uB825"
        ],
        "note": "\uCC38\uACE0 \uC0AC\uD56D"
      }
    ],
    "_pins_help": 'side: left/right/top/bottom. type: power_out(\uC804\uC6D0 \uCD9C\uB825) power_in(\uC804\uC6D0 \uC785\uB825) gnd gpio(\uC785\uCD9C\uB825) input output passive contact(\uB9B4\uB808\uC774 \uC811\uC810) nc(\uC0AC\uC6A9 \uAE08\uC9C0). voltage: \uCD9C\uB825 \uC804\uC555(\uC22B\uC790) \uB610\uB294 "VCC"(\uC804\uC6D0 \uD540 \uC804\uC555\uC744 \uB530\uB984). maxVoltage: \uACAC\uB51C \uC218 \uC788\uB294 \uCD5C\uB300 \uC804\uC555',
    "internalNets": [],
    "_internalNets_help": '\uBD80\uD488 \uB0B4\uBD80\uC5D0\uC11C \uC11C\uB85C \uC5F0\uACB0\uB41C \uD540 \uBAA9\uB85D. \uC608: [["GND1","GND2"]]',
    "sources": [
      "\uC81C\uC870\uC0AC \uB370\uC774\uD130\uC2DC\uD2B8 \uC774\uB984/\uB9C1\uD06C"
    ]
  };

  // assets/web-api.js
  var import_server_connection = __toESM(require_server_connection());

  // assets/server-chat.js
  function createServerChatApi(base, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    let apiKey = "", sessionId = null, selectedMode = null, generation = 0, inFlight = false, sessionTimeout = 300;
    const messages = {
      CIRCUIT_API_KEY_REQUIRED: "\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uD0ED\uC5D0\uC11C \uC5F0\uACB0 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC138\uC694.",
      COPILOT_TOOL_CONNECTION_REQUIRED: "Copilot Studio\uC758 CircuitAgent \uB3C4\uAD6C \uC5F0\uACB0\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uB3C4\uAD6C\uC758 \uC5F0\uACB0 \uACC4\uC815\xB7\uC790\uACA9 \uC99D\uBA85\uC744 \uD655\uC778\uD558\uACE0 \uC5D0\uC774\uC804\uD2B8\uB97C \uB2E4\uC2DC \uAC8C\uC2DC\uD558\uC138\uC694. Direct Line \uD0A4\uB97C \uBC14\uAFC0 \uBB38\uC81C\uB294 \uC544\uB2D9\uB2C8\uB2E4.",
      COPILOT_SECRET_NOT_CONFIGURED: "\uC11C\uBC84 .env\uC758 COPILOT_DIRECT_LINE_SECRET\uC5D0 Direct Line \uBE44\uBC00 \uD0A4\uB97C \uB123\uC73C\uC138\uC694.",
      DIRECT_LINE_NETWORK_ERROR: "\uC11C\uBC84\uC640 Microsoft \uC0AC\uC774\uC758 \uD1B5\uC2E0\uC774 \uB04A\uACBC\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uC0C8 \uC694\uCCAD\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694. \uC774\uC804 \uC791\uC5C5\uC740 \uC9C4\uD589 \uC911\uC77C \uC218 \uC788\uC73C\uB2C8 DB \uC0C1\uD0DC\uB97C \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694.",
      DIRECT_LINE_AUTH_FAILED: "Direct Line \uC778\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uBE44\uBC00 \uD0A4\uC640 \uC9C0\uC5ED\uBCC4 Direct Line \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.",
      DIRECT_LINE_REPLY_TIMEOUT: "\uC751\uB2F5 \uB300\uAE30 \uC2DC\uAC04\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC694\uCCAD\uC740 \uC0C8 \uB300\uD654\uB85C \uC5F0\uACB0\uB429\uB2C8\uB2E4. \uAE30\uC874 \uC694\uCCAD\uC740 \uC790\uB3D9 \uC7AC\uC804\uC1A1\uD558\uC9C0 \uC54A\uC73C\uB2C8 DB\uC5D0 \uBD80\uD488\uC774 \uC0DD\uC131\uB410\uB294\uC9C0 \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694.",
      CHAT_SESSION_NEEDS_RESET: "\uC0C8\uB85C \uB9CC\uB4E4\uAE30\uB85C \uB300\uD654\uB97C \uB2E4\uC2DC \uC5F0 \uB4A4 \uC694\uCCAD\uD558\uC138\uC694.",
      DIRECT_LINE_ENDED_WITHOUT_REPLY: "\uC5D0\uC774\uC804\uD2B8\uAC00 \uB2F5\uBCC0 \uC5C6\uC774 \uB300\uD654\uB97C \uC885\uB8CC\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC694\uCCAD\uC740 \uC0C8 \uB300\uD654\uB85C \uC5F0\uACB0\uB429\uB2C8\uB2E4.",
      CHAT_SESSION_EXPIRED: "\uB300\uD654\uAC00 \uB9CC\uB8CC\uB410\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C \uB9CC\uB4E4\uAE30\uB85C \uB2E4\uC2DC \uC2DC\uC791\uD558\uC138\uC694."
    };
    function error(code, status) {
      const e = new Error(messages[code] || code);
      e.code = code;
      e.status = status;
      return e;
    }
    async function call(path, method = "GET", body) {
      const response = await base.requestCircuit(path, {
        method,
        headers: { "Content-Type": "application/json", ...apiKey ? { "X-API-Key": apiKey } : {} },
        ...body ? { body: JSON.stringify(body) } : {}
      });
      if (response.status >= 400) throw error(response.body?.detail?.code || `HTTP ${response.status}`, response.status);
      return response.body;
    }
    async function requireKey() {
      if (!apiKey && !(await base.getAutoAuthStatus?.())?.ready) throw error("CIRCUIT_API_KEY_REQUIRED");
    }
    function checkGeneration(value) {
      if (value !== generation) throw error("CHAT_RESET");
    }
    return {
      ...base,
      setCircuitKey: (key2) => {
        if (key2 !== apiKey) {
          apiKey = key2;
          sessionId = null;
          generation++;
        }
      },
      getSettings: async () => {
        const previous = await base.getSettings();
        let config;
        try {
          config = await call("/chat/config");
        } catch {
          config = null;
        }
        const autoAuth = await base.getAutoAuthStatus?.();
        const mode = selectedMode || (previous.mode === "demo" && previous.modeExplicit !== true && config?.mode === "directline" && config.configured && autoAuth?.ready ? "server" : previous.mode);
        return { ...previous, mode, serverSecretConfigured: !!config?.configured, apiKeyReady: !!apiKey || !!autoAuth?.ready };
      },
      setSettings: async (settings) => {
        await base.setSettings(settings);
        selectedMode = settings.mode;
      },
      sendToAgent: async (text2, catalog, onProgress = () => {
      }) => {
        if (selectedMode !== "server") return base.sendToAgent(text2, catalog);
        await requireKey();
        if (inFlight) throw error("CHAT_REQUEST_IN_PROGRESS");
        const current = generation;
        inFlight = true;
        let usedSession = sessionId;
        try {
          if (!sessionId) {
            onProgress({ stage: "opening" });
            const opened = await call("/chat/sessions", "POST");
            checkGeneration(current);
            sessionId = opened.session_id;
            usedSession = sessionId;
            sessionTimeout = opened.reply_timeout_seconds || 300;
          }
          const sent = await call(`/chat/sessions/${sessionId}/messages`, "POST", { message: text2, catalog: catalog || "" });
          onProgress({ stage: "waiting" });
          checkGeneration(current);
          const until = Date.now() + (sessionTimeout + 30) * 1e3;
          while (Date.now() < until) {
            await sleep(900);
            checkGeneration(current);
            const result = await call(`/chat/sessions/${sessionId}/messages/${sent.request_id}`);
            onProgress({ ...result, stage: result.recovering_connection ? "reconnecting" : result.bot_message_count ? "receiving" : "waiting" });
            checkGeneration(current);
            if (result.status === "completed") return { reply: result.reply };
            if (result.status === "failed") throw error(result.error || "DIRECT_LINE_REPLY_FAILED");
          }
          throw error("DIRECT_LINE_REPLY_TIMEOUT");
        } catch (failure) {
          if (generation === current && sessionId === usedSession) {
            sessionId = null;
            if (usedSession) void call(`/chat/sessions/${usedSession}`, "DELETE").catch(() => {
            });
          }
          throw failure;
        } finally {
          inFlight = false;
        }
      },
      testAgent: async () => {
        if (selectedMode !== "server") return base.testAgent();
        await requireKey();
        const opened = await call("/chat/sessions", "POST");
        await call(`/chat/sessions/${opened.session_id}`, "DELETE");
        return "\uC11C\uBC84 .env\uC758 \uD0A4\uB85C Direct Line \uB300\uD654 \uC0DD\uC131\uC5D0 \uC131\uACF5\uD588\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uB2F5\uBCC0\uC740 \uCC44\uD305\uC5D0\uC11C \uD655\uC778\uD558\uC138\uC694.";
      },
      resetAgent: async () => {
        const previous = sessionId;
        sessionId = null;
        generation++;
        if (previous) {
          try {
            await call(`/chat/sessions/${previous}`, "DELETE");
          } catch {
          }
        }
        await base.resetAgent();
      },
      selectMode: (mode) => {
        selectedMode = mode;
      }
    };
  }

  // assets/browser-projects.js
  var MAX_RECENT = 10;
  function pickProjectFile() {
    return new Promise((resolve) => {
      const input2 = document.createElement("input");
      input2.type = "file";
      input2.accept = ".json,application/json";
      input2.hidden = true;
      const finish = (file) => {
        input2.remove();
        resolve(file);
      };
      input2.addEventListener("change", () => finish(input2.files[0]), { once: true });
      input2.addEventListener("cancel", () => finish(null), { once: true });
      document.body.append(input2);
      input2.click();
    });
  }
  function fileName(title) {
    const safe = String(title || "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().replace(/[. ]+$/, "").slice(0, 110);
    return `${safe || "wiring"}.mir.json`;
  }
  function chooseFileName(suggestion) {
    const dialog2 = document.getElementById("saveNameDialog");
    const input2 = document.getElementById("saveFileName");
    input2.value = suggestion.replace(/\.mir\.json$/i, "");
    dialog2.returnValue = "";
    return new Promise((resolve) => {
      dialog2.addEventListener("close", () => resolve(
        dialog2.returnValue === "save" ? fileName(input2.value.trim().replace(/\.mir\.json$/i, "")) : null
      ), { once: true });
      dialog2.showModal();
      input2.select();
    });
  }
  function downloadProject(data, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function openProjectStorage() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open("mir-html-projects", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("recent");
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => database.close();
          resolve(database);
        };
        request.onerror = request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  function makeProjectStore() {
    let databasePromise;
    let memory = [];
    let pending = Promise.resolve();
    function access(read, change) {
      const operation = pending.then(async () => {
        databasePromise ??= openProjectStorage();
        const database = await databasePromise;
        if (database) {
          try {
            memory = await new Promise((resolve, reject) => {
              const transaction = database.transaction("recent", change ? "readwrite" : "readonly");
              const store = transaction.objectStore("recent");
              const request = store.get("projects");
              let result;
              transaction.oncomplete = () => resolve(result);
              transaction.onabort = transaction.onerror = () => reject(transaction.error);
              request.onsuccess = () => {
                const records = Array.isArray(request.result) ? request.result : [];
                result = change ? change(records) : records;
                if (change) store.put(result, "projects");
              };
            });
            return read(memory, true);
          } catch {
            database.close();
            databasePromise = Promise.resolve(null);
          }
        }
        if (change) memory = change(memory);
        return read(memory, false);
      });
      pending = operation.catch(() => {
      });
      return operation;
    }
    return access;
  }
  function createBrowserProjects() {
    const storage = makeProjectStore();
    let activeProject = null;
    let pendingProject = null;
    let revision = 0;
    function remember(project, title, data) {
      const snapshot = structuredClone(data);
      return storage((records, persisted) => persisted, (records) => {
        const previous = records.find((entry) => entry.path === project.path);
        const record = {
          path: project.path,
          filename: project.filename,
          alias: previous?.alias,
          title: previous?.alias || title?.trim() || project.filename,
          data: snapshot
        };
        return [record, ...records.filter((entry) => entry.path !== record.path)].slice(0, MAX_RECENT);
      });
    }
    return {
      async saveProject(data, saveAs = false) {
        const savingRevision = revision;
        let project = !saveAs && activeProject ? activeProject : { path: crypto.randomUUID(), filename: fileName(data.title) };
        let handle = project.handle;
        if (!handle && typeof window.showSaveFilePicker === "function") {
          try {
            handle = await window.showSaveFilePicker({
              suggestedName: project.filename,
              types: [{ description: "\uBBF8\uB974 \uD504\uB85C\uC81D\uD2B8", accept: { "application/json": [".mir.json"] } }]
            });
          } catch (error) {
            if (error.name === "AbortError") return null;
            if (error.name !== "SecurityError") throw error;
          }
        }
        if (handle) {
          const stream = await handle.createWritable();
          try {
            await stream.write(JSON.stringify(data, null, 2));
            await stream.close();
          } catch (error) {
            await stream.abort().catch(() => {
            });
            throw error;
          }
          project = { ...project, handle, filename: handle.name };
          if (revision === savingRevision) activeProject = project;
          await remember(project, data.title, data);
          return { saved: true, message: "\uD504\uB85C\uC81D\uD2B8 \uD30C\uC77C\uC5D0 \uC800\uC7A5\uD588\uC5B4\uC694." };
        }
        if (saveAs) {
          const name = await chooseFileName(project.filename);
          if (name === null) return null;
          project.filename = name;
        }
        downloadProject(data, project.filename);
        if (revision === savingRevision) activeProject = project;
        const persisted = await remember(project, data.title, data);
        return {
          saved: persisted,
          message: persisted ? "\uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8\uC5D0 \uBCF4\uAD00\uD588\uC5B4\uC694. \uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC \uACB0\uACFC\uB294 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uD655\uC778\uD574 \uC8FC\uC138\uC694." : "\uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC\uB97C \uC694\uCCAD\uD588\uC5B4\uC694. \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC644\uB8CC\uB410\uB294\uC9C0 \uD655\uC778\uD574 \uC8FC\uC138\uC694. \uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8\uC5D0\uB294 \uC774\uBC88 \uD0ED\uC5D0\uC11C\uB9CC \uB0A8\uC544\uC694."
        };
      },
      async openProject(recentPath) {
        const opening = ++revision;
        pendingProject = null;
        let project;
        let data;
        if (recentPath !== void 0) {
          const record = await storage((records) => records.find((entry) => entry.path === recentPath));
          if (!record) throw new Error("\uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8 \uBAA9\uB85D\uC5D0\uC11C \uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC5B4\uC694.");
          project = { path: record.path, filename: record.filename };
          data = record.data;
        } else {
          const file = await pickProjectFile();
          if (!file || opening !== revision) return null;
          data = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
          project = { path: crypto.randomUUID(), filename: file.name };
        }
        if (opening !== revision) return null;
        pendingProject = { project, data };
        return data;
      },
      async newProject() {
        revision++;
        activeProject = pendingProject = null;
      },
      async acceptOpenProject(title) {
        if (!pendingProject) return;
        const { project, data } = pendingProject;
        activeProject = project;
        pendingProject = null;
        await remember(project, title, data);
      },
      recentProjects: () => storage((records) => records.map(({ path, title }) => ({ path, title }))),
      async updateRecentProject(path, name) {
        if (name !== null && (typeof name !== "string" || !name.trim() || name.length > 120)) {
          throw new Error("\uC774\uB984\uC744 1~120\uC790\uB85C \uC785\uB825\uD558\uC138\uC694.");
        }
        let found = false;
        await storage(() => {
        }, (records) => {
          found = records.some((entry) => entry.path === path);
          if (name === null) return records.filter((entry) => entry.path !== path);
          return records.map((entry) => entry.path === path ? { ...entry, title: name.trim(), alias: name.trim() } : entry);
        });
        if (!found) throw new Error("\uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC5B4\uC694.");
      }
    };
  }

  // assets/web-api.js
  var DEFAULT_SERVER = "https://rqc76xf3-8000.jpe1.devtunnels.ms";
  var connection = { mode: "remote", url: DEFAULT_SERVER, key: "" };
  var availability = { db: false, ai: false, editorWires: false };
  function setAvailability(next) {
    const changed = next.db !== availability.db || next.ai !== availability.ai;
    availability = next;
    if (changed) window.dispatchEvent(new Event("mir-connection-status"));
  }
  var serverErrors = {
    INVALID_API_KEY: "\uBC30\uC120 API \uD0A4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
    LOCAL_API_KEY_NOT_CONFIGURED: "\uC774 PC\uC758 \uBC30\uC120 \uC11C\uBC84\uC5D0 API \uD0A4\uB97C \uC124\uC815\uD574 \uC8FC\uC138\uC694.",
    COPILOT_SECRET_NOT_CONFIGURED: "\uBC30\uC120 \uC11C\uBC84\uC5D0 Copilot Direct Line \uBE44\uBC00 \uD0A4\uB97C \uC124\uC815\uD574 \uC8FC\uC138\uC694.",
    DIRECT_LINE_AUTH_FAILED: "Copilot \uC778\uC99D\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uC11C\uBC84\uC758 Direct Line \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
    DIRECT_LINE_NETWORK_ERROR: "\uBC30\uC120 \uC11C\uBC84\uC5D0\uC11C Microsoft\uC5D0 \uC811\uC18D\uD560 \uC218 \uC5C6\uC5B4\uC694."
  };
  async function requestAt(config, route, { method = "GET", body, signal } = {}) {
    const timeout = AbortSignal.timeout(route.startsWith("/chat/") ? 5e4 : 25e3);
    if (location.protocol === "file:") {
      if (config.mode !== "remote") throw new Error("HTML \uC9C1\uC811 \uC2E4\uD589\uC5D0\uC11C\uB294 \uACF5\uC720 \uC11C\uBC84\uB97C \uC120\uD0DD\uD558\uACE0 \uC11C\uBC84 \uC8FC\uC18C\uC640 \uBC30\uC120 API \uD0A4\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      const transport = window.MirServerConnection.createTransport({
        read: () => config,
        fetcher: (url, options) => fetch(url, {
          ...options,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout
        })
      });
      try {
        return await transport(route, { method, body });
      } catch (error) {
        if (error instanceof TypeError) throw new Error("\uC11C\uBC84\uC5D0 \uC811\uC18D\uD560 \uC218 \uC5C6\uC5B4\uC694. \uC8FC\uC18C\uC640 \uC11C\uBC84 \uC2E4\uD589 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uACE0, \uC11C\uBC84\uAC00 HTML \uD30C\uC77C\uC758 \uC5F0\uACB0\uC744 \uD5C8\uC6A9\uD558\uB294\uC9C0 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        throw error;
      }
    }
    const response = await fetch("/api/mir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.mode === "remote" ? { "X-API-Key": config.key } : {}
      },
      body: JSON.stringify({ mode: config.mode, url: config.url, route, method, body }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "\uBBF8\uB974 HTML \uC2E4\uD589\uAE30\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    return result;
  }
  function requireResult(result, valid, message) {
    if (result.status < 200 || result.status >= 300 || !valid(result.body)) {
      const code = result.body?.detail?.code;
      throw new Error(serverErrors[code] || message);
    }
    return result.body;
  }
  async function verifyAI(candidate, signal) {
    const info = await requestAt(candidate, "/chat/config", { signal });
    requireResult(
      info,
      (config) => config?.mode === "directline" && config.configured === true,
      "\uBC30\uC120 \uC11C\uBC84\uC5D0 Copilot Direct Line \uBE44\uBC00 \uD0A4\uB97C \uC124\uC815\uD574 \uC8FC\uC138\uC694."
    );
    const opened = await requestAt(candidate, "/chat/sessions", { method: "POST", signal });
    const { session_id: id } = requireResult(
      opened,
      (session) => typeof session?.session_id === "string" && /^[a-f0-9]{1,64}$/.test(session.session_id),
      "Copilot \uB300\uD654\uB97C \uC5F4 \uC218 \uC5C6\uC5B4\uC694. \uC11C\uBC84\uC758 \uC5D0\uC774\uC804\uD2B8 \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."
    );
    void requestAt(candidate, "/chat/sessions/" + id, { method: "DELETE" }).catch(() => {
    });
  }
  async function requestCircuit(route, options) {
    const target = connection;
    const chat = route.startsWith("/chat/");
    const cleanup = chat && options?.method === "DELETE";
    if (!availability.db && !cleanup) throw new Error("\uBC30\uC120 DB \uC5F0\uACB0\uC744 \uBA3C\uC800 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    if (chat && !availability.ai && !cleanup) throw new Error("Copilot AI \uC5F0\uACB0\uC744 \uBA3C\uC800 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    function lost(all) {
      if (connection !== target || cleanup) return;
      setAvailability({ ...availability, db: all ? false : availability.db, ai: false });
    }
    try {
      const result = await requestAt(target, route, options);
      const authError = [401, 403].includes(result.status);
      if (authError || result.status >= 500) lost(authError || !chat);
      return result;
    } catch (error) {
      if (!options?.signal?.aborted) lost(!chat);
      throw error;
    }
  }
  var PART_STORAGE = "mir-html-user-parts-v1";
  var PIN_TYPES = ["power_out", "power_in", "gnd", "gpio", "input", "output", "passive", "contact", "nc"];
  var userParts;
  try {
    userParts = new Map(JSON.parse(localStorage.getItem(PART_STORAGE) || "[]"));
  } catch {
    userParts = /* @__PURE__ */ new Map();
  }
  function validatePart(part) {
    if (typeof part?.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(part.id) || typeof part.name !== "string" || !part.name.trim() || !Array.isArray(part.pins) || !part.pins.length) {
      throw new Error("\uBD80\uD488\uC758 id, name, pins\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    }
    const ids = /* @__PURE__ */ new Set();
    for (const pin of part.pins) {
      if (typeof pin?.id !== "string" || !pin.id.trim() || ids.has(pin.id) || !PIN_TYPES.includes(pin.type)) {
        throw new Error("\uD540 id\uC758 \uC911\uBCF5 \uC5EC\uBD80\uC640 type\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      }
      ids.add(pin.id);
    }
  }
  function savePart(part, imageData) {
    validatePart(part);
    const next = new Map(userParts);
    const { imageData: embedded, ...data } = part;
    const image = imageData || (/^data:image\/(?:svg\+xml|png);base64,[a-z0-9+/=]+$/i.test(embedded) ? embedded : void 0);
    next.set(part.id, { ...data, source: "user", file: part.id + ".json", imageData: image });
    try {
      localStorage.setItem(PART_STORAGE, JSON.stringify([...next]));
    } catch {
      throw new Error("\uBE0C\uB77C\uC6B0\uC800\uC5D0 \uBD80\uD488\uC744 \uC800\uC7A5\uD560 \uACF5\uAC04\uC774 \uBD80\uC871\uD574\uC694. \uB354 \uC791\uC740 \uADF8\uB9BC\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    }
    userParts = next;
    return part.id;
  }
  function pickPartFiles() {
    return new Promise((resolve) => {
      const input2 = document.createElement("input");
      input2.type = "file";
      input2.accept = ".json,.png,.svg";
      input2.multiple = true;
      input2.hidden = true;
      const done = (files) => {
        input2.remove();
        resolve(files);
      };
      input2.addEventListener("change", () => done([...input2.files]), { once: true });
      input2.addEventListener("cancel", () => done([]), { once: true });
      document.body.append(input2);
      input2.click();
    });
  }
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error("\uBD80\uD488 \uADF8\uB9BC\uC740 2MB \uC774\uD558\uB85C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."));
        return;
      }
      const type = /\.svg$/i.test(file.name) ? "image/svg+xml" : "image/png";
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("\uBD80\uD488 \uADF8\uB9BC\uC744 \uC77D\uC744 \uC218 \uC5C6\uC5B4\uC694."));
      reader.readAsDataURL(new Blob([file], { type }));
    });
  }
  async function importParts() {
    const files = await pickPartFiles();
    const pictures = new Map(files.filter((file) => /\.(?:svg|png)$/i.test(file.name)).map((file) => [file.name, file]));
    const jsonFiles = files.filter((file) => /\.json$/i.test(file.name));
    const added = [], errors = [];
    if (files.length && !jsonFiles.length) errors.push("\uBD80\uD488 JSON\uB3C4 \uD568\uAED8 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
    for (const file of jsonFiles) {
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error("\uBD80\uD488 JSON\uC740 2MB \uC774\uD558\uB85C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        const part = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
        const picture = pictures.get(part?.image);
        added.push(savePart(part, picture && await readImage(picture)));
      } catch (error) {
        errors.push(file.name + " \xB7 " + error.message);
      }
    }
    return { added, errors };
  }
  function openGuide(name) {
    const guides = {
      "Copilot-Studio-\uC5F0\uACB0-\uC548\uB0B4.md": "docs/\uC5F0\uACB0 \uC548\uB0B4.html",
      "\uBD80\uD488-JSON-\uC591\uC2DD.md": "docs/\uBD80\uD488 \uC548\uB0B4.html"
    };
    if (Object.hasOwn(guides, name)) window.open(guides[name], "_blank", "noopener");
  }
  window.api = {
    browserMode: true,
    ...createBrowserProjects(),
    getSettings: async () => ({
      mode: "server",
      serverSecretConfigured: availability.ai,
      apiKeyReady: availability.db
    }),
    setSettings: async ({ mode }) => {
      if (mode !== "server") throw new Error("\uBBF8\uB974 HTML\uC740 \uC2E4\uC81C AI\uC640 DB \uC5F0\uACB0\uC774 \uD544\uC694\uD574\uC694.");
    },
    getServerConnection: async () => ({
      mode: connection.mode,
      url: connection.url || DEFAULT_SERVER,
      hasKey: Boolean(connection.key)
    }),
    getAutoAuthStatus: async () => ({ ready: availability.db, editorWires: availability.editorWires, remote: connection.mode === "remote" }),
    requestCircuit,
    resetAgent: async () => {
    },
    listParts: async () => {
      let parts = builtInParts, errors = [];
      if (location.protocol !== "file:") {
        const response = await fetch("/api/parts");
        if (!response.ok) throw new Error("\uAE30\uBCF8 \uBD80\uD488 \uBAA9\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC5B4\uC694.");
        ({ parts, errors } = await response.json());
      }
      const all = new Map(parts.map((part) => [part.id, part]));
      for (const [id, part] of userParts) all.set(id, part);
      return { parts: [...all.values()], errors };
    },
    savePart: async (part) => savePart(part),
    importParts,
    savePartTemplate: () => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(partTemplate, null, 2)], { type: "application/json" }));
      setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
      link.download = "my-part.json";
      link.click();
    },
    openPartsFolder: () => openGuide("\uBD80\uD488-JSON-\uC591\uC2DD.md"),
    openDoc: openGuide,
    getAppIcon: async () => "assets/mir-icon.png"
  };
  var runtimeApi = createServerChatApi(window.api);
  runtimeApi.selectMode("server");
  runtimeApi.getSettings = window.api.getSettings;
  async function connectRequired(input2, { signal, progress = () => {
  } } = {}) {
    const candidate = window.MirServerConnection.updateConnection(connection, input2);
    const sameServer = candidate.mode === connection.mode && candidate.url === connection.url && candidate.key === connection.key;
    progress("DB \uBD80\uD488 \uBAA9\uB85D\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC5B4\uC694.");
    const db = await requestAt(candidate, "/components/search?limit=100", { signal });
    requireResult(db, Array.isArray, "DB \uBD80\uD488 \uBAA9\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC5B4\uC694. \uC11C\uBC84 \uC8FC\uC18C\uC640 \uBC30\uC120 API \uD0A4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    progress("DB \uD655\uC778 \uC644\uB8CC \xB7 Copilot AI \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC5B4\uC694.");
    const [capabilities, agent] = await Promise.allSettled([
      requestAt(candidate, "/circuits/capabilities", { signal }),
      verifyAI(candidate, signal)
    ]);
    signal?.throwIfAborted();
    const aiError = agent.status === "rejected" ? agent.reason.message : "";
    const editorWires = capabilities.status === "fulfilled" && capabilities.value.status === 200 && capabilities.value.body?.editor_wires === true;
    void runtimeApi.resetAgent();
    connection = candidate;
    setAvailability({ db: true, ai: !aiError, editorWires });
    return { sameServer, aiError };
  }

  // assets/appearance.js
  var dialog = document.getElementById("wireSettings");
  var key = "mir-accent-color";
  var defaultColor = "#1c74c4";
  var selected = null;
  try {
    const saved = localStorage.getItem(key);
    if (/^#[0-9a-f]{6}$/i.test(saved || "")) selected = saved;
  } catch {
  }
  var root = document.documentElement;
  var tokens = ["--primary", "--primary-hover", "--primary-active", "--primary-soft", "--primary-text", "--on-primary"];
  function mix(color, target, amount) {
    const rgb = color.match(/\w\w/g).map((v) => parseInt(v, 16));
    return "#" + rgb.map((v) => Math.round(v + (target - v) * amount).toString(16).padStart(2, "0")).join("");
  }
  function apply() {
    if (!selected) {
      tokens.forEach((k) => root.style.removeProperty(k));
      return;
    }
    const dark = root.dataset.theme === "dark" || !root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches;
    const base = dark ? mix(selected.slice(1), 255, 0.32) : selected;
    const values = base.slice(1).match(/\w\w/g).map((v) => parseInt(v, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    const colors = [base, mix(base.slice(1), dark ? 255 : 0, 0.15), mix(base.slice(1), dark ? 255 : 0, 0.28), mix(selected.slice(1), dark ? 0 : 255, dark ? 0.78 : 0.93), dark ? mix(selected.slice(1), 255, 0.65) : mix(selected.slice(1), 0, 0.48), luminance > 0.179 ? "#000000" : "#ffffff"];
    tokens.forEach((k, i) => root.style.setProperty(k, colors[i]));
  }
  var tabs = document.createElement("div");
  tabs.className = "settings-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "\uC124\uC815 \uC885\uB958");
  var wiring = document.createElement("section");
  wiring.id = "settingsWiringPanel";
  wiring.setAttribute("role", "tabpanel");
  wiring.setAttribute("aria-labelledby", "settingsWiringTab");
  for (const el3 of [...dialog.children]) if (el3.matches(".wiring-options,.wire-preview")) wiring.append(el3);
  var appearance = document.createElement("section");
  appearance.id = "settingsColorPanel";
  appearance.setAttribute("role", "tabpanel");
  appearance.setAttribute("aria-labelledby", "settingsColorTab");
  appearance.hidden = true;
  appearance.innerHTML = '<h3>\uBA54\uC778 \uC0C9\uC0C1</h3><p class="muted">\uBC84\uD2BC\uACFC \uAC15\uC870 \uD45C\uC2DC\uC5D0 \uC0AC\uC6A9\uD560 \uC0C9\uC0C1\uC744 \uACE8\uB77C \uC8FC\uC138\uC694.</p><div class="accent-presets" aria-label="\uCD94\uCC9C \uC0C9\uC0C1"></div><label class="accent-custom">\uC9C1\uC811 \uACE0\uB974\uAE30 <input id="accentColor" type="color" aria-label="\uBA54\uC778 \uC0C9\uC0C1 \uC9C1\uC811 \uACE0\uB974\uAE30"></label><div class="accent-sample"><button class="primary" type="button">\uBC84\uD2BC \uBBF8\uB9AC\uBCF4\uAE30</button><span class="badge">\uAC15\uC870 \uC0C9\uC0C1</span></div><button id="accentReset" type="button">\uAE30\uBCF8 \uC0C9\uC0C1\uC73C\uB85C</button><p id="accentStatus" role="status" class="muted"></p>';
  var theme = document.createElement("section");
  theme.id = "settingsThemePanel";
  theme.setAttribute("role", "tabpanel");
  theme.setAttribute("aria-labelledby", "settingsThemeTab");
  theme.innerHTML = '<fieldset class="theme-options"><legend>\uD14C\uB9C8 \uC124\uC815</legend><label><input type="radio" name="appTheme" value="light"> \uB77C\uC774\uD2B8</label><label><input type="radio" name="appTheme" value="dark"> \uB2E4\uD06C</label></fieldset>';
  var panels = [wiring, appearance, theme];
  var tabLabels = ["\uBC30\uC120 \uD615\uD0DC", "\uBA54\uC778 \uC0C9\uC0C1", "\uB2E4\uD06C/\uB77C\uC774\uD2B8 \uBAA8\uB4DC"];
  var buttons = tabLabels.map((label, i) => {
    const button2 = document.createElement("button");
    button2.id = panels[i].getAttribute("aria-labelledby");
    button2.type = "button";
    button2.textContent = label;
    button2.setAttribute("role", "tab");
    button2.setAttribute("aria-controls", panels[i].id);
    button2.onclick = () => activate(i);
    button2.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const offset = event.key === "ArrowLeft" ? -1 : 1;
      const next = event.key === "Home" ? 0 : event.key === "End" ? panels.length - 1 : (i + offset + panels.length) % panels.length;
      activate(next, true);
    };
    return button2;
  });
  function activate(index, focus = false) {
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
    buttons.forEach((button2, i) => {
      button2.setAttribute("aria-selected", String(i === index));
      button2.tabIndex = i === index ? 0 : -1;
    });
    if (focus) buttons[index].focus();
  }
  tabs.append(...buttons);
  dialog.append(tabs, ...panels);
  activate(0);
  var input = appearance.querySelector("#accentColor");
  function update() {
    input.value = selected || defaultColor;
    appearance.querySelectorAll("[data-color]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === input.value)));
    apply();
  }
  function choose(value) {
    selected = value;
    let saved = true;
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      saved = false;
    }
    update();
    document.getElementById("accentStatus").textContent = saved ? "\uC0C9\uC0C1\uC744 \uC801\uC6A9\uD558\uACE0 \uC800\uC7A5\uD588\uC5B4\uC694." : "\uC0C9\uC0C1\uC744 \uC801\uC6A9\uD588\uC9C0\uB9CC \uC800\uC7A5\uD560 \uC218 \uC5C6\uC5B4\uC694. \uC774\uBC88 \uC2E4\uD589\uC5D0\uB9CC \uC720\uC9C0\uB429\uB2C8\uB2E4.";
  }
  for (const [name, color] of [["\uD30C\uB791", "#1c74c4"], ["\uBCF4\uB77C", "#7950c8"], ["\uCD08\uB85D", "#218565"], ["\uC8FC\uD669", "#c96517"], ["\uBD84\uD64D", "#b83e78"], ["\uCCAD\uB85D", "#087f8c"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.color = color;
    b.style.setProperty("--swatch", color);
    b.setAttribute("aria-label", name);
    b.title = name;
    b.onclick = () => choose(color);
    appearance.querySelector(".accent-presets").append(b);
  }
  input.oninput = () => choose(input.value);
  document.getElementById("accentReset").onclick = () => choose(null);
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
  update();

  // assets/circuit-api.js
  var signature = (refs) => JSON.stringify(refs.map((p) => [p.instance_id, p.pin_id]).sort());
  function parsePin(key2, instances) {
    const dot = typeof key2 === "string" ? key2.indexOf(".") : -1;
    if (dot < 1) throw new Error(`\uC798\uBABB\uB41C \uD540 \uCC38\uC870: ${key2}`);
    const ref = { instance_id: key2.slice(0, dot), pin_id: key2.slice(dot + 1) };
    if (!instances.has(ref.instance_id) || !ref.pin_id) throw new Error(`\uC5C6\uB294 \uBD80\uD488\uC758 \uD540: ${key2}`);
    return ref;
  }
  function toCircuitDraft(state2, original = null, { editorWires = false } = {}) {
    if (!state2.instances.length) throw new Error("\uBA3C\uC800 \uBD80\uD488\uC744 \uBC30\uCE58\uD558\uC138\uC694.");
    const instances = /* @__PURE__ */ new Set();
    for (const i of state2.instances) {
      if (!i.ref || i.ref.includes(".") || instances.has(i.ref)) throw new Error("\uBD80\uD488 ref\uB294 \uC911\uBCF5\uB418\uAC70\uB098 \uC810(.)\uC744 \uD3EC\uD568\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      instances.add(i.ref);
    }
    const parents = /* @__PURE__ */ new Map(), refs = /* @__PURE__ */ new Map();
    const find = (x) => {
      if (!parents.has(x)) parents.set(x, x);
      if (parents.get(x) !== x) parents.set(x, find(parents.get(x)));
      return parents.get(x);
    };
    for (const wire of state2.wires) {
      const a = parsePin(wire.from, instances), b = parsePin(wire.to, instances);
      const ka = JSON.stringify(a), kb = JSON.stringify(b);
      if (ka === kb) throw new Error("\uAC19\uC740 \uD540\uC744 \uC790\uAE30 \uC790\uC2E0\uC5D0\uAC8C \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      refs.set(ka, a);
      refs.set(kb, b);
      parents.set(find(ka), find(kb));
    }
    const groups2 = /* @__PURE__ */ new Map();
    for (const [key2, ref] of refs) {
      const root2 = find(key2);
      if (!groups2.has(root2)) groups2.set(root2, []);
      groups2.get(root2).push(ref);
    }
    const oldIds = new Map((original?.nets || []).map((net) => [signature(net.connected_pin_refs), net.net_id]));
    const reserved = new Set((original?.nets || []).map((n) => n.net_id));
    let serial = 1;
    const nets = [...groups2.values()].map((connected_pin_refs) => {
      let net_id = oldIds.get(signature(connected_pin_refs));
      if (!net_id) {
        do {
          net_id = `mir-net-${serial++}`;
        } while (reserved.has(net_id));
        reserved.add(net_id);
      }
      return { net_id, connected_pin_refs };
    });
    return {
      name: state2.title || "\uBBF8\uB974 \uBC30\uC120 \uCD08\uC548",
      requirements: state2.requirements ?? original?.requirements ?? "",
      component_instances: state2.instances.map((i) => ({
        instance_id: i.ref,
        component_definition_id: i.part,
        ...i.props ? { props: i.props } : {},
        ...i.label ? { label: i.label } : {}
      })),
      nets,
      ...editorWires ? { editor_wires: state2.wires.map(({ id, from, to, kind, note, origin }) => ({ id, from, to, kind, note, origin })) } : {},
      layout: state2.instances.map((i) => ({ instance_id: i.ref, x: i.x ?? 0, y: i.y ?? 0, rotation: i.rotation ?? 0, ...i.mirrored ? { mirrored: true } : {} }))
    };
  }
  function fromCircuit(circuit) {
    const layout = new Map(circuit.layout.map((p) => [p.instance_id, p]));
    const instances = circuit.component_instances.map((i, n) => {
      if (i.instance_id.includes(".")) throw new Error("\uBBF8\uB974\uC5D0\uC11C\uB294 ref\uC5D0 \uC810(.)\uC774 \uD3EC\uD568\uB41C \uD68C\uB85C\uB97C \uD3B8\uC9D1\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      const p = layout.get(i.instance_id);
      return {
        ref: i.instance_id,
        part: i.component_definition_id,
        ...i.props && Object.keys(i.props).length ? { props: i.props } : {},
        ...i.label ? { label: i.label } : {},
        x: p?.x ?? n % 3 * 360,
        y: p?.y ?? Math.floor(n / 3) * 240,
        rotation: p?.rotation ?? 0,
        ...p?.mirrored ? { mirrored: true } : {}
      };
    });
    const seen = /* @__PURE__ */ new Set(), wires = [];
    for (const net of circuit.nets) {
      const keys = net.connected_pin_refs.map((p) => `${p.instance_id}.${p.pin_id}`);
      for (const key2 of keys) {
        if (seen.has(key2)) throw new Error(`\uC5EC\uB7EC net\uC5D0 \uC911\uBCF5\uB41C \uD540(${key2})\uC774 \uC788\uC5B4 \uBD88\uB7EC\uC624\uAE30\uB97C \uC911\uB2E8\uD588\uC2B5\uB2C8\uB2E4. API\uC5D0\uC11C \uBA3C\uC800 \uC218\uC815\uD558\uC138\uC694.`);
        seen.add(key2);
      }
      keys.slice(1).forEach((key2) => wires.push({ id: `db-${wires.length}`, from: keys[0], to: key2, origin: "api", note: net.net_id }));
    }
    const editor = circuit.editor_wires;
    if (Array.isArray(editor)) {
      const ids = new Set(editor.map((wire) => wire?.id));
      if (ids.size === editor.length && editor.every((wire) => typeof wire?.id === "string" && wire.id)) {
        try {
          const savedNets = circuit.nets.map((net) => signature(net.connected_pin_refs)).sort();
          const editorNets = toCircuitDraft({ instances, wires: editor }).nets.map((net) => signature(net.connected_pin_refs)).sort();
          if (JSON.stringify(savedNets) === JSON.stringify(editorNets)) {
            return {
              instances,
              wires: editor.map(({ id, from, to, kind, note, origin }) => ({ id, from, to, ...kind ? { kind } : {}, ...note != null ? { note } : {}, ...origin ? { origin } : {} })),
              title: circuit.name,
              requirements: circuit.requirements
            };
          }
        } catch {
        }
      }
    }
    return { instances, wires, title: circuit.name, requirements: circuit.requirements };
  }
  function definitionToPart(def2) {
    const types = { ground: "gnd", bidirectional: "gpio" };
    return {
      id: def2.id,
      name: def2.model,
      category: def2.category,
      description: `${def2.manufacturer} \xB7 ${def2.verification_status}${def2.is_draft ? " \xB7 \uBBF8\uAC80\uC99D \uC124\uACC4 \uBD80\uD488" : ""}${def2.is_virtual ? " \xB7 \uAC00\uC0C1 \uBD80\uD488" : ""}${!def2.pins.length ? " \xB7 \uD540 \uC815\uBCF4 \uBBF8\uD655\uC778" : ""}`,
      isDraft: !!def2.is_draft,
      unresolvedFields: def2.unresolved_fields || [],
      sources: def2.source_references.map((s) => s.reference),
      pins: def2.pins.map((p, n) => ({
        id: p.id,
        label: p.label,
        type: types[p.direction] || p.direction,
        side: n % 2 ? "right" : "left",
        ...p.voltage_min != null ? { minVoltage: p.voltage_min } : {},
        ...p.voltage_max != null ? { maxVoltage: p.voltage_max } : {},
        ...p.output_voltage != null ? { voltage: p.output_voltage } : {}
      }))
    };
  }
  async function loadComponentCatalog(client) {
    const parts = [];
    for (let offset = 0; offset < 1e4; offset += 100) {
      const batch = await client.call(`/components/search?limit=100&offset=${offset}`);
      parts.push(...batch);
      if (batch.length < 100) return parts;
    }
    throw new Error("\uBD80\uD488 \uBAA9\uB85D\uC774 \uC870\uD68C \uD55C\uB3C4\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4.");
  }
  async function loadComponentImage(client, part) {
    try {
      const result = await client.call(`/components/${encodeURIComponent(part.id)}/image`);
      if (!result.image_data?.startsWith("data:image/svg+xml;base64,") || !result.layout) throw new Error("\uC774\uBBF8\uC9C0 \uB370\uC774\uD130 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      const positions = new Map(result.layout.pins.map((p) => [p.id, p]));
      if (part.pins.length !== positions.size || part.pins.some((p) => !positions.has(p.id))) throw new Error("\uC774\uBBF8\uC9C0\uC640 \uD540 \uBAA9\uB85D\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      const { _layout, ...fresh } = part;
      const pins = part.pins.map((p) => ({ ...p, side: positions.get(p.id).side }));
      const pos = Object.fromEntries(pins.map((p) => [p.id, { ...positions.get(p.id), def: p }]));
      const nodes = result.design_version === "v2" && Array.isArray(result.art_nodes) ? result.art_nodes : void 0;
      return {
        ...fresh,
        imageData: result.image_data,
        imageFit: "none",
        pins,
        imageAssetId: result.asset_id,
        imageNodes: nodes,
        imagePresentation: result.presentation,
        color: result.presentation?.color || fresh.color,
        _layout: { w: result.layout.width, h: result.layout.height, top: result.layout.top || 0, pos }
      };
    } catch (e) {
      if (e.status === 404) return part;
      throw e;
    }
  }
  var CircuitApi = class {
    constructor(request, key2) {
      this.request = request;
      this.key = key2;
    }
    async call(path, method = "GET", body) {
      const response = await this.request(path, {
        method,
        headers: { "X-API-Key": this.key, "Content-Type": "application/json" },
        ...body ? { body: JSON.stringify(body) } : {}
      });
      if (response.status >= 400) {
        const detail = response.body?.detail;
        const code = detail?.code || `HTTP ${response.status}`;
        const hint = response.status === 409;
        const error = new Error(code + (hint ? " \uCD5C\uC2E0 \uBC84\uC804\uACFC \uCDA9\uB3CC\uD588\uC2B5\uB2C8\uB2E4. \uD3B8\uC9D1\uC744 \uD30C\uC77C\uB85C \uC800\uC7A5\uD55C \uB4A4 \uD68C\uB85C\uB97C \uB2E4\uC2DC \uBD88\uB7EC\uC624\uC138\uC694." : ""));
        error.status = response.status;
        throw error;
      }
      return response.body;
    }
  };

  // assets/backend-panel.js?v=research-evidence-7
  function initBackendPanel({
    getState,
    getProjectGeneration = () => 0,
    canReplace = () => true,
    getCatalog = () => getState().defs,
    registerParts = (parts) => {
      for (const [id, def2] of parts) getState().defs.set(id, def2);
    },
    replace,
    renderParts,
    message
  }) {
    const $2 = (id) => document.getElementById(id);
    const dialog2 = $2("backendModal");
    let client = null, current = null, busy = false, saved = "", editorWires = false;
    let dialogGeneration = 0;
    function openDialog() {
      if (dialog2.open) return;
      dialogGeneration++;
      dialog2.showModal();
    }
    function updateSaveScope() {
      $2("dbSaveScope").hidden = editorWires;
      $2("dbSaveScope").textContent = "\uC774 \uC11C\uBC84\uB294 \uBC30\uC120\uC758 \uD540 \uC5F0\uACB0\uC744 \uC800\uC7A5\uD574\uC694. \uC9C0\uC815\uD55C \uC120 \uC885\uB958\uC640 \uBA54\uBAA8\uAE4C\uC9C0 \uBCF4\uAD00\uD558\uB824\uBA74 \uD504\uB85C\uC81D\uD2B8 \uD30C\uC77C\uB85C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.";
    }
    window.addEventListener("mir-connection-status", async () => {
      editorWires = (await runtimeApi.getAutoAuthStatus()).editorWires;
      updateSaveScope();
    });
    const status = (text2) => {
      $2("dbStatus").textContent = text2;
    };
    const draft = () => toCircuitDraft(getState(), current, { editorWires });
    function reset() {
      client = null;
      current = null;
      saved = "";
      $2("dbCircuitId").value = "";
      status("\uC0C8 \uD68C\uB85C \xB7 DB \uC800\uC7A5 \uC804");
    }
    async function run(action, loading = "DB \uC791\uC5C5\uC744 \uCC98\uB9AC\uD558\uACE0 \uC788\uC5B4\uC694\u2026") {
      if (busy) return;
      busy = true;
      const controls = ["btnDbConnect", "btnDbLoad", "btnDbSave", "btnDbValidate", "btnFileVerification"].map($2);
      const previous = $2("dbStatus").textContent;
      status(loading);
      controls.forEach((control) => {
        control.disabled = true;
      });
      try {
        return await action();
      } catch (error) {
        status("\uC2E4\uD328 \xB7 " + error.message);
        message("\uBC30\uC120 API \xB7 " + error.message);
      } finally {
        if ($2("dbStatus").textContent === loading) status(previous);
        busy = false;
        controls.forEach((control) => {
          control.disabled = false;
        });
      }
    }
    async function connect() {
      const readiness = await runtimeApi.getAutoAuthStatus();
      if (!readiness.ready) throw new Error("\uC5F0\uACB0 \uD655\uC778\uC744 \uB20C\uB7EC \uBC30\uC120 DB\uC5D0 \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
      editorWires = readiness.editorWires;
      updateSaveScope();
      const next = new CircuitApi(runtimeApi.requestCircuit, "");
      const parts = await loadComponentCatalog(next);
      client = next;
      const catalog = getCatalog();
      const loaded = /* @__PURE__ */ new Map();
      for (const def2 of parts) {
        const old = catalog.get(def2.id);
        const converted = definitionToPart(def2);
        const samePins = old && JSON.stringify(old.pins.map((p) => p.id).sort()) === JSON.stringify(def2.pins.map((p) => p.id).sort());
        const base = samePins ? {
          ...old,
          ...converted,
          pins: converted.pins.map((p) => ({ ...p, side: old.pins.find((x) => x.id === p.id).side }))
        } : converted;
        delete base._layout;
        loaded.set(def2.id, await loadComponentImage(next, base));
      }
      registerParts(loaded);
      renderParts();
      status(`\uC11C\uBC84 \uC790\uB3D9 \uC5F0\uACB0\uB428 \xB7 \uB4F1\uB85D \uBD80\uD488 ${parts.length}\uAC1C`);
    }
    async function requireClient() {
      if (!client) await connect();
    }
    async function fetchPart(id) {
      if (!client && !(await runtimeApi.getAutoAuthStatus?.())?.ready) return null;
      const api2 = client || new CircuitApi(runtimeApi.requestCircuit, "");
      try {
        const def2 = await api2.call(`/components/${encodeURIComponent(id)}`);
        return await loadComponentImage(api2, definitionToPart(def2));
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    }
    async function load(id = $2("dbCircuitId").value.trim(), { automatic = false, guardDialog = true } = {}) {
      const generation = getProjectGeneration();
      const view = dialogGeneration;
      const canLoad = () => generation === getProjectGeneration() && canReplace() && (automatic ? !getState().instances.length : !guardDialog || dialog2.open && view === dialogGeneration);
      if (!canLoad()) return false;
      if (!id) throw new Error("\uC5D0\uC774\uC804\uD2B8\uAC00 \uBC18\uD658\uD55C \uD68C\uB85C ID\uB97C \uC785\uB825\uD558\uC138\uC694.");
      await requireClient();
      if (!canLoad()) return false;
      const circuitClient = client;
      const record = await circuitClient.call(`/circuits/${encodeURIComponent(id)}`);
      const next = fromCircuit(record);
      const defs = new Map(getCatalog());
      const projectParts2 = /* @__PURE__ */ new Map();
      const missing = [];
      for (const partId of new Set(next.instances.map((i) => i.part))) {
        try {
          const def2 = await circuitClient.call(`/components/${encodeURIComponent(partId)}`);
          const old = defs.get(partId);
          const samePins = old && JSON.stringify(old.pins.map((p) => p.id).sort()) === JSON.stringify(def2.pins.map((p) => p.id).sort());
          const converted = definitionToPart(def2);
          const base = samePins ? {
            ...old,
            ...converted,
            pins: converted.pins.map((p) => ({ ...p, side: old.pins.find((x) => x.id === p.id).side }))
          } : converted;
          delete base._layout;
          projectParts2.set(partId, await loadComponentImage(circuitClient, base));
        } catch (e) {
          if (e.status !== 404) throw e;
          if (!defs.has(partId)) {
            const refs = new Set(next.instances.filter((i) => i.part === partId).map((i) => i.ref));
            const pins = [...new Set(record.nets.flatMap((n) => n.connected_pin_refs).filter((p) => refs.has(p.instance_id)).map((p) => p.pin_id))];
            projectParts2.set(partId, {
              id: partId,
              name: `${partId} (DB \uBBF8\uB4F1\uB85D)`,
              category: "module",
              pins: pins.map((id2) => ({ id: id2, label: id2, type: "passive", side: "left" }))
            });
          }
          missing.push(partId);
        }
      }
      const loadedDraft = JSON.stringify(toCircuitDraft(next, record, { editorWires }));
      if (!canLoad()) return false;
      if (getState().instances.length && !await confirmAction("\uD604\uC7AC \uD654\uBA74\uC744 \uC774 DB \uD68C\uB85C\uB85C \uBC14\uAFC0\uAE4C\uC694? \uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uBCC0\uACBD\uC740 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4.")) return false;
      if (!canLoad()) return false;
      getState().defs = new Map([...defs, ...projectParts2]);
      replace(next, projectParts2);
      renderParts();
      for (const partId of missing) message(`\uBD80\uD488 DB \uBBF8\uB4F1\uB85D: ${partId}. \uD654\uBA74 \uD45C\uC2DC\uB294 \uAC00\uB2A5\uD558\uBA70 \uC0AC\uC591 \uAC80\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.`);
      current = record;
      saved = loadedDraft;
      $2("dbCircuitId").value = record.id;
      status(`${record.id} \xB7 v${record.version} \xB7 ${record.status}`);
      message(`DB \uD68C\uB85C \uBD88\uB7EC\uC634: ${record.name} (v${record.version})`);
      return true;
    }
    $2("btnBackend").onclick = openDialog;
    $2("btnDbClose").onclick = () => dialog2.close();
    $2("btnDbConnect").onclick = async () => {
      if (!(await runtimeApi.getAutoAuthStatus()).ready) {
        dialog2.close();
        $2("btnSettings").click();
        return;
      }
      await run(connect, "\uC11C\uBC84 \uC5F0\uACB0\uACFC \uBD80\uD488 \uBAA9\uB85D\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC5B4\uC694\u2026");
    };
    $2("btnDbLoad").onclick = () => run(load, "DB\uC5D0\uC11C \uD68C\uB85C\uB97C \uBD88\uB7EC\uC624\uACE0 \uC788\uC5B4\uC694\u2026");
    $2("btnDbSave").onclick = () => run(async () => {
      const generation = getProjectGeneration();
      await requireClient();
      if (generation !== getProjectGeneration() || !canReplace()) return;
      if (getState().pendingProposal) throw new Error("\uC218\uC815\uC548\uC744 \uBA3C\uC800 \uC801\uC6A9\uD558\uAC70\uB098 \uCDE8\uC18C\uD558\uC138\uC694.");
      const data = draft();
      const record = current ? await client.call(`/circuits/${encodeURIComponent(current.id)}`, "PUT", { ...data, expected_version: current.version }) : await client.call("/circuits", "POST", data);
      if (generation !== getProjectGeneration()) {
        message("\uC774\uC804 \uD68C\uB85C DB \uC800\uC7A5 \uC644\uB8CC \xB7 " + record.id);
        return;
      }
      current = record;
      saved = JSON.stringify(data);
      $2("dbCircuitId").value = record.id;
      status(`${record.id} \xB7 v${record.version} \xB7 \uC800\uC7A5\uB428 (\uC7AC\uAC80\uC99D \uD544\uC694)`);
      message(`DB \uC800\uC7A5 \uC644\uB8CC: ${record.id} \xB7 v${record.version}`);
    });
    $2("btnDbValidate").onclick = () => run(async () => {
      await requireClient();
      if (!current || saved !== JSON.stringify(draft()) || getState().pendingProposal) throw new Error("\uD604\uC7AC \uD3B8\uC9D1 \uB0B4\uC6A9\uC744 \uBA3C\uC800 DB\uC5D0 \uC800\uC7A5\uD558\uC138\uC694.");
      const result = await client.call(`/circuits/${encodeURIComponent(current.id)}/validate`, "POST", { expected_version: current.version });
      status(`v${result.version} \xB7 \uC11C\uBC84 \uAC80\uC99D: ${result.status}
${result.issues.map((i) => `[${i.severity}] ${i.message}`).join("\n") || "\uAC80\uC0AC \uBC94\uC704\uC5D0\uC11C \uC774\uC288 \uC5C6\uC74C"}
\uAC80\uC0AC \uC81C\uC678: ${result.excluded_checks.join(", ")}`);
      message(`\uC11C\uBC84 \uAC80\uC99D: ${result.status}
${result.issues.map((i) => `[${i.severity}] ${i.message}`).join("\n") || "\uAD6C\uD604\uB41C \uAC80\uC0AC \uBC94\uC704\uC5D0\uC11C \uC774\uC288 \uC5C6\uC74C"}
\uAC80\uC0AC \uC81C\uC678: ${result.excluded_checks.join(", ")}`);
    });
    const linked = new URLSearchParams(location.search).get("circuit");
    if (linked) {
      $2("dbCircuitId").value = linked;
      openDialog();
    }
    return {
      reset,
      fetchPart,
      connectionChanged(sameServer) {
        client = null;
        if (!sameServer) {
          current = null;
          saved = "";
        }
      },
      isBusy: () => busy,
      connectAutomatically: async () => {
        if ((await runtimeApi.getAutoAuthStatus?.())?.ready) await run(connect);
      },
      refreshAfterAgent: () => client ? run(connect) : Promise.resolve(),
      openCircuit: (id, { showPanel = true, automatic = false } = {}) => {
        if (showPanel) $2("dbCircuitId").value = id;
        if (showPanel) openDialog();
        return run(() => load(id, { automatic, guardDialog: showPanel }));
      }
    };
  }

  // assets/verification-panel.js?v=research-evidence-7
  function initVerificationPanel({ message }) {
    const $2 = (id) => document.getElementById(id);
    const dialog2 = $2("verificationModal");
    let busy = false, checking = false, dbReady = false, kicadReady = false;
    function updateControls() {
      $2("btnVerificationConnect").hidden = dbReady || checking;
      $2("btnVerificationImport").disabled = !dbReady || busy || checking;
      $2("btnVerificationRun").disabled = !kicadReady || busy || checking;
    }
    let selectedFiles = [];
    const show = (value) => {
      $2("verificationResult").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    };
    async function call(path, method = "GET", body) {
      const response = await runtimeApi.requestCircuit(path, { method, ...body ? { body: JSON.stringify(body) } : {} });
      if (response.status >= 400) throw new Error(response.body?.detail?.code || `HTTP ${response.status}`);
      return response.body;
    }
    async function run(action) {
      if (busy) return;
      busy = true;
      updateControls();
      try {
        await action();
      } catch (error) {
        show("\uC2E4\uD328 \xB7 " + error.message);
      } finally {
        busy = false;
        updateControls();
      }
    }
    async function checkTools() {
      checking = true;
      dbReady = kicadReady = false;
      $2("verificationConfig").textContent = "\uBC30\uC120 DB\uC640 \uAC80\uC0AC \uB3C4\uAD6C\uB97C \uD655\uC778\uD558\uACE0 \uC788\uC5B4\uC694\u2026";
      updateControls();
      try {
        dbReady = (await runtimeApi.getAutoAuthStatus()).ready;
        if (!dbReady) {
          $2("verificationConfig").textContent = "\uD30C\uC77C\uC744 \uAC80\uC99D\uD558\uB824\uBA74 \uBC30\uC120 DB\uC5D0 \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.";
          return;
        }
        const config = await call("/verification/config");
        kicadReady = Boolean(config.kicad_available);
        $2("verificationSpice").disabled = !config.ngspice_available;
        if (!config.ngspice_available) $2("verificationSpice").checked = false;
        $2("verificationConfig").textContent = "KiCad " + (kicadReady ? "\uC900\uBE44\uB428" : "\uBBF8\uC124\uCE58 \uB610\uB294 \uACBD\uB85C \uBBF8\uC124\uC815") + " \xB7 ngspice " + (config.ngspice_available ? "\uC900\uBE44\uB428" : "\uBBF8\uC124\uCE58 \uB610\uB294 \uACBD\uB85C \uBBF8\uC124\uC815");
      } catch (error) {
        dbReady = (await runtimeApi.getAutoAuthStatus()).ready;
        $2("verificationConfig").textContent = "\uAC80\uC0AC \uB3C4\uAD6C\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4\uC694. " + error.message;
      } finally {
        checking = false;
        updateControls();
      }
    }
    $2("btnFileVerification").onclick = () => {
      if (!dialog2.open) dialog2.showModal();
      if (!busy && !checking) {
        show("");
        void checkTools();
      }
    };
    $2("btnVerificationClose").onclick = () => dialog2.close();
    $2("btnVerificationConnect").onclick = () => {
      dialog2.close();
      $2("backendModal").close();
      $2("btnSettings").click();
    };
    window.addEventListener("mir-connection-status", async () => {
      if (!(await runtimeApi.getAutoAuthStatus()).ready && dialog2.open && !checking) {
        dbReady = kicadReady = false;
        $2("verificationConfig").textContent = "\uBC30\uC120 DB \uC5F0\uACB0\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
        updateControls();
      }
    });
    function selectFiles(input2, folder = false) {
      const supported = /\.(?:kicad_sch|kicad_pro|lib|inc|mod|cir|sp|model)$/i;
      selectedFiles = [...input2.files].filter((file) => supported.test(file.name)).map((file) => ({
        file,
        name: folder ? file.webkitRelativePath.split("/").slice(1).join("/") : file.name
      }));
      $2("verificationMain").replaceChildren();
      for (const item of selectedFiles.filter((f) => f.name.toLowerCase().endsWith(".kicad_sch"))) {
        const option = document.createElement("option");
        option.value = item.name;
        option.textContent = item.name;
        $2("verificationMain").appendChild(option);
      }
    }
    $2("verificationFiles").onchange = () => selectFiles($2("verificationFiles"));
    $2("verificationFolder").onchange = () => selectFiles($2("verificationFolder"), true);
    $2("btnVerificationImport").onclick = () => run(async () => {
      const files = selectedFiles;
      if (!files.length || !setupMain()) throw new Error("\uD68C\uB85C\uB3C4 \uD30C\uC77C\uACFC \uC8FC \uD68C\uB85C\uB3C4\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
      if (files.length > 40 || files.reduce((sum, f) => sum + f.file.size, 0) > 16e6 || files.some((f) => f.file.size > 5e6)) throw new Error("\uCD5C\uB300 40\uAC1C\xB7\uC804\uCCB4 16MB\xB7\uD30C\uC77C\uB2F9 5MB\uAE4C\uC9C0 \uAC00\uC838\uC62C \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      show("\uD30C\uC77C \uAC00\uC838\uC624\uB294 \uC911\u2026");
      const body = {
        name: $2("verificationMain").value,
        main_file: $2("verificationMain").value,
        files: await Promise.all(files.map(async (f) => ({ name: f.name, content: await f.file.text() })))
      };
      const project = await call("/verification/projects", "POST", body);
      $2("verificationProjectId").value = project.id;
      show(`\uAC00\uC838\uC624\uAE30 \uC644\uB8CC \xB7 ${project.files.length}\uAC1C \uD30C\uC77C
project_id: ${project.id}
\uAC80\uC0AC \uC2E4\uD589 \uC804\uC5D0\uB294 \uD1B5\uACFC \uC5EC\uBD80\uB97C \uD310\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`);
      message(`KiCad \uD30C\uC77C \uAC00\uC838\uC634 \xB7 ${project.name}
project_id: ${project.id}
\uC774 ID\uB85C \uC5D0\uC774\uC804\uD2B8\uC5D0 ERC\xB7\uC2DC\uBBAC\uB808\uC774\uC158\uC744 \uC694\uCCAD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`);
    });
    function setupMain() {
      return $2("verificationMain").value;
    }
    $2("btnVerificationRun").onclick = () => run(async () => {
      const id = $2("verificationProjectId").value.trim();
      if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("\uBA3C\uC800 \uD30C\uC77C\uC744 \uAC00\uC838\uC624\uAC70\uB098 \uD504\uB85C\uC81D\uD2B8 ID\uB97C \uC785\uB825\uD558\uC138\uC694.");
      const checks = {
        run_erc: true,
        run_ngspice: $2("verificationSpice").checked,
        analysis: $2("verificationAnalysis").value,
        timestep: Number($2("verificationStep").value),
        duration: Number($2("verificationDuration").value),
        vectors: $2("verificationVectors").value.split(",").map((s) => s.trim()).filter(Boolean)
      };
      const job = await call(`/verification/projects/${id}/verify`, "POST", checks);
      show(`\uAC80\uC0AC \uB300\uAE30 \uC911\u2026
job_id: ${job.id}`);
      for (let i = 0; i < 150; i++) {
        const state2 = await call(`/jobs/${job.id}`);
        if (!["queued", "running"].includes(state2.status)) {
          const summary = document.createElement("p");
          summary.textContent = `\uAC80\uC0AC \uC0C1\uD0DC: ${state2.status} \xB7 ${state2.result?.note || state2.error?.code || "\uC544\uB798 \uC0C1\uC138 \uACB0\uACFC\uB97C \uD655\uC778\uD558\uC138\uC694."}`;
          const details = document.createElement("details");
          const heading2 = document.createElement("summary");
          heading2.textContent = "\uC0C1\uC138 \uACB0\uACFC \uBCF4\uAE30";
          const raw = document.createElement("pre");
          raw.textContent = JSON.stringify(state2, null, 2);
          details.append(heading2, raw);
          $2("verificationResult").replaceChildren(summary, details);
          message(`KiCad \uD30C\uC77C \uAC80\uC0AC ${state2.status}
project_id: ${id}
job_id: ${job.id}
${state2.result?.note || state2.error?.code || ""}`);
          return;
        }
        show(`\uAC80\uC0AC \uC911 \xB7 ${i + 1}\uCD08
job_id: ${job.id}`);
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
      show(`\uCC98\uB9AC\uAC00 \uACC4\uC18D\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC5D0\uC774\uC804\uD2B8\uC758 GetJobStatus\uB85C \uC870\uD68C\uD558\uC138\uC694.
job_id: ${job.id}`);
    });
  }

  // assets/props.js
  var LED_COLORS = [
    { id: "red", label: "\uBE68\uAC04", hex: "#ff3b30", vf: 2 },
    { id: "orange", label: "\uC8FC\uD669", hex: "#ff9500", vf: 2 },
    { id: "yellow", label: "\uB178\uB780", hex: "#ffd60a", vf: 2.1 },
    { id: "green", label: "\uCD08\uB85D", hex: "#34c759", vf: 2.2 },
    { id: "blue", label: "\uD30C\uB780", hex: "#0a84ff", vf: 3 },
    { id: "white", label: "\uD770\uC0C9", hex: "#f2f2f7", vf: 3 }
  ];
  var RESISTOR_PRESETS = [10, 47, 100, 220, 330, 470, 1e3, 2200, 4700, 1e4, 47e3, 1e5, 1e6];
  function formatOhms(ohms) {
    const trim = (n) => String(Number(n.toFixed(2)));
    if (ohms >= 1e6) return `${trim(ohms / 1e6)}M\u03A9`;
    if (ohms >= 1e3) return `${trim(ohms / 1e3)}k\u03A9`;
    return `${trim(ohms)}\u03A9`;
  }
  function parseOhms(s) {
    const t = String(s).trim().replace(/\s|Ω|ohms?|옴/gi, "");
    const m = t.match(/^(\d+(?:\.\d+)?)([rkm]?)(\d*)$/i);
    if (!m) return null;
    const mult = { "": 1, r: 1, k: 1e3, m: 1e6 }[m[2].toLowerCase()];
    const num = m[3] ? parseFloat(`${m[1]}.${m[3]}`) : parseFloat(m[1]);
    const v = Math.round(num * mult * 100) / 100;
    return v > 0 && v <= 1e8 ? v : null;
  }
  function editableKind(def2) {
    const k = def2?.behavior?.kind;
    return k === "led" || k === "resistor" ? k : null;
  }
  function cleanProps(def2, props) {
    if (!props || typeof props !== "object") return void 0;
    const kind = editableKind(def2);
    const out = {};
    if (kind === "led") {
      const named = LED_COLORS.find((c) => c.id === props.color || c.label === props.color);
      if (named) {
        out.color = named.hex;
        out.forwardVoltage = named.vf;
      } else if (/^#[0-9a-f]{6}$/i.test(props.color || "")) out.color = props.color.toLowerCase();
      const vf = Number(props.forwardVoltage);
      if (vf > 0 && vf < 10) out.forwardVoltage = vf;
    } else if (kind === "resistor") {
      const ohms = typeof props.ohms === "number" ? props.ohms : parseOhms(props.ohms ?? "");
      if (ohms > 0) out.ohms = ohms;
    }
    return Object.keys(out).length ? out : void 0;
  }
  function displayName(base, props) {
    const kind = editableKind(base);
    if (kind === "resistor" && props.ohms != null) return `\uC800\uD56D ${formatOhms(props.ohms)}`;
    if (kind === "led" && props.color) {
      const c = LED_COLORS.find((x) => x.hex === props.color);
      return `${c ? `${c.label} LED` : "LED (\uC9C1\uC811 \uACE0\uB978 \uC0C9)"}${/5mm/.test(base.name) ? " (5mm)" : ""}`;
    }
    return base.name;
  }
  var BAND = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "gray", "white"];
  var BAND_HEX = {
    black: "#1a1a1a",
    brown: "#7b4a23",
    red: "#d0312d",
    orange: "#f07f13",
    yellow: "#f2c200",
    green: "#2e9e4f",
    blue: "#2563eb",
    violet: "#7c3aed",
    gray: "#8a8a8a",
    white: "#f5f5f5",
    gold: "#c9a43a"
  };
  function resistorBands(ohms) {
    if (!(ohms >= 1)) return ["black", "black", "black", "gold"];
    let exp = Math.max(-1, Math.floor(Math.log10(ohms)) - 1);
    let v = Math.round(ohms / 10 ** exp);
    if (v >= 100) {
      v = Math.round(v / 10);
      exp++;
    }
    const digits = String(v).padStart(2, "0");
    return [BAND[+digits[0]], BAND[+digits[1]], exp < 0 ? "gold" : BAND[exp] || "white", "gold"];
  }
  var SVG_PREFIX = "data:image/svg+xml;base64,";
  function editSvg(dataUrl, fn) {
    if (!dataUrl?.startsWith(SVG_PREFIX)) return dataUrl;
    const bin = atob(dataUrl.slice(SVG_PREFIX.length));
    const text2 = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const bytes = new TextEncoder().encode(fn(text2));
    let out = "";
    for (const b of bytes) out += String.fromCharCode(b);
    return SVG_PREFIX + btoa(out);
  }
  function toHsl(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }
  function toHex([h, s, l]) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }
  var clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function recolorLed(svg, fromHex, toHexColor) {
    const [fh, fs, fl] = toHsl(fromHex);
    const [th, ts, tl] = toHsl(toHexColor);
    return svg.replace(/#[0-9a-f]{6}\b/gi, (hex) => {
      const [h, s, l] = toHsl(hex);
      const dh = Math.min(Math.abs(h - fh), 360 - Math.abs(h - fh));
      if (s < 0.3 || dh > 40) return hex;
      return toHex([th, clamp(ts * (s / (fs || 1)), 0, 1), clamp(l + (tl - fl), 0.05, 0.97)]);
    });
  }
  function recolorBands(svg, ohms) {
    const bands = resistorBands(ohms).map((c) => BAND_HEX[c]);
    let k = 0;
    return svg.replace(/<rect\b[^>]*>/g, (tag) => {
      const num = (a) => parseFloat((tag.match(new RegExp(`\\s${a}="([\\d.]+)"`)) || [])[1]);
      const w = num("width"), h = num("height");
      if (!(w > 0 && h >= w * 2.5) || k >= bands.length) return tag;
      const c = bands[k++];
      return /\sfill="[^"]*"/.test(tag) ? tag.replace(/\sfill="[^"]*"/, ` fill="${c}"`) : tag.replace("<rect", `<rect fill="${c}"`);
    });
  }
  function recolorImage(base, props) {
    if (!base.imageData) return void 0;
    if (props.color && base.behavior.color) return editSvg(base.imageData, (s) => recolorLed(s, base.behavior.color, props.color));
    if (props.ohms != null) return editSvg(base.imageData, (s) => recolorBands(s, props.ohms));
    return base.imageData;
  }
  var cache = /* @__PURE__ */ new WeakMap();
  function defFor(defs, inst) {
    const base = inst && defs.get(inst.part);
    if (!base || !inst.props || !editableKind(base)) return base;
    const key2 = JSON.stringify(inst.props);
    let byKey = cache.get(base);
    if (!byKey) cache.set(base, byKey = /* @__PURE__ */ new Map());
    if (!byKey.has(key2)) {
      byKey.set(key2, {
        ...base,
        name: displayName(base, inst.props),
        behavior: { ...base.behavior, ...inst.props },
        ...base.imageData ? { imageData: recolorImage(base, inst.props) } : {}
      });
    }
    return byKey.get(key2);
  }

  // assets/sim.js
  var UnionFind = class {
    constructor() {
      this.p = /* @__PURE__ */ new Map();
    }
    find(x) {
      if (!this.p.has(x)) this.p.set(x, x);
      let r = x;
      while (this.p.get(r) !== r) r = this.p.get(r);
      this.p.set(x, r);
      return r;
    }
    union(a, b) {
      this.p.set(this.find(a), this.find(b));
    }
  };
  var pinKey = (ref, pin) => `${ref}.${pin}`;
  function splitKey(key2) {
    const i = key2.indexOf(".");
    return [key2.slice(0, i), key2.slice(i + 1)];
  }
  function resolvePinVoltage(pinDef, ref, def2, netVoltage) {
    if (typeof pinDef.voltage === "number") return pinDef.voltage;
    if (pinDef.voltage === "VCC" && def2.behavior?.vcc) return netVoltage(pinKey(ref, def2.behavior.vcc));
    return null;
  }
  function simulate({ instances, wires, defs, gpio = {}, pressed = /* @__PURE__ */ new Set() }) {
    const inst = instances.filter((i) => defFor(defs, i));
    const relayState = {};
    let result = null;
    for (let iter = 0; iter < 6; iter++) {
      result = solve({ inst, wires, defs, gpio, pressed, relayState });
      let changed = false;
      for (const i of inst) {
        const def2 = defFor(defs, i);
        if (def2.behavior?.kind !== "relay") continue;
        const on = result.parts[i.ref].energized;
        if ((relayState[i.ref] || false) !== on) {
          relayState[i.ref] = on;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return result;
  }
  function solve({ inst, wires, defs, gpio, pressed, relayState }) {
    const uf = new UnionFind();
    const allPins = [];
    for (const i of inst) {
      const def2 = defFor(defs, i);
      for (const p of def2.pins) {
        const k = pinKey(i.ref, p.id);
        uf.find(k);
        allPins.push([k, i, def2, p]);
      }
      for (const group of def2.internalNets || []) {
        for (let n = 1; n < group.length; n++) uf.union(pinKey(i.ref, group[0]), pinKey(i.ref, group[n]));
      }
      const b = def2.behavior || {};
      if (b.kind === "button" && pressed.has(i.ref)) uf.union(pinKey(i.ref, b.a), pinKey(i.ref, b.b));
      if (b.kind === "relay") {
        const target = relayState[i.ref] ? b.no : b.nc;
        uf.union(pinKey(i.ref, b.com), pinKey(i.ref, target));
      }
    }
    for (const w of wires) {
      if (uf.p.has(w.from) && uf.p.has(w.to)) uf.union(w.from, w.to);
    }
    const nets = /* @__PURE__ */ new Map();
    const net = (k) => {
      const id = uf.find(k);
      if (!nets.has(id)) nets.set(id, { id, pins: [], sources: [], voltage: null, kind: null, short: false, limited: false });
      return nets.get(id);
    };
    for (const [k] of allPins) net(k).pins.push(k);
    const addSource = (k, v, strength, label) => net(k).sources.push({ v, strength, label, pin: k });
    for (const [k, i, def2, p] of allPins) {
      const kind = def2.behavior?.kind;
      if (p.type === "power_out" && (kind === "board" || kind === "supply")) addSource(k, p.voltage, "power", k);
      if (p.type === "gnd" && (kind === "board" || kind === "supply")) addSource(k, 0, "power", k);
      if (kind === "board" && p.type === "gpio" && gpio[k]) {
        addSource(k, gpio[k] === "HIGH" ? p.voltage : 0, "drive", `${k} ${gpio[k]}`);
      }
    }
    const finalize = () => {
      for (const n of nets.values()) {
        const strong = n.sources.filter((s) => s.strength !== "pullup");
        const pool = strong.length ? strong : n.sources;
        const volts = [...new Set(pool.map((s) => s.v))];
        n.short = strong.length > 1 && volts.length > 1;
        n.voltage = volts.length ? Math.max(...volts) : n.voltage;
        if (n.sources.some((s) => s.strength === "power" && s.v === 0) && !n.short) n.kind = "gnd";
        else if (n.voltage != null) n.kind = n.sources.some((s) => s.strength === "power") ? "power" : "signal";
      }
    };
    finalize();
    const netOf = (k) => net(k);
    const vOf = (k) => net(k).voltage;
    const isGround = (k) => net(k).kind === "gnd" || net(k).voltage === 0 && net(k).sources.length > 0;
    const parts = {};
    for (const i of inst) {
      const def2 = defFor(defs, i);
      const b = def2.behavior || {};
      if (b.kind === "sensor" || b.kind === "i2c-device") {
        const vcc = vOf(pinKey(i.ref, b.vcc));
        const vccPin = def2.pins.find((p) => p.id === b.vcc);
        const powered = vcc != null && vcc >= (vccPin?.minVoltage ?? 0.1) && isGround(pinKey(i.ref, b.gnd));
        parts[i.ref] = { powered, vcc };
        if (powered) {
          for (const p of def2.pins) {
            if (p.voltage === "VCC" || typeof p.voltage === "number" && p.type === "output") {
              addSource(pinKey(i.ref, p.id), resolvePinVoltage(p, i.ref, def2, vOf), "pullup", `${i.ref}.${p.id} \uD480\uC5C5`);
            }
          }
        }
      }
    }
    finalize();
    for (let pass = 0; pass < 6; pass++) {
      for (const i of inst) {
        const def2 = defFor(defs, i);
        if (def2.behavior?.kind !== "resistor") continue;
        const [a, b] = def2.pins.map((p) => net(pinKey(i.ref, p.id)));
        for (const [from, to] of [[a, b], [b, a]]) {
          if (from.voltage != null && to.voltage == null && !to.sources.length) {
            to.voltage = from.voltage;
            to.limited = true;
            to.kind = from.kind === "gnd" ? "gnd" : "signal";
            to.via = `${i.ref}(${def2.behavior.ohms}\u03A9) \uACBD\uC720`;
          }
        }
      }
    }
    for (const i of inst) {
      const def2 = defFor(defs, i);
      const b = def2.behavior || {};
      const st = parts[i.ref] || {};
      if (b.kind === "board" || b.kind === "supply") st.powered = true;
      if (b.kind === "led" || b.kind === "diode") {
        const A = net(pinKey(i.ref, b.anode));
        const K = net(pinKey(i.ref, b.cathode));
        const forward = A.voltage != null && K.voltage != null ? A.voltage - K.voltage : null;
        const limited = A.limited || K.limited;
        if (b.kind === "led") {
          st.lit = forward != null && forward >= (b.forwardVoltage || 2) * 0.9;
          st.burnt = st.lit && !limited && forward > (b.forwardVoltage || 2) + 0.3;
        } else {
          st.conducting = forward != null && forward > 0.6;
          st.shorting = st.conducting && !limited && A.kind === "power" && K.kind === "gnd";
        }
      }
      if (b.kind === "relay") {
        const vcc = vOf(pinKey(i.ref, b.vcc));
        const vin = vOf(pinKey(i.ref, b.in));
        const vccPin = def2.pins.find((p) => p.id === b.vcc);
        st.powered = vcc != null && vcc >= (vccPin?.minVoltage ?? 4) * 0.8 && isGround(pinKey(i.ref, b.gnd));
        const trig = b.trigger === "low" ? vin != null && vin < 0.8 : vin != null && vin >= (b.minTrigger ?? 2.5);
        st.energized = st.powered && trig;
      }
      if (b.kind === "load") {
        const vp = vOf(pinKey(i.ref, b.plus));
        const vm = vOf(pinKey(i.ref, b.minus));
        const diff = vp != null && vm != null ? vp - vm : null;
        st.voltage = diff;
        st.on = diff != null && diff >= (b.ratedVoltage || 5) * 0.75;
        st.weak = diff != null && diff > 0.5 && !st.on;
        st.reversed = diff != null && diff < -0.5;
      }
      if (b.kind === "i2c-device" && st.powered) {
        const busOk = (pin, fn) => net(pinKey(i.ref, pin)).pins.some((k) => {
          const [r, pid] = splitKey(k);
          const d = defs.get(inst.find((x) => x.ref === r)?.part);
          if (d?.behavior?.kind !== "board") return false;
          return (d.pins.find((p) => p.id === pid)?.functions || []).some((f) => f.includes(fn));
        });
        st.linked = busOk(b.sda, "SDA") && busOk(b.scl, "SCL");
      }
      if (b.kind === "button") st.pressed = pressed.has(i.ref);
      parts[i.ref] = st;
    }
    const netByPin = {};
    for (const [k] of allPins) netByPin[k] = net(k);
    return { netByPin, nets: [...nets.values()], parts };
  }

  // assets/art.js
  var NS = "http://www.w3.org/2000/svg";
  var el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  };
  var text = (parent, x, y, s, cls, anchor = "middle") => {
    el("text", { x, y, "text-anchor": anchor, class: cls }, parent).textContent = s;
  };
  function lookOf(def2) {
    if (def2.look) return def2.look;
    const kind = def2.behavior?.kind;
    const id = def2.id;
    if (kind === "board") return /raspberry|rpi/.test(id) ? "rpi" : /esp32/.test(id) ? "esp32" : "board";
    if (kind === "led" || kind === "resistor" || kind === "diode" || kind === "button" || kind === "relay") return kind;
    if (kind === "load") return "valve";
    if (kind === "supply") return "adapter";
    if (kind === "i2c-device") return def2.behavior.display ? "oled" : "chip-module";
    if (kind === "sensor") return /dht/.test(id) ? "dht" : "module";
    return "module";
  }
  var BARE = /* @__PURE__ */ new Set(["led", "resistor", "diode", "button", "valve", "adapter"]);
  function isBareArt(def2) {
    return Array.isArray(def2.imageNodes) ? def2.imagePresentation?.kind === "bare" : BARE.has(lookOf(def2)) && !def2.imageData;
  }
  function labelInset(look) {
    return look === "relay" ? { left: 0, right: -20 } : { left: 0, right: 0 };
  }
  function drawArt(g, ctx) {
    const { def: def2 } = ctx;
    if (Array.isArray(def2.imageNodes) && drawGeneratedArt(g, ctx)) return;
    if (def2.imageData) return drawImage(g, ctx);
    const look = lookOf(def2);
    const art = el("g", { class: `art art-${look}` }, g);
    (DRAW[look] || DRAW.module)(art, ctx);
  }
  var GENERATED_TAGS = /* @__PURE__ */ new Set(["g", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "text"]);
  var GENERATED_ATTRS = /* @__PURE__ */ new Set([
    "x",
    "y",
    "width",
    "height",
    "rx",
    "ry",
    "cx",
    "cy",
    "r",
    "x1",
    "y1",
    "x2",
    "y2",
    "points",
    "d",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "transform",
    "fill-rule",
    "class",
    "text-anchor",
    "font-family",
    "font-size",
    "font-weight"
  ]);
  function drawGeneratedArt(g, ctx) {
    const { def: def2, st = {}, power = false } = ctx;
    let count = 0;
    const valid = (node, depth = 0) => {
      if (++count > 1200 || depth > 36 || !GENERATED_TAGS.has(node?.tag) || !Array.isArray(node.children)) return false;
      if (typeof node.text !== "string" || (node.tag === "text" ? node.text.length > 80 || node.children.length : node.text.trim())) return false;
      for (const [key2, value] of Object.entries(node.attrs || {})) {
        if (!GENERATED_ATTRS.has(key2) || typeof value !== "string" || value.length > 4e4 || /[<>]|url\s*\(|javascript:|https?:/i.test(value)) return false;
      }
      return node.children.every((child) => valid(child, depth + 1));
    };
    if (!def2.imageNodes.every((node) => valid(node))) return false;
    const art = el("g", { class: "art art-generated" }, g);
    const active = power && !!(st.on || st.lit || st.energized || st.pressed);
    const powered = power && !!(st.powered || st.on || st.lit || st.energized);
    let band = 0;
    const bands = Number.isFinite(def2.behavior?.ohms) && def2.behavior.ohms > 0 ? resistorBands2(def2.behavior.ohms) : null;
    const append = (node, parent) => {
      const attrs = { ...node.attrs };
      const classes = new Set((attrs.class || "").split(/\s+/).filter(Boolean));
      if (classes.has("state-on") && !active || classes.has("state-off") && active || classes.has("state-powered") && !powered || classes.has("state-unpowered") && powered) return;
      if (classes.has("led-dome") && power && st.lit) classes.add("lit");
      if (classes.has("pipe") && power && st.on) classes.add("flow");
      if (classes.has("tact-cap") && st.pressed) classes.add("pressed");
      if (classes.has("resistor-band") && bands && band < 4) {
        for (const cls of classes) if (cls.startsWith("band-")) classes.delete(cls);
        classes.add("band-" + bands[band++]);
      }
      if (classes.size) attrs.class = [...classes].join(" ");
      const element = el(node.tag, attrs, parent);
      if (node.tag === "text") element.textContent = node.text;
      for (const child of node.children) append(child, element);
    };
    for (const node of def2.imageNodes) append(node, art);
    return true;
  }
  function drawImage(g, { w, h, def: def2 }) {
    el("image", { href: def2.imageData, x: 0, y: 0, width: w, height: h, preserveAspectRatio: def2.imageFit || "none", class: "art-image" }, g);
  }
  function pcbDetails(g, { w, h }) {
    el("rect", { x: 4, y: 4, width: w - 8, height: h - 8, rx: 5, class: "silk" }, g);
    for (const [x, y] of [[9, 9], [w - 9, 9], [9, h - 9], [w - 9, h - 9]]) el("circle", { cx: x, cy: y, r: 3, class: "hole" }, g);
  }
  function pads(g, { pos }) {
    for (const p of Object.values(pos)) el("rect", { x: p.x - 5, y: p.y - 5, width: 10, height: 10, rx: 2, class: "pad" }, g);
  }
  function headerStrip(g, { pos, h }, side, x) {
    const ys = Object.values(pos).filter((p) => p.side === side).map((p) => p.y);
    if (!ys.length) return;
    el("rect", { x, y: Math.min(...ys) - 9, width: 12, height: Math.max(...ys) - Math.min(...ys) + 18, rx: 2, class: "header" }, g);
  }
  function lead(g, x1, y1, x2, y2) {
    el("line", { x1, y1, x2, y2, class: "lead" }, g);
  }
  function twoLeads(g, { pos, w }, bodyHalf) {
    const ps = Object.values(pos);
    const y = ps[0]?.y ?? 39;
    lead(g, 0, y, w / 2 - bodyHalf, y);
    lead(g, w / 2 + bodyHalf, y, w, y);
    return y;
  }
  var BAND2 = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "gray", "white"];
  function resistorBands2(ohms) {
    let exp = 0;
    let v = Math.round(ohms);
    while (v >= 100) {
      v = Math.round(v / 10);
      exp++;
    }
    const digits = String(v).padStart(2, "0");
    return [BAND2[+digits[0]], BAND2[+digits[1]], BAND2[exp] || "black", "gold"];
  }
  var DRAW = {
    esp32(g, ctx) {
      const { w, h } = ctx;
      pcbDetails(g, ctx);
      headerStrip(g, ctx, "left", -6);
      headerStrip(g, ctx, "right", w - 6);
      pads(g, ctx);
      const mx = 54, mw = w - 108;
      el("rect", { x: mx, y: 30, width: mw, height: 140, rx: 3, class: "module-pcb" }, g);
      el("path", { d: `M${mx + 8} 40 h${mw - 16} v8 h-${mw - 24} v8 h${mw - 24} v8 h-${mw - 16}`, class: "antenna" }, g);
      el("rect", { x: mx + 4, y: 72, width: mw - 8, height: 92, rx: 2, class: "shield" }, g);
      text(g, w / 2, 112, "ESP32", "art-text strong dark");
      text(g, w / 2, 126, "WROOM-32", "art-text dark");
      el("rect", { x: w / 2 - 12, y: h - 120, width: 24, height: 16, rx: 1, class: "ic" }, g);
      for (const [x, label] of [[mx + 6, "EN"], [w - mx - 22, "BOOT"]]) {
        el("rect", { x, y: h - 70, width: 16, height: 16, rx: 2, class: "tact" }, g);
        el("circle", { cx: x + 8, cy: h - 62, r: 4, class: "tact-cap" }, g);
        text(g, x + 8, h - 46, label, "art-text tiny");
      }
      el("rect", { x: w / 2 - 14, y: h - 18, width: 28, height: 22, rx: 3, class: "metal" }, g);
      el("rect", { x: w / 2 - 9, y: h - 4, width: 18, height: 5, rx: 1, class: "metal-dark" }, g);
    },
    rpi(g, ctx) {
      const { w, h } = ctx;
      pcbDetails(g, ctx);
      headerStrip(g, ctx, "left", -6);
      headerStrip(g, ctx, "right", w - 6);
      pads(g, ctx);
      const cx = w / 2;
      el("rect", { x: cx - 26, y: 70, width: 52, height: 52, rx: 3, class: "metal" }, g);
      text(g, cx, 100, "BCM2711", "art-text dark tiny");
      el("rect", { x: cx - 22, y: 140, width: 44, height: 30, rx: 2, class: "ic" }, g);
      text(g, cx, 159, "RAM", "art-text tiny");
      text(g, cx, 210, "Raspberry Pi 4", "art-text");
      const portY = h - 70;
      for (let k = 0; k < 3; k++) el("rect", { x: cx - 30, y: portY - k * 46, width: 60, height: 38, rx: 2, class: k === 0 ? "metal" : "metal-dark" }, g);
      text(g, cx, portY + 23, "LAN", "art-text dark tiny");
      text(g, cx, portY - 23, "USB", "art-text tiny");
      text(g, cx, portY - 69, "USB", "art-text tiny");
    },
    board(g, ctx) {
      const { w, h } = ctx;
      pcbDetails(g, ctx);
      pads(g, ctx);
      el("rect", { x: w / 2 - 22, y: h / 2 - 22, width: 44, height: 44, rx: 2, class: "ic" }, g);
    },
    module(g, ctx) {
      const { w, h } = ctx;
      pcbDetails(g, ctx);
      pads(g, ctx);
      el("rect", { x: w / 2 - 10, y: h / 2 - 2, width: 28, height: 18, rx: 2, class: "ic" }, g);
    },
    "chip-module"(g, ctx) {
      const { w, h, top: top2 } = ctx;
      pcbDetails(g, ctx);
      pads(g, ctx);
      const cx = w / 2 + 16, cy = top2 + 30 + (h - top2 - 30) / 2 - 6;
      el("rect", { x: cx - 12, y: cy - 12, width: 24, height: 24, rx: 2, class: "metal" }, g);
      el("circle", { cx: cx + 6, cy: cy - 6, r: 2, class: "hole" }, g);
      text(g, cx, cy + 26, def(ctx).name.split(" ")[0], "art-text tiny");
    },
    oled(g, ctx) {
      pcbDetails(g, ctx);
      pads(g, ctx);
    },
    dht(g, ctx) {
      const { w, h } = ctx;
      pcbDetails(g, ctx);
      pads(g, ctx);
      const x = 56, y = 26, hw = w - 70, hh = h - 44;
      el("rect", { x, y, width: hw, height: hh, rx: 4, class: "housing" }, g);
      for (let gy = y + 8; gy < y + hh - 6; gy += 7) {
        for (let gx = x + 8; gx < x + hw - 6; gx += 9) el("rect", { x: gx, y: gy, width: 5, height: 3, rx: 1, class: "grille" }, g);
      }
    },
    relay(g, ctx) {
      const { w, h } = ctx;
      pcbDetails(g, ctx);
      pads(g, ctx);
      el("rect", { x: 60, y: 30, width: w - 108, height: h - 44, rx: 3, class: "relay-box" }, g);
      text(g, 60 + (w - 108) / 2, h / 2 + 4, "SRD-05VDC", "art-text tiny");
      const ys = Object.values(ctx.pos).filter((p) => p.side === "right").map((p) => p.y);
      if (ys.length) {
        el("rect", { x: w - 22, y: Math.min(...ys) - 9, width: 20, height: Math.max(...ys) - Math.min(...ys) + 18, rx: 2, class: "terminal" }, g);
        for (const y of ys) {
          el("circle", { cx: w - 12, cy: y, r: 5, class: "screw" }, g);
          el("line", { x1: w - 15, y1: y - 3, x2: w - 9, y2: y + 3, class: "screw-slot" }, g);
        }
      }
    },
    led(g, ctx) {
      const { w, st } = ctx;
      const y = twoLeads(g, ctx, 12);
      const color = def(ctx).behavior?.color;
      el("path", { d: `M${w / 2 - 12} ${y + 8} v-10 a12 12 0 0 1 24 0 v10 z`, class: `led-dome ${st.lit ? "lit" : ""}`, style: color ? `--led:${color}` : null, filter: st.lit ? "url(#glow)" : null }, g);
      el("rect", { x: w / 2 - 14, y: y + 8, width: 28, height: 4, rx: 1, class: `led-dome rim ${st.lit ? "lit" : ""}`, style: color ? `--led:${color}` : null }, g);
    },
    resistor(g, ctx) {
      const { w } = ctx;
      const y = twoLeads(g, ctx, 22);
      el("rect", { x: w / 2 - 22, y: y - 7, width: 44, height: 14, rx: 7, class: "resistor-body" }, g);
      resistorBands2(def(ctx).behavior?.ohms || 0).forEach((c, k) => {
        el("rect", { x: w / 2 - 14 + k * 8 + (k === 3 ? 4 : 0), y: y - 7, width: 4, height: 14, class: `band band-${c}` }, g);
      });
    },
    diode(g, ctx) {
      const { w } = ctx;
      const y = twoLeads(g, ctx, 18);
      el("rect", { x: w / 2 - 18, y: y - 6, width: 36, height: 12, rx: 3, class: "diode-body" }, g);
      el("rect", { x: w / 2 + 8, y: y - 6, width: 5, height: 12, class: "diode-band" }, g);
    },
    button(g, ctx) {
      const { w, st } = ctx;
      const y = twoLeads(g, ctx, 14);
      el("rect", { x: w / 2 - 14, y: y - 14, width: 28, height: 28, rx: 3, class: "tact" }, g);
      el("circle", { cx: w / 2, cy: y, r: 8, class: `tact-cap ${st.pressed ? "pressed" : ""}` }, g);
    },
    valve(g, ctx) {
      const { w, h, pos, st } = ctx;
      const ps = Object.values(pos);
      const cx = 44, cw = w - 64;
      ps.forEach((p, k) => el("path", { d: `M0 ${p.y} C24 ${p.y} 24 ${40 + k * 10} ${cx} ${40 + k * 10}`, class: `cable ${k === 0 ? "cable-red" : "cable-black"}` }, g));
      el("rect", { x: cx, y: 24, width: cw, height: h - 72, rx: 4, class: "coil" }, g);
      el("rect", { x: cx, y: 30, width: cw, height: 4, class: "coil-band" }, g);
      text(g, cx + cw / 2, 24 + (h - 72) / 2 + 6, "DC 12V", "art-text tiny");
      el("rect", { x: cx - 8, y: h - 48, width: cw + 16, height: 16, rx: 2, class: "brass" }, g);
      el("rect", { x: cx + cw + 8, y: h - 45, width: 12, height: 10, class: `pipe ${st.on ? "flow" : ""}` }, g);
    },
    adapter(g, ctx) {
      const { w, h, pos } = ctx;
      const ps = Object.values(pos);
      const bx = 46, bw = w - 56;
      ps.forEach((p, k) => el("path", { d: `M0 ${p.y} C22 ${p.y} 22 ${h / 2 + (k - 0.5) * 8} ${bx} ${h / 2 + (k - 0.5) * 8}`, class: `cable ${k === 0 ? "cable-red" : "cable-black"}` }, g));
      el("rect", { x: bx, y: 24, width: bw, height: h - 48, rx: 6, class: "brick" }, g);
      text(g, bx + bw / 2, 24 + (h - 48) / 2 + 3, "12V \u2393 2A", "art-text");
      el("circle", { cx: bx + bw - 10, cy: 36, r: 3, class: ctx.power ? "indicator-ok" : "indicator-off" }, g);
    }
  };
  var def = (ctx) => ctx.def;

  // assets/wire-router.js
  var EPS = 1e-7;
  var DIR = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
  var ROUTING_DEFAULTS = Object.freeze({
    clearance: 12,
    stub: 24,
    laneGap: 8,
    bendPenalty: 24,
    overlapPenalty: 3,
    crossingPenalty: 16,
    maxVisited: 3e4
  });
  var distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  var same = (a, b) => distance(a, b) < EPS;
  var inside = (p, r) => p.x > r.left + EPS && p.x < r.right - EPS && p.y > r.top + EPS && p.y < r.bottom - EPS;
  function segmentBlocked(a, b, boxes) {
    return boxes.some((r) => {
      if (Math.abs(a.y - b.y) < EPS) return a.y > r.top + EPS && a.y < r.bottom - EPS && Math.max(a.x, b.x) > r.left + EPS && Math.min(a.x, b.x) < r.right - EPS;
      if (Math.abs(a.x - b.x) < EPS) return a.x > r.left + EPS && a.x < r.right - EPS && Math.max(a.y, b.y) > r.top + EPS && Math.min(a.y, b.y) < r.bottom - EPS;
      return true;
    });
  }
  function simplifyPoints(points) {
    const result = [];
    for (const p of points) {
      if (result.length && same(result[result.length - 1], p)) continue;
      while (result.length >= 2) {
        const a = result[result.length - 2], b = result[result.length - 1];
        const horizontal = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - p.y) < EPS;
        const vertical = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - p.x) < EPS;
        if (!(horizontal || vertical) || (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < -EPS) break;
        result.pop();
      }
      result.push({ x: p.x, y: p.y });
    }
    return result;
  }
  function indexSegments(segments) {
    const horizontal = /* @__PURE__ */ new Map(), vertical = /* @__PURE__ */ new Map();
    for (const [a, b] of segments) {
      const h = Math.abs(a.y - b.y) < EPS, map = h ? horizontal : vertical;
      const key2 = h ? a.y : a.x;
      if (!map.has(key2)) map.set(key2, []);
      const p = h ? a.x : a.y, q = h ? b.x : b.y;
      map.get(key2).push([Math.min(p, q), Math.max(p, q)]);
    }
    return { horizontal, vertical, x: [...vertical.keys()].sort((a, b) => a - b), y: [...horizontal.keys()].sort((a, b) => a - b) };
  }
  function lowerBound(values, target) {
    let lo = 0, hi = values.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (values[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function congestion(a, b, index, options) {
    let cost = 0;
    const horizontal = Math.abs(a.y - b.y) < EPS;
    const fixed = horizontal ? a.y : a.x, from = horizontal ? a.x : a.y, to = horizontal ? b.x : b.y;
    const lo = Math.min(from, to), hi = Math.max(from, to);
    const parallel = horizontal ? index.horizontal : index.vertical;
    for (const [axis, segments] of parallel) {
      if (Math.abs(axis - fixed) >= options.laneGap - EPS) continue;
      for (const [p, q] of segments) {
        const overlap = Math.max(0, Math.min(hi, q) - Math.max(lo, p));
        if (overlap > EPS) cost += overlap * options.overlapPenalty * 1e3;
      }
    }
    const keys = horizontal ? index.x : index.y, perpendicular = horizontal ? index.vertical : index.horizontal;
    for (let i = lowerBound(keys, lo - EPS); i < keys.length && keys[i] <= hi + EPS; i++) {
      for (const [p, q] of perpendicular.get(keys[i])) if (fixed > p + EPS && fixed < q - EPS) cost += options.crossingPenalty * (Math.abs(keys[i] - lo) < EPS || Math.abs(keys[i] - hi) < EPS ? 0.5 : 1);
    }
    return cost;
  }
  var MinHeap = class {
    constructor() {
      this.items = [];
      this.sequence = 0;
    }
    push(state2, score, g) {
      const item = { state: state2, score, g, order: this.sequence++ }, a = this.items;
      a.push(item);
      let i = a.length - 1;
      while (i) {
        const parent = i - 1 >> 1;
        if (!this.less(item, a[parent])) break;
        a[i] = a[parent];
        i = parent;
      }
      a[i] = item;
    }
    less(a, b) {
      return a.score < b.score || a.score === b.score && a.order < b.order;
    }
    pop() {
      const a = this.items, first = a[0], last = a.pop();
      if (a.length) {
        let i = 0;
        while (i * 2 + 1 < a.length) {
          let child = i * 2 + 1;
          if (child + 1 < a.length && this.less(a[child + 1], a[child])) child++;
          if (!this.less(a[child], last)) break;
          a[i] = a[child];
          i = child;
        }
        a[i] = last;
      }
      return first;
    }
  };
  function escapePin(pin, boxes, options) {
    const dir = DIR[pin.side] || [0, 0];
    if (!dir[0] && !dir[1]) return { point: { x: pin.x, y: pin.y }, dir };
    let length = options.stub;
    for (const box of boxes) {
      if (pin.owner != null && box.id === pin.owner) continue;
      if (inside(pin, box)) return null;
      let gap = Infinity;
      if (dir[0] && pin.y > box.top + EPS && pin.y < box.bottom - EPS) {
        if (dir[0] > 0 && box.left >= pin.x) gap = box.left - pin.x;
        if (dir[0] < 0 && box.right <= pin.x) gap = pin.x - box.right;
      }
      if (dir[1] && pin.x > box.left + EPS && pin.x < box.right - EPS) {
        if (dir[1] > 0 && box.top >= pin.y) gap = box.top - pin.y;
        if (dir[1] < 0 && box.bottom <= pin.y) gap = pin.y - box.bottom;
      }
      length = Math.min(length, gap - 1);
    }
    if (length <= options.clearance + EPS) return null;
    return { point: { x: pin.x + dir[0] * length, y: pin.y + dir[1] * length }, dir };
  }
  function search(start, end, boxes, previous, options, lane) {
    const xs = /* @__PURE__ */ new Set([start.point.x, end.point.x, (start.point.x + end.point.x) / 2]);
    const ys = /* @__PURE__ */ new Set([start.point.y, end.point.y, (start.point.y + end.point.y) / 2]);
    for (const b of boxes) {
      xs.add(b.left);
      xs.add(b.right);
      xs.add(b.left - lane);
      xs.add(b.right + lane);
      ys.add(b.top);
      ys.add(b.bottom);
      ys.add(b.top - lane);
      ys.add(b.bottom + lane);
    }
    for (const [axis, segments] of previous.horizontal) {
      ys.add(axis - options.laneGap);
      ys.add(axis + options.laneGap);
      for (const [p, q] of segments) {
        xs.add(p - options.laneGap);
        xs.add(q + options.laneGap);
      }
    }
    for (const [axis, segments] of previous.vertical) {
      xs.add(axis - options.laneGap);
      xs.add(axis + options.laneGap);
      for (const [p, q] of segments) {
        ys.add(p - options.laneGap);
        ys.add(q + options.laneGap);
      }
    }
    const margin = options.stub + options.laneGap;
    xs.add(Math.min(...xs) - margin);
    xs.add(Math.max(...xs) + margin);
    ys.add(Math.min(...ys) - margin);
    ys.add(Math.max(...ys) + margin);
    const x = [...xs].sort((a, b) => a - b), y = [...ys].sort((a, b) => a - b);
    const nx = x.length, count = nx * y.length;
    if (count > 2e5 || options.maxVisited <= 0) return null;
    const point = (id) => ({ x: x[id % nx], y: y[Math.floor(id / nx)] });
    const startId = y.indexOf(start.point.y) * nx + x.indexOf(start.point.x);
    const endId = y.indexOf(end.point.y) * nx + x.indexOf(end.point.x);
    if (boxes.some((b) => inside(start.point, b) || inside(end.point, b))) return null;
    const blocked = /* @__PURE__ */ new Map();
    const isBlocked = (id) => {
      if (!blocked.has(id)) blocked.set(id, boxes.some((b) => inside(point(id), b)));
      return blocked.get(id);
    };
    const costs = new Float64Array(count * 3);
    costs.fill(Infinity);
    const parents = new Int32Array(count * 3);
    parents.fill(-1);
    const heading2 = start.dir[0] ? 1 : start.dir[1] ? 2 : 0;
    const initial = startId * 3 + heading2;
    costs[initial] = 0;
    const queue = new MinHeap();
    queue.push(initial, distance(start.point, end.point), 0);
    let visited = 0;
    while (queue.items.length && visited++ < options.maxVisited) {
      const current = queue.pop();
      if (current.g !== costs[current.state]) continue;
      const id = Math.floor(current.state / 3), incoming = current.state % 3;
      if (id === endId) {
        const result = [];
        for (let s = current.state; s !== -1; s = parents[s]) result.push(point(Math.floor(s / 3)));
        return result.reverse();
      }
      const a = point(id), ix = id % nx, iy = Math.floor(id / nx);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (ix + dx < 0 || ix + dx >= nx || iy + dy < 0 || iy + dy >= y.length) continue;
        const nextId = (iy + dy) * nx + ix + dx;
        if (isBlocked(nextId)) continue;
        if (id === startId && dx * start.dir[0] + dy * start.dir[1] < 0) continue;
        if (nextId === endId && dx * end.dir[0] + dy * end.dir[1] > 0) continue;
        const b = point(nextId);
        if (segmentBlocked(a, b, boxes)) continue;
        const direction = dx ? 1 : 2, nextState = nextId * 3 + direction;
        const turn = incoming && direction !== incoming ? options.bendPenalty : 0;
        const endHeading = end.dir[0] ? 1 : end.dir[1] ? 2 : 0;
        const lastTurn = nextId === endId && endHeading && endHeading !== direction ? options.bendPenalty : 0;
        const g = current.g + distance(a, b) + turn + lastTurn + congestion(a, b, previous, options);
        if (g >= costs[nextState] - EPS) continue;
        costs[nextState] = g;
        parents[nextState] = current.state;
        queue.push(nextState, g + distance(b, end.point), g);
      }
    }
    return null;
  }
  function routeWire(start, end, obstacles = [], previous = [], settings = {}) {
    const options = { ...ROUTING_DEFAULTS, ...settings };
    if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) throw new TypeError("\uD540 \uC88C\uD45C\uB294 \uC720\uD55C\uD55C \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4");
    if (same(start, end)) return { points: [{ x: start.x, y: start.y }], blocked: false };
    const occupied = indexSegments(previous);
    const boxes = obstacles.map((b2) => ({
      id: b2.id,
      left: b2.x - options.clearance,
      right: b2.x + b2.width + options.clearance,
      top: b2.y - options.clearance,
      bottom: b2.y + b2.height + options.clearance
    }));
    const da = DIR[start.side] || [0, 0], db = DIR[end.side] || [0, 0];
    const aligned = Math.abs(start.x - end.x) < EPS || Math.abs(start.y - end.y) < EPS;
    const vx = end.x - start.x, vy = end.y - start.y;
    const outward = (!DIR[start.side] || vx * da[0] + vy * da[1] > 0) && (!DIR[end.side] || vx * db[0] + vy * db[1] < 0);
    const directBoxes = boxes.map((b2, i) => start.owner != null && b2.id === start.owner || end.owner != null && b2.id === end.owner ? {
      ...b2,
      left: obstacles[i].x,
      right: obstacles[i].x + obstacles[i].width,
      top: obstacles[i].y,
      bottom: obstacles[i].y + obstacles[i].height
    } : b2);
    if (aligned && outward && !segmentBlocked(start, end, directBoxes) && !congestion(start, end, occupied, options)) {
      return { points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }], blocked: false };
    }
    const a = escapePin(start, boxes, options), b = escapePin(end, boxes, options);
    if (a && b) {
      const found = search(a, b, boxes, occupied, options, (settings.lane || 0) * options.laneGap);
      if (found) return { points: simplifyPoints([start, ...found, end]), blocked: false };
    }
    const p = a?.point || { x: start.x + da[0] * options.stub, y: start.y + da[1] * options.stub };
    const q = b?.point || { x: end.x + db[0] * options.stub, y: end.y + db[1] * options.stub };
    const candidates = [[start, p, { x: q.x, y: p.y }, q, end], [start, p, { x: p.x, y: q.y }, q, end]].map(simplifyPoints);
    const score = (points) => points.slice(1).reduce((sum, next, i) => sum + distance(points[i], next) + (segmentBlocked(points[i], next, directBoxes) ? 1e6 : 0), 0);
    candidates.sort((p1, p2) => score(p1) - score(p2));
    return { points: candidates[0], blocked: true };
  }
  function routeWires(connections, obstacles, settings = {}) {
    const result = /* @__PURE__ */ new Map(), occupied = [];
    const ordered = [...connections].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    ordered.forEach((wire, index) => {
      const base = routeWire(wire.start, wire.end, obstacles, [], settings);
      let route = occupied.length ? routeWire(wire.start, wire.end, obstacles, occupied, { ...settings, lane: index % 4 }) : base;
      const length = (r) => r.points.slice(1).reduce((sum, p, i) => sum + distance(r.points[i], p), 0);
      if (!base.blocked && (route.blocked || length(route) > length(base) * 1.25 + 16 || route.points.length > base.points.length + 4)) route = { ...base, shared: true };
      result.set(wire.id, route);
      for (let i = 1; i < route.points.length; i++) occupied.push([route.points[i - 1], route.points[i]]);
    });
    return result;
  }
  function pointsToPath(points, radius = 5, cubic = false) {
    const p = simplifyPoints(points);
    if (!p.length) return "";
    let d = `M${p[0].x} ${p[0].y}`;
    for (let i = 1; i < p.length; i++) {
      if (i === p.length - 1 || radius <= 0) {
        d += ` L${p[i].x} ${p[i].y}`;
        continue;
      }
      const before = p[i - 1], at = p[i], after = p[i + 1];
      const r = Math.min(radius, distance(before, at) / 2, distance(at, after) / 2);
      const a = { x: at.x + Math.sign(before.x - at.x) * r, y: at.y + Math.sign(before.y - at.y) * r };
      const b = { x: at.x + Math.sign(after.x - at.x) * r, y: at.y + Math.sign(after.y - at.y) * r };
      d += cubic ? ` L${a.x} ${a.y} C${a.x + (at.x - a.x) * 2 / 3} ${a.y + (at.y - a.y) * 2 / 3} ${b.x + (at.x - b.x) * 2 / 3} ${b.y + (at.y - b.y) * 2 / 3} ${b.x} ${b.y}` : ` L${a.x} ${a.y} Q${at.x} ${at.y} ${b.x} ${b.y}`;
    }
    return d;
  }
  function softAlignedPath(a, b, obstacles = []) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const horizontal = a.side === "right" && b.side === "left" && dx > 0 || a.side === "left" && b.side === "right" && dx < 0;
    const vertical = a.side === "bottom" && b.side === "top" && dy > 0 || a.side === "top" && b.side === "bottom" && dy < 0;
    if (!(horizontal && Math.abs(dy) <= 12 || vertical && Math.abs(dx) <= 12)) return null;
    const c1 = horizontal ? { x: a.x + dx / 3, y: a.y } : { x: a.x, y: a.y + dy / 3 };
    const c2 = horizontal ? { x: b.x - dx / 3, y: b.y } : { x: b.x, y: b.y - dy / 3 };
    for (let i = 1; i < 40; i++) {
      const t = i / 40, u = 1 - t, x = u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y = u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y;
      for (const box of obstacles) {
        const pad = box.id === a.owner || box.id === b.owner ? 0 : 12;
        if (x > box.x - pad + EPS && x < box.x + box.width + pad - EPS && y > box.y - pad + EPS && y < box.y + box.height + pad - EPS) return null;
      }
    }
    return `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
  }

  // assets/canvas.js
  function selectionBounds(start, end) {
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  }
  var NS2 = "http://www.w3.org/2000/svg";
  var PIN_GAP = 18;
  var HEADER = 30;
  var PAD = 10;
  var PART_GAP = 64;
  function pinCaption(pin, limit = 18) {
    const label = pin.label || pin.id;
    const name = label.split(/\s+\(/, 1)[0] || label;
    return name.length > limit ? name.slice(0, limit - 1) + "\u2026" : name;
  }
  var el2 = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS2, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  function layoutPart(def2) {
    if (def2._layout) return def2._layout;
    const by = { left: [], right: [], top: [], bottom: [] };
    for (const p of def2.pins) (by[p.side] || by.left).push(p);
    const isBoard = def2.behavior?.kind === "board";
    const maxLabel = (arr) => Math.max(0, ...arr.map((p) => pinCaption(p).length));
    const sideW = Math.max(maxLabel(by.left), maxLabel(by.right)) * 7 + 14;
    const titleW = Math.min(def2.name.length, 32) * 7.5 + 64;
    const topW = Math.max(by.top.length, by.bottom.length) * 44 + 20;
    const w = Math.max(isBoard ? 170 : 110, by.left.length && by.right.length ? sideW * 2 + 30 : sideW + 50, titleW, topW);
    const rows = Math.max(by.left.length, by.right.length, 1);
    const extraTop = by.top.length ? 18 : 0;
    const h = HEADER + extraTop + rows * PIN_GAP + PAD + (by.bottom.length ? 18 : 0) + (isBoard ? 0 : 18);
    const pos = {};
    by.left.forEach((p, i) => {
      pos[p.id] = { x: 0, y: HEADER + extraTop + i * PIN_GAP + PIN_GAP / 2, side: "left", def: p };
    });
    by.right.forEach((p, i) => {
      pos[p.id] = { x: w, y: HEADER + extraTop + i * PIN_GAP + PIN_GAP / 2, side: "right", def: p };
    });
    const spread = (arr, y, side) => arr.forEach((p, i) => {
      pos[p.id] = { x: w / (arr.length + 1) * (i + 1), y, side, def: p };
    });
    spread(by.top, 0, "top");
    spread(by.bottom, h, "bottom");
    def2._layout = { w, h, pos, top: extraTop };
    return def2._layout;
  }
  function rotationDegrees(angle = 0) {
    return (angle % 360 + 360) % 360;
  }
  function partGeometry(instance, def2) {
    const { w, h } = def2 ? layoutPart(def2) : { w: 140, h: 40 };
    const angle = rotationDegrees(instance.rotation);
    const radians = angle * Math.PI / 180;
    const cos = Math.round(Math.cos(radians) * 1e12) / 1e12;
    const sin = Math.round(Math.sin(radians) * 1e12) / 1e12;
    return { w, h, angle, cos, sin };
  }
  function partBounds(instance, def2) {
    const { w, h, cos, sin } = partGeometry(instance, def2);
    const width = Math.abs(w * cos) + Math.abs(h * sin);
    const height = Math.abs(w * sin) + Math.abs(h * cos);
    return { x: instance.x + (w - width) / 2, y: instance.y + (h - height) / 2, w: width, h: height };
  }
  var pinSides = ["right", "bottom", "left", "top"];
  function separateParts(instances, defs, anchored = [], { gap = PART_GAP, preservePlaced = false } = {}) {
    const bounds = (i) => partBounds(i, defFor(defs, i));
    const occupied = anchored.map(bounds);
    const overlaps = (a, b) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
    const boxes = instances.map(bounds);
    for (const [index, instance] of instances.entries()) {
      const box = boxes[index];
      if (!occupied.some((part) => overlaps(box, part))) {
        occupied.push(box);
        continue;
      }
      const obstacles = preservePlaced ? occupied.concat(boxes.slice(index + 1)) : occupied;
      const clearAlong = (axis, size) => {
        const candidate = { ...box };
        let blockers = obstacles.filter((part) => overlaps(candidate, part));
        while (blockers.length) {
          candidate[axis] = Math.max(...blockers.map((part) => part[axis] + part[size] + gap));
          blockers = obstacles.filter((part) => overlaps(candidate, part));
        }
        return candidate[axis];
      };
      const right = clearAlong("x", "w");
      const down = clearAlong("y", "h");
      if (right - box.x < down - box.y) {
        instance.x += right - box.x;
        box.x = right;
      } else {
        instance.y += down - box.y;
        box.y = down;
      }
      occupied.push(box);
    }
  }
  function wireColor(fromPin, toPin) {
    const types = [fromPin?.type, toPin?.type];
    const fns = [...fromPin?.functions || [], ...toPin?.functions || []].join(" ");
    if (types.includes("gnd")) return "var(--wire-gnd)";
    if (types.includes("power_out") || types.includes("power_in")) return "var(--wire-power)";
    if (types.includes("contact")) return "var(--wire-contact)";
    if (/SDA/.test(fns)) return "var(--wire-sda)";
    if (/SCL/.test(fns)) return "var(--wire-scl)";
    return "var(--wire-signal)";
  }
  var WiringCanvas = class {
    constructor(svg, { getDefs, onChange, onSelect, onPartClick, onPartDoubleClick, tooltip: tooltip2 }) {
      this.svg = svg;
      this.getDefs = getDefs;
      this.onChange = onChange;
      this.onSelect = onSelect;
      this.onPartClick = onPartClick;
      this.onPartDoubleClick = onPartDoubleClick;
      this.tooltip = tooltip2;
      this.view = { x: -40, y: -40, k: 1 };
      this.instances = [];
      this.wires = [];
      this.preview = null;
      this.sim = null;
      this.selected = null;
      this.pending = null;
      this.mouse = { x: 0, y: 0 };
      this.routeCacheKey = null;
      this.wireStyle = "curve";
      this.routingPaths = /* @__PURE__ */ new Map();
      this.routingObstacles = [];
      this.routeWarnings = /* @__PURE__ */ new Set();
      this.drawnParts = /* @__PURE__ */ new Map();
      this.drawnWires = /* @__PURE__ */ new Map();
      this.drawnInstances = /* @__PURE__ */ new Map();
      this.defsLayer = el2("defs", {}, svg);
      this.defsLayer.innerHTML = `
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" style="fill:var(--grid)"/>
      </pattern>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
      this.root = el2("g", {}, svg);
      this.bg = el2("rect", { x: -5e3, y: -5e3, width: 1e4, height: 1e4, fill: "url(#grid)" }, this.root);
      this.wireLayer = el2("g", {}, this.root);
      this.partLayer = el2("g", {}, this.root);
      this.overLayer = el2("g", {}, this.root);
      this.bindEvents();
      this.applyView();
    }
    defOf(ref) {
      const i = this.instances.find((x) => x.ref === ref);
      return i && defFor(this.getDefs(), i);
    }
    pinPos(key2, instances = this.instances) {
      const [ref, pid] = splitKey(key2);
      const i = instances instanceof Map ? instances.get(ref) : instances.find((x) => x.ref === ref);
      const def2 = i && defFor(this.getDefs(), i);
      if (!def2) return null;
      const p = layoutPart(def2).pos[pid];
      if (!p) return null;
      const { w, h, angle, cos, sin } = partGeometry(i, def2);
      const dx = (p.x - w / 2) * (i.mirrored ? -1 : 1), dy = p.y - h / 2;
      const originalSide = pinSides.indexOf(p.side);
      const sideIndex = i.mirrored && originalSide >= 0 && originalSide % 2 === 0 ? (originalSide + 2) % 4 : originalSide;
      const side = sideIndex < 0 ? p.side : pinSides[(sideIndex + Math.round(angle / 90)) % 4];
      return {
        x: i.x + w / 2 + dx * cos - dy * sin,
        y: i.y + h / 2 + dx * sin + dy * cos,
        side,
        owner: ref,
        def: p.def
      };
    }
    applyView() {
      this.root.setAttribute("transform", `translate(${-this.view.x * this.view.k} ${-this.view.y * this.view.k}) scale(${this.view.k})`);
    }
    toWorld(evt) {
      const r = this.svg.getBoundingClientRect();
      return { x: (evt.clientX - r.left) / this.view.k + this.view.x, y: (evt.clientY - r.top) / this.view.k + this.view.y };
    }
    fit() {
      if (!this.instances.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const i of this.instances) {
        const def2 = defFor(this.getDefs(), i);
        if (!def2) continue;
        const { x, y, w, h } = partBounds(i, def2);
        x0 = Math.min(x0, x - 60);
        y0 = Math.min(y0, y - 40);
        x1 = Math.max(x1, x + w + 60);
        y1 = Math.max(y1, y + h + 40);
      }
      const r = this.svg.getBoundingClientRect();
      const k = Math.min(1.4, Math.max(0.3, Math.min(r.width / (x1 - x0), r.height / (y1 - y0))));
      this.view = { k, x: x0 - (r.width / k - (x1 - x0)) / 2, y: y0 - (r.height / k - (y1 - y0)) / 2 };
      this.applyView();
    }
    zoom(f, cx, cy) {
      const r = this.svg.getBoundingClientRect();
      cx ??= r.width / 2;
      cy ??= r.height / 2;
      const wx = cx / this.view.k + this.view.x;
      const wy = cy / this.view.k + this.view.y;
      this.view.k = Math.min(3, Math.max(0.25, this.view.k * f));
      this.view.x = wx - cx / this.view.k;
      this.view.y = wy - cy / this.view.k;
      this.applyView();
    }
    bindEvents() {
      let drag = null;
      let dragFrame = null;
      let lastPartClick = null;
      let armedMarquee = false;
      this.svg.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const target = e.target.closest("[data-kind]");
        const kind = target?.dataset.kind;
        const selectArea = !kind && (e.shiftKey || e.detail === 2 || armedMarquee);
        armedMarquee = false;
        if (kind !== "part") lastPartClick = null;
        if (kind === "pin" || kind === "wire") return;
        if (kind === "part") {
          const ref = target.dataset.ref;
          const inst = this.instances.find((i) => i.ref === ref);
          if (!inst) return;
          const group = this.selected?.type === "group" && this.selected.refs.has(ref);
          const members = group ? this.instances.filter((i) => this.selected.refs.has(i.ref)) : [inst];
          this.draggingPart = ref;
          drag = {
            type: "part",
            inst,
            sx: e.clientX,
            sy: e.clientY,
            members: members.map((i) => ({ inst: i, x: i.x, y: i.y })),
            moved: false,
            snapX: 0,
            snapY: 0
          };
        } else if (selectArea) {
          this.cancelPending();
          const start = this.toWorld(e);
          const rect = el2("rect", { class: "part-marquee" }, this.overLayer);
          drag = { type: "marquee", start, end: start, rect, armedByDoubleClick: e.detail === 2, moved: false };
          this.svg.classList.add("selecting-area");
        } else {
          drag = { type: "pan", sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
        }
      });
      const placeDragMembers = (moving) => {
        for (const member of moving.members) {
          member.inst.x = member.x + moving.snapX;
          member.inst.y = member.y + moving.snapY;
        }
      };
      window.addEventListener("mousemove", (e) => {
        if (!drag || drag.type === "marquee" || this.pending) this.mouse = this.toWorld(e);
        if (this.pending && drag?.type !== "part") this.drawOverlay();
        if (!drag) return;
        if (e.buttons === 0) {
          finishDrag(true);
          return;
        }
        if (drag.type === "marquee") {
          drag.end = this.mouse;
          const { x, y, width, height } = selectionBounds(drag.start, drag.end);
          for (const [key2, value] of Object.entries({ x, y, width, height })) drag.rect.setAttribute(key2, value);
          drag.moved ||= Math.max(width, height) * this.view.k >= 4;
          return;
        }
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        drag.moved ||= Math.hypot(dx, dy) >= 4;
        if (!drag.moved) return;
        if (drag.type === "pan") {
          this.view.x = drag.vx - dx / this.view.k;
          this.view.y = drag.vy - dy / this.view.k;
          this.svg.classList.add("panning");
          this.applyView();
          return;
        }
        const snapX = Math.round(dx / this.view.k / 10) * 10;
        const snapY = Math.round(dy / this.view.k / 10) * 10;
        if (snapX === drag.snapX && snapY === drag.snapY && !this.pending) return;
        drag.snapX = snapX;
        drag.snapY = snapY;
        if (!this.svg.classList.contains("part-drag-active")) {
          this.svg.classList.add("part-drag-active");
          this.tooltip.hide();
        }
        if (dragFrame === null) {
          dragFrame = requestAnimationFrame(() => {
            dragFrame = null;
            placeDragMembers(drag);
            this.renderDrag(drag.members);
          });
        }
      });
      const finishDrag = (interrupted = false) => {
        if (dragFrame !== null) {
          cancelAnimationFrame(dragFrame);
          dragFrame = null;
        }
        const finished = drag;
        drag = null;
        this.draggingPart = null;
        if (interrupted) {
          armedMarquee = false;
          lastPartClick = null;
        }
        if (!finished) return;
        this.svg.classList.remove("panning", "selecting-area", "part-drag-active");
        if (finished.type === "part") {
          if (finished.moved) {
            placeDragMembers(finished);
            lastPartClick = null;
            this.onChange("move");
          } else if (!interrupted) {
            const ref = finished.inst.ref, now = performance.now();
            const repeat = lastPartClick?.inst === finished.inst && now - lastPartClick.time < 450 && Math.hypot(finished.sx - lastPartClick.x, finished.sy - lastPartClick.y) < 6;
            lastPartClick = repeat ? null : { inst: finished.inst, time: now, x: finished.sx, y: finished.sy };
            if (repeat && this.onPartDoubleClick) this.onPartDoubleClick(ref);
            else this.handlePartClick(ref);
          }
        } else if (finished.type === "marquee") {
          finished.rect.remove();
          if (interrupted) return;
          if (!finished.moved) {
            armedMarquee = finished.armedByDoubleClick;
            return;
          }
          const box = selectionBounds(finished.start, finished.end);
          const refs = /* @__PURE__ */ new Set();
          for (const inst of this.instances) {
            const def2 = defFor(this.getDefs(), inst);
            const { x, y, w, h } = partBounds(inst, def2);
            if (x < box.x + box.width && x + w > box.x && y < box.y + box.height && y + h > box.y) refs.add(inst.ref);
          }
          this.select(refs.size === 1 ? { type: "part", ref: [...refs][0] } : refs.size ? { type: "group", refs } : null);
        } else if (!finished.moved && !interrupted) {
          this.cancelPending();
          this.select(null);
        }
      };
      window.addEventListener("mouseup", (e) => {
        if (e.button === 0) finishDrag();
      });
      window.addEventListener("blur", () => finishDrag(true));
      window.addEventListener("pointercancel", () => finishDrag(true));
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") armedMarquee = false;
      });
      this.svg.addEventListener("click", (e) => {
        const target = e.target.closest("[data-kind]");
        if (target?.dataset.kind === "pin") this.handlePinClick(target.dataset.key);
        if (target?.dataset.kind === "wire") this.select({ type: "wire", id: target.dataset.id });
      });
      this.svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = this.svg.getBoundingClientRect();
        this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      this.svg.addEventListener("mouseover", (e) => {
        if (this.svg.classList.contains("part-drag-active")) return;
        const t = e.target.closest("[data-kind]");
        if (t?.dataset.kind === "pin") this.tooltip.showPin(t.dataset.key, e);
        else if (t?.dataset.kind === "wire") this.tooltip.showWire(t.dataset.id, e);
        else if (t?.dataset.kind === "part") this.tooltip.showPart(t.dataset.ref, e);
        else this.tooltip.hide();
      });
      this.svg.addEventListener("mousemove", (e) => this.tooltip.move(e));
      this.svg.addEventListener("mouseleave", () => this.tooltip.hide());
    }
    handlePartClick(ref) {
      if (this.onPartClick(ref)) return;
      this.select({ type: "part", ref });
    }
    handlePinClick(key2) {
      const pos = this.pinPos(key2);
      if (pos?.def.type === "nc" && !this.pending) {
      }
      if (!this.pending) {
        this.pending = key2;
        this.drawOverlay();
        return;
      }
      if (this.pending === key2) return this.cancelPending();
      const exists = this.wires.some((w) => w.from === this.pending && w.to === key2 || w.from === key2 && w.to === this.pending);
      if (!exists) {
        this.wires.push({ id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, from: this.pending, to: key2, origin: "user", ...this.selectedWireKind ? { kind: this.selectedWireKind } : {} });
        this.onChange("wire");
      }
      this.pending = null;
      this.render();
    }
    cancelPending() {
      this.pending = null;
      this.drawOverlay();
    }
    select(sel) {
      this.selected = sel;
      this.render();
      this.onSelect(sel);
    }
    async deleteSelected() {
      const s = this.selected;
      if (!s) return false;
      const refs = s.type === "group" ? s.refs : new Set(s.type === "part" ? [s.ref] : []);
      const message = refs.size ? `\uC120\uD0DD\uD55C \uBD80\uD488 ${refs.size}\uAC1C\uC640 \uC5F0\uACB0\uB41C \uC120\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?` : "\uC120\uD0DD\uD55C \uC120\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?";
      if (!await confirmAction(message, { defaultAction: refs.size ? "accept" : "cancel" }) || this.selected !== s) return false;
      if (s.type === "wire") this.wires = this.wires.filter((w) => w.id !== s.id);
      if (refs.size) {
        this.instances = this.instances.filter((inst) => !refs.has(inst.ref));
        this.wires = this.wires.filter((w) => !refs.has(splitKey(w.from)[0]) && !refs.has(splitKey(w.to)[0]));
      }
      this.selected = null;
      this.onSelect(null);
      this.onChange("delete");
      this.render();
      return true;
    }
    wirePath(a, b) {
      if (this.wireStyle === "curve") {
        const dirs = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
        const [dx1, dy1] = dirs[a.side] || [1, 0], [dx2, dy2] = dirs[b.side] || [-1, 0];
        const d = Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) / 3);
        return `M${a.x} ${a.y} C${a.x + dx1 * d} ${a.y + dy1 * d} ${b.x + dx2 * d} ${b.y + dy2 * d} ${b.x} ${b.y}`;
      }
      if (this.draggingPart) return "M" + a.x + " " + a.y + " L" + b.x + " " + b.y;
      const gentle = softAlignedPath(a, b, this.routingObstacles);
      if (gentle) return gentle;
      const result = routeWire(a, b, this.routingObstacles, [], { maxVisited: 2e3 });
      return pointsToPath(result.points, this.wireStyle === "curve" ? 10 : 5, this.wireStyle === "curve");
    }
    shadeOverlappingWires() {
      const paths = [...this.wireLayer.querySelectorAll(".wire")].sort((a, b) => a.dataset.id.localeCompare(b.dataset.id));
      const cells = /* @__PURE__ */ new Map();
      let rank = 0;
      for (const path of paths) {
        const length = path.getTotalLength(), samples = [], step = Math.max(3, length / 500), trim = Math.min(8, length * 0.1);
        for (let t = trim; t < length - trim; t += step) {
          const p = path.getPointAtLength(t), before = path.getPointAtLength(Math.max(0, t - 1)), after = path.getPointAtLength(Math.min(length, t + 1));
          const dx = after.x - before.x, dy = after.y - before.y, n = Math.hypot(dx, dy) || 1;
          const s = { p, t, x: Math.floor(p.x / 4), y: Math.floor(p.y / 4), dx: dx / n, dy: dy / n, overlap: false };
          for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (const q of cells.get(`${s.x + x},${s.y + y}`) || []) {
            if (Math.hypot(p.x - q.p.x, p.y - q.p.y) < 3 && Math.abs(s.dx * q.dx + s.dy * q.dy) > 0.95) s.overlap = true;
          }
          samples.push(s);
        }
        let run = [];
        const flush = () => {
          if (run.length >= 3 && run.at(-1).t - run[0].t >= 8) {
            const points = run.map((s) => s.p), d = points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
            const overlay = el2("path", { d, class: "wire-overlap-shade", style: `stroke:${path.style.stroke};filter:brightness(${rank % 2 ? 0.82 : 1.18})` }, path.parentNode);
            overlay.dataset.wireId = path.dataset.id;
            path.dataset.overlap = "true";
            rank++;
          }
          run = [];
        };
        for (const s of samples) {
          if (s.overlap) run.push(s);
          else flush();
        }
        flush();
        for (const s of samples) {
          const key2 = `${s.x},${s.y}`;
          if (!cells.has(key2)) cells.set(key2, []);
          cells.get(key2).push(s);
        }
      }
    }
    updateRoutes(instances, wires) {
      const defs = this.getDefs();
      const obstacles = instances.map((i) => {
        const { x, y, w, h } = partBounds(i, defFor(defs, i));
        return { id: i.ref, x, y, width: w, height: h };
      });
      const connections = wires.flatMap((w) => {
        const start = this.pinPos(w.from, instances), end = this.pinPos(w.to, instances);
        if (!start || !end) return [];
        const point = (p) => ({ x: p.x, y: p.y, side: p.side, owner: p.owner });
        return [{ id: w.id, start: point(start), end: point(end) }];
      });
      const key2 = JSON.stringify([obstacles, connections, this.wireStyle]);
      if (key2 === this.routeCacheKey) return;
      this.routingObstacles = obstacles;
      this.routingPaths = routeWires(connections, obstacles);
      this.routeWarnings = /* @__PURE__ */ new Set();
      for (const [id, route] of this.routingPaths) {
        route.path = pointsToPath(route.points, this.wireStyle === "curve" ? 10 : 5, this.wireStyle === "curve");
        if (this.wireStyle === "straight") {
          const connection2 = connections.find((w) => w.id === id);
          if (connection2) {
            const gentle = softAlignedPath(connection2.start, connection2.end, obstacles);
            if (gentle) {
              route.path = gentle;
              route.blocked = false;
            }
          }
        }
        if (route.blocked) this.routeWarnings.add(id);
      }
      this.routeCacheKey = key2;
    }
    drawOverlay() {
      this.overLayer.replaceChildren();
      if (!this.pending) return;
      const a = this.pinPos(this.pending);
      if (!a) return;
      el2("path", { d: this.wirePath(a, { ...this.mouse, side: "none" }), class: "wire-rubber" }, this.overLayer);
      el2("circle", { cx: a.x, cy: a.y, r: 7, class: "pin-pending" }, this.overLayer);
    }
    netColor(net) {
      if (!net) return null;
      if (net.short) return "var(--volt-short)";
      if (net.kind === "gnd") return "var(--volt-gnd)";
      if (net.voltage == null) return "var(--volt-float)";
      if (net.voltage >= 9) return "var(--volt-high)";
      if (net.voltage >= 4.5) return "var(--volt-5)";
      if (net.voltage >= 2.5) return "var(--volt-3)";
      if (net.voltage > 0) return "var(--volt-low)";
      return "var(--volt-gnd)";
    }
    renderDrag(members) {
      const movingWires = /* @__PURE__ */ new Set();
      for (const { inst } of members) {
        const part = this.drawnParts.get(inst);
        if (part) part.group.setAttribute("transform", "translate(" + inst.x + " " + inst.y + ")" + part.suffix);
        for (const wire of this.drawnWires.get(inst.ref) || []) movingWires.add(wire);
      }
      const pins = /* @__PURE__ */ new Map();
      const pin = (key2) => {
        if (!pins.has(key2)) pins.set(key2, this.pinPos(key2, this.drawnInstances));
        return pins.get(key2);
      };
      for (const { from, to, paths } of movingWires) {
        const start = pin(from), end = pin(to);
        if (!start || !end) continue;
        const path = this.wirePath(start, end);
        for (const node of paths) node.setAttribute("d", path);
      }
      if (this.pending) this.drawOverlay();
    }
    render() {
      const defs = this.getDefs();
      const power = !!this.sim;
      this.wireLayer.replaceChildren();
      this.partLayer.replaceChildren();
      const shown = [...this.instances, ...this.preview?.addedParts || []];
      this.drawnParts.clear();
      this.drawnWires.clear();
      this.drawnInstances = new Map(shown.map((instance) => [instance.ref, instance]));
      const usedPins = new Set(this.wires.flatMap((wire) => [wire.from, wire.to]));
      if (!this.draggingPart) this.updateRoutes(shown, [...this.wires, ...this.preview?.added || []]);
      const pinColor = {};
      const drawWire = (w, cls) => {
        const a = this.pinPos(w.from, this.drawnInstances);
        const b = this.pinPos(w.to, this.drawnInstances);
        if (!a || !b) return;
        const net = power ? this.sim.netByPin[w.from] : null;
        const chosen = ["power", "gnd", "sda", "scl", "signal", "contact"].includes(w.kind) ? `var(--wire-${w.kind})` : null;
        const color = power ? this.netColor(net) : chosen || wireColor(a.def, b.def);
        const sel = this.selected?.type === "wire" && this.selected.id === w.id;
        const route = this.routingPaths.get(w.id);
        const d = this.draggingPart || this.wireStyle === "curve" ? this.wirePath(a, b) : route?.path || this.wirePath(a, b);
        const focus = this.selected?.type === "part" ? this.selected.ref : null;
        const dim = focus && !this.preview && !net?.short && splitKey(w.from)[0] !== focus && splitKey(w.to)[0] !== focus;
        const layer = dim ? el2("g", { opacity: 0.2 }, this.wireLayer) : this.wireLayer;
        if (!cls) {
          pinColor[w.from] = color;
          pinColor[w.to] = color;
        }
        const hit = el2("path", { d, class: "wire-hit", "data-kind": "wire", "data-id": w.id }, layer);
        const casing = el2("path", { d, class: "wire-casing " + (cls || ""), "data-wire-id": w.id }, layer);
        const p = el2("path", {
          d,
          style: `stroke:${color}`,
          class: `wire ${cls || ""} ${sel ? "selected" : ""} ${net?.short ? "short" : ""} ${this.wireStyle !== "curve" && route?.blocked ? "routing-blocked" : ""}`,
          "data-kind": "wire",
          "data-id": w.id
        }, layer);
        if (this.wireStyle !== "curve" && route?.blocked) el2("title", {}, p).textContent = "\uBD80\uD488\uC774 \uACB9\uCE58\uAC70\uB098 \uD540 \uC8FC\uBCC0 \uC5EC\uBC31\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4. \uBD80\uD488\uC744 \uC870\uAE08 \uB5A8\uC5B4\uB728\uB824 \uC8FC\uC138\uC694.";
        if (w.origin === "ai") p.classList.add("ai");
        const paths = [hit, casing, p];
        if (power && net?.voltage > 0 && !net.short && !cls) paths.push(el2("path", { d, class: "wire-pulse" }, layer));
        const record = { from: w.from, to: w.to, paths };
        for (const ref of /* @__PURE__ */ new Set([a.owner, b.owner])) {
          if (!this.drawnWires.has(ref)) this.drawnWires.set(ref, []);
          this.drawnWires.get(ref).push(record);
        }
      };
      for (const w of this.wires) drawWire(w, this.preview?.removed.has(w.id) ? "removed" : "");
      if (this.preview) for (const w of this.preview.added) drawWire(w, "added");
      if (!this.draggingPart) this.shadeOverlappingWires();
      for (const i of shown) {
        const def2 = defFor(defs, i);
        const isPreview = this.preview?.addedParts?.includes(i);
        const { angle, w: width, h: height } = partGeometry(i, def2);
        const rotation = angle ? ` rotate(${angle} ${width / 2} ${height / 2})` : "";
        const mirror = i.mirrored ? ` translate(${width} 0) scale(-1 1)` : "";
        const g = el2("g", {
          transform: `translate(${i.x} ${i.y})${rotation}${mirror}`,
          class: i.mirrored ? "part-mirrored" : null,
          "data-kind": isPreview ? null : "part",
          "data-ref": i.ref
        }, this.partLayer);
        this.drawnParts.set(i, { group: g, suffix: rotation + mirror });
        if (!def2) {
          el2("rect", { width: 140, height: 40, rx: 6, class: "part-missing" }, g);
          el2("text", { x: 8, y: 24, class: "part-title dark" }, g).textContent = `${i.ref}: \uC5C6\uB294 \uBD80\uD488 ${i.part}`;
          continue;
        }
        const { w, h, pos, top: top2 } = layoutPart(def2);
        const st = this.sim?.parts[i.ref] || {};
        const sel = this.selected?.type === "part" && this.selected.ref === i.ref || this.selected?.type === "group" && this.selected.refs.has(i.ref);
        const look = lookOf(def2);
        const bare = isBareArt(def2);
        const light = bare ? null : isLight(def2.color);
        const tone = bare || def2.imageData ? "on-canvas" : light ? "dark" : "";
        el2("rect", {
          width: w,
          height: h,
          rx: 8,
          style: bare ? null : def2.imageData ? "fill:transparent" : `fill:${def2.color || "var(--slate-600)"}`,
          class: `part-body ${bare ? "bare" : ""} ${sel ? "selected" : ""} ${isPreview ? "added" : ""}`
        }, g);
        drawArt(g, { w, h, top: top2, pos, st, def: def2, power });
        const title = el2("text", { x: w / 2, y: (bare ? 14 : 19) + top2, class: `part-title ${tone}`, "text-anchor": "middle" }, g);
        title.textContent = shortName(`${i.ref} \xB7 ${def2.name}`, w);
        el2("title", {}, g).textContent = `${i.ref} \xB7 ${def2.name}${i.label ? ` \u2014 ${i.label}` : ""}`;
        if (i.label) el2("text", { x: w / 2, y: -6, class: "part-label", "text-anchor": "middle" }, g).textContent = shortName(i.label, w);
        this.drawBehavior(g, def2, st, w, h, tone, power);
        const inset = labelInset(look);
        for (const [pid, p] of Object.entries(pos)) {
          const key2 = pinKey(i.ref, pid);
          const used = usedPins.has(key2);
          const net = power ? this.sim.netByPin[key2] : null;
          const tx = p.side === "left" ? 10 + inset.left : p.side === "right" ? -10 + inset.right : 0;
          const ty = bare && (p.side === "left" || p.side === "right") ? 20 : p.side === "top" ? 18 : p.side === "bottom" ? -8 : 4;
          const anchor = p.side === "left" ? "start" : p.side === "right" ? "end" : "middle";
          el2("text", { x: p.x + tx, y: p.y + ty, "text-anchor": anchor, class: `pin-label ${tone} ${p.def.type === "nc" ? "nc" : ""}` }, g).textContent = pinCaption(p.def, anchor === "middle" ? 7 : 18);
          el2("circle", { cx: p.x, cy: p.y, r: 9, class: "pin-hit", "data-kind": "pin", "data-key": key2 }, g);
          const c = el2("circle", {
            cx: p.x,
            cy: p.y,
            r: 5,
            class: `pin pin-${p.def.type} ${used ? "used" : ""} ${this.pending === key2 ? "pending" : ""}`
          }, g);
          if (pinColor[key2]) c.style.fill = pinColor[key2];
          else if (power && net) c.style.fill = this.netColor(net);
        }
      }
      this.drawOverlay();
    }
    drawBehavior(g, def2, st, w, h, tone, power) {
      const b = def2.behavior || {};
      const cx = w / 2;
      const cy = h - 16;
      const txt = (s, cls = "") => {
        const t = el2("text", { x: cx, y: h - 8, "text-anchor": "middle", class: `part-state ${tone} ${cls}` }, g);
        t.textContent = s;
      };
      if (b.kind === "led") {
        if (st.burnt) txt("\u26A0 \uACFC\uC804\uB958\uB85C \uD0D0", "danger");
      } else if (b.kind === "relay") {
        if (power) txt(st.energized ? "\uB538\uAE4D! COM\u2194NO" : st.powered ? "\uB300\uAE30 COM\u2194NC" : "\uC804\uC6D0 \uC5C6\uC74C", st.energized ? "ok" : "");
        el2("circle", { cx: 14, cy: h - 12, r: 4, class: st.powered ? "indicator-power" : "indicator-off" }, g);
      } else if (b.kind === "load") {
        if (power) {
          const s = st.on ? `${b.label || "\uBD80\uD558"} ${b.onText || "ON"} (${st.voltage.toFixed(1)}V)` : st.reversed ? `\uC5ED\uBC29\uD5A5 ${st.voltage.toFixed(1)}V` : st.weak ? `\uC804\uC555 \uBD80\uC871 ${st.voltage.toFixed(1)}V` : `${b.label || "\uBD80\uD558"} ${b.offText || "OFF"}`;
          txt(s, st.on ? "ok" : "");
        }
        if (st.on) el2("rect", { x: 36, y: 20, width: w - 44, height: h - 44, rx: 6, class: "load-on" }, g);
      } else if (b.kind === "i2c-device" && b.display) {
        const area = def2.imageData && def2.imageDisplay;
        const sx = area ? area.x * w : 14;
        const sy = area ? area.y * h : 34 + layoutPart(def2).top;
        const sw = area ? area.width * w : w - 28;
        const sh = area ? area.height * h : Math.max(26, h - 52 - layoutPart(def2).top);
        el2("rect", { x: sx, y: sy, width: sw, height: sh, rx: 3, class: "oled-screen" }, g);
        if (st.powered && st.linked) {
          const t = el2("text", { x: sx + sw / 2, y: sy + sh / 2 + 4, "text-anchor": "middle", class: "oled-text" }, g);
          t.textContent = "24.5\xB0C 51%";
        } else if (st.powered) {
          el2("text", { x: sx + sw / 2, y: sy + sh / 2 + 4, "text-anchor": "middle", class: "oled-text dim" }, g).textContent = "\uC2E0\uD638 \uC5C6\uC74C";
        }
      } else if (b.kind === "sensor" || b.kind === "i2c-device") {
        el2("circle", { cx: w - 14, cy: h - 12, r: 4, class: st.powered ? "indicator-ok" : "indicator-off" }, g);
        if (power) txt(st.powered ? b.kind === "i2c-device" ? st.linked ? "\uD1B5\uC2E0 \uC911" : "\uC804\uC6D0 ON" : "\uCE21\uC815 \uC911" : "\uC804\uC6D0 \uC5C6\uC74C", st.powered ? "ok" : "");
      } else if (b.kind === "button") {
        if (power) txt(st.pressed ? "\uB20C\uB9BC (\uD074\uB9AD\uD574 \uB5BC\uAE30)" : "\uD074\uB9AD\uD574 \uB204\uB974\uAE30");
      } else if (b.kind === "diode") {
        if (st.shorting) txt("\u26A0 \uB2E8\uB77D! \uACFC\uC5F4", "danger");
      } else if (b.kind === "resistor") {
        txt(`${b.ohms >= 1e3 ? b.ohms / 1e3 + "k" : b.ohms}\u03A9`);
      } else if (b.kind === "supply" && power) {
        txt("\uC804\uC6D0 \uACF5\uAE09 \uC911", "ok");
      } else if (b.kind === "board" && power) {
        el2("circle", { cx: w - 14, cy: 14, r: 4, class: "indicator-power", filter: "url(#glow)" }, g);
      }
    }
  };
  function shortName(name, w) {
    const max = Math.floor((w - 40) / 7.5);
    return name.length > max ? name.slice(0, max - 1) + "\u2026" : name;
  }
  function isLight(hex) {
    if (!hex || hex[0] !== "#" || hex.length < 7) return false;
    const n = parseInt(hex.slice(1, 7), 16);
    const r = n >> 16, g = n >> 8 & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 160;
  }

  // assets/agent.js?v=84
  var FORMAT_REMINDER = `[\uC751\uB2F5 \uD615\uC2DD]
\uBC30\uC120 \uC124\uACC4\uB97C \uC694\uCCAD\uBC1B\uC73C\uBA74 \uBD80\uD488\xB7\uC774\uBBF8\uC9C0 \uB4F1\uB85D\uB9CC\uC73C\uB85C \uC791\uC5C5\uC744 \uB05D\uB0B4\uC9C0 \uB9C8\uC138\uC694. \uC0AC\uC6A9\uC790 \uBAA9\uD45C\uC758 \uC804\uC6D0\xB7GND\xB7\uC2E0\uD638 \uC5F0\uACB0\uAE4C\uC9C0 \uC124\uACC4\uD569\uB2C8\uB2E4.
1. \uBD80\uD488id\uC640 \uD540id\uB294 [\uBD80\uD488 \uBAA9\uB85D] \uB610\uB294 MCP\uB85C \uC0DD\uC131\xB7\uC870\uD68C\uD55C \uC2E4\uC81C DB \uC815\uC758\uB9CC \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uBD80\uC871\uD55C \uBD80\uD488\uC740 \uC870\uC0AC \u2192 CreateComponent \u2192 \uC774\uBBF8\uC9C0 \uC81C\uC791\xB7\uC801\uC6A9 \uD6C4 \uD68C\uB85C \uC124\uACC4\uB85C \uACC4\uC18D \uC9C4\uD589\uD569\uB2C8\uB2E4. \uAE30\uC874 \uBD80\uD488\uC758 pins=[]\uB3C4 \uBBF8\uC644\uC131 \uC815\uC758\uC785\uB2C8\uB2E4. \uACF5\uC2DD \uD540\uB9F5\uC744 \uC870\uC0AC\uD558\uACE0 \uD655\uC778\uB41C \uD540\uC73C\uB85C \uC0C8 request_id\uC758 \uC0C8 \uC815\uC758\uB97C \uC800\uC7A5\uD574 \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uC77C\uBC18 \uBAA8\uB378\uBA85\uC744 \uD2B9\uC815 \uBC84\uC804\uC73C\uB85C \uD574\uC11D\uD588\uB2E4\uBA74 \uCD08\uC548\uC758 \uBAA8\uB378 \uAC00\uC815\uC744 \uBA85\uC2DC\uD569\uB2C8\uB2E4.
2. MCP\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC73C\uBA74 CreateCircuitDraft(\uC218\uC815\uC740 UpdateCircuit)\uB85C component_instances/nets/layout\uC744 \uC2E4\uC81C \uC800\uC7A5\uD558\uACE0, ValidateCircuit\uC758 \uC0C1\uD0DC\uB97C \uC124\uBA85\uD569\uB2C8\uB2E4. \uBBF8\uAC80\uC99D \uCD08\uC548 \uD45C\uC2DC\uC5D0\uB294 ApplyCircuitLayout\uC758 allow_unvalidated_draft=true\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uAC80\uC99D \uD1B5\uACFC\uB97C \uAFB8\uBA70\uB0B4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
3. \uB9C8\uC9C0\uB9C9\uC5D0 \uC2E4\uC81C \uC800\uC7A5 \uACB0\uACFC\uB97C JSON \uCF54\uB4DC\uBE14\uB85D\uC73C\uB85C \uBC18\uD658\uD569\uB2C8\uB2E4: {"type":"circuit_reference","circuit_id":"\uC800\uC7A5\uB41C \uC2E4\uC81C \uD68C\uB85C ID","version":\uC2E4\uC81C\uBC84\uC804}. \uBD80\uD488 ID\uB098 \uC774\uBBF8\uC9C0 ID\uB97C \uD68C\uB85C ID\uB85C \uC4F0\uC9C0 \uB9C8\uC138\uC694. \uBBF8\uB974\uAC00 \uC774 ID\uB85C \uBC30\uC120 \uADF8\uB9BC\uC744 \uBD88\uB7EC\uC635\uB2C8\uB2E4.
4. MCP\uB85C \uD68C\uB85C\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC73C\uB098 \uD655\uC778\uB41C \uD540\uC73C\uB85C \uD654\uBA74\uC6A9 \uCD08\uC548\uC744 \uB9CC\uB4E4 \uC218 \uC788\uC73C\uBA74 \uAE30\uC874 \uD615\uC2DD {"type":"wiring","title":"...","parts":[{"ref":"U1","part":"\uBD80\uD488id","label":"\uC5ED\uD560"}],"connections":[{"from":"U1.\uD540id","to":"R1.\uD540id","note":"\uC774\uC720"}],"steps":["..."],"warnings":["..."],"code":"..."}\uC744 JSON \uCF54\uB4DC\uBE14\uB85D\uC73C\uB85C \uBC18\uD658\uD569\uB2C8\uB2E4. LED \uC0C9\uC740 parts\uC758 props.color, \uC800\uD56D\uAC12\uC740 props.ohms\uB85C \uC720\uC9C0\xB7\uBCC0\uACBD\uD558\uACE0 \uC218\uC815\uC548\uB3C4 \uC804\uCCB4 \uBC30\uC120\uC744 \uBC18\uD658\uD569\uB2C8\uB2E4. \uC774\uB54C DB \uC800\uC7A5 \uC644\uB8CC\uB77C\uACE0 \uB9D0\uD558\uC9C0 \uB9C8\uC138\uC694.
5.  \uC870\uC0AC \uD6C4\uBCF4\uC758 unresolved_fields\uB098 agent_extraction_tasks\uB294 \uAC80\uD1A0\xB7\uCD94\uCD9C \uD56D\uBAA9\uC774\uC9C0 \uC0AC\uC6A9\uC790 \uD544\uC218 \uC785\uB825 \uBAA9\uB85D\uC774 \uC544\uB2D9\uB2C8\uB2E4. document_sections\uC640 evidence\uB97C \uC77D\uC5B4 \uC2E4\uC81C \uD655\uC778\uD560 \uC218 \uC788\uB294 \uB0B4\uC6A9\uC744 \uBA3C\uC800 \uCD94\uCD9C\uD569\uB2C8\uB2E4. \uC0C1\uD488\uBA85 \uC804\uCCB4 \uBB38\uC790\uC5F4\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC544\uB3C4 source.title, source_title_identifiers, identifier_matches\uB85C \uBAA8\uB378\uC744 \uC7AC\uD655\uC778\uD569\uB2C8\uB2E4. \uC0AC\uC6A9\uC790 \uBA54\uC2DC\uC9C0\uC5D0 \uC81C\uC2DC\uB41C OUT\xB7VCC\xB7GND \uAC19\uC740 \uD540 \uD45C\uAE30\uB294 \uADFC\uAC70\uB85C \uBC18\uC601\uD558\uACE0 \uAC19\uC740 \uD45C\uAE30\uB97C \uB2E4\uC2DC \uB098\uC5F4\uD558\uB77C\uACE0 \uBB3B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD655\uC778\uB41C \uD540 \uC5ED\uD560\uACFC \uC544\uC9C1 \uD655\uC778\uB418\uC9C0 \uC54A\uC740 \uC804\uC6D0 \uC815\uACA9\xB7\uC81C\uD488 \uBCC0\uD615\uC740 \uBCC4\uB3C4\uB85C \uCDE8\uAE09\uD569\uB2C8\uB2E4. \uC9C8\uBB38\uBCF4\uB2E4 \uC870\uC0AC\uB97C \uBA3C\uC800 \uD569\uB2C8\uB2E4. 1) SearchComponents/GetComponentDetails\uB85C DB\uC640 \uCD9C\uCC98\uB97C \uD655\uC778\uD558\uACE0, \uBAA8\uB378\uB85C \uCC3E\uC744 \uC218 \uC788\uB294 \uD540\uB9F5\xB7\uD540 \uAE30\uB2A5\xB7\uB3D9\uC791 \uC804\uC555\xB7\uC815\uACA9\xB7\uB370\uC774\uD130\uC2DC\uD2B8\uB294 \uAC80\uC0C9 \uC5D0\uC774\uC804\uD2B8\uC640 \uC6F9 \uAC80\uC0C9/ResearchComponent/AnalyzeDatasheet\uB85C \uC9C1\uC811 \uC870\uC0AC\uD569\uB2C8\uB2E4. \uBE44\uC5B4 \uC788\uB294 pins\uB098 unresolved_fields\uB97C \uADF8\uB300\uB85C \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uCC44\uC6B0\uB77C\uACE0 \uC694\uAD6C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. 2) \uC870\uD68C\uD55C \uC2E4\uC81C \uACF5\uC2DD \uC790\uB8CC\uC640 \uC791\uC5C5 \uACB0\uACFC\uB97C \uD655\uC778\uD574 \uBD80\uD488 \uC815\uC758\uB97C \uBCF4\uC644\uD558\uACE0 \uC124\uACC4\uB97C \uACC4\uC18D\uD569\uB2C8\uB2E4. \uAC80\uC0C9 \uC218\uB2E8\uC774 \uC5C6\uAC70\uB098 \uC2E4\uD328\uD558\uBA74 \uC131\uACF5\uD588\uB2E4\uACE0 \uAFB8\uBBF8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. 3) \uC870\uC0AC\uD574\uB3C4 \uC2E4\uC81C \uC0AC\uC6A9\uD560 \uC81C\uD488\uC744 \uD2B9\uC815\uD560 \uC218 \uC5C6\uC744 \uB54C\uB9CC \uCD5C\uC18C\uD55C\uC758 \uC2DD\uBCC4 \uC815\uBCF4(\uBAA8\uB378\uBA85\xB7\uC81C\uC870\uC0AC\xB7\uBAA8\uB4C8 \uBCC0\uD615)\uB97C \uBB3B\uC2B5\uB2C8\uB2E4. \uC608: \uD0DC\uC591\uAD11 \uD328\uB110\uC758 \uBAA8\uB378\uBA85\uC744 \uC54C\uB824\uC8FC\uC138\uC694. \uBAA8\uB378\uC744 \uBC1B\uC73C\uBA74 Voc\uC640 \uD540 \uC815\uBCF4\uB294 \uB2E4\uC2DC \uC9C1\uC811 \uC870\uC0AC\uD558\uACE0, \uACF5\uAC1C \uC790\uB8CC\uB85C \uC54C \uC218 \uC5C6\uB294 \uC2E4\uC81C \uC81C\uD488\uC758 \uAC12\uB9CC \uCD94\uAC00\uB85C \uBB3B\uC2B5\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uAC00 \uD540 \uC774\uB984\xB7\uD540 \uAC1C\uC218\xB7\uD540 \uAE30\uB2A5\uC744 \uC804\uBD80 \uB098\uC5F4\uD558\uB3C4\uB85D \uC694\uAD6C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0AC\uC6A9\uC790 \uC81C\uC791 \uBCF4\uB4DC\uCC98\uB7FC \uACF5\uC2DD \uC790\uB8CC\uAC00 \uC5C6\uB294 \uACBD\uC6B0\uC5D0\uB9CC \uC790\uB8CC \uB9C1\uD06C\uB098 \uD540\uB9F5\uC744 \uC694\uCCAD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. 4) \uC774 \uD655\uC778 \uC9C8\uBB38\uC5D0\uB294 \uD544\uC694\uD55C \uBD80\uD488\uBA85\uACFC \uD56D\uBAA9\uB9CC \uC9E7\uAC8C \uC4F0\uACE0 \uC624\uB958 \uC704\uCE58\xB7\uB0B4\uBD80 \uB3C4\uAD6C\xB7\uC2E4\uD328 \uC6D0\uC778 \uC124\uBA85\uC744 \uBD99\uC774\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uCD5C\uC885 JSON\uC740 {"type":"clarification","questions":["\uD0DC\uC591\uAD11 \uD328\uB110\uC758 \uBAA8\uB378\uBA85\uC744 \uC54C\uB824\uC8FC\uC138\uC694."]}\uB85C \uBC18\uD658\uD569\uB2C8\uB2E4. \uC0AC\uC591\uC744 \uCD94\uCE21\uD558\uAC70\uB098 \uD655\uC778 \uC804 \uBC30\uC120\uC744 \uD655\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E8\uC21C \uC9C8\uBB38\uC774\uB098 \uBD80\uD488 \uB4F1\uB85D\uB9CC \uC694\uCCAD\uD55C \uACBD\uC6B0 \uBD88\uD544\uC694\uD55C \uD68C\uB85C\uB97C \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
6. \uBAA8\uD130\uC640 \uC678\uBD80 \uC804\uC6D0\uC5D0\uB294 \uB2E4\uC74C \uADDC\uCE59\uC744 \uC6B0\uC120 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uBAA8\uD130\uB294 \uC81C\uD488 \uC2DD\uBCC4\uC5D0 \uD544\uC694\uD55C \uC885\uB958\uC640 \uBAA8\uB378\uBA85 \uC911 \uBE60\uC9C4 \uD56D\uBAA9\uB9CC \uBB3B\uC2B5\uB2C8\uB2E4. \uC815\uACA9 \uC804\uC555\xB7\uC804\uB958, \uAE30\uB3D9\xB7\uC2A4\uD1A8 \uC804\uB958, \uD540\uB9F5\uACFC \uC0AC\uC6A9\uBC95\uC740 \uBAA8\uB378\uB85C DB\uC640 \uC81C\uC870\uC0AC \uC790\uB8CC\uB97C \uC9C1\uC811 \uC870\uC0AC\uD569\uB2C8\uB2E4. \uD655\uC778\uD558\uC9C0 \uBABB\uD55C \uC815\uACA9\uC740 \uBBF8\uD655\uC778\uC73C\uB85C \uB0A8\uAE30\uACE0, \uADF8 \uAC12\uC774 \uD544\uC694\uD55C \uC2E4\uC81C \uBC30\uC120\uC740 \uD655\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC815\uACA9\uC774\uB098 \uD540 \uC815\uBCF4\uB97C \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uC694\uAD6C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC678\uBD80 \uC804\uC6D0\uC774 \uD544\uC694\uD558\uACE0 \uC0AC\uC6A9\uC790\uAC00 \uC885\uB958\uB97C \uC9C0\uC815\uD558\uC9C0 \uC54A\uC73C\uBA74 \uBC30\uD130\uB9AC\uB97C \uAE30\uBCF8\uC73C\uB85C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uD30C\uC6CC\uC11C\uD50C\uB77C\uC774 \uB4F1 \uB2E4\uB978 \uC804\uC6D0\uC744 \uC9C0\uC815\uD558\uAC70\uB098 \uB098\uC911\uC5D0 \uBCC0\uACBD\uD558\uBA74 \uADF8 \uC120\uD0DD\uC5D0 \uB9DE\uCDB0 \uC124\uACC4\uB97C \uAC31\uC2E0\uD569\uB2C8\uB2E4. \uC77C\uBC18 \uC678\uBD80 \uC804\uC6D0\uC758 \uBAA8\uB378\uBA85\uC774\uB098 \uC804\uC555\uBCC4 \uD540 \uC720\uBB34\uB97C \uBB3B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD655\uC778\uB41C \uBD80\uD558\uC640 \uB4DC\uB77C\uC774\uBC84 \uC0AC\uC591\uC5D0 \uB9DE\uCDB0 \uD544\uC694\uD55C \uCD9C\uB825 \uC804\uC555\uACFC \uC804\uB958 \uC6A9\uB7C9\uC744 \uC120\uC815\uD569\uB2C8\uB2E4. \uD30C\uC6CC\uC11C\uD50C\uB77C\uC774\uB294 \uCD9C\uB825 \uC124\uC815\uAC12\uACFC +/\u2212 \uCD9C\uB825 \uB2E8\uC790\uB85C \uD45C\uD604\uD558\uACE0, \uAE30\uAE30\uBCC4 \uB2E8\uC790 \uBC30\uCE58\uB098 \uCD9C\uB825 \uBC94\uC704\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD558\uBA74 \uD544\uC694\uD55C \uC870\uAC74\uB9CC \uC548\uB0B4\uD569\uB2C8\uB2E4.`;
  function buildCatalog(defs) {
    const lines = ["[\uBD80\uD488 \uBAA9\uB85D] \uD615\uC2DD: \uBD80\uD488id | \uC774\uB984 | \uD540id:\uC885\uB958:\uC804\uC555(\uD5C8\uC6A9\uBC94\uC704)[\uAE30\uB2A5]"];
    for (const d of defs.values()) {
      const pins = d.pins.map((p) => {
        let s = `${p.id}:${p.type}`;
        if (p.voltage != null) s += `:${p.voltage}${typeof p.voltage === "number" ? "V" : ""}`;
        if (p.minVoltage != null || p.maxVoltage != null) s += `(${p.minVoltage ?? ""}~${p.maxVoltage ?? ""}V)`;
        const fns = (p.functions || []).filter((f) => f !== "GPIO");
        if (fns.length) s += `[${fns.join("/")}]`;
        if (p.note) s += `{${p.note}}`;
        return s;
      });
      lines.push(`${d.id} | ${d.name} | ${pins.join(", ")}${d.isDraft ? " [\uBBF8\uAC80\uC99D \uC124\uACC4 \uBD80\uD488" + (d.unresolvedFields?.length ? ": " + d.unresolvedFields.join(", ") : "") + "]" : ""}`);
    }
    return lines.join("\n");
  }
  function wiringSnapshot(state2, defs) {
    return {
      type: "wiring",
      title: state2.title || "",
      parts: state2.instances.map((i) => ({ ref: i.ref, part: i.part, ...i.label ? { label: i.label } : {}, ...i.props ? { props: i.props } : {} })),
      connections: state2.wires.map((w) => ({ from: w.from, to: w.to, ...w.note ? { note: w.note } : {} }))
    };
  }
  function buildRecommendRequest(goal) {
    return `[\uC694\uCCAD \uC885\uB958: \uBC30\uC120 \uCD94\uCC9C]
\uC0AC\uC6A9\uC790 \uBAA9\uD45C: ${goal}

${FORMAT_REMINDER}`;
  }
  function buildChatRequest(text2, snapshot) {
    if (!snapshot) return `${text2}

${FORMAT_REMINDER}`;
    return `${text2}

[\uD604\uC7AC \uBC30\uC120]
\`\`\`json
${JSON.stringify(snapshot)}
\`\`\`

${FORMAT_REMINDER}`;
  }
  function buildDiagnoseRequest({ snapshot, checklist, measurements, memo }) {
    const judged = checklist.map((c) => `- ${c.title}: ${c.status}${c.memo ? ` (\uD559\uC0DD \uBA54\uBAA8: ${c.memo})` : ""}`).join("\n");
    return `[\uC694\uCCAD \uC885\uB958: \uC624\uB958 \uC9C4\uB2E8]
\uD559\uC0DD\uC774 2D \uAC00\uC0C1\uD658\uACBD\uC5D0\uC11C \uC9C1\uC811 \uD14C\uC2A4\uD2B8\uD588\uC2B5\uB2C8\uB2E4. \uCE21\uC815\uAC12\uACFC \uD559\uC0DD \uC124\uBA85\uC744 \uBCF4\uACE0 \uBB38\uC81C\uC758 \uC6D0\uC778\uC774 \uBC30\uC120\xB7\uCF54\uB4DC\xB7\uBD80\uD488 \uC911 \uC5B4\uB514\uC778\uC9C0 \uC9DA\uACE0, \uC218\uC815\uC548\uC744 \uC81C\uC2DC\uD574 \uC8FC\uC138\uC694.
${judged ? `
[\uD559\uC0DD \uD310\uC815]
${judged}
` : ""}${memo ? `
[\uD559\uC0DD \uC124\uBA85]
${memo}
` : ""}
[\uAC00\uC0C1 \uC804\uC6D0 \uCE21\uC815\uAC12]
${measurements || "(\uAC00\uC0C1 \uC804\uC6D0\uC744 \uCF1C\uC9C0 \uC54A\uC74C)"}

[\uD604\uC7AC \uBC30\uC120]
\`\`\`json
${JSON.stringify(snapshot)}
\`\`\`

${FORMAT_REMINDER}`;
  }
  function buildPartRequest(text2) {
    return `[\uC694\uCCAD \uC885\uB958: \uBD80\uD488 \uB4F1\uB85D]
\uC544\uB798 \uB370\uC774\uD130\uC2DC\uD2B8/\uB3C4\uBA74 \uB0B4\uC6A9\uC744 \uBCF4\uACE0 \uC774 \uD504\uB85C\uADF8\uB7A8\uC758 \uBD80\uD488 JSON\uC744 \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694.
\uD615\uC2DD: \`\`\`json {"type":"part","id":"\uC601\uBB38\uC18C\uBB38\uC790-\uD558\uC774\uD508","name":"...","category":"sensor|display|output|input|module|actuator|power|passive|board","description":"...","behavior":{"kind":"sensor|i2c-device|led|resistor|button|relay|load|supply|diode|board", ...},"pins":[{"id":"VCC","label":"VCC","side":"left|right|top|bottom","type":"power_out|power_in|gnd|gpio|input|output|passive|contact|nc","voltage":3.3,"minVoltage":3.3,"maxVoltage":5.5,"functions":["..."],"note":"..."}],"sources":["\uADFC\uAC70 \uBB38\uC11C"]} \`\`\`
\uD655\uC778\uB418\uC9C0 \uC54A\uC740 \uAC12\uC740 \uB123\uC9C0 \uB9D0\uACE0 note\uC5D0 "\uD655\uC778 \uD544\uC694"\uB77C\uACE0 \uC801\uC5B4 \uC8FC\uC138\uC694.

[\uC790\uB8CC]
${text2}`;
  }
  function parseReply(text2) {
    const blocks = [];
    const re = /```(?:json)?\s*([\s\S]*?)```/g;
    let m;
    let plain = text2;
    while (m = re.exec(text2)) {
      try {
        const obj = JSON.parse(m[1]);
        blocks.push(obj);
        plain = plain.replace(m[0], "");
      } catch {
      }
    }
    if (!blocks.length) {
      const s = text2.indexOf("{");
      const e = text2.lastIndexOf("}");
      if (s >= 0 && e > s) {
        try {
          blocks.push(JSON.parse(text2.slice(s, e + 1)));
          plain = text2.slice(0, s) + text2.slice(e + 1);
        } catch {
        }
      }
    }
    const wiring2 = blocks.find((b) => b && (b.type === "wiring" || Array.isArray(b.connections)));
    const part = blocks.find((b) => b && (b.type === "part" || Array.isArray(b.pins) && b.id));
    const circuit = blocks.find((b) => b && (typeof b.circuit_id === "string" || typeof b.id === "string" && Array.isArray(b.component_instances)));
    const clarification = blocks.find((b) => b?.type === "clarification" && Array.isArray(b.questions) && b.questions.length > 0 && b.questions.every((q) => typeof q === "string" && q.trim()));
    if (clarification) return { text: clarification.questions.map((q) => q.trim()).join("\n"), clarification };
    return { text: plain.trim(), wiring: wiring2, part, circuit };
  }
  var DEMOS = [
    {
      id: "valve",
      board: "esp32",
      match: /밸브|솔레노이드|valve|solenoid/i,
      reply: `ESP32\uC758 GPIO\uB294 3.3V\xB7\uC218\uC2ED mA\uBC16\uC5D0 \uBABB \uB0B4\uAE30 \uB54C\uBB38\uC5D0 12V \uBC38\uBE0C\uB97C \uC9C1\uC811 \uCF24 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. **\uB9B4\uB808\uC774 \uBAA8\uB4C8**\uB85C 12V \uD68C\uB85C\uB97C \uB530\uB85C \uC2A4\uC704\uCE6D\uD558\uB294 \uAD6C\uC131\uC744 \uCD94\uCC9C\uD569\uB2C8\uB2E4.

1. \uB9B4\uB808\uC774 \uBAA8\uB4C8 \uC804\uC6D0\uC740 ESP32\uC758 5V(USB) \uD540\uC5D0\uC11C, \uC81C\uC5B4 \uC2E0\uD638(IN)\uB294 GPIO23\uC5D0\uC11C \uBC1B\uC2B5\uB2C8\uB2E4.
2. 12V \uC5B4\uB311\uD130 + \u2192 \uB9B4\uB808\uC774 COM, \uB9B4\uB808\uC774 NO \u2192 \uBC38\uBE0C +, \uBC38\uBE0C - \u2192 \uC5B4\uB311\uD130 GND \uB85C 12V \uD68C\uB85C\uB97C \uB9CC\uB4ED\uB2C8\uB2E4.
3. \uBC38\uBE0C \uCF54\uC77C \uC591\uB2E8\uC5D0 1N4007 \uB2E4\uC774\uC624\uB4DC\uB97C **\uB760(K)\uAC00 + \uCABD**\uC774 \uB418\uB3C4\uB85D \uBCD1\uB82C\uB85C \uBD99\uC5EC \uC5ED\uAE30\uC804\uB825\uC744 \uD761\uC218\uD569\uB2C8\uB2E4.`,
      wiring: {
        type: "wiring",
        title: "ESP32\uB85C 12V \uC194\uB808\uB178\uC774\uB4DC \uBC38\uBE0C \uC81C\uC5B4",
        parts: [
          { ref: "U1", part: "esp32-devkitc", label: "\uC81C\uC5B4 \uBCF4\uB4DC" },
          { ref: "K1", part: "relay-module-5v", label: "\uC2A4\uC704\uCE58" },
          { ref: "PS1", part: "dc-12v-adapter", label: "\uC678\uBD80 \uC804\uC6D0" },
          { ref: "V1", part: "solenoid-valve-12v", label: "\uBC38\uBE0C" },
          { ref: "D1", part: "diode-1n4007", label: "\uC5ED\uAE30\uC804\uB825 \uBCF4\uD638" }
        ],
        connections: [
          { from: "U1.5V", to: "K1.VCC", note: "\uB9B4\uB808\uC774 \uCF54\uC77C \uC804\uC6D0 5V" },
          { from: "U1.GND2", to: "K1.GND", note: "\uACF5\uD1B5 GND" },
          { from: "U1.GPIO23", to: "K1.IN", note: "\uC81C\uC5B4 \uC2E0\uD638(3.3V HIGH = \uCF1C\uC9D0)" },
          { from: "PS1.V+", to: "K1.COM", note: "12V\uB97C \uB9B4\uB808\uC774 \uACF5\uD1B5 \uB2E8\uC790\uB85C" },
          { from: "K1.NO", to: "V1.V+", note: "\uB9B4\uB808\uC774\uAC00 \uBD99\uC73C\uBA74 \uBC38\uBE0C\uC5D0 12V" },
          { from: "V1.V-", to: "PS1.GND", note: "\uBC38\uBE0C \uBCF5\uADC0\uC120" },
          { from: "D1.K", to: "V1.V+", note: "\uB2E4\uC774\uC624\uB4DC \uB760(K)\uB294 + \uCABD" },
          { from: "D1.A", to: "V1.V-", note: "\uB2E4\uC774\uC624\uB4DC A\uB294 - \uCABD" }
        ],
        steps: ["USB\uB97C \uBF51\uC740 \uC0C1\uD0DC\uC5D0\uC11C \uBC30\uC120\uD569\uB2C8\uB2E4.", "12V \uC5B4\uB311\uD130\uB294 \uB9C8\uC9C0\uB9C9\uC5D0 \uC5F0\uACB0\uD569\uB2C8\uB2E4.", "\uCF54\uB4DC \uC5C5\uB85C\uB4DC \uD6C4 GPIO23\uC744 HIGH\uB85C \uB9CC\uB4E4\uC5B4 \uBC38\uBE0C\uAC00 \uC5F4\uB9AC\uB294\uC9C0 \uD655\uC778\uD569\uB2C8\uB2E4."],
        warnings: ["\uB9B4\uB808\uC774 \uBAA8\uB4C8\uC774 LOW \uD2B8\uB9AC\uAC70 \uC81C\uD488\uC774\uBA74 \uCF54\uB4DC\uC758 HIGH/LOW\uB97C \uBC18\uB300\uB85C \uBC14\uAFD4\uC57C \uD569\uB2C8\uB2E4.", "12V \uC120\uC774 ESP32 \uD540\uC5D0 \uB2FF\uC9C0 \uC54A\uB3C4\uB85D \uC8FC\uC758\uD558\uC138\uC694."],
        code: `const int VALVE = 23;
void setup() {
  pinMode(VALVE, OUTPUT);
}
void loop() {
  digitalWrite(VALVE, HIGH); // \uBC38\uBE0C \uC5F4\uB9BC
  delay(3000);
  digitalWrite(VALVE, LOW);  // \uBC38\uBE0C \uB2EB\uD798
  delay(3000);
}`
      }
    },
    {
      id: "climate",
      board: "esp32",
      match: /온도|습도|화면|oled|디스플레이|dht/i,
      reply: `DHT22\uB85C \uC628\uC2B5\uB3C4\uB97C \uC77D\uC5B4 OLED\uC5D0 \uB744\uC6B0\uB294 \uAD6C\uC131\uC785\uB2C8\uB2E4.

- DHT22\uB294 **3.3V**\uB85C \uC804\uC6D0\uC744 \uC8FC\uC5B4\uC57C \uB370\uC774\uD130\uC120(OUT)\uB3C4 3.3V\uAC00 \uB418\uC5B4 ESP32 \uD540\uC774 \uC548\uC804\uD569\uB2C8\uB2E4.
- OLED\uB294 I2C\uB77C\uC11C SDA\u2192GPIO21, SCL\u2192GPIO22(ESP32 \uAE30\uBCF8 I2C \uD540)\uC5D0 \uC5F0\uACB0\uD569\uB2C8\uB2E4.`,
      wiring: {
        type: "wiring",
        title: "\uC628\uC2B5\uB3C4\uB97C \uC77D\uC5B4 OLED\uC5D0 \uD45C\uC2DC",
        parts: [
          { ref: "U1", part: "esp32-devkitc", label: "\uC81C\uC5B4 \uBCF4\uB4DC" },
          { ref: "S1", part: "dht22-module", label: "\uC628\uC2B5\uB3C4 \uC13C\uC11C" },
          { ref: "DS1", part: "ssd1306-oled", label: "\uD654\uBA74" }
        ],
        connections: [
          { from: "U1.3V3", to: "S1.VCC", note: "\uC13C\uC11C \uC804\uC6D0 3.3V" },
          { from: "U1.GND1", to: "S1.GND" },
          { from: "U1.GPIO4", to: "S1.DATA", note: "\uB370\uC774\uD130\uC120" },
          { from: "U1.3V3", to: "DS1.VCC", note: "OLED \uC804\uC6D0" },
          { from: "U1.GND2", to: "DS1.GND" },
          { from: "U1.GPIO21", to: "DS1.SDA", note: "I2C SDA" },
          { from: "U1.GPIO22", to: "DS1.SCL", note: "I2C SCL" }
        ],
        steps: ["DHT sensor library, Adafruit SSD1306 \uB77C\uC774\uBE0C\uB7EC\uB9AC\uB97C \uC124\uCE58\uD569\uB2C8\uB2E4."],
        warnings: ["DHT22\uB97C 5V\uB85C \uC4F0\uBA74 \uB370\uC774\uD130\uC120\uC774 5V\uAC00 \uB418\uC5B4 ESP32\uC5D0 \uBB34\uB9AC\uAC00 \uAC11\uB2C8\uB2E4."],
        code: `#include <DHT.h>
#include <Adafruit_SSD1306.h>
DHT dht(4, DHT22);
Adafruit_SSD1306 oled(128, 64, &Wire);
void setup() {
  dht.begin();
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}
void loop() {
  float t = dht.readTemperature(), h = dht.readHumidity();
  oled.clearDisplay(); oled.setTextColor(WHITE); oled.setTextSize(2);
  oled.setCursor(0, 10); oled.printf("%.1fC\\n%.0f%%", t, h);
  oled.display(); delay(2000);
}`
      }
    },
    {
      id: "led",
      board: "raspberry",
      match: /led|엘이디|불빛|깜빡/i,
      reply: `\uB77C\uC988\uBCA0\uB9AC\uD30C\uC774 GPIO17\uC5D0 LED\uB97C \uC5F0\uACB0\uD558\uB294 \uAE30\uBCF8 \uAD6C\uC131\uC785\uB2C8\uB2E4. GPIO\uB294 3.3V\uC774\uACE0 5V\uB97C \uACAC\uB514\uC9C0 \uBABB\uD558\uB2C8 5V \uD540\uC740 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`,
      wiring: {
        type: "wiring",
        title: "\uB77C\uC988\uBCA0\uB9AC\uD30C\uC774 LED \uAE5C\uBE61\uC774\uAE30",
        parts: [
          { ref: "U1", part: "raspberry-pi-4" },
          { ref: "R1", part: "resistor-220", label: "\uC804\uB958 \uC81C\uD55C" },
          { ref: "LED1", part: "led-red" }
        ],
        connections: [
          { from: "U1.GPIO17", to: "R1.P1" },
          { from: "R1.P2", to: "LED1.A", note: "\uAE34 \uB2E4\uB9AC" },
          { from: "LED1.K", to: "U1.GND_9", note: "\uC9E7\uC740 \uB2E4\uB9AC" }
        ],
        code: `from gpiozero import LED
from time import sleep
led = LED(17)
while True:
    led.toggle(); sleep(0.5)`
      }
    },
    {
      board: "esp32",
      match: /led|엘이디|불빛|깜빡/i,
      reply: `ESP32 GPIO26 \u2192 220\u03A9 \uC800\uD56D \u2192 LED \u2192 GND \uB85C \uC5F0\uACB0\uD569\uB2C8\uB2E4. \uC800\uD56D\uC774 \uC5C6\uC73C\uBA74 LED\uC640 GPIO\uC5D0 \uACFC\uC804\uB958\uAC00 \uD750\uB985\uB2C8\uB2E4.`,
      wiring: {
        type: "wiring",
        title: "ESP32 LED \uAE5C\uBE61\uC774\uAE30",
        parts: [
          { ref: "U1", part: "esp32-devkitc" },
          { ref: "R1", part: "resistor-220", label: "\uC804\uB958 \uC81C\uD55C" },
          { ref: "LED1", part: "led-red" }
        ],
        connections: [
          { from: "U1.GPIO26", to: "R1.P1" },
          { from: "R1.P2", to: "LED1.A", note: "\uAE34 \uB2E4\uB9AC" },
          { from: "LED1.K", to: "U1.GND1", note: "\uC9E7\uC740 \uB2E4\uB9AC" }
        ],
        code: `void setup() { pinMode(26, OUTPUT); }
void loop() { digitalWrite(26, !digitalRead(26)); delay(500); }`
      }
    }
  ];
  function getBuiltInWiring(id) {
    return DEMOS.find((example) => example.id === id)?.wiring;
  }
  function demoReply(message, ctx = {}) {
    if (message.startsWith("[\uC694\uCCAD \uC885\uB958: \uC624\uB958 \uC9C4\uB2E8]")) return demoDiagnose(ctx);
    if (message.startsWith("[\uC694\uCCAD \uC885\uB958: \uBD80\uD488 \uB4F1\uB85D]")) {
      return "\uB370\uBAA8 \uBAA8\uB4DC\uC5D0\uC11C\uB294 \uBD80\uD488 \uB4F1\uB85D\uC744 \uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC5D0\uC11C Copilot Studio \uC5D0\uC774\uC804\uD2B8\uB97C \uC5F0\uACB0\uD558\uBA74 \uB370\uC774\uD130\uC2DC\uD2B8 \uB0B4\uC6A9\uC73C\uB85C \uBD80\uD488 JSON\uC744 \uB9CC\uB4E4\uC5B4 \uB4DC\uB9BD\uB2C8\uB2E4.";
    }
    const goal = message.split(/\[현재 배선\]|\[응답 형식\]/)[0];
    const raspberry = /라즈베리|raspberry|\brpi\b/i.test(goal);
    const esp32 = /esp\s*32/i.test(goal);
    const board = raspberry ? "raspberry" : "esp32";
    const prefix = "(\uB370\uBAA8 \uBAA8\uB4DC \xB7 \uC2E4\uC81C AI \uC751\uB2F5\uC774 \uC544\uB2D9\uB2C8\uB2E4)";
    if (/펌프|pump/i.test(goal)) {
      const controller = raspberry && !esp32 ? "\uB77C\uC988\uBCA0\uB9AC\uD30C\uC774" : esp32 && !raspberry ? "ESP32" : "\uC694\uCCAD\uD55C \uBCF4\uB4DC";
      return `${prefix}

${controller}\uB85C \uC678\uBD80 \uC804\uC6D0\uC744 \uC0AC\uC6A9\uD558\uB294 \uD38C\uD504\uB97C \uCF1C\uACE0 \uB044\uB824\uB294 \uC694\uCCAD\uC785\uB2C8\uB2E4.
\uD604\uC7AC \uC800\uC7A5\uB41C \uB370\uBAA8\uC5D0\uB294 \uD38C\uD504 \uD68C\uB85C\uAC00 \uC5C6\uC5B4 \uBC30\uC120\uC744 \uC0DD\uC131\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.

\uD38C\uD504 \uBAA8\uB378\xB7\uC815\uACA9 \uC804\uC555\xB7\uC815\uACA9 \uC804\uB958\uC640 \uD30C\uC6CC\uC11C\uD50C\uB77C\uC774 \uC0AC\uC591\uC744 \uC900\uBE44\uD558\uACE0, \uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uD0ED\uC5D0\uC11C Copilot Studio\uB97C \uC5F0\uACB0\uD574 \uC124\uACC4\uB97C \uC694\uCCAD\uD558\uC138\uC694. \uAE30\uC874 ESP32 \uBC38\uBE0C \uC608\uC2DC\uB85C \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`;
    }
    const unsupportedBoard = /아두이노|arduino|피코|\bpico\b|stm32|micro:bit|마이크로비트/i.test(goal);
    const d = !unsupportedBoard && !(raspberry && esp32) ? DEMOS.find((x) => x.board === board && x.match.test(goal)) : void 0;
    if (!d) {
      return `(\uB370\uBAA8 \uBAA8\uB4DC) \uC9C0\uAE08\uC740 Copilot Studio \uC5D0\uC774\uC804\uD2B8\uC5D0 \uC5F0\uACB0\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC544 \uC815\uD574\uC9C4 \uC608\uC2DC\uB9CC \uB2F5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.
"ESP32\uB85C \uC678\uBD80 \uC804\uC6D0\uC73C\uB85C \uBC38\uBE0C \uCF1C\uAE30", "\uC628\uB3C4\uB97C \uC77D\uC5B4\uC11C \uD654\uBA74\uC5D0 \uB744\uC6B0\uAE30", "LED \uAE5C\uBE61\uC774\uAE30", "\uB77C\uC988\uBCA0\uB9AC\uD30C\uC774 LED" \uCC98\uB7FC \uBB3C\uC5B4\uBCF4\uC138\uC694.
\uC785\uB825\uD55C \uBCF4\uB4DC\uC640 \uC7A5\uCE58\uB97C \uB2E4\uB978 \uC608\uC2DC\uB85C \uBC14\uAFB8\uC9C0\uB294 \uC54A\uC2B5\uB2C8\uB2E4. \uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uD0ED\uC5D0\uC11C \uC2E4\uC81C \uC5D0\uC774\uC804\uD2B8\uB97C \uC5F0\uACB0\uD558\uC138\uC694.`;
    }
    return `${prefix}

${d.reply}

\`\`\`json
${JSON.stringify(d.wiring, null, 2)}
\`\`\``;
  }
  function demoDiagnose({ problems = [] }) {
    if (!problems.length) {
      return "(\uB370\uBAA8 \uBAA8\uB4DC) \uD559\uC0DD \uD310\uC815\uC5D0\uC11C \uBB38\uC81C \uD56D\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uC9C4\uB2E8\uC740 Copilot Studio \uC5D0\uC774\uC804\uD2B8\uB97C \uC5F0\uACB0\uD558\uBA74 \uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
    }
    return `(\uB370\uBAA8 \uBAA8\uB4DC) \uB2E4\uC74C \uC9C0\uC810\uC744 \uD655\uC778\uD574 \uBCF4\uC138\uC694. \uC5F0\uACB0\uB41C \uC5D0\uC774\uC804\uD2B8\uB294 \uC6D0\uC778(\uBC30\uC120/\uCF54\uB4DC/\uBD80\uD488)\uACFC \uC218\uC815 \uBC30\uC120\uC744 \uD568\uAED8 \uC81C\uC548\uD569\uB2C8\uB2E4.

${problems.map((p) => `- ${p}`).join("\n")}`;
  }

  // assets/app.js
  var $ = (id) => document.getElementById(id);
  var api = runtimeApi;
  var CATEGORY = {
    board: "\uBCF4\uB4DC",
    sensor: "\uC13C\uC11C",
    display: "\uB514\uC2A4\uD50C\uB808\uC774",
    output: "\uCD9C\uB825",
    input: "\uC785\uB825",
    module: "\uBAA8\uB4C8",
    actuator: "\uAD6C\uB3D9\uAE30",
    power: "\uC804\uC6D0",
    passive: "\uC218\uB3D9 \uC18C\uC790"
  };
  var PIN_TYPE = {
    power_out: "\uC804\uC6D0 \uCD9C\uB825",
    power_in: "\uC804\uC6D0 \uC785\uB825",
    gnd: "GND",
    gpio: "\uC785\uCD9C\uB825(GPIO)",
    input: "\uC785\uB825",
    output: "\uCD9C\uB825",
    passive: "\uB2E8\uC790",
    contact: "\uB9B4\uB808\uC774 \uC811\uC810",
    nc: "\uC0AC\uC6A9 \uAE08\uC9C0"
  };
  var localParts = /* @__PURE__ */ new Map();
  var serverParts = /* @__PURE__ */ new Map();
  var projectParts = /* @__PURE__ */ new Map();
  var state = {
    defs: /* @__PURE__ */ new Map(),
    instances: [],
    wires: [],
    title: "",
    requirements: "",
    power: false,
    gpio: {},
    pressed: /* @__PURE__ */ new Set(),
    history: [],
    future: [],
    settings: { mode: "demo" },
    pendingProposal: null,
    buildingManually: false,
    busy: false
  };
  function wireOriginLabel(wire) {
    if (wire.origin === "ai") return "AI \uCD94\uCC9C \uBC30\uC120";
    if (wire.origin === "example") return "\uB0B4\uC7A5 \uC608\uC81C \uBC30\uC120";
    return "\uC9C1\uC811 \uC5F0\uACB0\uD55C \uBC30\uC120";
  }
  var tooltipEl = $("tooltip");
  var tooltip = {
    showPart(ref, e) {
      const inst = state.instances.find((i) => i.ref === ref);
      const def2 = inst && defFor(state.defs, inst);
      if (!def2) return this.hide();
      tooltipEl.innerHTML = `<b>${escapeHtml(ref)} \xB7 ${escapeHtml(def2.name)}</b><br>${escapeHtml(def2.description || "")}${inst.label ? "<br>\uC5ED\uD560: " + escapeHtml(inst.label) : ""}<br><span class="dim">\uB450 \uBC88 \uD074\uB9AD: \uBD80\uD488 \uC18D\uC131 \xB7 Delete: \uC0AD\uC81C</span>`;
      tooltipEl.classList.remove("hidden");
      this.move(e);
    },
    showPin(key2, e) {
      const [ref, pid] = splitKey(key2);
      const inst = state.instances.find((i) => i.ref === ref);
      const def2 = inst && defFor(state.defs, inst);
      const pin = def2?.pins.find((p) => p.id === pid);
      if (!pin) return;
      const conns = state.wires.filter((w) => w.from === key2 || w.to === key2).map((w) => w.from === key2 ? w.to : w.from);
      let html = `<b>${escapeHtml(ref)}.${escapeHtml(pin.label || pin.id)}</b> <span class="dim">(${escapeHtml(pin.id)})</span><br><span class="dim">${escapeHtml(def2.name)}</span><br>\uC885\uB958: ${escapeHtml(PIN_TYPE[pin.type] || pin.type)}`;
      if (pin.voltage != null) html += `<br>${pin.type === "power_out" ? "\uCD9C\uB825 \uC804\uC555" : "\uB85C\uC9C1 \uC804\uC555"}: ${escapeHtml(pin.voltage)}${typeof pin.voltage === "number" ? "V" : " \uC804\uC555\uC744 \uB530\uB984"}`;
      if (pin.minVoltage != null || pin.maxVoltage != null) {
        html += `<br>\uD5C8\uC6A9 \uBC94\uC704: ${pin.minVoltage != null ? escapeHtml(pin.minVoltage) + "V" : ""} ~ ${pin.maxVoltage != null ? escapeHtml(pin.maxVoltage) + "V" : ""}`;
      }
      if (pin.functions?.length) html += `<br>\uAE30\uB2A5: ${escapeHtml(pin.functions.join(", "))}`;
      if (pin.note) html += `<br><span class="warn">\u203B ${escapeHtml(pin.note)}</span>`;
      html += `<br>\uC5F0\uACB0: ${conns.length ? escapeHtml(conns.join(", ")) : "\uC5C6\uC74C"}`;
      if (state.power && canvas.sim) {
        const net = canvas.sim.netByPin[key2];
        const v = net?.voltage;
        html += `<div class="meter">\u{1F50C} \uBA40\uD2F0\uBBF8\uD130: <span class="v">${v == null ? "\uCE21\uC815 \uC548 \uB428(\uB5A0 \uC788\uC74C)" : v.toFixed(2) + " V"}</span>`;
        if (net?.kind === "gnd") html += " (GND)";
        if (net?.via) html += `<br>${escapeHtml(net.via)}`;
        if (net?.short) html += '<br><span class="err">\u26A1 \uC11C\uB85C \uB2E4\uB978 \uC804\uC6D0\uC774 \uD55C \uC120\uC5D0 \uC9C1\uC811 \uC5F0\uACB0\uB428 (\uBD88\uAF43)</span>';
        const src = net?.sources?.filter((s) => s.strength !== "pullup").map((s) => s.label);
        if (src?.length) html += `<br>\uACF5\uAE09\uC6D0: ${escapeHtml(src.join(", "))}`;
        html += "</div>";
      } else {
        html += '<div class="meter dim">\uAC00\uC0C1 \uC804\uC6D0\uC744 \uCF1C\uBA74 \uC774 \uD540\uC758 \uC804\uC555\uC744 \uCE21\uC815\uD560 \uC218 \uC788\uC5B4\uC694</div>';
      }
      tooltipEl.innerHTML = html;
      tooltipEl.classList.remove("hidden");
      this.move(e);
    },
    showWire(id, e) {
      const w = state.wires.find((x) => x.id === id);
      if (!w) return;
      let html = `<b>${escapeHtml(w.from)} \u2194 ${escapeHtml(w.to)}</b><br>${wireOriginLabel(w)}`;
      if (w.note) html += `<br>${escapeHtml(w.note)}`;
      if (canvas.routeWarnings.has(id)) html += '<br><span class="warn">\uBD80\uD488\uC774 \uACB9\uCE58\uAC70\uB098 \uD540 \uC8FC\uBCC0 \uC5EC\uBC31\uC774 \uBD80\uC871\uD574\uC694. \uBD80\uD488\uC744 \uC870\uAE08 \uB5A8\uC5B4\uB728\uB824 \uC8FC\uC138\uC694.</span>';
      if (state.power && canvas.sim) {
        const v = canvas.sim.netByPin[w.from]?.voltage;
        html += `<div class="meter">\uC804\uC555: <span class="v">${v == null ? "-" : v.toFixed(2) + " V"}</span></div>`;
      }
      tooltipEl.innerHTML = html;
      tooltipEl.classList.remove("hidden");
      this.move(e);
    },
    move(e) {
      if (tooltipEl.classList.contains("hidden")) return;
      const gap = 12, top2 = document.querySelector(".stage-toolbar").getBoundingClientRect().bottom + gap;
      const bottom = document.querySelector(".legend").getBoundingClientRect().top - gap;
      const visible = (el3) => el3 && !el3.hidden && getComputedStyle(el3).display !== "none";
      const panels2 = [$("agentPanel"), $("compactReply"), $("btnChatToggle")].filter(visible).map((el3) => el3.getBoundingClientRect());
      const width = tooltipEl.offsetWidth, height = tooltipEl.offsetHeight;
      const clamp2 = (n, min, max) => Math.max(min, Math.min(n, Math.max(min, max)));
      const candidates = [{ x: e.clientX + 16, y: e.clientY + 16 }, { x: e.clientX - width - 16, y: e.clientY + 16 }];
      for (const r of panels2) candidates.push({ x: r.left - width - gap, y: e.clientY + 16 }, { x: e.clientX - width / 2, y: r.top - height - gap });
      let best = null;
      for (const p of candidates) {
        const x = clamp2(p.x, 8, innerWidth - width - 8), y = clamp2(p.y, top2, bottom - height);
        const overlap = panels2.reduce((sum, r) => sum + Math.max(0, Math.min(x + width, r.right + gap) - Math.max(x, r.left - gap)) * Math.max(0, Math.min(y + height, r.bottom + gap) - Math.max(y, r.top - gap)), 0);
        const score = overlap * 1e4 + Math.abs(x - e.clientX) + Math.abs(y - e.clientY);
        if (!best || score < best.score) best = { x, y, score };
      }
      tooltipEl.style.left = `${best.x}px`;
      tooltipEl.style.top = `${best.y}px`;
    },
    hide() {
      tooltipEl.classList.add("hidden");
    }
  };
  var canvas = new WiringCanvas($("canvas"), {
    getDefs: () => state.defs,
    onChange: () => {
      syncFromCanvas();
      pushHistory();
      refresh();
    },
    onSelect: (sel) => {
      showSelection(sel);
      updateWireDockActions();
    },
    onPartClick: (ref) => {
      const inst = state.instances.find((i) => i.ref === ref);
      const def2 = inst && defFor(state.defs, inst);
      if (state.power && def2?.behavior?.kind === "button") {
        state.pressed.has(ref) ? state.pressed.delete(ref) : state.pressed.add(ref);
        refresh();
        return true;
      }
      return false;
    },
    onPartDoubleClick: (ref) => {
      tooltip.hide();
      canvas.select({ type: "part", ref });
      if (!propertiesDialog.open) propertiesDialog.show();
    },
    tooltip
  });
  function syncFromCanvas() {
    state.instances = canvas.instances;
    state.wires = canvas.wires;
  }
  function syncToCanvas() {
    canvas.instances = state.instances;
    canvas.wires = state.wires;
  }
  function snapshotState() {
    return JSON.stringify({ instances: state.instances, wires: state.wires, title: state.title });
  }
  var savedSnapshot = snapshotState();
  function hasUnsavedChanges() {
    return snapshotState() !== savedSnapshot;
  }
  window.addEventListener("beforeunload", (event) => {
    if (hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = false;
    }
  });
  function pushHistory() {
    const s = snapshotState();
    if (state.history[state.history.length - 1] === s) return;
    state.history.push(s);
    if (state.history.length > 100) state.history.shift();
    state.future = [];
  }
  function clearEditorSelection() {
    canvas.selected = null;
    canvas.cancelPending();
    $("selInfo").classList.add("hidden");
    document.querySelector(".part-properties-dialog")?.close();
  }
  function resetProjectHistory() {
    state.history = [];
    state.future = [];
    clearEditorSelection();
    pushHistory();
  }
  function restore(s) {
    clearEditorSelection();
    const d = JSON.parse(s);
    state.instances = d.instances;
    state.wires = d.wires;
    state.title = d.title || "";
    syncToCanvas();
    refresh();
  }
  function undo() {
    if (state.history.length < 2) return;
    state.future.push(state.history.pop());
    restore(state.history[state.history.length - 1]);
  }
  function redo() {
    const s = state.future.pop();
    if (!s) return;
    state.history.push(s);
    restore(s);
  }
  function runSim() {
    return simulate({ instances: state.instances, wires: state.wires, defs: state.defs, gpio: state.gpio, pressed: state.pressed });
  }
  function updateWireDockActions() {
    const remove = $("btnDockDeleteWire");
    if (!remove) return;
    remove.disabled = canvas.selected?.type !== "wire";
    $("btnDockUndo").disabled = state.history.length < 2;
    $("btnDockRedo").disabled = state.future.length === 0;
  }
  function refresh() {
    updateWireDockActions();
    canvas.sim = state.power ? runSim() : null;
    canvas.render();
    $("emptyHint").classList.toggle("hidden", state.buildingManually || state.instances.length > 0 || !!canvas.preview);
    const projectName = $("frameProjectName");
    if (projectName) projectName.textContent = state.title || "\uC0C8 \uD504\uB85C\uC81D\uD2B8";
    renderGpioPanel();
  }
  var paletteCat = "all";
  function setPartsOpen(open, restoreFocus = false) {
    const panel = $("partsPalette");
    const toggle = $("btnPaletteToggle");
    if (open) applyPaletteSize();
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "\uBD80\uD488\uD568 \uB2EB\uAE30" : "\uBD80\uD488\uD568 \uC5F4\uAE30");
    toggle.title = open ? "\uBD80\uD488\uD568 \uB2EB\uAE30" : "\uBD80\uD488\uD568 \uC5F4\uAE30";
    if (open) $("partSearch").focus({ preventScroll: true });
    else {
      $("partMenu").classList.add("hidden");
      if (restoreFocus) toggle.focus({ preventScroll: true });
    }
  }
  var paletteSize = { width: 300, height: 560 };
  try {
    const saved = JSON.parse(localStorage.getItem("mir-palette-size"));
    if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) paletteSize = saved;
  } catch {
  }
  function applyPaletteSize() {
    const stage = document.querySelector(".stage-body");
    const area = stage.getBoundingClientRect();
    const dock = $("partsDock");
    const panel = $("partsPalette");
    const gpio = $("gpioPanel");
    const chat = $("agentPanel").getBoundingClientRect();
    const dockStyle = getComputedStyle(dock);
    const left = parseFloat(dockStyle.left);
    const bottom = parseFloat(dockStyle.bottom);
    const gap = parseFloat(dockStyle.getPropertyValue("--parts-gap"));
    const gpioWidth = parseFloat(dockStyle.getPropertyValue("--gpio-width"));
    const right = Math.min(area.right - 12, compactWorkspace.matches ? area.right : chat.left - 12);
    const dockWidth = Math.max(1, right - area.left - left);
    const dockHeight = Math.max(1, area.height - bottom - Math.max(
      0,
      document.querySelector(".stage-toolbar").getBoundingClientRect().bottom - area.top
    ) - 10);
    const stacked = state.power && dockWidth < 280 + gpioWidth + gap;
    dock.toggleAttribute("data-stacked", stacked);
    dock.style.width = dockWidth + "px";
    gpio.style.maxHeight = Math.min(220, dockHeight * (stacked ? 0.35 : 1)) + "px";
    const maxW = Math.max(1, dockWidth - (state.power && !stacked ? gpioWidth + gap : 0));
    const maxH = Math.max(1, dockHeight - (stacked ? gpio.offsetHeight + gap : 0));
    const width = Math.min(maxW, Math.max(Math.min(280, maxW), paletteSize.width));
    const height = Math.min(maxH, Math.max(Math.min(220, maxH), paletteSize.height));
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    for (const handle of document.querySelectorAll("[data-palette-resize]")) {
      if (handle.dataset.paletteResize === "ne") continue;
      const horizontal = handle.dataset.paletteResize === "e";
      handle.setAttribute("aria-valuemin", horizontal ? Math.min(280, maxW) : Math.min(220, maxH));
      handle.setAttribute("aria-valuemax", horizontal ? maxW : maxH);
      handle.setAttribute("aria-valuenow", horizontal ? width : height);
    }
    return { width, height };
  }
  function savePaletteSize() {
    try {
      localStorage.setItem("mir-palette-size", JSON.stringify(paletteSize));
    } catch {
    }
  }
  for (const handle of document.querySelectorAll("[data-palette-resize]")) {
    let drag = null;
    const edge = handle.dataset.paletteResize;
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = $("partsPalette").getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, width: rect.width, height: rect.height };
      handle.setPointerCapture(e.pointerId);
      document.body.classList.add("palette-resizing");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      paletteSize = { width: drag.width + (edge.includes("e") ? e.clientX - drag.x : 0), height: drag.height + (edge.includes("n") ? drag.y - e.clientY : 0) };
      paletteSize = applyPaletteSize();
    });
    const finish = () => {
      if (!drag) return;
      drag = null;
      document.body.classList.remove("palette-resizing");
      savePaletteSize();
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", finish);
    handle.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const size = applyPaletteSize(), step = e.shiftKey ? 40 : 20;
      paletteSize = { width: size.width + (edge.includes("e") ? e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0 : 0), height: size.height + (edge.includes("n") ? e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0 : 0) };
      paletteSize = applyPaletteSize();
      savePaletteSize();
    });
  }
  var paletteCollapsed = new Set((() => {
    try {
      return JSON.parse(localStorage.getItem("mir-palette-collapsed") || "[]");
    } catch {
      return [];
    }
  })());
  function partCatalog() {
    return new Map([...localParts, ...serverParts]);
  }
  function setProjectParts(parts) {
    projectParts = parts;
    state.defs = new Map([...partCatalog(), ...projectParts]);
  }
  async function loadParts() {
    const { parts, errors } = await api.listParts();
    localParts = new Map(parts.map((part) => [part.id, part]));
    setProjectParts(projectParts);
    renderPalette();
    $("partErrors").innerHTML = errors.map((e) => `\u26A0 ${escapeHtml(e)}`).join("<br>");
    refresh();
  }
  function renderPalette() {
    const q = $("partSearch").value.trim().toLowerCase();
    const list = $("partList");
    list.replaceChildren();
    const all = [...state.defs.values()];
    const match = (d) => !q || `${d.id} ${d.name} ${d.description || ""} ${CATEGORY[d.category] || ""} ${partBadges(d).join(" ")} ${d.pins.flatMap((p) => p.functions || []).join(" ")}`.toLowerCase().includes(q);
    const found = all.filter(match);
    renderCategoryChips(found);
    const shown = found.filter((d) => paletteCat === "all" || d.category === paletteCat);
    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "palette-empty";
      empty.innerHTML = `<p>${q ? `'${escapeHtml(q)}'\uC5D0 \uB9DE\uB294 \uBD80\uD488\uC774 \uC5C6\uC5B4\uC694.` : "\uC774 \uBD84\uB958\uC5D0 \uBD80\uD488\uC774 \uC5C6\uC5B4\uC694."}</p>
      <button class="small" data-act="datasheet">\uB370\uC774\uD130\uC2DC\uD2B8\uB85C \uBD80\uD488 \uB9CC\uB4E4\uAE30</button>`;
      empty.querySelector("button").onclick = () => $("partModal").classList.remove("hidden");
      list.appendChild(empty);
      return;
    }
    if (!q && paletteCat === "all") {
      const recent = loadRecent().map((id) => state.defs.get(id)).filter(Boolean);
      if (recent.length) appendGroup(list, "recent", "\uCD5C\uADFC \uC0AC\uC6A9", recent);
    }
    const groups2 = {};
    for (const d of shown) (groups2[d.category] ||= []).push(d);
    const order = Object.keys(CATEGORY);
    for (const cat of Object.keys(groups2).sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
      appendGroup(list, cat, CATEGORY[cat] || cat, groups2[cat], !!q);
    }
  }
  function appendGroup(list, key2, title, defs, forceOpen = false) {
    const closed = !forceOpen && paletteCollapsed.has(key2);
    const head = document.createElement("button");
    head.className = "cat-head";
    head.setAttribute("aria-expanded", String(!closed));
    head.innerHTML = `<span class="chev">${closed ? "\u25B8" : "\u25BE"}</span><span class="label">${escapeHtml(title)}</span><span class="cat-count">${defs.length}</span>`;
    head.onclick = () => {
      paletteCollapsed.has(key2) ? paletteCollapsed.delete(key2) : paletteCollapsed.add(key2);
      try {
        localStorage.setItem("mir-palette-collapsed", JSON.stringify([...paletteCollapsed]));
      } catch {
      }
      renderPalette();
    };
    list.appendChild(head);
    if (closed) return;
    for (const d of defs) list.appendChild(partItem(d));
  }
  function renderCategoryChips(found) {
    const box = $("partCats");
    box.replaceChildren();
    const counts = {};
    for (const d of found) counts[d.category] = (counts[d.category] || 0) + 1;
    const order = Object.keys(CATEGORY).filter((c) => counts[c]);
    if (paletteCat !== "all" && !counts[paletteCat]) order.push(paletteCat);
    for (const cat of ["all", ...order]) {
      const b = document.createElement("button");
      b.className = `chip ${paletteCat === cat ? "on" : ""}`;
      b.textContent = cat === "all" ? `\uC804\uCCB4 ${found.length}` : `${CATEGORY[cat] || cat} ${counts[cat] || 0}`;
      b.onclick = () => {
        paletteCat = cat;
        renderPalette();
      };
      box.appendChild(b);
    }
  }
  function partItem(d) {
    const item = document.createElement("div");
    item.className = "part-item";
    item.tabIndex = 0;
    item.draggable = true;
    item.title = `${d.description || d.name}
\uD074\uB9AD\uD558\uAC70\uB098 \uD654\uBA74\uC73C\uB85C \uB04C\uC5B4\uB2E4 \uB193\uC73C\uC138\uC694`;
    const thumb = document.createElement("div");
    thumb.className = "part-thumb";
    thumb.appendChild(partThumb(d));
    const info = document.createElement("div");
    info.className = "part-info";
    info.innerHTML = `<div class="pn">${escapeHtml(d.name)}${d.source === "user" ? '<span class="badge b-info">\uB0B4 \uBD80\uD488</span>' : ""}</div>
    <div class="pbadges">${partBadges(d).map((t) => `<span class="pbadge">${escapeHtml(t)}</span>`).join("")}</div>`;
    item.append(thumb, info);
    item.onclick = () => {
      addPart(d.id);
      setPartsOpen(false, true);
    };
    item.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        addPart(d.id);
        setPartsOpen(false, true);
      }
    };
    item.ondragstart = (e) => {
      e.dataTransfer.setData("application/x-mir-part", d.id);
      e.dataTransfer.effectAllowed = "copy";
      item.classList.add("dragging");
    };
    item.ondragend = () => item.classList.remove("dragging");
    return item;
  }
  var thumbCache = /* @__PURE__ */ new Map();
  function partThumb(d) {
    const key2 = `${d.id}|${d.imageAssetId || (d.imageData ? "img" : "art")}`;
    if (thumbCache.has(key2)) return thumbCache.get(key2).cloneNode(true);
    const NS3 = "http://www.w3.org/2000/svg";
    const { w, h, pos, top: top2 } = layoutPart(d);
    const svg = document.createElementNS(NS3, "svg");
    svg.setAttribute("viewBox", `-8 -8 ${w + 16} ${h + 16}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    const g = document.createElementNS(NS3, "g");
    svg.appendChild(g);
    const bare = isBareArt(d);
    const body = document.createElementNS(NS3, "rect");
    body.setAttribute("width", w);
    body.setAttribute("height", h);
    body.setAttribute("rx", 8);
    body.setAttribute("class", `part-body ${bare ? "bare" : ""}`);
    if (!bare) body.setAttribute("style", d.imageData ? "fill:transparent" : `fill:${d.color || "var(--slate-600)"}`);
    g.appendChild(body);
    drawArt(g, { w, h, top: top2, pos, st: {}, def: d, power: false });
    for (const p of Object.values(pos)) {
      const c = document.createElementNS(NS3, "circle");
      c.setAttribute("cx", p.x);
      c.setAttribute("cy", p.y);
      c.setAttribute("r", 5);
      c.setAttribute("class", `pin pin-${p.def.type}`);
      g.appendChild(c);
    }
    thumbCache.set(key2, svg);
    return svg.cloneNode(true);
  }
  function partBadges(d) {
    const tags = [];
    const kind = d.behavior?.kind;
    if (kind === "board") {
      if (d.logicVoltage) tags.push(`${d.logicVoltage}V \uB85C\uC9C1`);
      tags.push(`GPIO ${d.pins.filter((p) => p.type === "gpio").length}\uAC1C`);
    } else {
      const pin = d.pins.find((p) => p.type === "power_in");
      const out = d.pins.find((p) => p.type === "power_out");
      if (pin && (pin.minVoltage != null || pin.maxVoltage != null)) {
        tags.push(pin.minVoltage != null && pin.maxVoltage != null && pin.minVoltage !== pin.maxVoltage ? `${pin.minVoltage}\u2013${pin.maxVoltage}V` : `${pin.maxVoltage ?? pin.minVoltage}V`);
      } else if (out && typeof out.voltage === "number") tags.push(`${out.voltage}V \uCD9C\uB825`);
      if (kind === "resistor") tags.push(`${d.behavior.ohms >= 1e3 ? d.behavior.ohms / 1e3 + "k" : d.behavior.ohms}\u03A9`);
      if (kind === "led" && d.behavior.forwardVoltage) tags.push(`Vf ${d.behavior.forwardVoltage}V`);
    }
    const fns = d.pins.flatMap((p) => p.functions || []).join(" ");
    for (const [re, label] of [[/I2C/, "I2C"], [/SPI/, "SPI"], [/UART/, "UART"], [/1-Wire/, "1-Wire"], [/ADC/, "ADC"], [/PWM/, "PWM"]]) {
      if (re.test(fns) && tags.length < 4) tags.push(label);
    }
    if (kind === "relay") tags.push("\uB9B4\uB808\uC774");
    return tags.slice(0, 4);
  }
  var RECENT_KEY = "mir-recent-parts";
  function loadRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function rememberRecent(id) {
    const list = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 4);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
    }
  }
  var REF_PREFIX = { board: "U", sensor: "S", display: "DS", output: "LED", input: "SW", module: "M", actuator: "A", power: "PS", passive: "R" };
  function nextRef(def2) {
    let prefix = REF_PREFIX[def2.category] || "X";
    const kind = def2.behavior?.kind;
    if (kind === "relay") prefix = "K";
    if (kind === "diode") prefix = "D";
    if (kind === "load") prefix = "V";
    let n = 1;
    while (state.instances.some((i) => i.ref === `${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }
  function addPart(partId, at) {
    const def2 = state.defs.get(partId);
    if (!def2) return;
    const ref = nextRef(def2);
    const { w, h } = layoutPart(def2);
    let x, y;
    if (at) {
      x = at.x - w / 2;
      y = at.y - Math.min(h, 120) / 2;
    } else {
      const r = $("canvas").getBoundingClientRect();
      const k = canvas.view.k;
      x = canvas.view.x + r.width / k / 2 - w / 2 + (Math.random() * 60 - 30);
      y = canvas.view.y + r.height / k / 3 + (Math.random() * 60 - 30);
    }
    state.instances.push({ ref, part: partId, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 });
    rememberRecent(partId);
    syncToCanvas();
    pushHistory();
    refresh();
    canvas.select({ type: "part", ref });
    if (!$("partSearch").value) renderPalette();
  }
  var stageBody = document.querySelector(".stage-body");
  stageBody.addEventListener("dragover", (e) => {
    if (e.target.closest(".palette")) return;
    if (!e.dataTransfer.types.includes("application/x-mir-part")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    stageBody.classList.add("drop-target");
  });
  stageBody.addEventListener("dragleave", (e) => {
    if (!stageBody.contains(e.relatedTarget)) stageBody.classList.remove("drop-target");
  });
  stageBody.addEventListener("drop", (e) => {
    stageBody.classList.remove("drop-target");
    if (e.target.closest(".palette")) return;
    const id = e.dataTransfer.getData("application/x-mir-part");
    if (!id) return;
    e.preventDefault();
    addPart(id, canvas.toWorld(e));
    setPartsOpen(false);
  });
  var partTransforms = {
    KeyE: { button: "rotateLeft", degrees: -90 },
    KeyR: { button: "rotateRight", degrees: 90 },
    KeyT: { button: "mirrorPart" }
  };
  function transformPart(action) {
    const selection = canvas.selected;
    if (selection?.type !== "part" || state.pendingProposal) return false;
    const inst = state.instances.find((item) => item.ref === selection.ref);
    if (!inst) return false;
    if (action.degrees) {
      inst.rotation = rotationDegrees((inst.rotation ?? 0) + action.degrees);
    } else {
      inst.rotation = rotationDegrees(-(inst.rotation ?? 0));
      if (inst.mirrored) delete inst.mirrored;
      else inst.mirrored = true;
    }
    const focus = document.activeElement;
    pushHistory();
    refresh();
    showSelection(selection);
    if (focus?.id && !focus.isConnected) $(focus.id)?.focus({ preventScroll: true });
    return true;
  }
  function showSelection(sel) {
    const box = $("selInfo");
    if (!sel) return box.classList.add("hidden");
    box.classList.remove("hidden");
    if (sel.type === "part") {
      const inst = state.instances.find((i) => i.ref === sel.ref);
      const def2 = inst && defFor(state.defs, inst);
      if (!def2) return box.classList.add("hidden");
      box.innerHTML = `<h4>${escapeHtml(inst.ref)} \xB7 ${escapeHtml(def2.name)}</h4>
      <div>${escapeHtml(def2.description || "")}</div>
      ${inst.label ? `<div class="muted">\uC5ED\uD560: ${escapeHtml(inst.label)}</div>` : ""}
      ${def2.sources?.length ? `<div class="muted">\uADFC\uAC70: ${escapeHtml(def2.sources.join(", "))}</div>` : ""}
      ${propsEditorHtml(inst, def2)}
      <div class="prop-edit">
        <div class="prop-head">\uBD80\uD488 \uD68C\uC804 <span class="muted">${rotationDegrees(inst.rotation)}\xB0</span></div>
        <div class="row">
          <button id="rotateLeft" aria-keyshortcuts="E">\u21B6 \uC67C\uCABD 90\xB0 \xB7 E</button>
          <button id="rotateRight" aria-keyshortcuts="R">\u21B7 \uC624\uB978\uCABD 90\xB0 \xB7 R</button>
          <button id="mirrorPart" aria-keyshortcuts="T" aria-pressed="${!!inst.mirrored}">\uC88C\uC6B0 \uBC18\uC804 \xB7 T</button>
        </div>
      </div>
      <div class="row"><button id="selDelete">\uBD80\uD488 \uC0AD\uC81C</button></div>`;
      bindPropsEditor(inst, def2, sel);
      for (const action of Object.values(partTransforms)) {
        $(action.button).onclick = () => transformPart(action);
      }
    } else {
      const w = state.wires.find((x) => x.id === sel.id);
      if (!w) return box.classList.add("hidden");
      box.innerHTML = `<h4>${escapeHtml(w.from)} \u2194 ${escapeHtml(w.to)}</h4>
      <div>${wireOriginLabel(w)}</div>
      ${w.note ? `<div class="muted">${escapeHtml(w.note)}</div>` : ""}
      <div class="row"><button id="selDelete">\uC120 \uC0AD\uC81C</button></div>`;
    }
    $("selDelete").onclick = () => canvas.deleteSelected();
  }
  function propsEditorHtml(inst, def2) {
    const kind = editableKind(def2);
    if (!kind) return "";
    const reset = inst.props ? '<button class="ghost small" id="propReset">\uC6D0\uB798 \uAC12\uC73C\uB85C</button>' : "";
    if (kind === "led") {
      const cur = def2.behavior.color;
      const sw = LED_COLORS.map((c) => `<button class="swatch ${cur === c.hex ? "on" : ""}" data-color="${c.id}" title="${c.label} (\uC57D ${c.vf}V)" style="--sw:${c.hex}"></button>`).join("");
      return `<div class="prop-edit"><div class="prop-head">LED \uC0C9 ${reset}</div>
      <div class="swatches">${sw}<label class="swatch custom" title="\uC9C1\uC811 \uACE0\uB974\uAE30"><input type="color" id="propColor" value="${cur || "#ff3b30"}"></label></div>
      <div class="muted">\uCF1C\uC9C0\uB294 \uC804\uC555(\uC21C\uBC29\uD5A5 \uC804\uC555) \uC57D ${def2.behavior.forwardVoltage || 2}V</div></div>`;
    }
    const quick = [220, 330, 1e3, 1e4].map((o) => `<button class="chip ${def2.behavior.ohms === o ? "on" : ""}" data-ohms="${o}">${formatOhms(o)}</button>`).join("");
    return `<div class="prop-edit"><div class="prop-head">\uC800\uD56D\uAC12 ${reset}</div>
    <div class="prop-row"><input id="propOhms" list="ohmPresets" value="${formatOhms(def2.behavior.ohms || 0)}" placeholder="\uC608: 220, 4.7k, 1M"><button id="propOhmsApply">\uBC14\uAFB8\uAE30</button></div>
    <datalist id="ohmPresets">${RESISTOR_PRESETS.map((o) => `<option value="${formatOhms(o)}">`).join("")}</datalist>
    <div class="chips">${quick}</div>
    <div class="muted" id="propMsg">\uC22B\uC790 \uB4A4\uC5D0 k(\uCC9C), M(\uBC31\uB9CC)\uC744 \uBD99\uC77C \uC218 \uC788\uC5B4\uC694. \uC0C9\uB760\uB294 \uAC12\uC5D0 \uB9DE\uAC8C \uBC14\uB01D\uB2C8\uB2E4.</div></div>`;
  }
  function bindPropsEditor(inst, def2, sel) {
    const kind = editableKind(def2);
    if (!kind) return;
    const base = state.defs.get(inst.part);
    const commit = (props) => {
      const clean = cleanProps(base, props);
      if (clean) inst.props = clean;
      else delete inst.props;
      pushHistory();
      refresh();
      showSelection(sel);
    };
    const box = $("selInfo");
    const reset = $("propReset");
    if (reset) reset.onclick = () => commit(null);
    if (kind === "led") {
      box.querySelectorAll(".swatch[data-color]").forEach((b) => {
        b.onclick = () => commit({ color: b.dataset.color });
      });
      $("propColor").onchange = (e) => commit({ color: e.target.value });
      return;
    }
    const apply2 = (v) => {
      const ohms = parseOhms(v);
      if (ohms == null) {
        $("propMsg").textContent = `"${v}"\uC740(\uB294) \uC800\uD56D\uAC12\uC73C\uB85C \uC77D\uC744 \uC218 \uC5C6\uC5B4\uC694. \uC608: 220, 4.7k, 1M`;
        $("propMsg").classList.add("error");
        return;
      }
      commit({ ohms });
    };
    $("propOhmsApply").onclick = () => apply2($("propOhms").value);
    $("propOhms").onkeydown = (e) => {
      if (e.key === "Enter") apply2(e.target.value);
    };
    box.querySelectorAll(".chip[data-ohms]").forEach((b) => {
      b.onclick = () => commit({ ohms: +b.dataset.ohms });
    });
  }
  function setPower(on) {
    state.power = on;
    const b = $("btnPower");
    b.classList.toggle("on", on);
    b.textContent = on ? "\uAC00\uC0C1 \uC804\uC6D0 ON" : "\uAC00\uC0C1 \uC804\uC6D0 OFF";
    $("gpioPanel").classList.toggle("hidden", !on);
    if (!on) state.pressed.clear();
    refresh();
    applyPaletteSize();
  }
  function renderGpioPanel() {
    if (!state.power) return;
    const list = $("gpioList");
    list.replaceChildren();
    const rows = [];
    for (const i of state.instances) {
      const def2 = state.defs.get(i.part);
      if (def2?.behavior?.kind !== "board") continue;
      for (const p of def2.pins) {
        if (p.type !== "gpio") continue;
        const key2 = `${i.ref}.${p.id}`;
        if (!state.wires.some((w) => w.from === key2 || w.to === key2)) continue;
        rows.push({ key: key2, label: `${i.ref}.${p.label || p.id}` });
      }
    }
    if (!rows.length) {
      list.innerHTML = '<div class="gpio-empty">\uC120\uC774 \uC5F0\uACB0\uB41C \uBCF4\uB4DC GPIO\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
      return;
    }
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = "gpio-row";
      const cur = state.gpio[r.key] || "IN";
      row.innerHTML = `<span class="gname">${escapeHtml(r.label)}</span><span class="seg">
      ${["IN", "HIGH", "LOW"].map((m) => `<button data-m="${m}" class="${cur === m ? "on" : ""}">${m === "IN" ? "\uC785\uB825" : m}</button>`).join("")}</span>`;
      row.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          if (b.dataset.m === "IN") delete state.gpio[r.key];
          else state.gpio[r.key] = b.dataset.m;
          refresh();
        };
      });
      list.appendChild(row);
    }
  }
  var COLUMN = { board: 0, sensor: 1, display: 1, input: 1, output: 1, passive: 1, module: 1, actuator: 2, power: 2 };
  function placeNew(instances, keepFrom = []) {
    const colY = [40, 40, 40];
    for (const i of keepFrom) {
      const def2 = state.defs.get(i.part);
      if (!def2) continue;
      const c = Math.min(2, Math.max(0, Math.round(i.x / 320)));
      const bounds = partBounds(i, def2);
      colY[c] = Math.max(colY[c], bounds.y + bounds.h + 50);
    }
    const incoming = [];
    for (const i of instances) {
      if (i.x != null) continue;
      const def2 = state.defs.get(i.part);
      const c = COLUMN[def2?.category] ?? 1;
      const h = def2 ? layoutPart(def2).h : 40;
      i.x = c * 320 + (c === 0 ? 0 : 40);
      i.y = colY[c];
      colY[c] += h + 50;
      incoming.push(i);
    }
    separateParts(incoming, state.defs, keepFrom);
  }
  function normalizeWiring(wiring2, defs = state.defs) {
    const warnings = [];
    const parts = [];
    for (const p of wiring2.parts || []) {
      if (!p.ref || !p.part) continue;
      if (!defs.has(p.part)) {
        warnings.push(`\uBD80\uD488\uD568\uC5D0 \uC5C6\uB294 \uBD80\uD488: ${p.part} (${p.ref}) \u2014 \uBD80\uD488 JSON\uC744 \uCD94\uAC00\uD574\uC57C \uADF8\uB9B4 \uC218 \uC788\uC5B4\uC694`);
        continue;
      }
      parts.push({ ref: String(p.ref), part: p.part, label: p.label, props: cleanProps(defs.get(p.part), p.props) });
    }
    const conns = [];
    for (const c of wiring2.connections || []) {
      const ok = [c.from, c.to].every((k) => {
        if (typeof k !== "string" || !k.includes(".")) return false;
        const [ref, pid] = splitKey(k);
        const p = parts.find((x) => x.ref === ref);
        return p && defs.get(p.part).pins.some((pin) => pin.id === pid);
      });
      if (!ok) {
        warnings.push(`\uADF8\uB9B4 \uC218 \uC5C6\uB294 \uC5F0\uACB0: ${c.from} \u2192 ${c.to} (\uD540 \uC774\uB984 \uD655\uC778 \uD544\uC694)`);
        continue;
      }
      conns.push({ from: c.from, to: c.to, note: c.note });
    }
    return { parts, conns, warnings };
  }
  var connKey = (a, b) => [a, b].sort().join("|");
  function proposeWiring(wiring2) {
    const { parts, conns, warnings } = normalizeWiring(wiring2);
    if (warnings.length) addMessage("system", warnings.join("\n"));
    if (!parts.length) return;
    if (!state.instances.length) {
      applyProposal({ parts, conns, title: wiring2.title });
      return;
    }
    const cur = new Map(state.wires.map((w) => [connKey(w.from, w.to), w]));
    const next = new Map(conns.map((c) => [connKey(c.from, c.to), c]));
    const removed = new Set([...cur].filter(([k]) => !next.has(k)).map(([, w]) => w.id));
    const added = [...next].filter(([k]) => !cur.has(k)).map(([, c], n) => ({ id: `p${n}`, ...c, origin: "ai" }));
    const addedParts = parts.filter((p) => !state.instances.some((i) => i.ref === p.ref && i.part === p.part)).map((p) => ({ ...p }));
    const removedParts = state.instances.filter((i) => !parts.some((p) => p.ref === i.ref && p.part === i.part));
    placeNew(addedParts, state.instances);
    const changedProps = parts.filter((p) => p.props && state.instances.some((i) => i.ref === p.ref && i.part === p.part && JSON.stringify(i.props) !== JSON.stringify(p.props)));
    if (!removed.size && !added.length && !addedParts.length && !removedParts.length && !changedProps.length) {
      addMessage("system", "\uC81C\uC548\uB41C \uBC30\uC120\uC774 \uD604\uC7AC \uBC30\uC120\uACFC \uAC19\uC2B5\uB2C8\uB2E4.");
      return;
    }
    state.pendingProposal = { parts, conns, title: wiring2.title, addedParts };
    canvas.preview = { added, removed, addedParts };
    const desc = [];
    if (added.length) desc.push(`<span class="add">+ \uC120 ${added.length}\uAC1C</span>`);
    if (removed.size) desc.push(`<span class="del">\u2212 \uC120 ${removed.size}\uAC1C</span>`);
    if (addedParts.length) desc.push(`<span class="add">+ \uBD80\uD488 ${escapeHtml(addedParts.map((p) => p.ref).join(", "))}</span>`);
    if (changedProps.length) desc.push(`<span class="add">\uAC12 \uBCC0\uACBD ${changedProps.map((p) => p.ref).join(", ")}</span>`);
    if (removedParts.length) desc.push(`<span class="del">\u2212 \uBD80\uD488 ${escapeHtml(removedParts.map((p) => p.ref).join(", "))}</span>`);
    $("previewText").innerHTML = `<b>AI \uC218\uC815\uC548 \uBBF8\uB9AC\uBCF4\uAE30</b> \u2014 ${desc.join(" \xB7 ")}<br><span class="muted">\uCD08\uB85D \uC810\uC120=\uCD94\uAC00, \uBE68\uAC04 \uC810\uC120=\uC0AD\uC81C. \uC801\uC6A9\uD558\uAE30 \uC804\uC5D0 \uD655\uC778\uD558\uC138\uC694.</span>`;
    $("previewBar").classList.remove("hidden");
    refresh();
  }
  function applyProposal({ parts, conns, title, addedParts = [], origin = "ai" }) {
    const keep = new Map(state.instances.map((i) => [`${i.ref}|${i.part}`, i]));
    const placed = new Map(addedParts.map((p) => [`${p.ref}|${p.part}`, p]));
    const instances = parts.map((p) => {
      const old = keep.get(`${p.ref}|${p.part}`) || placed.get(`${p.ref}|${p.part}`);
      return { ref: p.ref, part: p.part, label: p.label, x: old?.x, y: old?.y, ...old?.rotation == null ? {} : { rotation: old.rotation }, ...old?.mirrored ? { mirrored: true } : {}, ...p.props || old?.props ? { props: p.props || old.props } : {} };
    });
    placeNew(instances, instances.filter((i) => i.x != null));
    state.instances = instances;
    const previousWires = new Map(state.wires.map((w) => [connKey(w.from, w.to), w]));
    state.wires = conns.map((c, n) => {
      const old = previousWires.get(connKey(c.from, c.to));
      return { ...old || {}, id: old?.id || `a${Date.now().toString(36)}${n}`, from: c.from, to: c.to, note: c.note ?? old?.note, origin: old?.origin || origin };
    });
    if (title) state.title = title;
    state.gpio = {};
    clearPreview();
    syncToCanvas();
    pushHistory();
    refresh();
    canvas.fit();
  }
  function clearPreview() {
    canvas.preview = null;
    state.pendingProposal = null;
    $("previewBar").classList.add("hidden");
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function renderMarkdown(text2) {
    const parts = text2.split(/```(\w*)\n?([\s\S]*?)```/g);
    let html = "";
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        html += escapeHtml(parts[i]).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
      } else if (i % 3 === 2) {
        html += codeBlock(parts[i]);
      }
    }
    return html.trim();
  }
  function codeBlock(code) {
    return `<pre><button class="copy small" data-copy="${escapeHtml(code)}">\uBCF5\uC0AC</button><code>${escapeHtml(code)}</code></pre>`;
  }
  function addMessage(role, text2, extra, notifyCompact = false) {
    if (state.settings.mode === "web" && role === "system") {
      const entry = document.createElement("p");
      entry.textContent = text2;
      $("webActivity").appendChild(entry);
    }
    const m = document.createElement("div");
    m.className = `msg ${role}`;
    m.innerHTML = role === "agent" ? renderMarkdown(text2) : escapeHtml(text2);
    if (extra) m.appendChild(extra);
    $("messages").appendChild(m);
    if (notifyCompact && document.body.classList.contains("chat-collapsed")) showCompactReply(text2);
    if (!document.body.classList.contains("chat-collapsed") && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      m.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 200, easing: "ease-out" });
    }
    m.querySelectorAll("[data-copy]").forEach((b) => {
      b.onclick = () => {
        navigator.clipboard.writeText(b.dataset.copy);
        b.textContent = "\uBCF5\uC0AC\uB428";
      };
    });
    $("messages").scrollTop = $("messages").scrollHeight;
    return m;
  }
  function wiringCard(wiring2) {
    const card = document.createElement("div");
    card.className = "wiring-card";
    const conns = (wiring2.connections || []).map((c) => `<div class="conn">${escapeHtml(c.from)} \u2192 ${escapeHtml(c.to)}${c.note ? ` <span class="muted">\xB7 ${escapeHtml(c.note)}</span>` : ""}</div>`).join("");
    const steps = wiring2.steps?.length ? `<div><b>\uC21C\uC11C</b><ul>${wiring2.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>` : "";
    const warns = wiring2.warnings?.length ? `<div class="warns"><b>\uC8FC\uC758</b><ul>${wiring2.warnings.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>` : "";
    const code = wiring2.code ? `<details><summary>\uC608\uC81C \uCF54\uB4DC</summary>${codeBlock(wiring2.code)}</details>` : "";
    card.innerHTML = `<h4>\u{1F50C} ${escapeHtml(wiring2.title || "\uBC30\uC120 \uC81C\uC548")}</h4>
    <div class="muted">\uBD80\uD488: ${(wiring2.parts || []).map((p) => `${escapeHtml(p.ref)}(${escapeHtml(p.part)})`).join(", ")}</div>
    <details open><summary>\uC5F0\uACB0 ${wiring2.connections?.length || 0}\uAC1C</summary>${conns}</details>
    ${steps}${warns}${code}
    <div class="row"><button data-act="draw">2D \uD654\uBA74\uC5D0 \uB2E4\uC2DC \uADF8\uB9AC\uAE30</button></div>`;
    const draw = card.querySelector('[data-act="draw"]');
    draw.dataset.projectAction = "";
    draw.onclick = () => proposeWiring(wiring2);
    card.querySelectorAll("[data-copy]").forEach((b) => {
      b.onclick = () => {
        navigator.clipboard.writeText(b.dataset.copy);
        b.textContent = "\uBCF5\uC0AC\uB428";
      };
    });
    return card;
  }
  function partCard(part) {
    const card = document.createElement("div");
    card.className = "wiring-card";
    card.innerHTML = `<h4>\u{1F9E9} \uC0C8 \uBD80\uD488: ${escapeHtml(part.name || part.id)}</h4>
    <div class="muted">id: ${escapeHtml(part.id)} \xB7 \uD540 ${part.pins?.length || 0}\uAC1C</div>
    <div class="conn">${(part.pins || []).map((p) => `${escapeHtml(p.id)}(${escapeHtml(p.type)}${p.voltage != null ? " " + escapeHtml(p.voltage) + "V" : ""})`).join(", ")}</div>
    <div class="warns">\uB370\uC774\uD130\uC2DC\uD2B8\uC640 \uD540 \uC815\uBCF4\uB97C \uD55C \uBC88 \uB354 \uD655\uC778\uD55C \uB4A4 \uC800\uC7A5\uD558\uC138\uC694.</div>
    <div class="row"><button data-act="save">\uBD80\uD488\uD568\uC5D0 \uC800\uC7A5</button></div>`;
    card.querySelector('[data-act="save"]').onclick = async (e) => {
      try {
        const { type, ...clean } = part;
        await api.savePart(clean);
        e.target.disabled = true;
        e.target.textContent = "\uC800\uC7A5\uB428";
        await loadParts();
      } catch (err) {
        addMessage("system", `\uBD80\uD488 \uC800\uC7A5 \uC2E4\uD328: ${err.message}`);
      }
    };
    return card;
  }
  var projectGeneration = 0;
  async function askAgent(message, { shown, ctx = {} } = {}) {
    if (state.busy) return;
    const requestGeneration = projectGeneration;
    const isCurrent = () => requestGeneration === projectGeneration;
    state.busy = true;
    $("compactReply").hidden = true;
    $("btnSend").disabled = true;
    if (shown) addMessage("user", shown);
    const typing = addMessage("agent", "\uC5D0\uC774\uC804\uD2B8\uAC00 \uC0DD\uAC01\uD558\uB294 \uC911\u2026");
    typing.classList.add("typing");
    const waitingSince = Date.now();
    let waitingStage = "\uC694\uCCAD \uC900\uBE44 \uC911";
    const refreshWaiting = () => {
      typing.textContent = `${waitingStage} \xB7 ${Math.floor((Date.now() - waitingSince) / 1e3)}\uCD08`;
    };
    const waitingTimer = setInterval(refreshWaiting, 1e3);
    try {
      let reply;
      const res = await api.sendToAgent(message, buildCatalog(state.defs), (progress) => {
        waitingStage = progress.stage === "opening" ? "Copilot \uB300\uD654 \uC5F0\uACB0 \uC911" : progress.stage === "reconnecting" ? "Microsoft \uC5F0\uACB0 \uC7AC\uD655\uC778 \uC911" : progress.stage === "receiving" ? "Copilot \uC751\uB2F5 \uC218\uC2E0 \uC911" : "Copilot \uC751\uB2F5 \uB300\uAE30 \uC911";
        refreshWaiting();
      });
      if (res.demo) {
        typing.textContent = "\uC800\uC7A5\uB41C \uB370\uBAA8 \uC608\uC2DC\uB97C \uD655\uC778\uD558\uB294 \uC911\u2026";
        await new Promise((r) => setTimeout(r, 500));
        reply = demoReply(message, ctx);
      } else {
        reply = res.reply;
      }
      typing.remove();
      if (!isCurrent()) return;
      const { text: text2, wiring: wiring2, part, circuit, clarification } = parseReply(reply);
      let extra = circuit ? null : wiring2 ? wiringCard(wiring2) : part ? partCard(part) : null;
      if (circuit) {
        extra = document.createElement("button");
        extra.disabled = true;
        extra.dataset.projectAction = "";
        extra.textContent = "\uC5D0\uC774\uC804\uD2B8 \uD68C\uB85C\uB97C DB\uC5D0\uC11C \uBD88\uB7EC\uC624\uAE30";
        extra.onclick = () => backend.openCircuit(circuit.circuit_id || circuit.id, { showPanel: false });
      }
      addMessage("agent", text2 || (circuit ? "\uD68C\uB85C ID\uAC00 \uBC18\uD658\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC800\uC7A5\uB41C \uBC30\uC120\uC744 \uD655\uC778\uD569\uB2C8\uB2E4." : wiring2 ? "\uBC30\uC120\uC744 \uC81C\uC548\uD569\uB2C8\uB2E4." : "(\uBE48 \uC751\uB2F5)"), extra, true);
      const applied = await applyAgentResult({ wiring: wiring2, circuit, clarification }, {
        backend,
        hasInstances: () => state.instances.length > 0,
        drawWiring: proposeWiring,
        isCurrent,
        isDemo: !!res.demo
      }).finally(() => {
        if (circuit && isCurrent()) extra.disabled = false;
      });
      if (!isCurrent()) return;
      if (applied === "text-only" && !part && message.includes("[\uC694\uCCAD \uC885\uB958: \uBC30\uC120 \uCD94\uCC9C]")) {
        addMessage("system", "\uC5D0\uC774\uC804\uD2B8 \uC751\uB2F5\uC5D0 \uD68C\uB85C ID\uB098 \uBC30\uC120 \uB370\uC774\uD130\uAC00 \uC5C6\uC5B4 \uADF8\uB9BC\uC744 \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBD80\uD488 \uB4F1\uB85D\uACFC \uBC30\uC120 \uC124\uACC4\uB294 \uBCC4\uB3C4 \uB2E8\uACC4\uC785\uB2C8\uB2E4. \uC751\uB2F5\uC758 \uD655\uC778 \uC9C8\uBB38\uC774\uB098 \uBD80\uC871\uD55C \uC0AC\uC591\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      }
    } catch (e) {
      typing.remove();
      if (requestGeneration !== projectGeneration) return;
      if (shown && !$("chatInput").value.trim()) $("chatInput").value = shown;
      addMessage("system", `\uC5D0\uC774\uC804\uD2B8 \uD638\uCD9C \uC2E4\uD328: ${String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")}
\uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uD0ED\uC5D0\uC11C \uC5F0\uACB0 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC138\uC694.`, null, true);
    } finally {
      clearInterval(waitingTimer);
      state.busy = false;
      $("btnSend").disabled = false;
    }
  }
  function showConnectionSetup() {
    if (state.settings.serverSecretConfigured) return false;
    $("btnSettings").click();
    return true;
  }
  function sendChat() {
    if (state.busy) return;
    const text2 = $("chatInput").value.trim();
    if (!text2 || showConnectionSetup()) return;
    $("chatInput").value = "";
    let message;
    if (!state.instances.length) message = buildRecommendRequest(text2);
    else message = buildChatRequest(text2, $("attachWiring").checked ? wiringSnapshot(state, state.defs) : null);
    askAgent(message, { shown: text2 });
  }
  function measurementReport(sim) {
    const lines = [];
    const used = new Set(state.wires.flatMap((w) => [w.from, w.to]));
    for (const key2 of used) {
      const net = sim.netByPin[key2];
      const [ref, pid] = splitKey(key2);
      const inst = state.instances.find((i) => i.ref === ref);
      const pin = state.defs.get(inst?.part)?.pins.find((p) => p.id === pid);
      if (!pin) continue;
      const range = pin.minVoltage != null || pin.maxVoltage != null ? ` (\uD5C8\uC6A9 ${pin.minVoltage ?? ""}~${pin.maxVoltage ?? ""}V)` : "";
      lines.push(`- ${key2}: ${net?.voltage == null ? "\uB5A0 \uC788\uC74C" : net.voltage.toFixed(2) + "V"}${net?.short ? " [\uC11C\uB85C \uB2E4\uB978 \uC804\uC6D0 \uC9C1\uACB0]" : ""}${range}`);
    }
    for (const [ref, st] of Object.entries(sim.parts)) {
      const s = [];
      if (st.lit != null) s.push(st.lit ? st.burnt ? "LED \uCF1C\uC9D0(\uC800\uD56D \uC5C6\uC774 \uACFC\uC804\uB958)" : "LED \uCF1C\uC9D0" : "LED \uAEBC\uC9D0");
      if (st.energized != null) s.push(st.energized ? "\uB9B4\uB808\uC774 \uB3D9\uC791" : st.powered ? "\uB9B4\uB808\uC774 \uB300\uAE30" : "\uB9B4\uB808\uC774 \uC804\uC6D0 \uC5C6\uC74C");
      if (st.on != null) s.push(st.on ? "\uBD80\uD558 \uB3D9\uC791" : `\uBD80\uD558 \uC815\uC9C0(${st.voltage == null ? "-" : st.voltage.toFixed(1) + "V"})`);
      if (st.shorting) s.push("\uB2E4\uC774\uC624\uB4DC \uC815\uBC29\uD5A5 \uC9C1\uACB0");
      if (st.linked != null) s.push(st.linked ? "I2C \uC5F0\uACB0\uB428" : "I2C \uBBF8\uC5F0\uACB0");
      if (s.length) lines.push(`- ${ref}: ${s.join(", ")}`);
    }
    const gpio = Object.entries(state.gpio).map(([k, v]) => `${k}=${v}`).join(", ");
    if (gpio) lines.push(`- \uBCF4\uB4DC \uD540 \uCD9C\uB825 \uC124\uC815: ${gpio}`);
    return lines.join("\n");
  }
  function demoProblems(sim) {
    const out = [];
    for (const [key2, net] of Object.entries(sim.netByPin)) {
      const [ref, pid] = splitKey(key2);
      const inst = state.instances.find((i) => i.ref === ref);
      const pin = state.defs.get(inst?.part)?.pins.find((p) => p.id === pid);
      if (!pin || !state.wires.some((w) => w.from === key2 || w.to === key2)) continue;
      if (net.short) out.push(`${key2}: \uC11C\uB85C \uB2E4\uB978 \uC804\uC6D0\uC774 \uD55C \uC120\uC5D0 \uC9C1\uC811 \uBD99\uC5B4 \uC788\uC2B5\uB2C8\uB2E4(\uB2E8\uB77D). \uBC30\uC120 \uBB38\uC81C\uC785\uB2C8\uB2E4.`);
      else if (pin.maxVoltage != null && net.voltage != null && net.voltage > pin.maxVoltage) out.push(`${key2}: ${net.voltage}V\uAC00 \uB4E4\uC5B4\uC624\uC9C0\uB9CC \uD5C8\uC6A9 \uCD5C\uB300\uB294 ${pin.maxVoltage}V\uC785\uB2C8\uB2E4. \uC804\uC6D0 \uC804\uC555\uC744 \uB0AE\uCD94\uAC70\uB098 \uB808\uBCA8 \uBCC0\uD658\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.`);
      else if (pin.type === "power_in" && pin.minVoltage != null && net.voltage != null && net.voltage < pin.minVoltage && net.voltage > 0) out.push(`${key2}: ${net.voltage}V\uB85C\uB294 \uBD80\uC871\uD569\uB2C8\uB2E4(\uCD5C\uC18C ${pin.minVoltage}V).`);
    }
    for (const [ref, st] of Object.entries(sim.parts)) {
      if (st.burnt) out.push(`${ref}: LED\uC5D0 \uC804\uB958 \uC81C\uD55C \uC800\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`);
      if (st.shorting) out.push(`${ref}: \uB2E4\uC774\uC624\uB4DC \uBC29\uD5A5\uC774 \uBC18\uB300\uB77C \uC804\uC6D0\uC744 \uB2E8\uB77D\uC2DC\uD0B5\uB2C8\uB2E4. \uB760(K)\uB97C + \uCABD\uC73C\uB85C \uBC14\uAFB8\uC138\uC694.`);
      if (st.powered && st.linked === false) out.push(`${ref}: I2C SDA/SCL\uC774 \uBCF4\uB4DC\uC758 SDA/SCL \uD540\uC5D0 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.`);
    }
    return [...new Set(out)];
  }
  async function requestDiagnosis() {
    if (state.busy) return;
    if (!state.instances.length) {
      addMessage("system", "\uBA3C\uC800 \uBC30\uC120\uC744 \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694.");
      return;
    }
    if (showConnectionSetup()) return;
    const memo = $("chatInput").value.trim();
    $("chatInput").value = "";
    const sim = runSim();
    const message = buildDiagnoseRequest({
      snapshot: wiringSnapshot(state, state.defs),
      checklist: [],
      measurements: measurementReport(sim),
      memo
    });
    await askAgent(message, {
      shown: memo ? `\uAC00\uC0C1 \uD14C\uC2A4\uD2B8 \uACB0\uACFC\uB85C \uC9C4\uB2E8\uD574\uC918: ${memo}` : "\uAC00\uC0C1 \uD14C\uC2A4\uD2B8 \uACB0\uACFC\uB85C \uC6D0\uC778\uACFC \uC218\uC815\uC548\uC744 \uC54C\uB824\uC918.",
      ctx: { problems: demoProblems(sim) }
    });
  }
  async function loadSettings() {
    state.settings = await api.getSettings();
    const { apiKeyReady: db, serverSecretConfigured: ai } = state.settings;
    $("connPill").textContent = db ? ai ? "Copilot \xB7 DB \uC5F0\uACB0\uB428" : "DB \uC5F0\uACB0\uB428 \xB7 AI \uBBF8\uC5F0\uACB0" : "AI \xB7 DB \uBBF8\uC5F0\uACB0";
    $("connPill").className = "badge " + (db ? ai ? "b-ok" : "b-warn" : "b-mute");
    $("emptyHint").querySelector("h3").textContent = "\uBB34\uC5C7\uC744 \uB9CC\uB4E4\uACE0 \uC2F6\uB098\uC694?";
    $("emptyHint").querySelector("p").textContent = "\uC544\uB798 \uCE74\uB4DC\uB97C \uB20C\uB7EC \uC608\uC81C \uD68C\uB85C\uB97C \uBC14\uB85C \uC5F4\uAC70\uB098, \uBD80\uD488\uD568\uC5D0\uC11C \uC9C1\uC811 \uC2DC\uC791\uD574 \uBCF4\uC138\uC694.";
  }
  window.addEventListener("mir-connection-status", () => void loadSettings());
  async function openSettings() {
    if ($("settingsModal").open || connectionAttempt) return;
    const connection2 = await api.getServerConnection();
    $("serverConnectionMode").value = connection2.mode;
    $("inServerUrl").value = connection2.url;
    $("inServerKey").value = "";
    $("inServerKey").placeholder = connection2.hasKey ? "\uD604\uC7AC \uD0A4 \uC720\uC9C0" : "\uC11C\uBC84 \uAD00\uB9AC\uC790\uC5D0\uAC8C \uBC1B\uC740 \uD0A4";
    $("testResult").textContent = "";
    $("testResult").className = "test-result";
    updateSettingsFields();
    if (!$("settingsModal").open) $("settingsModal").showModal();
    $("serverConnectionMode").focus();
  }
  function updateSettingsFields() {
    const remote = $("serverConnectionMode").value === "remote";
    $("remoteServerFields").hidden = !remote;
    $("inServerUrl").required = remote;
  }
  $("btnPower").onclick = () => setPower(!state.power);
  $("btnUndo").onclick = undo;
  $("btnRedo").onclick = redo;
  $("btnDelete").onclick = () => canvas.deleteSelected();
  $("btnZoomIn").onclick = () => canvas.zoom(1.2);
  $("btnZoomOut").onclick = () => canvas.zoom(1 / 1.2);
  $("btnFit").onclick = () => canvas.fit();
  $("btnSend").onclick = sendChat;
  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendChat();
    }
  });
  for (const button2 of document.querySelectorAll("[data-example]")) {
    button2.onclick = () => {
      if (state.instances.length || state.pendingProposal) return;
      const wiring2 = getBuiltInWiring(button2.dataset.example);
      if (!wiring2) return;
      const { parts, conns, warnings } = normalizeWiring(wiring2, localParts);
      if (warnings.length) {
        addMessage("system", `\uC608\uC81C\uB97C \uC5F4\uC9C0 \uBABB\uD588\uC5B4\uC694.
${warnings.join("\n")}`, null, true);
        return;
      }
      const definitions = new Map(projectParts);
      for (const part of parts) definitions.set(part.part, localParts.get(part.part));
      setProjectParts(definitions);
      renderPalette();
      projectGeneration++;
      applyProposal({ parts, conns, title: wiring2.title, origin: "example" });
    };
  }
  $("btnBuildManually").onclick = () => {
    state.buildingManually = true;
    refresh();
    setPartsOpen(true);
  };
  var manualDialog = $("manualDialog");
  var manualFrame = manualDialog.querySelector("iframe");
  function updateManualTheme() {
    manualFrame.contentWindow?.postMessage({ type: "mir-manual-theme", theme: currentTheme() }, "*");
  }
  manualFrame.addEventListener("load", updateManualTheme);
  manualDialog.addEventListener("close", () => {
    manualFrame.contentWindow?.postMessage({ type: "mir-manual-close" }, "*");
  });
  $("btnManual").onclick = () => {
    updateManualTheme();
    manualDialog.showModal();
  };
  $("btnCloseManual").onclick = () => manualDialog.close();
  $("partSearch").oninput = renderPalette;
  $("btnPaletteToggle").onclick = () => setPartsOpen($("partsPalette").hidden, true);
  $("btnPaletteClose").onclick = () => setPartsOpen(false, true);
  document.addEventListener("pointerdown", (e) => {
    if ($("partsPalette").hidden || document.querySelector(".modal:not(.hidden)")) return;
    if (!$("partsDock").contains(e.target) && !$("btnPaletteToggle").contains(e.target)) setPartsOpen(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || $("partsPalette").hidden || document.querySelector("dialog[open],.modal:not(.hidden)")) return;
    setPartsOpen(false, true);
    e.preventDefault();
    e.stopImmediatePropagation();
  });
  $("btnPreviewApply").onclick = () => state.pendingProposal && applyProposal(state.pendingProposal);
  $("btnPreviewCancel").onclick = () => {
    clearPreview();
    refresh();
  };
  $("btnDiagnose").onclick = requestDiagnosis;
  function alignAgentBelowToolbar() {
    const bottom = document.querySelector(".stage-toolbar").getBoundingClientRect().bottom;
    document.documentElement.style.setProperty("--agent-top", `${Math.ceil(bottom + 12)}px`);
    const footerTop = document.querySelector(".legend").getBoundingClientRect().top;
    document.documentElement.style.setProperty("--agent-bottom", `${Math.ceil(window.innerHeight - footerTop + 12)}px`);
  }
  var toolbarObserver = new ResizeObserver(alignAgentBelowToolbar);
  toolbarObserver.observe(document.querySelector(".stage-toolbar"));
  toolbarObserver.observe(document.querySelector(".topbar"));
  toolbarObserver.observe(document.querySelector(".legend"));
  window.addEventListener("resize", alignAgentBelowToolbar);
  alignAgentBelowToolbar();
  function showCompactReply(text2) {
    const bubble = $("compactReply");
    $("compactReplyText").textContent = text2;
    bubble.hidden = false;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) bubble.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 200, easing: "ease-out" });
  }
  $("btnReplyClose").onclick = () => {
    $("compactReply").hidden = true;
    $("chatInput").focus();
  };
  for (const overlay of [$("agentPanel"), $("compactReply")]) {
    for (const event of ["keydown", "mousedown", "mousemove", "wheel", "dblclick"]) overlay.addEventListener(event, (e) => e.stopPropagation());
  }
  var compactWorkspace = matchMedia("(max-width: 900px)");
  function setChatCollapsed(collapsed, focus = false) {
    document.body.classList.toggle("chat-collapsed", collapsed);
    if (!collapsed) $("compactReply").hidden = true;
    $("btnChatToggle").setAttribute("aria-expanded", String(!collapsed));
    $("btnChatToggle").textContent = collapsed ? "\uB300\uD654\uCC3D \uD3BC\uCE58\uAE30 \u2197" : "\uB300\uD654\uCC3D \uC811\uAE30 \u2198";
    $("btnChatToggle").title = collapsed ? "\uC5D0\uC774\uC804\uD2B8 \uB300\uD654\uCC3D \uD3BC\uCE58\uAE30" : "\uC5D0\uC774\uC804\uD2B8 \uB300\uD654\uCC3D \uC811\uAE30";
    if (focus && (!collapsed || !compactWorkspace.matches)) $("chatInput").focus({ preventScroll: true });
  }
  $("btnChatToggle").onclick = () => setChatCollapsed(!document.body.classList.contains("chat-collapsed"), true);
  compactWorkspace.addEventListener("change", (event) => setChatCollapsed(event.matches));
  if (compactWorkspace.matches) setChatCollapsed(true);
  try {
    canvas.wireStyle = localStorage.getItem("mir-wire-shape-v2") === "straight" ? "straight" : "curve";
  } catch {
  }
  function updateWirePreview() {
    const curve = $("wireShapeToggle").checked;
    $("wirePreviewPath").setAttribute("d", curve ? "M72 50 C146 50 214 114 288 114" : "M72 50 L174 50 Q180 50 180 56 L180 108 Q180 114 186 114 L288 114");
    $("wirePreviewLabel").textContent = curve ? "\uACE1\uC120" : "\uC9C1\uC120";
    $("wirePreviewPath").parentElement.setAttribute("aria-label", curve ? "\uBD80\uB4DC\uB7FD\uAC8C \uD718\uC5B4\uC9C0\uB294 \uACE1\uC120 \uBC30\uC120 \uBBF8\uB9AC\uBCF4\uAE30" : "\uBAA8\uC11C\uB9AC\uAC00 \uC0B4\uC9DD \uB465\uADFC \uC9C1\uC120 \uBC30\uC120 \uBBF8\uB9AC\uBCF4\uAE30");
  }
  $("btnWireSettings").onclick = () => {
    closeProjectMenu();
    $("wireShapeToggle").checked = canvas.wireStyle === "curve";
    updateWirePreview();
    $("wireSettings").showModal();
  };
  $("btnWireSettingsClose").onclick = () => $("wireSettings").close();
  $("wireShapeToggle").onchange = () => {
    updateWirePreview();
    canvas.wireStyle = $("wireShapeToggle").checked ? "curve" : "straight";
    try {
      localStorage.setItem("mir-wire-shape-v2", canvas.wireStyle);
    } catch {
    }
    canvas.render();
  };
  var projectMenu = $("projectMenu");
  function closeProjectMenu() {
    projectMenu.close();
    $("btnMenu").setAttribute("aria-expanded", "false");
    $("btnMenu").focus();
  }
  $("btnMenu").onclick = () => {
    projectMenu.showModal();
    $("btnMenu").setAttribute("aria-expanded", "true");
  };
  $("btnMenuClose").onclick = closeProjectMenu;
  projectMenu.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeProjectMenu();
  });
  projectMenu.addEventListener("click", (e) => {
    const r = projectMenu.getBoundingClientRect();
    if (e.target === projectMenu && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeProjectMenu();
  });
  function resetProjectChat() {
    $("messages").replaceChildren();
    $("compactReply").hidden = true;
    greet();
  }
  $("btnNew").onclick = async () => {
    if (openingProject) return;
    closeProjectMenu();
    if (hasUnsavedChanges() && !await confirmAction("\uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uC791\uC5C5\uC774 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4. \uC0C8\uB85C \uC2DC\uC791\uD560\uAE4C\uC694?")) return;
    await api.newProject?.();
    projectGeneration++;
    state.buildingManually = false;
    state.instances = [];
    state.wires = [];
    state.title = "";
    state.gpio = {};
    state.requirements = "";
    setProjectParts(/* @__PURE__ */ new Map());
    renderPalette();
    backend.reset();
    clearPreview();
    syncToCanvas();
    resetProjectHistory();
    setPower(false);
    savedSnapshot = snapshotState();
    api.resetAgent();
    resetProjectChat();
  };
  function projectData() {
    const data = { format: "mir-wiring/1", title: state.title, instances: state.instances, wires: state.wires };
    const definitions = new Set(state.instances.map((instance) => instance.part));
    const embedded = [];
    for (const id of definitions) {
      const part = state.defs.get(id);
      if (!part || part.source === "builtin" && part === localParts.get(id)) continue;
      const { source, file, image, _layout, ...portable } = part;
      if (part.imageData && part.imageFit === "none" && _layout) portable._layout = _layout;
      embedded.push(portable);
    }
    if (embedded.length) data.partDefinitions = embedded;
    return data;
  }
  async function projectDefinitions(data) {
    const parts = new Map((data.partDefinitions || []).map((part) => {
      if (part._layout) {
        const pos = Object.fromEntries(part.pins.map((pin) => [pin.id, { ...part._layout.pos[pin.id], def: pin }]));
        part = { ...part, _layout: { ...part._layout, pos } };
      }
      return [part.id, part];
    }));
    const catalog = partCatalog();
    for (const id of new Set(data.instances.map((instance) => instance.part))) {
      if (parts.has(id) || catalog.has(id)) continue;
      const part = await backend.fetchPart(id);
      if (part) parts.set(id, part);
    }
    window.MirProjectValidation.validateProject(data, new Map([...catalog, ...parts]));
    return parts;
  }
  var savingProject = false;
  async function saveProject(saveAs = false) {
    if (savingProject) return false;
    savingProject = true;
    closeProjectMenu();
    try {
      const generation = projectGeneration;
      const savingSnapshot = snapshotState();
      const data = projectData();
      window.MirProjectValidation.validateProject(data, state.defs);
      const saved = await api.saveProject(data, saveAs);
      if (saved) void refreshRecentProjects();
      if (!saved || generation !== projectGeneration) return false;
      if (saved.saved) savedSnapshot = savingSnapshot;
      addMessage("system", saved.message, null, true);
      return saved.saved;
    } catch (err) {
      addMessage("system", `\uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694: ${err.message}`);
      return false;
    } finally {
      savingProject = false;
    }
  }
  $("btnSave").onclick = () => saveProject();
  $("btnSaveAs").onclick = () => saveProject(true);
  async function openProject(recentPath) {
    closeProjectMenu();
    if (hasUnsavedChanges() && !await confirmAction("\uD604\uC7AC \uC791\uC5C5\uC744 \uC5F4\uB824\uB294 \uD30C\uC77C\uB85C \uBC14\uAFC0\uAE4C\uC694? \uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uBCC0\uACBD\uC740 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4.")) return;
    let d, definitions;
    try {
      d = await api.openProject(recentPath);
      if (d) {
        window.MirProjectValidation.validateProject(d);
        definitions = await projectDefinitions(d);
        await api.acceptOpenProject?.(d.title);
      }
    } catch (err) {
      const message = `\uC5F4\uC9C0 \uBABB\uD588\uC5B4\uC694: ${err.message}`;
      if (recentPath) $("recentProjectStatus").textContent = message;
      addMessage("system", message, null, true);
      return;
    }
    if (!d) return;
    projectGeneration++;
    state.buildingManually = false;
    state.instances = d.instances || [];
    state.wires = d.wires || [];
    state.title = d.title || "";
    state.requirements = "";
    setProjectParts(definitions);
    renderPalette();
    backend.reset();
    clearPreview();
    syncToCanvas();
    resetProjectHistory();
    setPower(false);
    canvas.fit();
    savedSnapshot = snapshotState();
    resetProjectChat();
    void refreshRecentProjects();
    await api.resetAgent();
  }
  var openingProject = false;
  async function requestOpenProject(path) {
    if (openingProject) return;
    openingProject = true;
    try {
      await openProject(path);
    } finally {
      openingProject = false;
    }
  }
  $("btnOpen").onclick = () => requestOpenProject();
  $("btnImportPart").onclick = async () => {
    try {
      const r = await api.importParts();
      if (r.added.length) addMessage("system", `\uBD80\uD488 \uCD94\uAC00\uB428: ${r.added.join(", ")}`);
      if (r.errors.length) addMessage("system", `\uBD80\uD488 \uCD94\uAC00 \uC2E4\uD328
${r.errors.join("\n")}`);
      await loadParts();
    } catch (e) {
      addMessage("system", `\uBD80\uD488 \uAC00\uC838\uC624\uAE30 \uC2E4\uD328: ${e.message}`, null, true);
    }
  };
  $("btnPartMenu").onclick = (e) => {
    e.stopPropagation();
    $("partMenu").classList.toggle("hidden");
  };
  document.addEventListener("click", () => $("partMenu").classList.add("hidden"));
  $("partMenu").onclick = async (e) => {
    const act = e.target.dataset.act;
    if (act === "template") api.savePartTemplate();
    if (act === "folder") api.openPartsFolder();
    if (act === "guide") api.openDoc("\uBD80\uD488-JSON-\uC591\uC2DD.md");
    if (act === "reload") loadParts();
    if (act === "datasheet") $("partModal").classList.remove("hidden");
  };
  $("btnPartCancel").onclick = () => $("partModal").classList.add("hidden");
  $("partSource").addEventListener("input", () => $("partSource").setCustomValidity(""));
  $("btnPartAsk").onclick = () => {
    const text2 = $("partSource").value.trim();
    if (!text2) {
      $("partSource").setCustomValidity("\uB370\uC774\uD130\uC2DC\uD2B8 \uB0B4\uC6A9\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      $("partSource").reportValidity();
      return;
    }
    if (state.busy) {
      $("partSource").setCustomValidity("\uC9C4\uD589 \uC911\uC778 \uC694\uCCAD\uC774 \uB05D\uB09C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      $("partSource").reportValidity();
      return;
    }
    $("partSource").setCustomValidity("");
    $("partModal").classList.add("hidden");
    if (showConnectionSetup()) return;
    $("partSource").value = "";
    askAgent(buildPartRequest(text2), { shown: "\uB370\uC774\uD130\uC2DC\uD2B8 \uB0B4\uC6A9\uC73C\uB85C \uC0C8 \uBD80\uD488\uC744 \uB9CC\uB4E4\uC5B4\uC918" });
  };
  var connectionAttempt = null;
  $("btnSettings").onclick = openSettings;
  $("btnSettingsCancel").onclick = () => $("settingsModal").close();
  $("settingsModal").addEventListener("close", () => {
    $("inServerKey").value = "";
    connectionAttempt?.abort();
  });
  $("serverConnectionMode").onchange = updateSettingsFields;
  $("connectionSettings").onsubmit = async (event) => {
    event.preventDefault();
    const controls = ["btnSettingsSave", "serverConnectionMode", "inServerUrl", "inServerKey"].map($);
    if (controls[0].disabled) return;
    const status = $("testResult");
    if (state.busy || backend.isBusy()) {
      status.className = "test-result bad";
      status.textContent = "\uC9C4\uD589 \uC911\uC778 \uCC44\uD305\uC774\uB098 DB \uC791\uC5C5\uC774 \uB05D\uB09C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.";
      return;
    }
    for (const control of controls) control.disabled = true;
    const attempt = new AbortController();
    connectionAttempt = attempt;
    status.className = "test-result";
    try {
      const result = await connectRequired(
        { mode: $("serverConnectionMode").value, url: $("inServerUrl").value, key: $("inServerKey").value },
        { signal: attempt.signal, progress: (text2) => {
          status.textContent = text2;
        } }
      );
      $("inServerKey").value = "";
      await loadSettings();
      backend.connectionChanged(result.sameServer);
      void backend.connectAutomatically();
      if (result.aiError) {
        status.classList.add("bad");
        status.textContent = "DB\uC5D0 \uC5F0\uACB0\uB410\uC5B4\uC694. Copilot AI\uB294 \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694. " + result.aiError;
        $("inServerKey").placeholder = "\uD604\uC7AC \uD0A4 \uC720\uC9C0";
      } else {
        addMessage("system", "Copilot AI\uC640 \uBC30\uC120 DB\uB97C \uC5F0\uACB0\uD588\uC5B4\uC694.");
        $("settingsModal").close();
      }
    } catch (error) {
      if (!attempt.signal.aborted) {
        status.classList.add("bad");
        status.textContent = error.message;
      }
    } finally {
      connectionAttempt = null;
      for (const control of controls) control.disabled = false;
    }
  };
  window.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]:modal,.modal:not(.hidden)")) return;
    const props = document.querySelector(".part-properties-dialog[open]");
    if (e.key === "Escape" && props) {
      props.close();
      e.preventDefault();
      return;
    }
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing || e.isComposing) return;
    const action = partTransforms[e.code];
    if (action && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && transformPart(action)) e.preventDefault();
    if (e.key === "Delete" || e.key === "Backspace") canvas.deleteSelected();
    if (e.key === "Escape") {
      canvas.cancelPending();
      canvas.select(null);
    }
    if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    }
  });
  var PANEL_LIMITS = { right: [300, 680, 360] };
  function setPanelWidth(side, px) {
    const [min, limit] = PANEL_LIMITS[side];
    const max = Math.max(min, Math.min(limit, document.querySelector(".layout").clientWidth - 632));
    const v = Math.round(Math.min(max, Math.max(min, px)));
    document.querySelector(".layout").style.setProperty(`--${side}-w`, `${v}px`);
    document.documentElement.style.setProperty("--agent-width", `${v}px`);
    const bar2 = document.querySelector(`.resizer[data-side="${side}"]`);
    bar2.setAttribute("aria-valuemin", min);
    bar2.setAttribute("aria-valuemax", max);
    bar2.setAttribute("aria-valuenow", v);
    return v;
  }
  function initResizers() {
    for (const side of Object.keys(PANEL_LIMITS)) {
      let width = PANEL_LIMITS[side][2];
      try {
        const saved = Number(localStorage.getItem(`mir-panel-${side}`));
        if (saved) width = saved;
      } catch {
      }
      setPanelWidth(side, width);
    }
    window.addEventListener("resize", () => {
      const width = parseFloat(document.querySelector(".layout").style.getPropertyValue("--right-w"));
      setPanelWidth("right", width || PANEL_LIMITS.right[2]);
    });
    document.querySelectorAll(".resizer").forEach((bar2) => {
      const side = bar2.dataset.side;
      bar2.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const panel = document.querySelector(".side");
        const startX = e.clientX;
        const startW = panel.getBoundingClientRect().width;
        bar2.classList.add("dragging");
        document.body.classList.add("resizing");
        const move = (ev) => {
          const dx = ev.clientX - startX;
          const v = setPanelWidth(side, startW - dx);
          try {
            localStorage.setItem(`mir-panel-${side}`, v);
          } catch {
          }
        };
        const up = () => {
          bar2.classList.remove("dragging");
          document.body.classList.remove("resizing");
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      });
      bar2.addEventListener("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const current = document.querySelector(".side").getBoundingClientRect().width;
        const px = e.key === "Home" ? PANEL_LIMITS[side][0] : e.key === "End" ? PANEL_LIMITS[side][1] : current + (e.key === "ArrowLeft" ? 20 : -20);
        const v = setPanelWidth(side, px);
        try {
          localStorage.setItem(`mir-panel-${side}`, v);
        } catch {
        }
      });
      bar2.addEventListener("dblclick", () => {
        setPanelWidth(side, PANEL_LIMITS[side][2]);
        try {
          localStorage.removeItem(`mir-panel-${side}`);
        } catch {
        }
      });
    });
  }
  function currentTheme() {
    const set = document.documentElement.dataset.theme;
    if (set) return set;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme(theme2) {
    if (theme2) document.documentElement.dataset.theme = theme2;
    $("btnTheme").textContent = currentTheme() === "dark" ? "\u2600 \uB77C\uC774\uD2B8 \uBAA8\uB4DC\uB85C \uC804\uD658" : "\u263E \uB2E4\uD06C \uBAA8\uB4DC\uB85C \uC804\uD658";
    $("btnTheme").setAttribute("aria-pressed", String(currentTheme() === "dark"));
    for (const option of document.querySelectorAll('input[name="appTheme"]')) {
      option.checked = option.value === currentTheme();
    }
    updateManualTheme();
  }
  function chooseTheme(next) {
    try {
      localStorage.setItem("mir-theme", next);
    } catch {
    }
    applyTheme(next);
  }
  $("btnTheme").onclick = () => chooseTheme(currentTheme() === "dark" ? "light" : "dark");
  for (const option of document.querySelectorAll('input[name="appTheme"]')) {
    option.addEventListener("change", () => chooseTheme(option.value));
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme());
  try {
    applyTheme(localStorage.getItem("mir-theme"));
  } catch {
    applyTheme();
  }
  function greet() {
    if (state.settings.mode === "web") return;
    if (state.settings.mode === "server") {
      addMessage("system", state.settings.serverSecretConfigured ? "\uC5F0\uACB0\uB41C \uBC30\uC120 \uC11C\uBC84\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uC624\uB978\uCABD \uCC44\uD305\uCC3D\uC5D0 \uC124\uACC4\uB97C \uC694\uCCAD\uD558\uC138\uC694. \uC5F0\uACB0\uC774 \uC548 \uB418\uBA74 \uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uD0ED\uC5D0\uC11C \uC5F0\uACB0 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC138\uC694." : "\uC608\uC81C\uC640 \uBC30\uC120 \uC2E4\uC2B5\uC740 \uBC14\uB85C \uC2DC\uC791\uD560 \uC218 \uC788\uC5B4\uC694. AI\uC640 DB\uB97C \uC4F0\uB824\uBA74 \uB3C4\uC6C0\uB9D0 \u2192 \uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uC124\uC815\uC744 \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
      return;
    }
    if (state.settings.mode === "demo") {
      addMessage("system", "\uD604\uC7AC\uB294 \uB370\uBAA8 \uBAA8\uB4DC\uC785\uB2C8\uB2E4. Copilot Studio\uC5D0 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC544 \uC800\uC7A5\uB41C \uC608\uC2DC\uB9CC \uBCF4\uC5EC \uC90D\uB2C8\uB2E4. \uC790\uC720\uB85C\uC6B4 \uC124\uACC4 \uC694\uCCAD\uC740 \uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uD0ED\uC5D0\uC11C \uC2E4\uC81C \uC5D0\uC774\uC804\uD2B8\uB97C \uC5F0\uACB0\uD55C \uB4A4 \uBCF4\uB0B4\uC138\uC694.");
      return;
    }
    addMessage("agent", `\uC548\uB155\uD558\uC138\uC694! \uC784\uBCA0\uB514\uB4DC \uBC30\uC120 \uAC00\uC774\uB4DC **\uBBF8\uB974**\uC785\uB2C8\uB2E4.
\uB9CC\uB4E4\uACE0 \uC2F6\uC740 \uAC83\uC744 \uB9D0\uD558\uBA74 \uBCF4\uB4DC\xB7\uC13C\uC11C\uC758 \uD540 \uAE30\uB2A5, \uC804\uC555, \uD1B5\uC2E0 \uBC29\uC2DD\uC744 \uB530\uC838 \uBC30\uC120\uC744 \uCD94\uCC9C\uD558\uACE0 2D \uD654\uBA74\uC5D0 \uADF8\uB824 \uB4DC\uB824\uC694.

\uADF8\uB2E4\uC74C\uC740 \uC5EC\uB7EC\uBD84 \uCC28\uB840\uC608\uC694. **\uAC00\uC0C1 \uC804\uC6D0**\uC744 \uCF1C\uACE0 \uD540\uC744 \uCE21\uC815\uD574 \uBCF4\uACE0, \uBB38\uC81C\uAC00 \uC788\uB294\uC9C0 \uC9C1\uC811 \uD310\uB2E8\uD574 \uBCF4\uC138\uC694. \uC774\uC0C1\uD55C \uC810\uC744 \uC801\uACE0 **\uC9C4\uB2E8 \uC694\uCCAD**\uC744 \uB204\uB974\uBA74 \uC6D0\uC778\uACFC \uC218\uC815\uC548\uC744 \uC54C\uB824 \uB4DC\uB9B4\uAC8C\uC694.`);
  }
  async function applyAppIcon() {
    const src = await api.getAppIcon?.();
    if (!src) return;
    const img = document.createElement("img");
    img.src = src;
    img.alt = "\uBBF8\uB974";
    $("logo").replaceChildren(img);
    $("logo").classList.add("has-image");
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = src;
    document.head.appendChild(link);
  }
  var backend = initBackendPanel({
    getState: () => state,
    getProjectGeneration: () => projectGeneration,
    canReplace: () => !openingProject,
    getCatalog: partCatalog,
    registerParts: (parts) => {
      for (const [id, part] of parts) serverParts.set(id, part);
      setProjectParts(projectParts);
    },
    renderParts: () => {
      renderPalette();
      refresh();
    },
    message: (text2) => addMessage("system", text2),
    replace: (next, parts) => {
      projectGeneration++;
      void api.newProject?.();
      for (const button2 of $("messages").querySelectorAll("[data-project-action]")) button2.remove();
      setProjectParts(parts);
      Object.assign(state, next);
      state.gpio = {};
      savedSnapshot = snapshotState();
      clearPreview();
      syncToCanvas();
      resetProjectHistory();
      separateParts(next.instances, state.defs, [], { gap: 0, preservePlaced: true });
      pushHistory();
      setPower(false);
      canvas.fit();
    }
  });
  initVerificationPanel({ message: (text2) => addMessage("system", text2) });
  async function initWorkspace() {
    await loadParts();
    pushHistory();
    for (const button2 of document.querySelectorAll("[data-example]")) button2.disabled = false;
    initResizers();
    await applyAppIcon();
    await loadSettings();
    alignAgentBelowToolbar();
    void refreshRecentProjects();
    greet();
    void backend.connectAutomatically();
  }
  var closePromptOpen = false;
  window.api?.onConfirmClose?.(async () => {
    if (closePromptOpen) return;
    closePromptOpen = true;
    try {
      const exit = await confirmAction("\uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uC791\uC5C5\uC774 \uC788\uC5B4\uC694. \uC885\uB8CC\uD560\uAE4C\uC694?", { title: "\uBBF8\uB974 \uC885\uB8CC", cancelLabel: "\uACC4\uC18D \uD3B8\uC9D1", acceptLabel: "\uC800\uC7A5\uD558\uC9C0 \uC54A\uACE0 \uC885\uB8CC", extraLabel: "\uC800\uC7A5 \uD6C4 \uC885\uB8CC" });
      if (exit === "save") {
        const saved = await saveProject();
        if (saved && !hasUnsavedChanges()) await window.api.closeConfirmed();
      } else if (exit === true) await window.api.closeConfirmed();
    } finally {
      closePromptOpen = false;
    }
  });
  var wireDock = document.createElement("div");
  wireDock.className = "wire-dock";
  wireDock.setAttribute("aria-label", "\uC120 \uC885\uB958\uC640 \uC790\uB3D9 \uC5F0\uACB0");
  var choices = document.createElement("div");
  choices.className = "wire-kind-tabs";
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "\uC0C8\uB85C \uC5F0\uACB0\uD560 \uC120 \uC885\uB958");
  var kinds = [["power", "\uC804\uC6D0"], ["gnd", "GND"], ["sda", "SDA"], ["scl", "SCL"], ["signal", "\uC2E0\uD638"], ["contact", "\uB9B4\uB808\uC774 \uC811\uC810"]];
  for (const [kind, label] of kinds) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label + " \uC120");
    b.title = label;
    b.dataset.wireKind = kind;
    b.setAttribute("aria-pressed", "false");
    b.style.setProperty("--kind-color", `var(--wire-${kind})`);
    b.innerHTML = '<i aria-hidden="true"></i>';
    b.onclick = () => {
      canvas.selectedWireKind = kind;
      for (const other of choices.children) other.setAttribute("aria-pressed", String(other === b));
    };
    choices.append(b);
  }
  var auto = document.createElement("button");
  auto.id = "btnAutoConnect";
  auto.className = "primary";
  auto.textContent = "\uC790\uB3D9\uC73C\uB85C \uC5F0\uACB0";
  auto.setAttribute("aria-pressed", "false");
  auto.onclick = () => {
    const enable = auto.getAttribute("aria-pressed") !== "true";
    canvas.selectedWireKind = enable ? null : "sda";
    for (const b of choices.children) b.setAttribute("aria-pressed", String(!enable && b.dataset.wireKind === "sda"));
    auto.setAttribute("aria-pressed", String(enable));
    auto.textContent = enable ? "\u2713 \uC790\uB3D9 \uC5F0\uACB0 \uCF1C\uC9D0" : "\uC790\uB3D9\uC73C\uB85C \uC5F0\uACB0";
  };
  choices.addEventListener("click", () => {
    auto.setAttribute("aria-pressed", "false");
    auto.textContent = "\uC790\uB3D9\uC73C\uB85C \uC5F0\uACB0";
  });
  canvas.selectedWireKind = "sda";
  choices.querySelector('[data-wire-kind="sda"]').setAttribute("aria-pressed", "true");
  var dockActions = document.createElement("div");
  dockActions.className = "wire-dock-actions";
  for (const [id, label, hint, action] of [
    ["btnDockDeleteWire", "\uC120 \uC0AD\uC81C", "\uC120\uC744 \uC120\uD0DD\uD55C \uB4A4 \uC0AD\uC81C", () => {
      if (canvas.selected?.type === "wire") void canvas.deleteSelected();
    }],
    ["btnDockUndo", "\u21B6", "\uC2E4\uD589 \uCDE8\uC18C (Ctrl+Z)", undo],
    ["btnDockRedo", "\u21B7", "\uB2E4\uC2DC \uC2E4\uD589 (Ctrl+Y)", redo]
  ]) {
    const button2 = document.createElement("button");
    button2.type = "button";
    button2.id = id;
    button2.textContent = label;
    button2.title = hint;
    button2.setAttribute("aria-label", id === "btnDockDeleteWire" ? label : hint);
    button2.onclick = action;
    dockActions.append(button2);
  }
  var dockConnection = document.createElement("div");
  dockConnection.className = "wire-dock-connection";
  dockConnection.append(choices, auto);
  var dockMovement = document.createElement("div");
  dockMovement.className = "wire-dock-actions wire-dock-movement";
  var moveTool = document.createElement("button");
  moveTool.type = "button";
  moveTool.id = "btnMoveTool";
  moveTool.setAttribute("aria-label", "\uD654\uBA74 \uC774\uB3D9 \uBC0F \uBD80\uD488 \uC120\uD0DD");
  moveTool.title = "\uBE48 \uACF3 \uB4DC\uB798\uADF8: \uD654\uBA74 \uC774\uB3D9 \xB7 \uBD80\uD488 \uB4DC\uB798\uADF8: \uC774\uB3D9 \xB7 Shift \uB610\uB294 \uBE48 \uACF3 \uB354\uBE14\uD074\uB9AD \uD6C4 \uB4DC\uB798\uADF8: \uBC94\uC704 \uC120\uD0DD";
  moveTool.setAttribute("aria-description", moveTool.title);
  moveTool.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5v-1a1.5 1.5 0 0 1 3 0V11m0-6a1.5 1.5 0 0 1 3 0v7m0-4a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6 7h-2c-2.2 0-3.6-1-4.8-2.6l-3.4-4.5a1.6 1.6 0 0 1 2.4-2.1L8 13Z"/></svg>';
  moveTool.onclick = () => $("canvas").focus({ preventScroll: true });
  dockMovement.append(moveTool);
  wireDock.append(dockMovement, dockConnection, dockActions);
  document.querySelector(".stage-body").append(wireDock);
  updateWireDockActions();
  var propertiesDialog = document.createElement("dialog");
  propertiesDialog.className = "mir-confirm part-properties-dialog";
  var propertiesClose = document.createElement("button");
  propertiesClose.textContent = "\uB2EB\uAE30";
  propertiesClose.onclick = () => propertiesDialog.close();
  propertiesDialog.append($("selInfo"), propertiesClose);
  document.body.append(propertiesDialog);
  var propertiesHandle = document.createElement("div");
  propertiesHandle.className = "properties-drag-handle";
  propertiesHandle.textContent = "\uBD80\uD488 \uC18D\uC131";
  propertiesHandle.title = "\uB4DC\uB798\uADF8\uD574\uC11C \uC774\uB3D9";
  propertiesDialog.prepend(propertiesHandle);
  propertiesHandle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const rect = propertiesDialog.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    propertiesDialog.style.left = `${rect.left}px`;
    propertiesDialog.style.top = `${rect.top}px`;
    propertiesDialog.style.right = "auto";
    propertiesDialog.style.bottom = "auto";
    propertiesHandle.setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (event) => {
      const x = Math.max(0, Math.min(window.innerWidth - propertiesDialog.offsetWidth, rect.left + event.clientX - startX));
      const y = Math.max(0, Math.min(window.innerHeight - propertiesDialog.offsetHeight, rect.top + event.clientY - startY));
      propertiesDialog.style.left = `${x}px`;
      propertiesDialog.style.top = `${y}px`;
    };
    const end = () => {
      propertiesHandle.removeEventListener("pointermove", move);
      propertiesHandle.removeEventListener("pointerup", end);
      propertiesHandle.removeEventListener("pointercancel", end);
    };
    propertiesHandle.addEventListener("pointermove", move);
    propertiesHandle.addEventListener("pointerup", end);
    propertiesHandle.addEventListener("pointercancel", end);
  });
  var outsideCanvasPointer = null;
  document.addEventListener("pointerdown", (e) => {
    if (!propertiesDialog.open || propertiesDialog.contains(e.target)) return;
    if (e.target.closest("#canvas")) {
      outsideCanvasPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      return;
    }
    propertiesDialog.close();
  }, true);
  document.addEventListener("pointermove", (e) => {
    if (outsideCanvasPointer?.id === e.pointerId && Math.hypot(e.clientX - outsideCanvasPointer.x, e.clientY - outsideCanvasPointer.y) > 5) outsideCanvasPointer.moved = true;
  }, true);
  document.addEventListener("pointerup", (e) => {
    if (outsideCanvasPointer?.id !== e.pointerId) return;
    if (!outsideCanvasPointer.moved && propertiesDialog.open) propertiesDialog.close();
    outsideCanvasPointer = null;
  }, true);
  document.addEventListener("pointercancel", () => {
    outsideCanvasPointer = null;
  }, true);
  var popupClampFrame = null;
  function clampPropertiesDialog() {
    if (!propertiesDialog.open) return;
    const r = propertiesDialog.getBoundingClientRect(), gap = 8, top2 = 54;
    const x = Math.max(gap, Math.min(r.left, innerWidth - r.width - gap));
    const y = Math.max(top2, Math.min(r.top, innerHeight - r.height - gap));
    propertiesDialog.style.left = `${x}px`;
    propertiesDialog.style.top = `${y}px`;
    propertiesDialog.style.right = "auto";
    propertiesDialog.style.bottom = "auto";
  }
  function schedulePopupClamp() {
    if (popupClampFrame !== null) return;
    popupClampFrame = requestAnimationFrame(() => {
      popupClampFrame = null;
      clampPropertiesDialog();
    });
  }
  window.addEventListener("resize", schedulePopupClamp);
  new ResizeObserver(schedulePopupClamp).observe(propertiesDialog);
  new MutationObserver(schedulePopupClamp).observe(propertiesDialog, { attributes: true, attributeFilter: ["open"] });
  var overlayLayoutFrame = null;
  function alignWorkspaceOverlays() {
    const stage = document.querySelector(".stage-body").getBoundingClientRect();
    const toolbar = document.querySelector(".stage-toolbar").getBoundingClientRect();
    const agent = $("agentPanel").getBoundingClientRect();
    const compact = compactWorkspace.matches;
    const right = Math.max(stage.left + 20, Math.min(stage.right - 12, compact ? stage.right : agent.left - 12));
    const available = Math.max(0, right - stage.left - 20);
    const paletteEdge = $("btnPaletteToggle").getBoundingClientRect().right + 12;
    const left = Math.min(right, Math.max(stage.left + 12, paletteEdge));
    if (compact) {
      wireDock.style.removeProperty("max-width");
      wireDock.style.removeProperty("left");
    } else {
      wireDock.style.maxWidth = `${right - left}px`;
      const halfDock = wireDock.getBoundingClientRect().width / 2;
      const center = Math.min(Math.max(stage.left + stage.width / 2, left + halfDock), right - halfDock);
      wireDock.style.left = `${center - stage.left}px`;
    }
    applyPaletteSize();
    const chatCollapsed = document.body.classList.contains("chat-collapsed");
    const emptyHint = $("emptyHint");
    emptyHint.style.right = compact || chatCollapsed ? "0px" : stage.right - right + "px";
    const toolbarGap = Math.max(0, toolbar.bottom - stage.top);
    emptyHint.style.top = compact ? toolbarGap + 40 + "px" : chatCollapsed ? toolbarGap + "px" : "";
    const toggleTop = $("btnChatToggle").getBoundingClientRect().top;
    emptyHint.style.bottom = compact ? "78px" : chatCollapsed ? Math.max(0, stage.bottom - Math.min(agent.top, toggleTop)) + "px" : "";
    const preview = $("previewBar");
    preview.style.top = `${toolbar.bottom - stage.top + 12}px`;
    preview.style.width = `${Math.max(0, available)}px`;
  }
  function scheduleOverlayLayout() {
    if (overlayLayoutFrame !== null) return;
    overlayLayoutFrame = requestAnimationFrame(() => {
      overlayLayoutFrame = null;
      alignWorkspaceOverlays();
    });
  }
  var overlaysObserver = new ResizeObserver(scheduleOverlayLayout);
  for (const el3 of [document.querySelector(".stage-body"), document.querySelector(".stage-toolbar"), $("agentPanel"), $("gpioPanel"), wireDock]) overlaysObserver.observe(el3);
  new MutationObserver(scheduleOverlayLayout).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", scheduleOverlayLayout);
  scheduleOverlayLayout();
  async function refreshRecentProjects() {
    const list = $("recentProjects");
    const status = $("recentProjectStatus");
    if (!list || !status) return;
    try {
      const projects = await api.recentProjects?.() ?? [];
      const buttons2 = projects.map((project) => {
        const button2 = document.createElement("button");
        button2.type = "button";
        button2.textContent = project.title;
        button2.title = project.path;
        button2.onclick = () => requestOpenProject(project.path);
        const row = document.createElement("div");
        row.className = "recent-project-row";
        const more = document.createElement("button");
        more.type = "button";
        more.className = "recent-project-more";
        more.textContent = "\u22EE";
        more.setAttribute("aria-label", `${project.title} \uC635\uC158`);
        more.onclick = () => {
          if (!recentProjectMenu.hidden && recentProjectMenuAnchor === more) {
            recentProjectMenu.hidden = true;
            return;
          }
          const rect = more.getBoundingClientRect();
          showRecentProjectMenu(project, rect.right, rect.bottom, more);
        };
        row.oncontextmenu = (event) => {
          event.preventDefault();
          showRecentProjectMenu(project, event.clientX, event.clientY);
        };
        row.append(button2, more);
        return row;
      });
      list.replaceChildren(...buttons2);
      status.textContent = buttons2.length ? "" : "\uD30C\uC77C\uC744 \uC5F4\uAC70\uB098 \uC800\uC7A5\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB3FC\uC694.";
    } catch {
      status.textContent = "\uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.";
    }
  }
  var canvasContextMenu = document.createElement("div");
  canvasContextMenu.className = "canvas-context-menu";
  canvasContextMenu.hidden = true;
  var contextDelete = document.createElement("button");
  contextDelete.type = "button";
  contextDelete.textContent = "\uC0AD\uC81C";
  canvasContextMenu.append(contextDelete);
  document.body.append(canvasContextMenu);
  contextDelete.onclick = () => {
    canvasContextMenu.hidden = true;
    void canvas.deleteSelected();
  };
  $("canvas").addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const part = event.target.closest('[data-kind="part"]');
    const wire = event.target.closest('[data-kind="wire"]');
    if (wire) canvas.select({ type: "wire", id: wire.dataset.id });
    else if (part && !(canvas.selected?.type === "group" && canvas.selected.refs.has(part.dataset.ref))) {
      canvas.select({ type: "part", ref: part.dataset.ref });
    }
    if (!canvas.selected) return;
    canvasContextMenu.hidden = false;
    canvasContextMenu.style.left = `${Math.min(event.clientX, innerWidth - canvasContextMenu.offsetWidth - 8)}px`;
    canvasContextMenu.style.top = `${Math.min(event.clientY, innerHeight - canvasContextMenu.offsetHeight - 8)}px`;
    contextDelete.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!canvasContextMenu.contains(event.target)) canvasContextMenu.hidden = true;
  }, true);
  canvasContextMenu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    canvasContextMenu.hidden = true;
    event.stopPropagation();
  });
  window.addEventListener("blur", () => {
    canvasContextMenu.hidden = true;
  });
  var recentProjectMenu = document.createElement("div");
  recentProjectMenu.className = "canvas-context-menu";
  recentProjectMenu.hidden = true;
  document.body.append(recentProjectMenu);
  var recentProjectMenuAnchor = null;
  function showRecentProjectMenu(project, x, y, anchor = null) {
    recentProjectMenuAnchor = anchor;
    const remove = document.createElement("button");
    remove.textContent = "\uC0AD\uC81C";
    remove.title = "\uCD5C\uADFC \uBAA9\uB85D\uC5D0\uC11C \uC81C\uAC70";
    remove.onclick = () => {
      recentProjectMenu.hidden = true;
      void updateRecentProject(project, null);
    };
    const rename = document.createElement("button");
    rename.textContent = "\uC774\uB984 \uBCC0\uACBD";
    rename.onclick = () => {
      recentProjectMenu.hidden = true;
      const dialog2 = document.createElement("dialog");
      dialog2.className = "mir-confirm";
      dialog2.innerHTML = '<form method="dialog"><h2>\uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8 \uC774\uB984 \uBCC0\uACBD</h2><input aria-label="\uD504\uB85C\uC81D\uD2B8 \uC774\uB984" maxlength="120" required><div class="modal-actions"><button class="primary" value="rename">\uD655\uC778</button><button value="cancel" formnovalidate>\uCDE8\uC18C</button></div></form>';
      const input2 = dialog2.querySelector("input");
      input2.value = project.title;
      dialog2.querySelector("form").onsubmit = (event) => {
        if (event.submitter?.value !== "cancel" && !input2.value.trim()) event.preventDefault();
      };
      dialog2.onclose = () => {
        if (dialog2.returnValue === "rename") void updateRecentProject(project, input2.value.trim());
        dialog2.remove();
      };
      document.body.append(dialog2);
      dialog2.showModal();
      input2.select();
    };
    recentProjectMenu.replaceChildren(remove, rename);
    recentProjectMenu.hidden = false;
    const width = recentProjectMenu.offsetWidth;
    const height = recentProjectMenu.offsetHeight;
    const left = anchor ? x - width : x;
    const top2 = anchor && y + height > innerHeight - 8 ? anchor.getBoundingClientRect().top - height + 1 : y - Number(Boolean(anchor));
    recentProjectMenu.style.left = `${Math.max(8, Math.min(left, innerWidth - width - 8))}px`;
    recentProjectMenu.style.top = `${Math.max(8, Math.min(top2, innerHeight - height - 8))}px`;
    rename.focus();
  }
  async function updateRecentProject(project, name) {
    try {
      await api.updateRecentProject(project.path, name);
      await refreshRecentProjects();
    } catch (error) {
      $("recentProjectStatus").textContent = error.message;
    }
  }
  document.addEventListener("pointerdown", (event) => {
    if (!recentProjectMenu.contains(event.target) && !recentProjectMenuAnchor?.contains(event.target)) recentProjectMenu.hidden = true;
  }, true);
  recentProjectMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      recentProjectMenu.hidden = true;
      event.stopPropagation();
    }
  });

  // assets/workspace-frame.js
  var rail = document.createElement("aside");
  rail.className = "workspace-rail";
  rail.id = "workspaceRail";
  rail.inert = false;
  rail.setAttribute("aria-label", "\uC791\uC5C5 \uACF5\uAC04 \uBA54\uB274");
  rail.innerHTML = `<div class="frame-brand"></div>
<button class="frame-new" data-target="btnNew"><span aria-hidden="true">\uFF0B</span> \uC0C8 \uD504\uB85C\uC81D\uD2B8</button>
<nav aria-label="\uC791\uC5C5 \uACF5\uAC04"><button class="frame-current" aria-current="page" data-target="workspace"><span aria-hidden="true">\u25A3</span> \uC81C\uC791\uD310</button><button data-target="btnWireSettings"><span aria-hidden="true">\u2699</span> \uC571 \uC124\uC815</button><button data-target="btnSettings"><span aria-hidden="true">\u2197</span> \uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0</button></nav>
<section class="frame-project"><span>\uD604\uC7AC \uD504\uB85C\uC81D\uD2B8</span><strong id="frameProjectName">\uC0C8 \uD504\uB85C\uC81D\uD2B8</strong><hr class="project-section-divider"><span class="recent-project-heading">\uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8</span><div id="recentProjects" aria-label="\uCD5C\uADFC \uD504\uB85C\uC81D\uD2B8"></div><p id="recentProjectStatus" role="status"></p></section>
<footer><strong>PLAYLABS</strong><span>\uB9CC\uB4E4\uBA70 \uBC30\uC6B0\uB294 \uC804\uC790 \uC2E4\uC2B5</span></footer>`;
  document.body.append(rail);
  var brand = document.querySelector(".brand");
  var menu = document.getElementById("btnMenu");
  brand.removeChild(menu);
  rail.querySelector(".frame-brand").append(brand);
  var top = document.querySelector(".topbar");
  var heading = document.createElement("div");
  heading.className = "frame-heading";
  heading.append(menu);
  top.prepend(heading);
  var save = document.createElement("button");
  save.textContent = "\uD504\uB85C\uC81D\uD2B8 \uC800\uC7A5";
  save.onclick = () => document.getElementById("btnSave").click();
  document.querySelector(".top-actions").append(save);
  rail.addEventListener("click", (e) => {
    const b = e.target.closest("[data-target]");
    if (!b) return;
    const id = b.dataset.target;
    if (id === "workspace") {
      document.querySelector(".canvas").focus();
      return;
    }
    document.getElementById(id)?.click();
  });
  menu.setAttribute("aria-controls", "workspaceRail");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "\uBA54\uB274 \uC5F4\uAE30");
  function setFrameOpen(open, keyboard = false) {
    document.body.classList.toggle("frame-no-motion", keyboard);
    document.body.classList.toggle("frame-open", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "\uBA54\uB274 \uB2EB\uAE30" : "\uBA54\uB274 \uC5F4\uAE30");
    const details = rail.querySelector(".frame-project");
    details.inert = !open;
    if (!open && details.contains(document.activeElement)) menu.focus();
  }
  rail.querySelectorAll("button[data-target]").forEach((button2) => {
    const label = button2.textContent.trim().replace(/^[＋▣⚙↗]\s*/, "");
    button2.setAttribute("aria-label", label);
    button2.title = label;
    const text2 = [...button2.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (text2) {
      const span = document.createElement("span");
      span.className = "frame-label";
      span.textContent = text2.textContent;
      text2.replaceWith(span);
    }
  });
  rail.querySelector(".frame-project").inert = true;
  menu.addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    setFrameOpen(!document.body.classList.contains("frame-open"), e.detail === 0);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("frame-open") && !document.querySelector("dialog[open],.modal:not(.hidden)")) {
      setFrameOpen(false, true);
      e.preventDefault();
    }
  });

  // assets/titlebar.js
  var bar = document.createElement("header");
  bar.className = "desktop-titlebar";
  bar.setAttribute("aria-label", "\uC571 \uBA54\uB274");
  var click = (id) => document.getElementById(id)?.click();
  function button(label, text2, action) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.textContent = text2;
    b.onclick = action;
    return b;
  }
  bar.append(button("\uBA54\uB274 \uC5F4\uAE30/\uB2EB\uAE30", "\u25E7", () => click("btnMenu")));
  var groups = [["\uD30C\uC77C", [["\uC0C8 \uD504\uB85C\uC81D\uD2B8", "btnNew"], ["\uC678\uBD80\uC5D0\uC11C \uAC00\uC838\uC624\uAE30", "btnOpen"], ["\uC800\uC7A5", "btnSave"], ["\uB2E4\uB978 \uC774\uB984\uC73C\uB85C \uC800\uC7A5", "btnSaveAs"], ["\uBC30\uC120 API \xB7 DB (\uAC1C\uBC1C\uC790\uC6A9)", "btnBackend"]]], ["\uD3B8\uC9D1", [["\uB418\uB3CC\uB9AC\uAE30", "btnUndo"], ["\uB2E4\uC2DC \uD558\uAE30", "btnRedo"], ["\uC0AD\uC81C", "btnDelete"]]], ["\uBCF4\uAE30", [["\uD654\uBA74\uC5D0 \uB9DE\uCD94\uAE30", "btnFit"], ["\uD655\uB300", "btnZoomIn"], ["\uCD95\uC18C", "btnZoomOut"], ["\uB2E4\uD06C/\uB77C\uC774\uD2B8 \uBAA8\uB4DC", "btnTheme"]]], ["\uB3C4\uC6C0\uB9D0", [["\uCC98\uC74C \uC0AC\uC6A9\uD558\uB294 \uBD84\uC744 \uC704\uD55C \uC124\uBA85\uC11C", "btnManual"], ["\uC5D0\uC774\uC804\uD2B8 \uC5F0\uACB0 \uC124\uC815", "btnSettings"]]]];
  for (const [name, items] of groups) {
    const d = document.createElement("details");
    d.className = "desktop-menu";
    const summary = document.createElement("summary");
    summary.textContent = name;
    const popup = document.createElement("div");
    popup.className = "desktop-menu-popup";
    for (const [text2, id] of items) popup.append(button(text2, text2, () => {
      d.open = false;
      click(id);
    }));
    d.append(summary, popup);
    d.addEventListener("toggle", () => {
      if (d.open) {
        for (const other of bar.querySelectorAll("details")) if (other !== d) other.open = false;
      }
    });
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        d.open = false;
        summary.focus();
      }
    });
    bar.append(d);
  }
  document.body.prepend(bar);
  document.addEventListener("pointerdown", (e) => {
    if (!bar.contains(e.target)) bar.querySelectorAll("details").forEach((d) => d.open = false);
  });
  var lastTitlebarColors = "";
  function syncTitlebarColor() {
    let color = getComputedStyle(document.body).getPropertyValue("--frame-bg").trim();
    const modalOpen = !!document.querySelector("dialog[open]:modal, .modal:not(.hidden)");
    if (modalOpen && /^#[0-9a-f]{6}$/i.test(color)) color = "#" + color.slice(1).match(/../g).map((x) => Math.round(parseInt(x, 16) * 0.68 + 15 * 0.32).toString(16).padStart(2, "0")).join("");
    const symbolColor = color === "#172332" ? "#f4f4f4" : "#202124";
    const signature2 = color + symbolColor;
    if (signature2 === lastTitlebarColors) return;
    lastTitlebarColors = signature2;
    window.api?.setTitlebarColors?.({ color, symbolColor });
  }
  new MutationObserver(syncTitlebarColor).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTitlebarColor);
  syncTitlebarColor();
  var workspaceMenu = document.getElementById("btnMenu");
  var titlebarToggle = bar.querySelector(":scope > button");
  if (workspaceMenu && titlebarToggle) titlebarToggle.replaceWith(workspaceMenu);
  var railMenu = document.getElementById("btnMenu");
  var railBrand = document.querySelector(".frame-brand");
  if (railMenu && railBrand) railBrand.after(railMenu);
  var connectionPill = document.getElementById("connPill");
  var chatToggle = document.getElementById("btnChatToggle");
  if (connectionPill && chatToggle) {
    chatToggle.after(connectionPill);
    connectionPill.classList.add("chat-connection-pill");
  }
  if (connectionPill) bar.append(connectionPill);
  new MutationObserver(syncTitlebarColor).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "class"] });

  // entry.js
  async function startWorkspace() {
    const dialog2 = document.getElementById("mirStart");
    const status = document.getElementById("startStatus");
    document.getElementById("mirFileStart").hidden = true;
    status.textContent = "\uC81C\uC791\uB300\uB97C \uC5F4\uACE0 \uC788\uC5B4\uC694.";
    try {
      await initWorkspace();
      dialog2.close();
      document.body.classList.remove("mir-connecting");
      document.getElementById("btnMenu").focus({ preventScroll: true });
    } catch (error) {
      status.textContent = "\uC81C\uC791\uB300\uB97C \uC5F4 \uC218 \uC5C6\uC5B4\uC694. \uBBF8\uB974 HTML \uD3F4\uB354 \uC804\uCCB4\uAC00 \uD568\uAED8 \uC788\uB294\uC9C0 \uD655\uC778\uD574 \uC8FC\uC138\uC694. " + error.message;
      status.classList.add("bad");
    }
  }
  void startWorkspace();
})();
