// script.js
// ------------------
// Ready-to-paste JavaScript for Gonah Homes
// Requires:
//  - firebase-app-compat, firebase-firestore-compat loaded before this file
//  - flatpickr loaded before this file
// ------------------

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

// bookedDates will contain ISO date strings (e.g. "2025-10-10") for the selected house
let bookedDates = [];

// flatpickr instances (kept in outer scope so we can update/destroy them)
let checkinPicker = null;
let checkoutPicker = null;

/**
 * Convert various Firestore / string date values into a Date object.
 * Handles:
 * - Firestore Timestamp (has toDate())
 * - ISO string date
 * - Date object
 */
function parseDateField(value) {
  if (!value) return null;
  // Firestore Timestamp
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  // If it's already a Date
  if (value instanceof Date) return value;
  // Try to parse string
  const parsed = new Date(value);
  if (!isNaN(parsed)) return parsed;
  return null;
}

/**
 * Fetch booked dates (per house) from Firestore bookings collection.
 * Returns an array of ISO date strings (YYYY-MM-DD).
 */
async function getBookedDates(houseName) {
  try {
    const snapshot = await db.collection("bookings")
      .where("house", "==", houseName)
      .get();

    const setDates = new Set();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const startRaw = data.checkin;
      const endRaw = data.checkout;

      const startDate = parseDateField(startRaw);
      const endDate = parseDateField(endRaw);

      if (startDate && endDate) {
        // Normalize times to midnight
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        // NOTE: We block inclusive range from start -> end.
        // If you want to allow guests to check in on the checkout day,
        // change the loop condition to d < end instead of d <= end.
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          setDates.add(d.toISOString().split('T')[0]);
        }
      }
    });

    bookedDates = Array.from(setDates).sort();
    // expose globally for debugging if needed
    window.bookedDates = bookedDates;
    console.log(`Blocked dates for "${houseName}":`, bookedDates);
    return bookedDates;
  } catch (err) {
    console.error("Error fetching booked dates:", err);
    bookedDates = [];
    window.bookedDates = bookedDates;
    return [];
  }
}

/**
 * (Re)initialize or update Flatpickr instances with the current bookedDates array.
 * Ensures checkinPicker and checkoutPicker are available and wired.
 */
function setupDatePickers() {
  const checkinInput = document.getElementById("booking-checkin");
  const checkoutInput = document.getElementById("booking-checkout");
  if (!checkinInput || !checkoutInput) return;

  // Destroy previous instances if present
  if (checkinPicker && typeof checkinPicker.destroy === 'function') {
    checkinPicker.destroy();
    checkinPicker = null;
  }
  if (checkoutPicker && typeof checkoutPicker.destroy === 'function') {
    checkoutPicker.destroy();
    checkoutPicker = null;
  }

  // Create checkoutPicker first as an empty variable then assign to let checkin use it
  checkoutPicker = flatpickr(checkoutInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: bookedDates,
    // When checkout changes we could add logic if needed
    onChange: function(selectedDates, dateStr) {
      // nothing special needed currently
    }
  });

  checkinPicker = flatpickr(checkinInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: bookedDates,
    onChange: function (selectedDates, dateStr) {
      if (!selectedDates.length) return;
      // Ensure checkout cannot be earlier than checkin + 1 day
      const minCheckout = new Date(selectedDates[0]);
      minCheckout.setDate(minCheckout.getDate() + 1);
      const minCheckoutISO = minCheckout.toISOString().split('T')[0];
      // set the checkout min date and also update disabled dates in case bookedDates changed
      checkoutPicker.set("minDate", minCheckoutISO);
      checkoutPicker.set("disable", bookedDates);
      // If currently selected checkout is before new min, clear it
      const currentCheckout = checkoutPicker.input.value;
      if (currentCheckout) {
        const cur = new Date(currentCheckout);
        cur.setHours(0,0,0,0);
        if (cur <= selectedDates[0]) {
          checkoutPicker.clear();
        }
      }
    }
  });

  // Also ensure checkout picker uses the same disable dates (in case bookedDates changed)
  checkoutPicker.set("disable", bookedDates);
}

/**
 * Open booking modal for a particular house.
 * Fetches booked dates for that house and sets up the pickers before showing to user.
 */
async function openBookingModal(house) {
  const modal = document.getElementById('booking-modal-bg');
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');

  if (!modal || !form || !confirmDiv) return;

  // Reset form visually and values first
  form.reset();
  form.style.display = 'block';
  confirmDiv.style.display = 'none';
  document.getElementById('booking-house').value = house;

  // Fetch booked dates for this house and then setup pickers
  await getBookedDates(house);
  setupDatePickers();

  // Show modal
  modal.classList.add('active');

  // Also set plain input min attributes so native fallback works for users without flatpickr
  const todayISO = new Date().toISOString().split('T')[0];
  const checkinInput = document.getElementById('booking-checkin');
  const checkoutInput = document.getElementById('booking-checkout');
  if (checkinInput) checkinInput.min = todayISO;
  if (checkoutInput) checkoutInput.min = todayISO;

  // Replace any previous change handler by directly setting .onchange (overwrites previous)
  if (checkinInput) {
    checkinInput.onchange = function() {
      if (!this.value) return;
      const checkinDate = new Date(this.value);
      checkinDate.setDate(checkinDate.getDate() + 1);
      const minCheckout = checkinDate.toISOString().split('T')[0];
      if (checkoutInput) checkoutInput.min = minCheckout;

      // If using flatpickr, keep its state consistent (already handled by flatpickr onChange)
      if (checkoutPicker) {
        checkoutPicker.set("minDate", minCheckout);
      }

      // Clear checkout if before new minimum
      if (checkoutInput && checkoutInput.value) {
        const cur = new Date(checkoutInput.value);
        if (cur <= new Date(this.value)) {
          checkoutInput.value = '';
          if (checkoutPicker) checkoutPicker.clear();
        }
      }
    };
  }
}

/**
 * Close booking modal
 */
function closeBookingModal() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) modal.classList.remove('active');
}

/* ---------------------------
   Utility / UI / App logic (mostly unchanged)
   I kept your review, contact, admin, slideshow, and other helpers
   but cleaned duplicates and ensured global availability
   --------------------------- */

// Utility functions
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    return dateString;
  }
}

// Mobile nav
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  if (!hamburger || !navMenu) return;

  hamburger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
  });

  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
    });
  });

  document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
    }
  });
}

// Reviews rendering & loading
function renderTestimonials(reviews) {
  const testimonialsGrid = document.getElementById('testimonials-grid');
  if (!testimonialsGrid) return;

  if (!reviews || reviews.length === 0) {
    testimonialsGrid.innerHTML = `<div class="testimonial-card">No reviews yet.</div>`;
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
        <div class="testimonial-rating">${rating.split('').map(()=>' <i class="fas fa-star"></i>').join('')}</div>
        <p class="testimonial-text">"${review.review}"</p>
        <div class="testimonial-author">
          <img src="${userAvatar}" alt="${userName}" class="author-avatar">
          <div class="author-info">
            <h4>${userName}</h4>
            <span>Verified Guest ${reviewDate ? '• ' + reviewDate : ''}</span>
          </div>
        </div>
        ${review.adminReply ? `<div class="admin-reply"><strong>Management Response:</strong><br>${review.adminReply}</div>` : ''}
      </div>
    `;
  });

  testimonialsGrid.innerHTML = html;
}

function loadReviews() {
  db.collection("reviews").orderBy("timestamp", "desc").onSnapshot(snapshot => {
    const reviews = [];
    snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
    renderTestimonials(reviews);
  }, (err) => {
    console.error("Error loading reviews:", err);
    renderTestimonials([]);
  });
}

/* Forms and handlers */
function initFormHandlers() {
  // Email form for reviews
  const emailForm = document.getElementById('email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email-input').value.trim();
      if (email && email.includes('@')) {
        currentUser = { email };
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

      const submitBtn = reviewForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      submitBtn.disabled = true;

      const reviewData = {
        review: reviewText,
        rating,
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
        return db.collection("notifications").add({
          type: 'new_review',
          data: reviewData,
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }).catch((err) => {
        console.error("Error adding review:", err);
        showCustomAlert("Error submitting review. Please try again.", "error");
      }).finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // Booking form: save to Firestore
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(bookingForm);
      const bookingData = Object.fromEntries(formData.entries());

      // Simple validation
      const today = new Date(); today.setHours(0,0,0,0);
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

      // Check quickly against local bookedDates to avoid submitting overlapping bookings
      // If any date in requested stay intersects bookedDates -> block
      let conflict = false;
      for (let d = new Date(checkinDate); d <= checkoutDate; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().split('T')[0];
        if (bookedDates.includes(iso)) {
          conflict = true;
          break;
        }
      }
      if (conflict) {
        showCustomAlert("Selected dates overlap with an existing booking. Please choose different dates.", "error");
        return;
      }

      // Save booking
      const submitBtn = bookingForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      submitBtn.disabled = true;

      db.collection("bookings").add({
        ...bookingData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      }).then(() => {
        showBookingConfirmation(bookingData);
        // Create notification
        return db.collection("notifications").add({
          type: 'new_booking',
          data: bookingData,
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }).catch((err) => {
        console.error("Error saving booking:", err);
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

      const submitBtn = contactForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      submitBtn.disabled = true;

      db.collection("messages").add({
        name, email, message,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'new'
      }).then(() => {
        showCustomAlert("Thank you for your message! We will get back to you soon.", "success");
        contactForm.reset();
        return db.collection("notifications").add({
          type: 'new_message',
          data: { name, email, message },
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }).catch((err) => {
        console.error("Error sending message:", err);
        showCustomAlert("Error sending message. Please try again.", "error");
      }).finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });
  }
}

/* Booking confirmation UI */
function showBookingConfirmation(bookingData) {
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');
  const detailsDiv = document.getElementById('booking-details');

  if (!form || !confirmDiv || !detailsDiv) return;

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
    ${bookingData.access ? `<p><strong>Accessibility Needs:</strong> ${bookingData.access}</p>` : ''}
    ${bookingData.requests ? `<p><strong>Special Requests:</strong> ${bookingData.requests}</p>` : ''}
  `;
}

/* Smooth scrolling, animations, modal close, navbar */
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e){
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('fade-in');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.accommodation-card, .feature-card, .testimonial-card, .quick-link-card').forEach(el => {
    observer.observe(el);
  });
}

function initModalHandlers() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeBookingModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBookingModal();
  });
}

function initNavbarScroll() {
  const navbar = document.querySelector('.main-header');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      navbar.style.background = 'rgba(255,255,255,0.98)';
      navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    } else {
      navbar.style.background = 'rgba(255,255,255,0.95)';
      navbar.style.boxShadow = 'none';
    }
  });
}

/* Slideshow */
let slideIndex = 0;
const slides = document.querySelectorAll('.slide');
const indicators = document.querySelectorAll('.indicator');
function showSlide(index) {
  if (slides.length === 0) return;
  slides.forEach(s => s.classList.remove('active'));
  indicators.forEach(i => i.classList.remove('active'));
  const idx = index % slides.length;
  slides[idx].classList.add('active');
  indicators[idx].classList.add('active');
}
function nextSlide() { slideIndex = (slideIndex + 1) % slides.length; showSlide(slideIndex); }
function currentSlide(index) { slideIndex = index - 1; showSlide(slideIndex); }
function initSlideshow() { if (slides.length > 0) setInterval(nextSlide, 5000); }

/* Admin modal/login */
function openAdminModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) modal.style.display = 'flex';
}
function closeAdminModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.style.display = 'none';
    const form = document.getElementById('admin-login-form');
    if (form) form.reset();
    const err = document.getElementById('admin-login-error');
    if (err) err.style.display = 'none';
  }
}
function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('admin-login-error');
  const adminCredentials = { username: 'gonahhomes0@gmail.com', password: 'gonahhomes@0799466723' };
  if (username === adminCredentials.username && password === adminCredentials.password) {
    closeAdminModal();
    window.open('backend/dashboard.html', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  } else {
    if (errorDiv) { errorDiv.textContent = 'Invalid credentials. Please try again.'; errorDiv.style.display = 'block'; }
  }
}
function initAdminAccess() {
  const adminBtn = document.getElementById('admin-access-btn');
  if (adminBtn) adminBtn.addEventListener('click', openAdminModal);
  const adminForm = document.getElementById('admin-login-form');
  if (adminForm) adminForm.addEventListener('submit', handleAdminLogin);
  const adminModal = document.getElementById('admin-login-modal');
  if (adminModal) adminModal.addEventListener('click', (e) => { if (e.target === adminModal) closeAdminModal(); });
}

/* User info for review flow */
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

/* Small custom alert helper */
function showCustomAlert(message, type = "success") {
  const existing = document.querySelector('.custom-alert');
  if (existing) existing.remove();
  const alertBox = document.createElement('div');
  alertBox.className = `custom-alert ${type}`;
  const p = document.createElement('p'); p.textContent = message;
  const closeBtn = document.createElement('span'); closeBtn.className = 'alert-close-btn'; closeBtn.innerHTML = '&times;';
  alertBox.appendChild(p); alertBox.appendChild(closeBtn);
  document.body.appendChild(alertBox);
  closeBtn.addEventListener('click', () => alertBox.remove());
  setTimeout(()=> alertBox.remove(), 5000);
}

/* Initialize app on DOM ready */
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

  // Expose modal functions globally (for onclicks in HTML)
  window.openBookingModal = openBookingModal;
  window.closeBookingModal = closeBookingModal;
  window.openAdminModal = openAdminModal;
  window.closeAdminModal = closeAdminModal;
  window.scrollToSection = scrollToSection;
  window.currentSlide = currentSlide;

  console.log('Gonah Homes script initialized.');
});
