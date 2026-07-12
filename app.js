const STORAGE_KEY = 'kinfolk-tree-library-v2';
let library = loadLibrary();
let currentTreeId = '';
let people = [];
let zoom = 1;
const $ = (selector) => document.querySelector(selector);
const els = {
  canvas: $('#treeCanvas'), empty: $('#emptyState'), count: $('#peopleCount'), dialog: $('#personDialog'),
  form: $('#personForm'), id: $('#personId'), name: $('#nameInput'), birth: $('#birthInput'), death: $('#deathInput'),
  parent: $('#parentInput'), secondParent: $('#secondParentInput'), partner: $('#partnerInput'), marriageDate: $('#marriageDateInput'), sibling:$('#siblingInput'), siblingType:$('#siblingTypeInput'), bio: $('#bioInput'), error: $('#formError'), delete: $('#deleteBtn'),
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
  currentTreeId = id; people = tree.people.map(normalizePerson); tree.people = people; savePeople(); els.home.hidden = true; els.app.hidden = false;
  $('#treeLabel').textContent = tree.name.toUpperCase(); $('#treeTitle').textContent = tree.name; render();
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function initials(name) { return name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function years(p) { return `${p.birth || '?'} — ${p.death || 'present'}`; }
function normalizePerson(person) {
  const parentIds = Array.isArray(person.parentIds) ? person.parentIds : (person.parentId ? [person.parentId] : []);
  return {...person, parentIds:[...new Set(parentIds.filter(Boolean))].slice(0,2), marriageDate:person.marriageDate || '', siblingLinks:Array.isArray(person.siblingLinks) ? person.siblingLinks : []};
}
function baseGenerationOf(person, trail = new Set()) {
  if (!person.parentIds?.length || trail.has(person.id)) return 0;
  const nextTrail = new Set(trail); nextTrail.add(person.id);
  const parents = person.parentIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  return parents.length ? Math.max(...parents.map(parent => baseGenerationOf(parent, nextTrail))) + 1 : 0;
}
function generationOf(person) {
  const partner = people.find(p => p.id === person.partnerId && p.partnerId === person.id);
  return Math.max(baseGenerationOf(person), partner ? baseGenerationOf(partner) : 0);
}
function createPersonCard(person) {
  const card = document.createElement('button'); card.type = 'button'; card.className = 'person-card'; card.dataset.id = person.id;
  const parents = person.parentIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const parentNames = parents.map(parent => parent.name.split(' ')[0]).join(' & ');
  card.innerHTML = `<span class="avatar">${escapeHtml(initials(person.name))}</span><h3>${escapeHtml(person.name)}</h3><p class="years">${escapeHtml(years(person))}</p>${parents.length ? `<span class="relation">Child of ${escapeHtml(parentNames)}</span>` : '<span class="relation">Family root</span>'}`;
  card.addEventListener('click', () => showDetails(person.id));
  return card;
}
function drawParentConnections() {
  els.canvas.querySelector('.tree-links')?.remove();
  if (!people.length) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('tree-links'); svg.setAttribute('aria-hidden','true');
  const canvasRect = els.canvas.getBoundingClientRect();
  people.forEach(child => {
    const childCard = els.canvas.querySelector(`.person-card[data-id="${CSS.escape(child.id)}"]`); if (!childCard) return;
    const childRect = childCard.getBoundingClientRect();
    child.parentIds.forEach(parentId => {
      const parentCard = els.canvas.querySelector(`.person-card[data-id="${CSS.escape(parentId)}"]`); if (!parentCard) return;
      const parentRect = parentCard.getBoundingClientRect();
      const startX = (parentRect.left - canvasRect.left + parentRect.width / 2) / zoom;
      const startY = (parentRect.bottom - canvasRect.top) / zoom;
      const endX = (childRect.left - canvasRect.left + childRect.width / 2) / zoom;
      const endY = (childRect.top - canvasRect.top) / zoom;
      const middleY = startY + (endY - startY) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',`M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`); path.classList.add('parent-link'); svg.appendChild(path);
    });
  });
  els.canvas.prepend(svg);
}

function render() {
  els.count.textContent = people.length;
  els.empty.hidden = people.length > 0;
  els.canvas.innerHTML = '';
  const groups = new Map();
  people.forEach(person => { const gen = generationOf(person); if (!groups.has(gen)) groups.set(gen, []); groups.get(gen).push(person); });
  [...groups.keys()].sort((a,b) => a-b).forEach(gen => {
    const row = document.createElement('div'); row.className = 'generation'; row.dataset.generation = gen;
    const rendered = new Set();
    groups.get(gen).forEach(person => {
      if (rendered.has(person.id)) return;
      const partner = people.find(p => p.id === person.partnerId && p.partnerId === person.id && generationOf(p) === gen);
      if (partner && !rendered.has(partner.id)) {
        const couple = document.createElement('div'); couple.className = 'couple-unit';
        couple.appendChild(createPersonCard(person));
        const link = document.createElement('div'); link.className = 'couple-link';
        link.innerHTML = `<span>${person.marriageDate ? `Married ${escapeHtml(new Date(`${person.marriageDate}T00:00:00`).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}))}` : 'Partners'}</span>`;
        couple.appendChild(link); couple.appendChild(createPersonCard(partner)); row.appendChild(couple); rendered.add(partner.id);
      } else { row.appendChild(createPersonCard(person)); }
      rendered.add(person.id);
    });
    els.canvas.appendChild(row);
  });
  applyZoom();
  requestAnimationFrame(drawParentConnections);
}

function populateSelects(currentId = '') {
  const options = people.filter(p => p.id !== currentId).sort((a,b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  els.parent.innerHTML = `<option value="">No parent selected</option>${options}`;
  els.secondParent.innerHTML = `<option value="">No second parent selected</option>${options}`;
  els.partner.innerHTML = `<option value="">No partner selected</option>${options}`;
  els.sibling.innerHTML = `<option value="">No sibling selected</option>${options}`;
}
function suggestSecondParent() {
  if (!els.parent.value || els.secondParent.value) return;
  const firstParent = people.find(person => person.id === els.parent.value);
  const spouse = firstParent && people.find(person => person.id === firstParent.partnerId && person.partnerId === firstParent.id);
  if (spouse && spouse.id !== els.id.value) els.secondParent.value = spouse.id;
}
function openForm(id = '') {
  els.form.reset(); els.error.textContent = ''; els.id.value = id; populateSelects(id);
  const person = people.find(p => p.id === id);
  $('#formEyebrow').textContent = person ? 'EDIT RELATIVE' : 'NEW RELATIVE'; $('#formTitle').textContent = person ? 'Edit person' : 'Add a person'; els.delete.hidden = !person;
  if (person) { els.name.value=person.name; els.birth.value=person.birth; els.death.value=person.death; els.parent.value=person.parentIds?.[0] || ''; els.secondParent.value=person.parentIds?.[1] || ''; els.partner.value=person.partnerId; els.marriageDate.value=person.marriageDate || ''; els.bio.value=person.bio; }
  suggestSecondParent();
  els.marriageDate.disabled = !els.partner.value;
  els.siblingType.disabled = true;
  els.dialog.showModal(); setTimeout(() => els.name.focus(), 50);
}
function showDetails(id) {
  const p = people.find(person => person.id === id); if (!p) return;
  const partner = people.find(person => person.id === p.partnerId);
  const parents = p.parentIds.map(parentId => people.find(person => person.id === parentId)).filter(Boolean);
  const children = people.filter(person => person.parentIds?.includes(p.id));
  const siblingMap = new Map();
  people.filter(person => person.id !== p.id && person.parentIds?.some(parentId => p.parentIds.includes(parentId))).forEach(person => { const shared=person.parentIds.filter(parentId=>p.parentIds.includes(parentId)).length; siblingMap.set(person.id,{person,type:shared > 1 ? 'full' : 'half'}); });
  p.siblingLinks.forEach(link => { const person=people.find(candidate=>candidate.id===link.personId); if (person) siblingMap.set(person.id,{person,type:link.type || 'sibling'}); });
  const siblingText = [...siblingMap.values()].map(item => `${escapeHtml(item.person.name)} (${escapeHtml(item.type === 'sibling' ? 'sibling' : `${item.type} sibling`)})`).join(', ');
  const marriage = partner && p.marriageDate ? ` · Married ${new Date(`${p.marriageDate}T00:00:00`).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}` : '';
  const connections = [parents.length ? `<strong>Parents</strong><span>${parents.map(x=>escapeHtml(x.name)).join(' & ')}</span>` : '', children.length ? `<strong>Children</strong><span>${children.map(x=>escapeHtml(x.name)).join(', ')}</span>` : '', siblingText ? `<strong>Siblings</strong><span>${siblingText}</span>` : ''].filter(Boolean).join('');
  els.detailContent.innerHTML = `<div class="detail-head"><button class="close-button" style="float:right" aria-label="Close">×</button><span class="avatar">${escapeHtml(initials(p.name))}</span><p class="eyebrow">FAMILY MEMBER</p><h2>${escapeHtml(p.name)}</h2><p class="years">${escapeHtml(years(p))}${partner ? ` · Partner of ${escapeHtml(partner.name)}${marriage}` : ''}</p></div>${connections ? `<div class="connection-list">${connections}</div>` : ''}<p class="detail-bio">${escapeHtml(p.bio || 'No story has been added yet.')}</p><div class="detail-actions"><button class="button secondary close-detail">Close</button><button class="button primary edit-detail">Edit person</button></div>`;
  els.detailContent.querySelectorAll('.close-button,.close-detail').forEach(b => b.addEventListener('click', () => els.details.close()));
  els.detailContent.querySelector('.edit-detail').addEventListener('click', () => { els.details.close(); openForm(id); }); els.details.showModal();
}

els.form.addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const birth = Number(els.birth.value), death = Number(els.death.value);
  if (birth && death && death < birth) { els.error.textContent = 'Death year cannot be before birth year.'; return; }
  if (els.parent.value && els.parent.value === els.secondParent.value) { els.error.textContent = 'Choose two different parents.'; return; }
  const oldRecord = people.find(p => p.id === els.id.value);
  const record = { id: els.id.value || crypto.randomUUID(), name: els.name.value.trim(), birth: els.birth.value, death: els.death.value, parentIds:[els.parent.value,els.secondParent.value].filter(Boolean), partnerId: els.partner.value, marriageDate:els.partner.value ? els.marriageDate.value : '', siblingLinks:oldRecord?.siblingLinks || [], bio: els.bio.value.trim() };
  const index = people.findIndex(p => p.id === record.id); if (index >= 0) people[index] = record; else people.push(record);
  if (oldRecord?.partnerId && oldRecord.partnerId !== record.partnerId) { const oldPartner=people.find(p=>p.id===oldRecord.partnerId); if (oldPartner?.partnerId===record.id) { oldPartner.partnerId=''; oldPartner.marriageDate=''; } }
  if (record.partnerId) { const partner = people.find(p => p.id === record.partnerId); if (partner) { partner.partnerId = record.id; partner.marriageDate = record.marriageDate; } }
  if (els.sibling.value) {
    record.siblingLinks = record.siblingLinks.filter(link => link.personId !== els.sibling.value); record.siblingLinks.push({personId:els.sibling.value,type:els.siblingType.value});
    const sibling=people.find(person=>person.id===els.sibling.value); if (sibling) { sibling.siblingLinks=(sibling.siblingLinks || []).filter(link=>link.personId!==record.id); sibling.siblingLinks.push({personId:record.id,type:els.siblingType.value}); }
  }
  savePeople(); render(); els.dialog.close();
});
els.delete.addEventListener('click', () => {
  const id = els.id.value; const p = people.find(person => person.id === id);
  if (!p || !confirm(`Remove ${p.name} from the tree?`)) return;
  people = people.filter(person => person.id !== id).map(person => ({...person, parentIds:(person.parentIds || []).filter(parentId => parentId !== id), partnerId: person.partnerId === id ? '' : person.partnerId, marriageDate:person.partnerId === id ? '' : person.marriageDate, siblingLinks:(person.siblingLinks || []).filter(link=>link.personId!==id)})); savePeople(); render(); els.dialog.close();
});

function applyZoom() { els.canvas.style.transform = `scale(${zoom})`; requestAnimationFrame(drawParentConnections); }
$('#zoomInBtn').addEventListener('click', () => { zoom = Math.min(1.4, zoom + .1); applyZoom(); });
$('#zoomOutBtn').addEventListener('click', () => { zoom = Math.max(.6, zoom - .1); applyZoom(); });
$('#resetViewBtn').addEventListener('click', () => { zoom=1; applyZoom(); $('#treeViewport').scrollTo({top:0,left:0,behavior:'smooth'}); });
$('#addPersonBtn').addEventListener('click', () => openForm()); document.querySelectorAll('.add-trigger').forEach(b => b.addEventListener('click', () => openForm()));
els.partner.addEventListener('change', () => { els.marriageDate.disabled = !els.partner.value; if (!els.partner.value) els.marriageDate.value=''; });
els.parent.addEventListener('change', () => { els.secondParent.value=''; suggestSecondParent(); });
els.sibling.addEventListener('change', () => { els.siblingType.disabled=!els.sibling.value; });
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
  const firstPerson = { id: crypto.randomUUID(), name: $('#firstPersonName').value.trim(), birth: $('#firstPersonBirth').value, death:'', parentIds:[], partnerId:'', marriageDate:'', siblingLinks:[], bio: $('#firstPersonRelation').value.trim() ? `Relationship: ${$('#firstPersonRelation').value.trim()}` : '' };
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
window.addEventListener('resize', () => requestAnimationFrame(drawParentConnections));

refreshTreeSelect();
