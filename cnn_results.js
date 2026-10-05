const cnnImageInput = document.getElementById('cnnImageInput');
const cnnPreview = document.getElementById('cnnPreview');
const cnnImageState = document.getElementById('cnnImageState');
const cnnImageMessage = document.getElementById('cnnImageMessage');
const cnnRestoreSample = document.getElementById('cnnRestoreSample');
const cnnPredictionDetails = document.getElementById('cnnPredictionDetails');
const cnnUnclassifiedNotice = document.getElementById('cnnUnclassifiedNotice');

const sampleImagePath = 'starch-sample.svg';
let uploadedImageUrl = null;

function restoreCnnSample() {
  if (uploadedImageUrl) {
    URL.revokeObjectURL(uploadedImageUrl);
    uploadedImageUrl = null;
  }

  cnnPreview.src = sampleImagePath;
  cnnPreview.alt = 'Microscope image of a starch sample with dark and pale circular regions';
  cnnImageState.textContent = 'Sample';
  cnnImageMessage.textContent = 'Showing the sample image from the supplied CNN run.';
  cnnPredictionDetails.hidden = false;
  cnnUnclassifiedNotice.hidden = true;
  cnnImageInput.value = '';
}

cnnImageInput.addEventListener('change', () => {
  const file = cnnImageInput.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    cnnImageMessage.textContent = 'Choose a supported image file to preview.';
    cnnImageInput.value = '';
    return;
  }

  if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
  uploadedImageUrl = URL.createObjectURL(file);
  cnnPreview.src = uploadedImageUrl;
  cnnPreview.alt = `Selected image: ${file.name}`;
  cnnImageState.textContent = 'New image';
  cnnImageMessage.textContent = `${file.name} is ready to view. CNN inference is not connected.`;
  cnnPredictionDetails.hidden = true;
  cnnUnclassifiedNotice.hidden = false;
});

cnnRestoreSample.addEventListener('click', restoreCnnSample);