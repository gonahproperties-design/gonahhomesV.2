// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyABTVp797tNu353FBVLzsOp90aIX2mNF74",
  authDomain: "my-website-project2797.firebaseapp.com",
  projectId: "my-website-project2797",
  storageBucket: "my-website-project2797.appspot.com",
  messagingSenderId: "406226552922",
  appId: "1:406226552922:web:ffdf2ccf6f77a57964b063"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
let currentUser = null;
const adminEmail = "gonahhomes0@gmail.com";

// Utility Functions
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Mobile Navigation
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navMenu.classList.toggle('active');
      hamburger.classList.toggle('active');
    });

    // Close menu when clicking on links
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
      }
    });
  }
}

// Booking Modal Functions
function openBookingModal(house) {
  const modal = document.getElementById('booking-modal-bg');
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');

  if (modal && form && confirmDiv) {
    modal.classList.add('active');
    document.getElementById('booking-house').value = house;
    form.style.display = 'block';
    confirmDiv.style.display = 'none';
    form.reset();

    // Set minimum dates to today
    const today = new Date().toISOString().split('T')[0];
    const checkinInput = document.getElementById('booking-checkin');
    const checkoutInput = document.getElementById('booking-checkout');

    checkinInput.min = today;
    checkoutInput.min = today;

    // Update checkout min date when checkin changes
    checkinInput.addEventListener('change', function() {
      const checkinDate = new Date(this.value);
      checkinDate.setDate(checkinDate.getDate() + 1); // Next day minimum
      checkoutInput.min = checkinDate.toISOString().split('T')[0];

      // Clear checkout if it's before the new minimum
      if (checkoutInput.value && new Date(checkoutInput.value) <= new Date(this.value)) {
        checkoutInput.value = '';
      }
    });
  }
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Review System Functions
function showUserInfo(email) {
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const emailForm = document.getElementById('email-form');
  const reviewForm = document.getElementById('review-form');

  if (userInfo && userName && userEmail && emailForm && reviewForm) {
    userInfo.style.display = 'block';
    userName.textContent = email.split('@')[0];
    userEmail.textContent = email;
    reviewForm.style.display = 'block';
    emailForm.style.display = 'none';
  }
}

function hideUserInfo() {
  const userInfo = document.getElementById('user-info');
  const emailForm = document.getElementById('email-form');
  const reviewForm = document.getElementById('review-form');

  if (userInfo && emailForm && reviewForm) {
    userInfo.style.display = 'none';
    emailForm.style.display = 'block';
    reviewForm.style.display = 'none';
  }
}

function renderTestimonials(reviews) {
  const testimonialsGrid = document.getElementById('testimonials-grid');
  if (!testimonialsGrid) return;

  if (!reviews || reviews.length === 0) {
    testimonialsGrid.innerHTML = `
      <div class="testimonial-card">
        <div class="testimonial-rating">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
        <p class="testimonial-text">"Amazing experience! The apartment was spotless, beautifully furnished, and the location was perfect. Will definitely book again!"</p>
        <div class="testimonial-author">
          <img src="https://images.unsplash.com/photo-1494790108755-2616b612b577?w=100&h=100&fit=crop&crop=face" alt="Sarah Johnson" class="author-avatar">
          <div class="author-info">
            <h4>Sarah Johnson</h4>
            <span>Verified Guest</span>
          </div>
        </div>
      </div>
      <div class="testimonial-card">
        <div class="testimonial-rating">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
        <p class="testimonial-text">"Gonah Homes exceeded our expectations. The maisonette was luxurious and the customer service was outstanding. Highly recommended!"</p>
        <div class="testimonial-author">
          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" alt="Michael Chen" class="author-avatar">
          <div class="author-info">
            <h4>Michael Chen</h4>
            <span>Verified Guest</span>
          </div>
        </div>
      </div>
      <div class="testimonial-card">
        <div class="testimonial-rating">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
        <p class="testimonial-text">"Perfect for our family vacation. The kids loved the space and we appreciated the modern amenities. Thank you Gonah Homes!"</p>
        <div class="testimonial-author">
          <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face" alt="Emily Rodriguez" class="author-avatar">
          <div class="author-info">
            <h4>Emily Rodriguez</h4>
            <span>Verified Guest</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  let html = '';
  reviews.slice(0, 6).forEach(review => {
    const rating = '★'.repeat(Number(review.rating || 5));
    const reviewDate = review.timestamp ? new Date(review.timestamp.toDate()).toLocaleDateString() : '';
    const userName = review.user?.name || review.user?.email?.split('@')[0] || 'Anonymous';
    const userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&size=100&background=800000&color=fff`;

    html += `
      <div class="testimonial-card">
        <div class="testimonial-rating">
          ${rating.split('').map(() => '<i class="fas fa-star"></i>').join('')}
        </div>
        <p class="testimonial-text">"${review.review}"</p>
        <div class="testimonial-author">
          <img src="${userAvatar}" alt="${userName}" class="author-avatar">
          <div class="author-info">
            <h4>${userName}</h4>
            <span>Verified Guest ${reviewDate ? '• ' + reviewDate : ''}</span>
          </div>
        </div>
        ${review.adminReply ? `
          <div class="admin-reply" style="margin-top: 1rem; padding: 1rem; background: var(--bg-light); border-radius: var(--border-radius); border-left: 4px solid var(--primary-color);">
            <strong>Management Response:</strong><br>
            ${review.adminReply}
          </div>
        ` : ''}
      </div>
    `;
  });

  testimonialsGrid.innerHTML = html;
}

function loadReviews() {
  db.collection("reviews").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    const reviews = [];
    snapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    renderTestimonials(reviews);
  }, (error) => {
    console.error("Error loading reviews: ", error);
    renderTestimonials([]);
  });
}

// Form Handlers
function initFormHandlers() {
  // Email form for reviews
  const emailForm = document.getElementById('email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email-input').value.trim();
      if (email && email.includes('@')) {
        currentUser = { email: email };
        showUserInfo(email);
      } else {
        showCustomAlert("Please enter a valid email address", "error");
      }
    });
  }

  // Sign out button
  const signOutBtn = document.getElementById('signout-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      currentUser = null;
      hideUserInfo();
      document.getElementById('email-input').value = '';
    });
  }

  // Review form
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentUser) {
        alert("Please enter your email to leave a review.");
        return;
      }

      const rating = document.querySelector('input[name="rating"]:checked')?.value || 0;
      const reviewText = document.getElementById('review-text').value.trim();

      if (!reviewText) {
        alert("Please write a review!");
        return;
      }

      if (!rating) {
        alert("Please select a rating!");
        return;
      }

      // Show loading state
      const submitBtn = reviewForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      submitBtn.disabled = true;

      const reviewData = {
        review: reviewText,
        rating: rating,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        user: {
          name: currentUser.email.split('@')[0],
          email: currentUser.email
        },
        adminReply: null
      };

      db.collection("reviews").add(reviewData).then(() => {
        document.getElementById('review-text').value = '';
        document.querySelectorAll('input[name="rating"]').forEach(input => input.checked = false);
        showCustomAlert("Thank you for your review! It has been submitted successfully.");

        // Send notification to admin
        emailjs.send("service_ky2kj3t", "template_24gjzd3", {
          to_email: adminEmail,
          to_name: "Admin",
          from_name: reviewData.user.name,
          from_email: reviewData.user.email,
          message: `New ${reviewData.rating}-star review: ${reviewData.review}`,
          reply_to: reviewData.user.email
        }).then(function(response) {
          console.log('Admin notification sent:', response.status);
        }, function(error) {
          console.error('Admin notification failed:', error);
        });
      }).catch((error) => {
        console.error("Error adding review: ", error);
        showCustomAlert("Error submitting review. Please try again.", "error");
      }).finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // Booking form
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(bookingForm);
      const bookingData = Object.fromEntries(formData.entries());

      // Validation
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkinDate = new Date(bookingData.checkin);
      const checkoutDate = new Date(bookingData.checkout);

      if (!bookingData.name || !bookingData.guests || !bookingData.checkin ||
          !bookingData.checkout || !bookingData.phone || !bookingData.email) {
        showCustomAlert("Please fill all required booking fields.", "error");
        return;
      }

      if (checkinDate < today) {
        showCustomAlert("Check-in date cannot be in the past.", "error");
        return;
      }

      if (checkoutDate <= checkinDate) {
        showCustomAlert("Check-out date must be after check-in date.", "error");
        return;
      }

      // Ensure at least one night stay
      const timeDiff = checkoutDate.getTime() - checkinDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      if (daysDiff < 1) {
        showCustomAlert("Minimum stay is one night.", "error");
        return;
      }

      // Show loading state
      const submitBtn = bookingForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      submitBtn.disabled = true;

      // Save booking to database
      db.collection("bookings").add({
        ...bookingData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      }).then(() => {
        showBookingConfirmation(bookingData);

        // Send notification to admin
        emailjs.send("service_ky2kj3t", "template_24gjzd3", {
          to_email: adminEmail,
          to_name: "Admin",
          from_name: bookingData.name,
          from_email: bookingData.email,
          message: `New booking: ${bookingData.house} for ${bookingData.guests} guests from ${formatDate(bookingData.checkin)} to ${formatDate(bookingData.checkout)}. Contact: ${bookingData.phone}. Preferred check-in time: ${bookingData.preferred_checkin_time || 'Not specified'}`,
          reply_to: bookingData.email
        }).then(function(response) {
          console.log('Admin notification sent:', response.status);
        }, function(error) {
          console.error('Admin notification failed:', error);
        });

        // Send confirmation to guest
        emailjs.send("service_ky2kj3t", "template_6duvs5n", {
          to_email: bookingData.email,
          to_name: bookingData.name,
          from_name: "Gonah Homes",
          message: `Thank you for your booking! We have received your request for ${bookingData.house} from ${formatDate(bookingData.checkin)} to ${formatDate(bookingData.checkout)}. We will contact you shortly to confirm your reservation. Please complete payment to M-Pesa: 0799466723 to secure your booking.`,
          reply_to: "gonahhomes0@gmail.com"
        }).then(function(response) {
          console.log('Guest confirmation sent:', response.status);
        }, function(error) {
          console.error('Guest confirmation failed:', error);
        });
      }).catch((error) => {
        console.error("Error saving booking: ", error);
        showCustomAlert("Error processing booking. Please try again.", "error");
      }).finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const message = document.getElementById('contact-message').value.trim();

      if (!name || !email || !message) {
        alert("Please fill all required fields.");
        return;
      }

      // Show loading state
      const submitBtn = contactForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      submitBtn.disabled = true;

      // Save message to database
      db.collection("messages").add({
        name: name,
        email: email,
        message: message,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'new'
      }).then(() => {
        showCustomAlert("Thank you for your message! We will get back to you soon.");
        contactForm.reset();

        // Send notification to admin
        emailjs.send("service_ky2kj3t", "template_24gjzd3", {
          to_email: adminEmail,
          to_name: "Admin",
          from_name: name,
          from_email: email,
          message: message,
          reply_to: email
        }).then(function(response) {
          console.log('Admin notification sent:', response.status);
        }, function(error) {
          console.error('Admin notification failed:', error);
        });
      }).catch((error) => {
        console.error("Error sending message: ", error);
        showCustomAlert("Error sending message. Please try again.", "error");
      }).finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });
  }
}

function showBookingConfirmation(bookingData) {
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');
  const detailsDiv = document.getElementById('booking-details');

  if (form && confirmDiv && detailsDiv) {
    form.style.display = 'none';
    confirmDiv.style.display = 'block';

    detailsDiv.innerHTML = `
      <p><strong>Accommodation:</strong> ${bookingData.house}</p>
      <p><strong>Guest Name:</strong> ${bookingData.name}</p>
      <p><strong>Email:</strong> ${bookingData.email}</p>
      <p><strong>Phone:</strong> ${bookingData.phone}</p>
      <p><strong>Number of Guests:</strong> ${bookingData.guests}</p>
      <p><strong>Check-in:</strong> ${formatDate(bookingData.checkin)}</p>
      <p><strong>Check-out:</strong> ${formatDate(bookingData.checkout)}</p>
      ${bookingData.preferred_checkin_time ? `<p><strong>Preferred Check-in Time:</strong> ${bookingData.preferred_checkin_time}</p>` : ''}
      ${bookingData.access ? `<p><strong>Accessibility Needs:</strong> ${bookingData.access}</p>` : ''}
      ${bookingData.requests ? `<p><strong>Special Requests:</strong> ${bookingData.requests}</p>` : ''}
    `;
  }
}

// Smooth Scrolling for Navigation
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Intersection Observer for Animations
function initAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
      }
    });
  }, observerOptions);

  // Observe elements for animation
  document.querySelectorAll('.accommodation-card, .feature-card, .testimonial-card, .quick-link-card').forEach(el => {
    observer.observe(el);
  });
}

// Close modal when clicking outside
function initModalHandlers() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeBookingModal();
      }
    });
  }

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBookingModal();
    }
  });
}

// Navbar scroll effect
function initNavbarScroll() {
  const navbar = document.querySelector('.main-header');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
      } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
      }
    });
  }
}

// Slideshow functionality
let slideIndex = 0;
const slides = document.querySelectorAll('.slide');
const indicators = document.querySelectorAll('.indicator');

function showSlide(index) {
  slides.forEach(slide => slide.classList.remove('active'));
  indicators.forEach(indicator => indicator.classList.remove('active'));

  slides[index].classList.add('active');
  indicators[index].classList.add('active');
}

function nextSlide() {
  slideIndex = (slideIndex + 1) % slides.length;
  showSlide(slideIndex);
}

function currentSlide(index) {
  slideIndex = index - 1;
  showSlide(slideIndex);
}

function initSlideshow() {
  if (slides.length > 0) {
    // Auto-advance slides every 5 seconds
    setInterval(nextSlide, 5000);
  }
}

// Admin Access Functions
function openAdminModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeAdminModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('admin-login-form').reset();
    document.getElementById('admin-login-error').style.display = 'none';
  }
}

function handleAdminLogin(e) {
  e.preventDefault();

  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('admin-login-error');

  const adminCredentials = {
    username: 'gonahhomes0@gmail.com',
    password: 'gonahhomes@0799466723'
  };

  if (username === adminCredentials.username && password === adminCredentials.password) {
    closeAdminModal();
    // Open the admin panel in the same window
    window.location.href = 'admin.html';
  } else {
    errorDiv.textContent = 'Invalid credentials. Please try again.';
    errorDiv.style.display = 'block';
  }
}

// Make functions globally available
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.scrollToSection = scrollToSection;
window.currentSlide = currentSlide;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initFormHandlers();
  initSmoothScrolling();
  initAnimations();
  initModalHandlers();
  initNavbarScroll();
  loadReviews();
  hideUserInfo();
  initSlideshow();
  initAdminAccess();

  // Initialize EmailJS with your public key
  emailjs.init("VgDakmh3WscKrr_wQ");

  console.log('Gonah Homes website initialized successfully!');
});

function initAdminAccess() {
  // Add event listener for admin access button
  const adminBtn = document.getElementById('admin-access-btn');
  if (adminBtn) {
    adminBtn.addEventListener('click', openAdminModal);
  }

  // Add event listener for admin login form
  const adminForm = document.getElementById('admin-login-form');
  if (adminForm) {
    adminForm.addEventListener('submit', handleAdminLogin);
  }

  // Close modal when clicking outside
  const adminModal = document.getElementById('admin-login-modal');
  if (adminModal) {
    adminModal.addEventListener('click', (e) => {
      if (e.target === adminModal) {
        closeAdminModal();
      }
    });
  }
}

// Custom Alert Function
function showCustomAlert(message, type = "success") {
  // Remove any existing alert
  const existingAlert = document.querySelector('.custom-alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  const alertBox = document.createElement('div');
  alertBox.classList.add('custom-alert');
  alertBox.classList.add(type); // 'success', 'error', etc.

  // Determine background color based on type
  let backgroundColor = '';
  if (type === 'success') {
    backgroundColor = '#d4edda'; // Green background for success
    alertBox.style.borderColor = '#28a745';
  } else if (type === 'error') {
    backgroundColor = '#f8d7da'; // Red background for error
    alertBox.style.borderColor = '#dc3545';
  } else if (type === 'info') {
    backgroundColor = '#d1ecf1'; // Blue background for info
    alertBox.style.borderColor = '#17a2b8';
  } else {
    // Default or custom background for other types, including the maroon requested for reviews/messages
    backgroundColor = 'maroon'; // Maroon background
    alertBox.style.color = 'white'; // White text for maroon background
  }

  alertBox.style.backgroundColor = backgroundColor;

  const messageBox = document.createElement('p');
  messageBox.textContent = message;

  const closeBtn = document.createElement('span');
  closeBtn.classList.add('alert-close-btn');
  closeBtn.innerHTML = '&times;'; // Times symbol for close button

  alertBox.appendChild(messageBox);
  alertBox.appendChild(closeBtn);

  // Add to the body
  document.body.appendChild(alertBox);

  // Close the alert when the close button is clicked
  closeBtn.addEventListener('click', () => {
    alertBox.remove();
  });

  // Automatically close the alert after a few seconds (e.g., 5 seconds)
  setTimeout(() => {
    alertBox.remove();
  }, 5000);
}



// Function to add offers to the slideshow
function addOffersToSlideshow() {
  // Assuming 'offers' is a collection in Firestore containing offer details
  db.collection("offers").get().then((querySnapshot) => {
    const slidesContainer = document.getElementById('slideshow-container'); // Assuming this exists in your HTML
    if (!slidesContainer) {
      console.error("Slideshow container not found.");
      return;
    }

    querySnapshot.forEach((doc) => {
      const offer = doc.data();
      if (offer.imageUrl && offer.title) {
        const slideDiv = document.createElement('div');
        slideDiv.classList.add('slide');
        slideDiv.innerHTML = `
          <img src="${offer.imageUrl}" alt="${offer.title}">
          <div class="slide-content">
            <h2>${offer.title}</h2>
            ${offer.description ? `<p>${offer.description}</p>` : ''}
            ${offer.link ? `<a href="${offer.link}" class="btn btn-primary">Learn More</a>` : ''}
          </div>
        `;
        slidesContainer.appendChild(slideDiv);
      }
    });

    // Re-initialize slideshow with new slides if any were added
    // Ensure this logic correctly handles the initial slides and added offers
    // For simplicity, this might need a more robust way to manage initial vs dynamic slides
    if (slidesContainer.children.length > 0) {
      // If you have initial slides, make sure this doesn't break them.
      // You might need to adjust `initSlideshow` or how `slides` and `indicators` are selected.
      // For now, let's assume the initial setup handles the first few slides and this adds more.
      // A better approach would be to dynamically create indicators too if needed.
      console.log("Offers loaded into slideshow.");
      // If the slideshow was already initialized, it might not pick up these new slides automatically.
      // Re-initialization or a more dynamic slide management would be needed.
      // For this example, we'll just log that they've been added.
    }
  }).catch((error) => {
    console.error("Error fetching offers:", error);
  });
}

// Call this function after DOMContentLoaded or when you want to load offers
// Example: Add it to the DOMContentLoaded listener if offers should load on page load.
// document.addEventListener('DOMContentLoaded', () => { ... initSlideshow(); addOffersToSlideshow(); ... });
// For now, it's defined but not called automatically to avoid conflicts with existing slideshow setup.

// Ensure the admin access button links to the backend correctly
function updateAdminLink() {
  const adminLink = document.getElementById('admin-link'); // Assuming an element with id 'admin-link' exists in your footer
  if (adminLink) {
    // Create a link that might look like a lock icon, or just the text with a lock icon
    adminLink.innerHTML = '<i class="fas fa-lock"></i> Admin Access';
    // The actual navigation is handled by the admin login modal and its handling
    adminLink.onclick = openAdminModal; // Make it trigger the modal
    adminLink.style.cursor = 'pointer'; // Indicate it's clickable
  }
}

// Call this function on DOMContentLoaded to update the link
// document.addEventListener('DOMContentLoaded', () => { ... updateAdminLink(); ... });
