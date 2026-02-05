const STORAGE_RECURRING = 'futsal_recurring_players';
const LEVEL_ORDER = { S: 5, A: 4, B: 3, C: 2, D: 1 };

const useSupabase = !!(window.FUTSAL_SUPABASE_URL && window.FUTSAL_SUPABASE_ANON_KEY);
const supabaseUrl = window.FUTSAL_SUPABASE_URL || '';
const supabaseKey = window.FUTSAL_SUPABASE_ANON_KEY || '';

let recurringData = {};
let inscrits = [];
let editingRecurringName = null;

function supabaseFetch(path, options = {}) {
  const url = `${supabaseUrl}/rest/v1${path}`;
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  return fetch(url, { ...options, headers });
}

async function apiFetchPlayers() {
  const res = await supabaseFetch('/players?select=name,level');
  if (!res.ok) return [];
  const data = await res.json();
  return data;
}

async function apiUpsertPlayer(name, level) {
  await supabaseFetch('/players', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ name: name.trim(), level })
  }).then(r => { if (!r.ok) throw new Error(r.statusText); });
}

async function apiDeletePlayer(name) {
  await supabaseFetch(`/players?name=eq.${encodeURIComponent(name)}`, { method: 'DELETE' });
}

async function apiFetchSession() {
  const res = await supabaseFetch("/session?id=eq.current&select=inscrits");
  if (!res.ok) return [];
  const data = await res.json();
  if (!data || data.length === 0) return [];
  return data[0].inscrits || [];
}

async function apiSetSessionInscrits(inscritsList) {
  await supabaseFetch("/session?id=eq.current", {
    method: 'PATCH',
    body: JSON.stringify({ inscrits: inscritsList })
  });
}

async function apiEnsureSessionRow() {
  const res = await supabaseFetch("/session?id=eq.current&select=id");
  const data = await res.json();
  if (data && data.length === 0) {
    await supabaseFetch("/session", {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: 'current', inscrits: [] })
    });
  }
}

function getRecurring() {
  if (useSupabase) return recurringData;
  try {
    const raw = localStorage.getItem(STORAGE_RECURRING);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setRecurringLocal(players) {
  localStorage.setItem(STORAGE_RECURRING, JSON.stringify(players));
}

function addToRecurring(name, level) {
  const nameNorm = name.trim();
  if (!nameNorm) return;
  if (useSupabase) {
    recurringData[nameNorm] = level;
    apiUpsertPlayer(nameNorm, level).catch(showSyncError);
  } else {
    const rec = getRecurring();
    rec[nameNorm] = level;
    setRecurringLocal(rec);
  }
  renderRecurring();
}

function updateRecurringPlayer(oldName, newName, newLevel) {
  const newNameNorm = newName.trim();
  if (!newNameNorm) return;
  if (useSupabase) {
    (async () => {
      if (oldName !== newNameNorm) {
        await apiDeletePlayer(oldName);
        if (inscrits.some(p => p.name.toLowerCase() === oldName.toLowerCase())) {
          const idx = inscrits.findIndex(p => p.name.toLowerCase() === oldName.toLowerCase());
          inscrits[idx] = { name: newNameNorm, level: newLevel };
          await apiSetSessionInscrits(inscrits);
        }
      } else if (inscrits.some(p => p.name.toLowerCase() === oldName.toLowerCase())) {
        const idx = inscrits.findIndex(p => p.name.toLowerCase() === oldName.toLowerCase());
        inscrits[idx].level = newLevel;
        await apiSetSessionInscrits(inscrits);
      }
      delete recurringData[oldName];
      recurringData[newNameNorm] = newLevel;
      await apiUpsertPlayer(newNameNorm, newLevel);
    })().catch(showSyncError);
  } else {
    const rec = getRecurring();
    if (oldName !== newNameNorm) {
      delete rec[oldName];
      if (inscrits.some(p => p.name.toLowerCase() === oldName.toLowerCase())) {
        const idx = inscrits.findIndex(p => p.name.toLowerCase() === oldName.toLowerCase());
        inscrits[idx] = { name: newNameNorm, level: newLevel };
      }
    } else if (inscrits.some(p => p.name.toLowerCase() === oldName.toLowerCase())) {
      const idx = inscrits.findIndex(p => p.name.toLowerCase() === oldName.toLowerCase());
      inscrits[idx].level = newLevel;
    }
    rec[newNameNorm] = newLevel;
    setRecurringLocal(rec);
  }
  editingRecurringName = null;
  renderRecurring();
  renderInscrits();
  renderTeams();
}

function removeRecurringPlayer(name) {
  if (useSupabase) {
    delete recurringData[name];
    apiDeletePlayer(name).catch(showSyncError);
  } else {
    const rec = getRecurring();
    delete rec[name];
    setRecurringLocal(rec);
  }
  editingRecurringName = null;
  renderRecurring();
}

function showSyncError(err) {
  console.error('Sync Supabase:', err);
  alert('Erreur de synchronisation. Vérifiez la console et votre configuration Supabase.');
}

function renderRecurring() {
  const rec = getRecurring();
  const list = document.getElementById('recurring-list');
  const empty = document.getElementById('recurring-empty');
  const names = Object.keys(rec).sort((a, b) => a.localeCompare(b));

  if (names.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = names.map(name => {
    const level = rec[name];
    if (name === editingRecurringName) {
      const opts = ['S', 'A', 'B', 'C', 'D'].map(l =>
        `<option value="${l}" ${level === l ? 'selected' : ''}>${l}</option>`
      ).join('');
      return `<li class="recurring-edit-row">
        <div class="recurring-edit-form">
          <input type="text" class="edit-recurring-name" value="${escapeHtml(name)}" data-old-name="${escapeHtml(name)}">
          <select class="edit-recurring-level">${opts}</select>
          <div class="recurring-edit-actions">
            <button type="button" class="btn btn-primary btn-save-recurring" aria-label="Enregistrer">✓</button>
            <button type="button" class="btn btn-outline btn-cancel-recurring" aria-label="Annuler">✕</button>
          </div>
        </div>
      </li>`;
    }
    return `<li>
      <span><strong>${escapeHtml(name)}</strong> <span class="level level-${level}">${level}</span></span>
      <span class="recurring-actions">
        <button type="button" class="btn btn-outline add-inline btn-inscrire" data-name="${escapeHtml(name)}" data-level="${level}">Inscrire</button>
        <button type="button" class="btn btn-outline btn-edit-recurring" data-name="${escapeHtml(name)}" aria-label="Modifier">✎</button>
        <button type="button" class="btn btn-outline btn-delete-recurring" data-name="${escapeHtml(name)}" aria-label="Supprimer">🗑</button>
      </span>
    </li>`;
  }).join('');

  list.querySelectorAll('.btn-inscrire').forEach(btn => {
    btn.addEventListener('click', () => {
      addInscrit(btn.dataset.name, btn.dataset.level);
      document.getElementById('player-name').value = '';
      document.getElementById('player-level').value = 'B';
    });
  });
  list.querySelectorAll('.btn-edit-recurring').forEach(btn => {
    btn.addEventListener('click', () => {
      editingRecurringName = btn.dataset.name;
      renderRecurring();
      const li = list.querySelector('.recurring-edit-row');
      if (li) {
        const input = li.querySelector('.edit-recurring-name');
        if (input) { input.focus(); input.select(); }
      }
    });
  });
  list.querySelectorAll('.btn-delete-recurring').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`Retirer « ${btn.dataset.name} » de la base des joueurs récurrents ?`)) {
        removeRecurringPlayer(btn.dataset.name);
      }
    });
  });
  list.querySelectorAll('.btn-save-recurring').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('li');
      const oldName = li.querySelector('.edit-recurring-name').dataset.oldName;
      const newName = li.querySelector('.edit-recurring-name').value.trim();
      const newLevel = li.querySelector('.edit-recurring-level').value;
      if (!newName) return;
      if (oldName !== newName && getRecurring()[newName] !== undefined) {
        alert('Un joueur avec ce nom existe déjà.');
        return;
      }
      updateRecurringPlayer(oldName, newName, newLevel);
    });
  });
  list.querySelectorAll('.btn-cancel-recurring').forEach(btn => {
    btn.addEventListener('click', () => {
      editingRecurringName = null;
      renderRecurring();
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function addInscrit(name, level) {
  const nameNorm = name.trim();
  if (!nameNorm) return;
  if (inscrits.some(p => p.name.toLowerCase() === nameNorm.toLowerCase())) return;
  inscrits.push({ name: nameNorm, level: level });
  addToRecurring(nameNorm, level);
  if (useSupabase) apiSetSessionInscrits(inscrits).catch(showSyncError);
  renderInscrits();
  renderTeams();
}

function removeInscrit(index) {
  inscrits.splice(index, 1);
  if (useSupabase) apiSetSessionInscrits(inscrits).catch(showSyncError);
  renderInscrits();
  renderTeams();
}

function resetInscrits() {
  inscrits = [];
  if (useSupabase) apiSetSessionInscrits(inscrits).catch(showSyncError);
  renderInscrits();
  renderTeams();
}

function renderInscrits() {
  const list = document.getElementById('inscrits-list');
  const countEl = document.getElementById('count-inscrits');

  countEl.textContent = inscrits.length;

  if (inscrits.length === 0) {
    list.innerHTML = '<li class="empty-state">Aucun inscrit. Ajoutez des joueurs ci-dessus.</li>';
    return;
  }

  list.innerHTML = inscrits.map((p, i) => `
    <li>
      <span><span class="name">${escapeHtml(p.name)}</span> <span class="level level-${p.level}">${p.level}</span></span>
      <button type="button" class="remove-btn" data-index="${i}" aria-label="Retirer">×</button>
    </li>
  `).join('');

  list.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeInscrit(parseInt(btn.dataset.index, 10)));
  });
}

function renderTeams() {
  const team1List = document.getElementById('team1-list');
  const team2List = document.getElementById('team2-list');
  const team1Total = document.getElementById('team1-total');
  const team2Total = document.getElementById('team2-total');

  if (inscrits.length < 2) {
    team1List.innerHTML = '';
    team2List.innerHTML = '';
    team1Total.textContent = '';
    team2Total.textContent = '';
    return;
  }

  const sorted = [...inscrits].sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);
  const team1 = [];
  const team2 = [];
  let sum1 = 0, sum2 = 0;

  sorted.forEach((p, i) => {
    const score = LEVEL_ORDER[p.level];
    if (sum1 <= sum2) {
      team1.push(p);
      sum1 += score;
    } else {
      team2.push(p);
      sum2 += score;
    }
  });

  function teamHtml(team, sum) {
    const levelOrder = ['S','A','B','C','D'];
    const byLevel = levelOrder.map(l => team.filter(p => p.level === l));
    const total = team.reduce((s, p) => s + LEVEL_ORDER[p.level], 0);
    return {
      html: byLevel.flat().map(p => `<li><span>${escapeHtml(p.name)}</span> <span class="level level-${p.level}">${p.level}</span></li>`).join('') || '<li class="empty-state">—</li>',
      total: `Total niveau: ${total} (${team.length} joueur${team.length > 1 ? 's' : ''})`
    };
  }

  const t1 = teamHtml(team1, sum1);
  const t2 = teamHtml(team2, sum2);
  team1List.innerHTML = t1.html;
  team2List.innerHTML = t2.html;
  team1Total.textContent = t1.total;
  team2Total.textContent = t2.total;
}

function bindEvents() {
  document.getElementById('btn-add').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const levelSelect = document.getElementById('player-level');
    const name = nameInput.value.trim();
    if (!name) return;
    const rec = getRecurring();
    const level = rec[name] || levelSelect.value;
    if (rec[name] === undefined) addToRecurring(name, level);
    addInscrit(name, level);
    nameInput.value = '';
    levelSelect.value = rec[name] || levelSelect.value;
    nameInput.focus();
  });

  document.getElementById('player-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-add').click();
  });

  document.getElementById('player-name').addEventListener('input', () => {
    const name = document.getElementById('player-name').value.trim();
    const rec = getRecurring();
    const levelSelect = document.getElementById('player-level');
    if (rec[name] !== undefined) levelSelect.value = rec[name];
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (inscrits.length === 0) return;
    if (confirm('Réinitialiser la liste des inscrits pour cette session ?')) resetInscrits();
  });
}

async function init() {
  if (useSupabase) {
    try {
      await apiEnsureSessionRow();
      const players = await apiFetchPlayers();
      recurringData = {};
      players.forEach(p => { recurringData[p.name] = p.level; });
      inscrits = await apiFetchSession();
    } catch (err) {
      console.error('Chargement Supabase:', err);
      alert('Impossible de charger les données partagées. Vérifiez config.js et les tables Supabase.');
    }
  }
  renderRecurring();
  renderInscrits();
  renderTeams();
  bindEvents();
}

init();
