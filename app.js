const STORAGE_KEY = 'kinfolk-tree-library-v2';
let library = loadLibrary();
let currentTreeId = '';
let people = [];
let zoom = 1;
const $ = (selector) => document.querySelector(selector);
const els = {
  canvas: $('#treeCanvas'), empty: $('#emptyState'), count: $('#peopleCount'), dialog: $('#personDialog'),
  form: $('#personForm'), id: $('#personId'), name: $('#nameInput'), birth: $('#birthInput'), death: $('#deathInput'),
  parent: $('#parentInput'), partner: $('#partnerInput'), bio: $('#bioInput'), error: $('#formError'), delete: $('#deleteBtn'),
  details: $('#detailDialog'), detailContent: $('#detailContent'), search: $('#searchInput'),
  home: $('#homePage'), app: $('#appPage'), treeSelect: $('#treeSelect'), openTree: $('#openTreeBtn'),
  newTreeDialog: $('#newTreeDialog'), newTreeForm: $('#newTreeForm'), importInput: $('#importInput')
};

function loadLibrary() {
  try { const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); return stored && typeof stored === 'object' ? stored : {}; }
  catch { return {}; }
}
function savePeople() {
  if (!currentTreeId || !library[currentTreeId]) return;
  library[currentTreeId].people = people;
  library[currentTreeId].updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}
function refreshTreeSelect() {
  const trees = Object.values(library).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  els.treeSelect.innerHTML = '<option value="">Choose a saved tree…</option>' + trees.map(tree => `<option value="${tree.id}">${escapeHtml(tree.name)} (${tree.people.length} people)</option>`).join('');
  els.openTree.disabled = true;
}
function showHome() { currentTreeId = ''; people = []; els.app.hidden = true; els.home.hidden = false; refreshTreeSelect(); }
function openTree(id) {
  const tree = library[id]; if (!tree) return;
  currentTreeId = id; people = tree.people; els.home.hidden = true; els.app.hidden = false;
  $('#treeLabel').textContent = tree.name.toUpperCase(); $('#treeTitle').textContent = tree.name; render();
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function initials(name) { return name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function years(p) { return `${p.birth || '?'} — ${p.death || 'present'}`; }
function generationOf(person, trail = new Set()) {
  if (!person.parentId || trail.has(person.id)) return 0;
  trail.add(person.id);
  const parent = people.find(p => p.id === person.parentId);
  return parent ? generationOf(parent, trail) + 1 : 0;
}

function render() {
  els.count.textContent = people.length;
  els.empty.hidden = people.length > 0;
  els.canvas.innerHTML = '';
  const groups = new Map();
  people.forEach(person => { const gen = generationOf(person); if (!groups.has(gen)) groups.set(gen, []); groups.get(gen).push(person); });
  [...groups.keys()].sort((a,b) => a-b).forEach(gen => {
    const row = document.createElement('div'); row.className = 'generation'; row.dataset.generation = gen;
    groups.get(gen).forEach(person => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'person-card'; card.dataset.id = person.id;
      const parent = people.find(p => p.id === person.parentId);
      card.innerHTML = `<span class="avatar">${escapeHtml(initials(person.name))}</span><h3>${escapeHtml(person.name)}</h3><p class="years">${escapeHtml(years(person))}</p>${parent ? `<span class="relation">Child of ${escapeHtml(parent.name.split(' ')[0])}</span>` : '<span class="relation">Family root</span>'}`;
      card.addEventListener('click', () => showDetails(person.id)); row.appendChild(card);
    });
    els.canvas.appendChild(row);
  });
  applyZoom();
}

function populateSelects(currentId = '') {
  const options = people.filter(p => p.id !== currentId).sort((a,b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  els.parent.innerHTML = `<option value="">No parent selected</option>${options}`;
  els.partner.innerHTML = `<option value="">No partner selected</option>${options}`;
}
function openForm(id = '') {
  els.form.reset(); els.error.textContent = ''; els.id.value = id; populateSelects(id);
  const person = people.find(p => p.id === id);
  $('#formEyebrow').textContent = person ? 'EDIT RELATIVE' : 'NEW RELATIVE'; $('#formTitle').textContent = person ? 'Edit person' : 'Add a person'; els.delete.hidden = !person;
  if (person) { els.name.value=person.name; els.birth.value=person.birth; els.death.value=person.death; els.parent.value=person.parentId; els.partner.value=person.partnerId; els.bio.value=person.bio; }
  els.dialog.showModal(); setTimeout(() => els.name.focus(), 50);
}
function showDetails(id) {
  const p = people.find(person => person.id === id); if (!p) return;
  const partner = people.find(person => person.id === p.partnerId);
  els.detailContent.innerHTML = `<div class="detail-head"><button class="close-button" style="float:right" aria-label="Close">×</button><span class="avatar">${escapeHtml(initials(p.name))}</span><p class="eyebrow">FAMILY MEMBER</p><h2>${escapeHtml(p.name)}</h2><p class="years">${escapeHtml(years(p))}${partner ? ` · Partner of ${escapeHtml(partner.name)}` : ''}</p></div><p class="detail-bio">${escapeHtml(p.bio || 'No story has been added yet.')}</p><div class="detail-actions"><button class="button secondary close-detail">Close</button><button class="button primary edit-detail">Edit person</button></div>`;
  els.detailContent.querySelectorAll('.close-button,.close-detail').forEach(b => b.addEventListener('click', () => els.details.close()));
  els.detailContent.querySelector('.edit-detail').addEventListener('click', () => { els.details.close(); openForm(id); }); els.details.showModal();
}

els.form.addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const birth = Number(els.birth.value), death = Number(els.death.value);
  if (birth && death && death < birth) { els.error.textContent = 'Death year cannot be before birth year.'; return; }
  const record = { id: els.id.value || crypto.randomUUID(), name: els.name.value.trim(), birth: els.birth.value, death: els.death.value, parentId: els.parent.value, partnerId: els.partner.value, bio: els.bio.value.trim() };
  const index = people.findIndex(p => p.id === record.id); if (index >= 0) people[index] = record; else people.push(record);
  if (record.partnerId) { const partner = people.find(p => p.id === record.partnerId); if (partner) partner.partnerId = record.id; }
  savePeople(); render(); els.dialog.close();
});
els.delete.addEventListener('click', () => {
  const id = els.id.value; const p = people.find(person => person.id === id);
  if (!p || !confirm(`Remove ${p.name} from the tree?`)) return;
  people = people.filter(person => person.id !== id).map(person => ({...person, parentId: person.parentId === id ? '' : person.parentId, partnerId: person.partnerId === id ? '' : person.partnerId})); savePeople(); render(); els.dialog.close();
});

function applyZoom() { els.canvas.style.transform = `scale(${zoom})`; }
$('#zoomInBtn').addEventListener('click', () => { zoom = Math.min(1.4, zoom + .1); applyZoom(); });
$('#zoomOutBtn').addEventListener('click', () => { zoom = Math.max(.6, zoom - .1); applyZoom(); });
$('#resetViewBtn').addEventListener('click', () => { zoom=1; applyZoom(); $('#treeViewport').scrollTo({top:0,left:0,behavior:'smooth'}); });
$('#addPersonBtn').addEventListener('click', () => openForm()); document.querySelectorAll('.add-trigger').forEach(b => b.addEventListener('click', () => openForm()));
els.search.addEventListener('input', () => { const query=els.search.value.trim().toLowerCase(); document.querySelectorAll('.person-card').forEach(card => { const p=people.find(x=>x.id===card.dataset.id); card.classList.toggle('highlight', !!query && p.name.toLowerCase().includes(query)); card.style.opacity = query && !p.name.toLowerCase().includes(query) ? '.35' : '1'; }); });
$('#exportBtn').addEventListener('click', () => {
  const tree = library[currentTreeId]; if (!tree) return;
  const blob = new Blob([JSON.stringify({app:'Kinfolk',version:2,tree:{...tree,people}},null,2)], {type:'application/json'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${tree.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'family-tree'}.kinfolk.json`; link.click(); URL.revokeObjectURL(link.href);
});

$('#newTreeBtn').addEventListener('click', () => { els.newTreeForm.reset(); els.newTreeDialog.showModal(); setTimeout(() => $('#newTreeName').focus(), 50); });
els.newTreeForm.addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const id = crypto.randomUUID();
  const firstPerson = { id: crypto.randomUUID(), name: $('#firstPersonName').value.trim(), birth: $('#firstPersonBirth').value, death:'', parentId:'', partnerId:'', bio: $('#firstPersonRelation').value.trim() ? `Relationship: ${$('#firstPersonRelation').value.trim()}` : '' };
  library[id] = { id, name: $('#newTreeName').value.trim(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), people:[firstPerson] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); els.newTreeDialog.close(); openTree(id);
});
els.treeSelect.addEventListener('change', () => { els.openTree.disabled = !els.treeSelect.value; });
els.openTree.addEventListener('click', () => openTree(els.treeSelect.value));
$('#homeBtn').addEventListener('click', showHome);
$('#importBtn').addEventListener('click', () => els.importInput.click());
els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'Kinfolk' || !data.tree || typeof data.tree.name !== 'string' || !Array.isArray(data.tree.people)) throw new Error('Invalid tree file');
    const id = crypto.randomUUID();
    library[id] = {...data.tree, id, name:data.tree.name.trim(), updatedAt:new Date().toISOString()};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); refreshTreeSelect(); els.treeSelect.value=id; els.openTree.disabled=false; $('#homeMessage').textContent='Tree imported successfully.';
  } catch { $('#homeMessage').textContent='That file is not a valid Kinfolk tree export.'; }
  els.importInput.value='';
});

refreshTreeSelect();
