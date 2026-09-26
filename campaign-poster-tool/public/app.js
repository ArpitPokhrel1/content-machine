const canvas = document.querySelector('#poster');
const ctx = canvas.getContext('2d');
const photoInput = document.querySelector('#photoInput');
const nameInput = document.querySelector('#nameInput');
const districtInput = document.querySelector('#districtInput');
const status = document.querySelector('#status');
const downloadButton = document.querySelector('#downloadButton');
const emptyState = document.querySelector('#emptyState');

let background, overlay, subject;
const loadImage = (src) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`;
}

function fitText(text, maxWidth, startSize) {
  let size = startSize;
  do { ctx.font = `900 ${size}px "Noto Sans Devanagari", sans-serif`; size -= 4; } while (ctx.measureText(text).width > maxWidth && size > 74);
  return size + 4;
}

function drawText(text, x, y, maxWidth, size, color) {
  if (!text.trim()) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.font = `900 ${fitText(text, maxWidth, size)}px "Noto Sans Devanagari", sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawSubject() {
  if (!subject) return;
  const targetHeight = 4350;
  const targetWidth = subject.width / subject.height * targetHeight;
  ctx.drawImage(subject, 4500 - targetWidth + 95, 1135, targetWidth, targetHeight);
}

function render() {
  if (!background || !overlay) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  drawSubject();
  ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  drawText(nameInput.value, 1430, 2260, 2860, 280, '#242121');
  drawText(districtInput.value, 1260, 3890, 1880, 156, '#ffffff');
}

async function removePhotoBackground(file) {
  setStatus('Removing background — first use downloads the local AI model.', 'working');
  try {
    const { default: removeBackground } = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.8/+esm');
    const transparentPhoto = await removeBackground(file);
    subject = await loadImage(URL.createObjectURL(transparentPhoto));
    setStatus('Background removed. Your poster is ready to download.');
  } catch (error) {
    subject = await loadImage(URL.createObjectURL(file));
    setStatus('Background removal could not finish, so the original photo is shown.', 'error');
  }
  emptyState.classList.add('hidden');
  downloadButton.disabled = false;
  render();
}

photoInput.addEventListener('change', () => {
  const [file] = photoInput.files;
  if (file) removePhotoBackground(file);
});
[nameInput, districtInput].forEach((input) => input.addEventListener('input', render));
downloadButton.addEventListener('click', () => {
  canvas.toBlob((blob) => {
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'campaign-poster.png' });
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/png');
});

Promise.all([loadImage('/assets/template-background.webp'), loadImage('/assets/template-overlay.webp'), document.fonts.ready])
  .then(([backgroundImage, overlayImage]) => { background = backgroundImage; overlay = overlayImage; render(); })
  .catch(() => setStatus('The PSD template assets could not be loaded.', 'error'));
