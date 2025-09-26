document.addEventListener('DOMContentLoaded', () => {
  const galleryModal = document.getElementById('gallery-modal');
  const galleryImage = document.getElementById('gallery-image');
  const closeGallery = document.getElementById('close-gallery');

  // Images for One-Bedroom Apartment
  const oneBedImages = [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop"
  ];

  let currentIndex = 0;

  // Open gallery when the one-bed section is clicked
  document.getElementById('onebed').addEventListener('click', (e) => {
    // Don't open gallery if user clicks the booking button
    if (e.target.classList.contains('book-btn')) return;

    galleryImage.src = oneBedImages[currentIndex];
    galleryModal.style.display = 'flex';
  });

  // Close gallery
  closeGallery.addEventListener('click', () => {
    galleryModal.style.display = 'none';
  });

  // Navigate images with arrow keys
  document.addEventListener('keydown', (e) => {
    if (galleryModal.style.display === 'flex') {
      if (e.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % oneBedImages.length;
        galleryImage.src = oneBedImages[currentIndex];
      } else if (e.key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + oneBedImages.length) % oneBedImages.length;
        galleryImage.src = oneBedImages[currentIndex];
      } else if (e.key === 'Escape') {
        galleryModal.style.display = 'none';
      }
    }
  });
});
