const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('wish-form');
const feed = document.getElementById('wishes-feed');
const submitBtn = document.getElementById('submit-btn');
const themeToggle = document.getElementById('theme-toggle');
const fileInput = document.getElementById('photo');
const fileNameLabel = document.getElementById('file-name');

const cake = document.getElementById('birthday-cake');
const cakeHint = document.getElementById('cake-hint');
const modal = document.getElementById('birthday-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const relightBtn = document.getElementById('relight-btn');

// Theme Toggle with Persistence
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? 'Light Mode' : 'Dark Mode';

themeToggle.addEventListener('click', () => {
  const root = document.documentElement;
  const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
  themeToggle.textContent = nextTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
});

// Interactive Cake & Popup
function blowCandles() {
  if (!cake.classList.contains('blown-out')) {
    cake.classList.add('blown-out');
    cakeHint.textContent = 'Make a wish, Kerubo Lydia!';
    setTimeout(() => {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }, 450);
  } else {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }
}

cake.addEventListener('click', blowCandles);
cake.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    blowCandles();
  }
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
});

relightBtn.addEventListener('click', () => {
  cake.classList.remove('blown-out');
  cakeHint.textContent = 'Tap the cake to blow out the candles & make a wish!';
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
});

// File Selection Feedback
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    fileNameLabel.textContent = `Selected: ${fileInput.files[0].name}`;
  } else {
    fileNameLabel.textContent = 'Choose a photo from your device (Optional)';
  }
});

// Render & Realtime Sync
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderWish(wish, prepend = false) {
  if (document.getElementById(`wish-${wish.id}`)) return;

  const card = document.createElement('article');
  card.className = 'wish-card';
  if (wish.id) card.id = `wish-${wish.id}`;

  const imgHtml = wish.photo_url
    ? `<img src="${wish.photo_url}" alt="Birthday memory for Kerubo Lydia" loading="lazy" />`
    : '';

  card.innerHTML = `
    ${imgHtml}
    <div class="wish-content">
      <p>${escapeHtml(wish.message)}</p>
      <span>— ${escapeHtml(wish.sender_name)}</span>
    </div>
  `;

  if (prepend) {
    feed.prepend(card);
  } else {
    feed.appendChild(card);
  }
}

async function loadWishes() {
  const { data, error } = await db
    .from('wishes')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    feed.innerHTML = '';
    data.forEach((wish) => renderWish(wish));
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  const sender = document.getElementById('sender').value.trim();
  const message = document.getElementById('message').value.trim();
  let photoUrl = null;

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${cleanName}`;

    const { data: uploadData, error: uploadError } = await db.storage
      .from('birthday-photos')
      .upload(fileName, file);

    if (!uploadError && uploadData) {
      const { data: urlData } = db.storage
        .from('birthday-photos')
        .getPublicUrl(uploadData.path);
      photoUrl = urlData.publicUrl;
    }
  }

  const { data: inserted } = await db
    .from('wishes')
    .insert([{ sender_name: sender, message, photo_url: photoUrl }])
    .select()
    .single();

  if (inserted) {
    renderWish(inserted, true);
  }

  form.reset();
  fileNameLabel.textContent = 'Choose a photo from your device (Optional)';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Post Wish';
});

db.channel('realtime-wishes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wishes' }, (payload) => {
    renderWish(payload.new, true);
  })
  .subscribe();

loadWishes();
