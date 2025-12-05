// -------------------------------------------------------------
// FIREBASE INIT
// -------------------------------------------------------------
import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// -------------------------------------------------------------
// DOM ELEMENTS
// -------------------------------------------------------------
const headerRow = document.getElementById("headerRow");
const tableBody = document.getElementById("tableBody");

const bxInvestito = document.getElementById("totInvestito");
const bxValore    = document.getElementById("valoreAttuale");
const bxDividendi = document.getElementById("totDividendi");
const bxProfitto  = document.getElementById("totProfitto");
const elPerc      = document.getElementById("totProfittoPerc");

// -------------------------------------------------------------
// COLUMNS DEFINITIONS
// -------------------------------------------------------------
const columns = [
  "tipologia",
  "nome",
  "prezzo_acquisto",
  "prezzo_corrente",
  "dividendi",
  "prelevato",
  "profitto",
  "percentuale_12_mesi",
  "rendimento_percentuale",
  "payback",
  "percentuale_portafoglio",
  "score"
];

const labelMap = {
  tipologia: "Tipologia",
  nome: "Titolo",
  prezzo_acquisto: "Investito",
  prezzo_corrente: "Corrente",
  dividendi: "Dividendi",
  prelevato: "Prelevato",
  profitto: "Profitto",
  percentuale_12_mesi: "% 12 mesi",
  rendimento_percentuale: "Rend %",
  payback: "Payback",
  percentuale_portafoglio: "% Portafoglio",
  score: "Score"
};

// colonne nascoste
const hiddenCols = new Set([
  "percentuale_12_mesi",
  "rendimento_percentuale",
  "payback",
  "percentuale_portafoglio"
]);

// formattazioni
const euroCols = new Set(["prezzo_acquisto","prezzo_corrente","dividendi","prelevato"]);
const percCols = new Set(["percentuale_12_mesi","rendimento_percentuale","payback","percentuale_portafoglio"]);

// -------------------------------------------------------------
// FORMATTERS
// -------------------------------------------------------------
const fmtEuro  = n => Number(n||0).toFixed(2) + " €";
const fmtPerc  = n => Number(n||0).toFixed(2) + " %";
const fmtScore = n => Number(n||0).toFixed(2);

// -------------------------------------------------------------
// HEADER RENDERING + SORTING
// -------------------------------------------------------------
function renderHeader() {
  headerRow.innerHTML = "";

  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = labelMap[col] || col;
    if (hiddenCols.has(col)) th.style.display = "none";
    th.classList.add("sortable");
    headerRow.appendChild(th);
  });

  const thA = document.createElement("th");
  thA.textContent = "Azioni";
  headerRow.appendChild(thA);
}

function enableSorting() {
  const ths = Array.from(headerRow.children);

  ths.forEach((th, idx) => {
    if (th.textContent === "Azioni") return;

    th.dataset.asc = "true";
    th.style.cursor = "pointer";

    th.onclick = () => {
      const asc = th.dataset.asc === "true";
      th.dataset.asc = (!asc).toString();
      sortByColumn(idx, asc);

      ths.forEach(h => h.textContent = h.textContent.replace(/ ↑| ↓/g, ""));
      th.textContent += asc ? " ↑" : " ↓";
    };
  });
}

function sortByColumn(colIndex, asc) {
  const rows = Array.from(tableBody.rows);

  const arr = rows.map(r => {
    const raw = r.cells[colIndex]?.dataset.raw || "";
    const num = parseFloat(raw);

    let key;
    if (raw === "") key = "";
    else if (!isNaN(num)) key = num;
    else key = raw.toLowerCase();

    return { row: r, key };
  });

  arr.sort((a, b) => {
    const x = a.key, y = b.key;

    if (typeof x === "number" && typeof y === "number")
      return asc ? x - y : y - x;

    if (x === "" || y === "")
      return asc ? (x === "" ? 1 : -1) : (x === "" ? -1 : 1);

    return asc ? x.localeCompare(y) : y.localeCompare(x);
  });

  arr.forEach(i => tableBody.appendChild(i.row));
}

// -------------------------------------------------------------
// MODAL SYSTEM
// -------------------------------------------------------------
let modalEl = null;

function ensureModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement("div");
  modalEl.id = "editModal";
  modalEl.classList.add("modal-overlay");
  modalEl.style.display = "none";

  modalEl.innerHTML = `
    <div class="modal-card">
      <h3>Modifica</h3>
      <div id="modalFields"></div>
      <div class="modal-buttons">
        <button id="modalSave">Salva</button>
        <button id="modalClose">Annulla</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  modalEl.querySelector("#modalClose").onclick = () => {
    modalEl.style.display = "none";
  };

  return modalEl;
}

async function openEditModal(docId) {
  const ref = doc(db, "portafoglio", docId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return alert("Record non trovato!");

  const data = snap.data();
  const modal = ensureModal();
  const fieldsDiv = modal.querySelector("#modalFields");
  fieldsDiv.innerHTML = "";

  const editable = [
    "prezzo_acquisto",
    "prezzo_corrente",
    "dividendi",
    "prelevato",
    "percentuale_12_mesi",
    "rendimento_percentuale",
    "payback",
    "score"
  ];

  editable.forEach(f => {
    const lbl = document.createElement("label");
    lbl.textContent = f.toUpperCase().replaceAll("_", " ");

    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.01";
    inp.id = "fld_" + f;
    inp.value = data[f] ?? "";

    fieldsDiv.appendChild(lbl);
    fieldsDiv.appendChild(inp);
  });

  modal.style.display = "flex";

  modal.querySelector("#modalSave").onclick = async () => {
    const updated = { ...data };

    editable.forEach(f => {
      const el = document.getElementById("fld_" + f);
      const v = el.value;
      if (v === "") delete updated[f];
      else updated[f] = Number(v);
    });

    updated.profitto =
      (updated.prezzo_corrente || 0) - 
      (updated.prezzo_acquisto || 0) + 
      (updated.dividendi || 0) + 
      (updated.prelevato || 0);

    updated.score = Number(updated.score || 0);

    await updateDoc(ref, updated);

    modal.style.display = "none";
    await loadData();
  };
}

// -------------------------------------------------------------
// IMPORT EXCEL
// -------------------------------------------------------------
window.importExcel = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return alert("Nessun file selezionato!");

  try {
    const snap = await getDocs(collection(db, "portafoglio"));
    const nameMap = new Map();

    snap.docs.forEach(d => {
      const nm = (d.data().nome || "").toLowerCase();
      nameMap.set(nm, d.id);
    });

    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    let updated = 0, skipped = 0;

    for (const row of json) {
      const nm = (row.nome || "").toLowerCase();
      if (!nm) continue;

      const id = nameMap.get(nm);
      if (!id) { skipped++; continue; }

      const allowed = [
        "prezzo_acquisto","prezzo_corrente","dividendi","prelevato",
        "percentuale_12_mesi","rendimento_percentuale","payback",
        "percentuale_portafoglio","score"
      ];

      const updateObj = {};

      allowed.forEach(k => {
        if (row[k] !== undefined && row[k] !== "")
          updateObj[k] = Number(row[k]);
      });

      await updateDoc(doc(db, "portafoglio", id), updateObj);
      updated++;
    }

    alert(`Import completato.\nAggiornati: ${updated}\nSaltati: ${skipped}`);
    await loadData();

  } catch (e) {
    console.error(e);
    alert("Errore nell'import.");
  }
};

// -------------------------------------------------------------
// EXPORT EXCEL
// -------------------------------------------------------------
window.exportExcel = async function () {
  try {
    const snap = await getDocs(collection(db, "portafoglio"));
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Portafoglio");

    XLSX.writeFile(wb, "portafoglio.xlsx");
  } catch (e) {
    console.error(e);
    alert("Errore export.");
  }
};

// -------------------------------------------------------------
// STATS
// -------------------------------------------------------------
function updateStats(docs) {
  let totInv = 0, totVal = 0, totDiv = 0, totPre = 0;

  docs.forEach(d => {
    const o = d.data();
    totInv += Number(o.prezzo_acquisto || 0);
    totVal += Number(o.prezzo_corrente || 0);
    totDiv += Number(o.dividendi || 0);
    totPre += Number(o.prelevato || 0);
  });

  const profit = totVal - totInv + totDiv + totPre;
  const percProfit = totInv > 0 ? (profit / totInv) * 100 : 0;

  // Aggiorna valori principali
  bxInvestito.textContent = fmtEuro(totInv);
  bxValore.textContent    = fmtEuro(totVal);
  bxDividendi.textContent = fmtEuro(totDiv);

  // Aggiorna profitto totale
  bxProfitto.textContent  = fmtEuro(profit);
  bxProfitto.style.color  = profit >= 0 ? "#2ecc71" : "#e74c3c";

  // NUOVO: aggiorna % profitto con colore
  const elPerc = document.getElementById("totProfittoPerc");
  if (elPerc) {
    elPerc.textContent = percProfit.toFixed(2) + " %";
    elPerc.style.color = percProfit >= 0 ? "#2ecc71" : "#e74c3c";
    elPerc.className = percProfit >= 0 ? "profit-positive" : "profit-negative";
  }
}


async function loadData() {
  // Pulisce la tabella
  tableBody.innerHTML = "";
  renderHeader();

  if (!db) {
    console.error("Firestore non inizializzato!");
    alert("Errore: Firestore non inizializzato.");
    return;
  }

  try {
    console.log("Caricamento dati da Firebase...");
    const snap = await getDocs(collection(db, "portafoglio"));
    console.log("Documenti trovati:", snap.docs.length);

    if (snap.docs.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = columns.length + 1; // include la colonna Azioni
      td.textContent = "Nessun dato trovato!";
      td.style.textAlign = "center";
      td.style.fontStyle = "italic";
      tr.appendChild(td);
      tableBody.appendChild(tr);

      // Azzera anche i box principali
      bxInvestito.textContent = "0 €";
      bxValore.textContent = "0 €";
      bxDividendi.textContent = "0 €";
      bxProfitto.textContent = "0 €";
      elPerc.textContent = "0 %";

      return;
    }

    // Popola la tabella
    snap.docs.forEach(docSnap => {
      const d = docSnap.data();
      const id = docSnap.id;

      console.log("Documento:", id, d);

      const tr = document.createElement("tr");

      columns.forEach(col => {
        const td = document.createElement("td");
        td.style.textAlign = "center";
        td.style.display = hiddenCols.has(col) ? "none" : "table-cell";

        if (col === "profitto") {
          const p = (Number(d.prezzo_corrente) || 0) - (Number(d.prezzo_acquisto) || 0) +
                    (Number(d.dividendi) || 0) + (Number(d.prelevato) || 0);
          td.textContent = fmtEuro(p);
          td.dataset.raw = p;
        } else if (euroCols.has(col)) {
          const v = Number(d[col] || 0);
          td.textContent = fmtEuro(v);
          td.dataset.raw = v;
        } else if (percCols.has(col)) {
          const v = Number(d[col] || 0);
          td.textContent = fmtPerc(v);
          td.dataset.raw = v;
       } else if (col === "score") {
  const v = Number(d[col] || 0);
  td.textContent = fmtScore(v);
  td.dataset.raw = v;

  // --- COLORAZIONE SCORE ---
  if (v >= 12) {
    td.style.color = "#2ecc71";   // verde
  } else if (v < 12 && v >= 8) {
    td.style.color = "#f1c40f";   // giallo
  } else {
    td.style.color = "#e74c3c";   // rosso
  }

} else {
  td.textContent = d[col] ?? "";
  td.dataset.raw = (d[col] ?? "").toString();
}


        tr.appendChild(td);
      });

      // TD con bottoni Azioni
      const tdA = document.createElement("td");
      tdA.classList.add("action-buttons");
      tdA.style.textAlign = "center";

      const btE = document.createElement("button");
      btE.textContent = "Modifica";
      btE.style.backgroundColor = "#27ae60";
      btE.style.color = "white";
      btE.onclick = () => openEditModal(id);

      const btD = document.createElement("button");
      btD.textContent = "Cancella";
      btD.style.backgroundColor = "#e74c3c";
      btD.style.color = "white";
      btD.onclick = async () => {
        if (!confirm("Confermi?")) return;
        await deleteDoc(doc(db, "portafoglio", id));
        await loadData();
      };

      tdA.appendChild(btE);
      tdA.appendChild(btD);
      tr.appendChild(tdA);

      tableBody.appendChild(tr);
    });

    updateStats(snap.docs);
    enableSorting();

  } catch (e) {
    console.error("Errore nel caricamento dati:", e);
    alert("Errore nel caricamento dati, controlla console.");
  }
}
// ======================
// DARK MODE HANDLER
// ======================
const themeSwitch = document.getElementById("themeSwitch");

// Carica preferenza salvata
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    if (themeSwitch) themeSwitch.checked = true;
}

// Toggle manuale
if (themeSwitch) {
    themeSwitch.addEventListener("change", () => {
        if (themeSwitch.checked) {
            document.body.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.body.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    });
}

loadData();
