// ============================================================
// SUPABASE CONNECTION
// This is what makes your data persistent across devices/reboots.
// Every add / edit / delete below writes straight to this cloud DB.
// ============================================================
const SUPABASE_URL = "https://xzjwnsudcrqwhisgludb.supabase.co";
const SUPABASE_KEY = "sb_publishable_pYuhA1M7CEBxtsHiwhhNaw_gPgpdalE";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Save Expenses
async function saveExpenses() {
  const expenseValue = parseFloat(document.getElementById('totalExpensesInput').value);
  if (isNaN(expenseValue)) {
    alert("Please enter a valid number for expenses");
    return;
  }
  const { error } = await supabase.from('expenses').insert([{ amount: expenseValue }]);
  if (error) {
    console.error("Error saving expenses:", error);
    alert("Failed to save expenses");
  } else {
    alert("Expenses saved!");
    loadTotals();
  }
}

// Fetch Totals
async function loadTotals() {
  const { data: salaries } = await supabase.from('salary').select('amount');
  const { data: expenses } = await supabase.from('expenses').select('amount');
  const totalSalary = salaries?.reduce((sum, s) => sum + s.amount, 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
  document.getElementById('totalSalaryInput').value = totalSalary;
  document.getElementById('totalExpensesInput').value = totalExpenses;
}

// Run on page load
loadTotals();

const defaultAssets = [
    { id: "1", name: "Parag Parikh Flexi Cap Fund", allocation: 25, active: true, startDate: "" },
    { id: "2", name: "Motilal Oswal Large and Midcap Fund", allocation: 20, active: true, startDate: "" },
    { id: "3", name: "Small Cap Fund (low amount)", allocation: 10, active: true, startDate: "" },
    { id: "4", name: "Foreign Mutual Fund", allocation: 10, active: true, startDate: "" },
    { id: "5", name: "Gold ETF Mutual Fund", allocation: 10, active: true, startDate: "" },
    { id: "6", name: "Silver ETF Mutual Fund (low amount)", allocation: 5, active: true, startDate: "" },
    { id: "7", name: "Liquid Mutual Fund (Emergency Fund)", allocation: 10, active: true, startDate: "" },
    { id: "8", name: "Tax Saving Mutual Fund (ELSS)", allocation: 10, active: true, startDate: "" }
];

let userState = {
    monthlySavings: "",
    targetEndDate: "",
    assets: [],
    checklists: [false, false, false]
};
let chartInstance = null;

window.addEventListener('load', async function() {
    await loadState();
    document.getElementById("monthlySavings").value = userState.monthlySavings;
    document.getElementById("targetEndDate").value = userState.targetEndDate;
    document.getElementById("checklist_0").checked = userState.checklists[0] || false;
    document.getElementById("checklist_1").checked = userState.checklists[1] || false;
    document.getElementById("checklist_2").checked = userState.checklists[2] || false;
    recalculateAll();
    initChart();
}, false);

function setCloudStatus(state) {
    const el = document.getElementById("cloudStatus");
    if (!el) return;
    if (state === "online") {
        el.innerText = "☁️ Synced";
        el.className = "text-emerald-400 font-semibold";
    } else if (state === "connecting") {
        el.innerText = "☁️ Connecting…";
        el.className = "text-slate-500 font-semibold";
    } else {
        el.innerText = "⚠️ Offline";
        el.className = "text-red-400 font-semibold";
    }
}

async function loadState() {
    setCloudStatus("connecting");
    try {
        const { data: settingsRow, error: settingsError } = await supabaseClient.from('settings').select('*').eq('id', 1).maybeSingle();
        if (settingsError) throw settingsError;
        if (settingsRow) {
            userState.monthlySavings = settingsRow.monthly_savings ?? "";
            userState.targetEndDate = settingsRow.target_end_date ?? "";
            userState.checklists = [!!settingsRow.checklist_0, !!settingsRow.checklist_1, !!settingsRow.checklist_2];
        }
        const { data: assetRows, error: assetsError } = await supabaseClient.from('assets').select('*').order('created_at', { ascending: true });
        if (assetsError) throw assetsError;
        if (!assetRows || assetRows.length === 0) {
            const seedRows = defaultAssets.map(a => ({ id: a.id, name: a.name, allocation: a.allocation, active: a.active, start_date: null }));
            const { error: seedError } = await supabaseClient.from('assets').insert(seedRows);
            if (seedError) throw seedError;
            userState.assets = defaultAssets.map(a => ({ ...a, startDate: "" }));
        } else {
            userState.assets = assetRows.map(r => ({ id: r.id, name: r.name, allocation: r.allocation, active: r.active, startDate: r.start_date || "" }));
        }
        setCloudStatus("online");
    } catch (err) {
        console.error("❌ Supabase load failed", err);
        setCloudStatus("offline");
        showToast("⚠️ Could not reach the cloud database. Check your internet connection and reload.", "error");
        if (!userState.assets || userState.assets.length === 0) userState.assets = defaultAssets.map(a => ({ ...a, startDate: "" }));
    }
}

async function persistSettings() {
    try {
        const payload = {
            id: 1,
            monthly_savings: userState.monthlySavings === "" ? null : userState.monthlySavings,
            target_end_date: userState.targetEndDate === "" ? null : userState.targetEndDate,
            checklist_0: userState.checklists[0] || false,
            checklist_1: userState.checklists[1] || false,
            checklist_2: userState.checklists[2] || false,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabaseClient.from('settings').upsert(payload);
        if (error) throw error;
        setCloudStatus("online");
    } catch (err) {
        console.error("❌ Failed to save settings to Supabase", err);
        setCloudStatus("offline");
        showToast("⚠️ Could not save to cloud database", "error");
    }
}

function saveChecklistState() {
    userState.checklists = [
        document.getElementById("checklist_0").checked,
        document.getElementById("checklist_1").checked,
        document.getElementById("checklist_2").checked
    ];
    persistSettings();
}
function handleMonthlySavingsChange() { recalculateAll(); persistSettings(); }
function handleTargetDateChange() { recalculateAll(); persistSettings(); }

async function resetToCleanState() {
    try {
        const { error: deleteError } = await supabaseClient.from('assets').delete().neq('id', '__never_matches__');
        if (deleteError) throw deleteError;
        const seedRows = defaultAssets.map(a => ({ id: a.id, name: a.name, allocation: a.allocation, active: a.active, start_date: null }));
        const { error: insertError } = await supabaseClient.from('assets').insert(seedRows);
        if (insertError) throw insertError;
        userState.monthlySavings = "";
        userState.targetEndDate = "";
        userState.assets = defaultAssets.map(asset => ({ ...asset, startDate: "" }));
        userState.checklists = [false, false, false];
        await persistSettings();
        document.getElementById("monthlySavings").value = "";
        document.getElementById("targetEndDate").value = "";
        document.getElementById("checklist_0").checked = false;
        document.getElementById("checklist_1").checked = false;
        document.getElementById("checklist_2").checked = false;
        recalculateAll();
        showToast("Reset to clean template. Cloud data cleared.", "warning");
    } catch (err) {
        console.error("❌ Reset failed", err);
        showToast("⚠️ Could not reset cloud database", "error");
    }
}

function calculateCompletedInstallments(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months--;
    return Math.max(0, months + 1);
}

function recalculateAll() {
    const savingsVal = document.getElementById("monthlySavings").value;
    userState.monthlySavings = savingsVal === "" ? "" : parseFloat(savingsVal);
    userState.targetEndDate = document.getElementById("targetEndDate").value;
    let totalPercentAssigned = 0, activeSipCount = 0, grandSipSum = 0, grandPrincipalSum = 0;
    userState.assets.forEach(asset => {
        totalPercentAssigned += asset.allocation;
        if (asset.active) activeSipCount++;
        const installments = (asset.startDate && userState.targetEndDate) ? calculateCompletedInstallments(asset.startDate, userState.targetEndDate) : 0;
        asset.installmentsCount = installments;
        const monthlySip = (userState.monthlySavings !== "" && !isNaN(userState.monthlySavings)) ? (userState.monthlySavings * asset.allocation) / 100 : 0;
        asset.calculatedSip = monthlySip;
        if (asset.active) { grandSipSum += monthlySip; asset.calculatedPrincipal = monthlySip * installments; }
        else { asset.calculatedPrincipal = 0; }
        grandPrincipalSum += asset.calculatedPrincipal;
    });
    document.getElementById("activeSipsCount").innerText = `${activeSipCount} Active SIPs`;
    const statusText = document.getElementById("allocationStatus");
    const statusBar = document.getElementById("allocationBar");
    const errorText = document.getElementById("allocationError");
    statusText.innerText = `${totalPercentAssigned}% Allocated`;
    statusBar.style.width = `${Math.min(totalPercentAssigned, 100)}%`;
    if (totalPercentAssigned === 100) {
        statusText.className = "font-bold text-emerald-400 text-xs";
        statusBar.className = "bg-emerald-500 h-full transition-all duration-300";
        errorText.classList.add("hidden");
    } else {
        statusText.className = "font-bold text-amber-500 text-xs";
        statusBar.className = "bg-amber-500 h-full transition-all duration-300";
        errorText.classList.remove("hidden");
        errorText.innerText = `Allocations must equal 100% (currently ${totalPercentAssigned}%). Please adjust asset splits.`;
    }
    renderMasterTable(grandSipSum, grandPrincipalSum, totalPercentAssigned);
    updateChartData();
}

function renderMasterTable(totalSip, totalPrincipal, totalAlloc) {
    const body = document.getElementById("portfolioTableBody");
    body.innerHTML = "";
    if (userState.assets.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="7" class="p-8 text-center text-slate-500 border border-slate-800 italic">No assets in your portfolio. Click <span class="text-emerald-400 font-semibold cursor-pointer" onclick="openAddAssetModal()">➕ Add Asset</span> above to start tracking your investments.</td>`;
        body.appendChild(tr);
        document.getElementById("totalAllocation").innerText = "0%";
        document.getElementById("totalSip").innerText = "₹0";
        document.getElementById("totalPrincipal").innerText = "₹0";
        return;
    }
    userState.assets.forEach((asset, index) => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-900/20 transition-colors";
        const formattedSip = (userState.monthlySavings === "" || isNaN(userState.monthlySavings)) ? "-" : `₹${Math.round(asset.calculatedSip).toLocaleString('en-IN')}`;
        const formattedPrincipal = (!asset.startDate || userState.monthlySavings === "") ? "-" : `₹${Math.round(asset.calculatedPrincipal).toLocaleString('en-IN')}`;
        const installmentDisplay = (!asset.startDate || userState.monthlySavings === "") ? "" : `<span class="text-[9px] text-slate-500 font-normal">(${asset.installmentsCount} installments)</span>`;
        tr.innerHTML = `
            <td class="p-3 border border-slate-800 font-semibold text-slate-200">${asset.name}</td>
            <td class="p-3 text-center border border-slate-800 font-bold text-slate-300 font-mono">${asset.allocation}%</td>
            <td class="p-3 text-center border border-slate-800"><button onclick="toggleSipStatus(${index})" class="px-2.5 py-1 rounded text-[10px] font-bold transition-all ${asset.active ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40' : 'bg-slate-950 border border-slate-850 text-slate-500 hover:bg-slate-900/40'}">${asset.active ? '🟢 ACTIVE' : '🔴 STOPPED'}</button></td>
            <td class="p-3 text-right border border-slate-800 font-semibold text-slate-300 font-mono">${formattedSip}</td>
            <td class="p-3 text-center border border-slate-800 text-slate-400 font-mono text-[11px]">${formatDateDisplay(asset.startDate)}</td>
            <td class="p-3 text-right border border-slate-800 font-bold text-emerald-400 font-mono bg-emerald-950/5"><div class="flex flex-col items-end"><span>${formattedPrincipal}</span>${installmentDisplay}</div></td>
            <td class="p-3 text-center border border-slate-800"><div class="flex items-center justify-center gap-2">
                <button onclick="openEditAssetModal(${index})" class="p-1 hover:text-emerald-400 text-slate-500 transition-colors" title="Edit"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z"></path></svg></button>
                <button onclick="deleteAsset(${index})" class="p-1 hover:text-red-400 text-slate-500 transition-colors" title="Delete"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div></td>`;
        body.appendChild(tr);
    });
    document.getElementById("totalAllocation").innerText = `${totalAlloc}%`;
    document.getElementById("totalAllocation").className = totalAlloc === 100 ? "p-3 text-center text-emerald-400 font-mono border border-slate-800" : "p-3 text-center text-amber-500 font-mono border border-slate-800";
    document.getElementById("totalSip").innerText = (userState.monthlySavings === "" || isNaN(userState.monthlySavings)) ? "-" : "₹" + Math.round(totalSip).toLocaleString('en-IN');
    document.getElementById("totalPrincipal").innerText = (userState.monthlySavings === "" || isNaN(userState.monthlySavings)) ? "-" : "₹" + Math.round(totalPrincipal).toLocaleString('en-IN');
}

async function toggleSipStatus(index) {
    const asset = userState.assets[index], newActive = !asset.active;
    try {
        const { error } = await supabaseClient.from('assets').update({ active: newActive }).eq('id', asset.id);
        if (error) throw error;
        asset.active = newActive;
        setCloudStatus("online");
        recalculateAll();
    } catch (err) {
        console.error("❌ Failed to update SIP status", err);
        showToast("⚠️ Could not save change to cloud database", "error");
    }
}
function openAddAssetModal() {
    document.getElementById("modalTitle").innerText = "Add New Asset";
    document.getElementById("editAssetId").value = "";
    document.getElementById("assetForm").reset();
    document.getElementById("modalStartDate").value = "";
    document.getElementById("assetModal").classList.remove("hidden");
}
function openEditAssetModal(index) {
    const asset = userState.assets[index];
    document.getElementById("modalTitle").innerText = "Edit Asset";
    document.getElementById("editAssetId").value = index;
    document.getElementById("modalAssetName").value = asset.name;
    document.getElementById("modalAllocation").value = asset.allocation;
    document.getElementById("modalStartDate").value = asset.startDate || "";
    document.getElementById("assetModal").classList.remove("hidden");
}
function closeAssetModal() { document.getElementById("assetModal").classList.add("hidden"); }

async function handleAssetFormSubmit(e) {
    e.preventDefault();
    const editIndex = document.getElementById("editAssetId").value;
    const name = document.getElementById("modalAssetName").value;
    const allocation = parseInt(document.getElementById("modalAllocation").value) || 0;
    const startDateRaw = document.getElementById("modalStartDate").value;
    const startDateForDb = startDateRaw === "" ? null : startDateRaw;
    try {
        if (editIndex === "") {
            const newId = "asset_" + Date.now();
            const { error } = await supabaseClient.from('assets').insert({ id: newId, name, allocation, active: true, start_date: startDateForDb });
            if (error) throw error;
            userState.assets.push({ id: newId, name, allocation, active: true, startDate: startDateRaw });
            showToast("✅ New asset added and saved to cloud", "success");
        } else {
            const idx = parseInt(editIndex), asset = userState.assets[idx];
            const { error } = await supabaseClient.from('assets').update({ name, allocation, start_date: startDateForDb }).eq('id', asset.id);
            if (error) throw error;
            asset.name = name; asset.allocation = allocation; asset.startDate = startDateRaw;
            showToast("✅ Asset updated and saved to cloud", "success");
        }
        closeAssetModal();
        setCloudStatus("online");
        recalculateAll();
    } catch (err) {
        console.error("❌ Failed to save asset", err);
        showToast("⚠️ Could not save to cloud database", "error");
    }
}

async function deleteAsset(index) {
    const asset = userState.assets[index];
    try {
        const { error } = await supabaseClient.from('assets').delete().eq('id', asset.id);
        if (error) throw error;
        userState.assets.splice(index, 1);
        setCloudStatus("online");
        recalculateAll();
        showToast(`🗑️ Deleted "${asset.name}" from cloud database`, "error");
    } catch (err) {
        console.error("❌ Failed to delete asset", err);
        showToast("⚠️ Could not delete from cloud database", "error");
    }
}
function formatDateDisplay(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}
function showToast(message, type = "success") {
    const toast = document.getElementById("customToast");
    toast.innerText = message;
    toast.classList.remove("hidden", "bg-emerald-950/40", "border-emerald-500/30", "text-emerald-400", "bg-red-950/40", "border-red-500/30", "text-red-400", "bg-amber-950/40", "border-amber-500/30", "text-amber-400");
    if (type === "success") toast.classList.add("bg-emerald-950/40", "border-emerald-500/30", "text-emerald-400");
    else if (type === "error") toast.classList.add("bg-red-950/40", "border-red-500/30", "text-red-400");
    else toast.classList.add("bg-amber-950/40", "border-amber-500/30", "text-amber-400");
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 4000);
}
function initChart() {
    const ctx = document.getElementById('holdingsSplitChart').getContext('2d');
    const labels = userState.assets.length > 0 ? userState.assets.map(a => a.name) : ["No Assets"];
    const dataValues = userState.assets.length > 0 ? userState.assets.map(a => a.allocation) : [100];
    const bgColors = userState.assets.length > 0 ? ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#14b8a6', '#ec4899'] : ['#1e293b'];
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 2, borderColor: '#090d16', hoverOffset: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) { const rawVal = context.raw || 0; return ` ${context.label}: ${rawVal}%`; } } }
            },
            cutout: '72%'
        }
    });
}
function updateChartData() {
    if (!chartInstance) return;
    if (userState.assets.length === 0) {
        chartInstance.data.labels = ["No Assets"];
        chartInstance.data.datasets[0].data = [100];
        chartInstance.data.datasets[0].backgroundColor = ['#1e293b'];
    } else {
        chartInstance.data.labels = userState.assets.map(a => a.name);
        chartInstance.data.datasets[0].data = userState.assets.map(a => a.allocation);
        chartInstance.data.datasets[0].backgroundColor = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#14b8a6', '#ec4899'];
    }
    chartInstance.update();
}
