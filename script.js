// script.js (ready to paste — overwrite your existing file)

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

// === Booked dates (strings 'YYYY-MM-DD') for current house ===
let bookedDates = [];        // array of date strings
let bookedSet = new Set();   // fast lookup
let checkinPicker = null;
let checkoutPicker = null;

// Utility: inject CSS for flatpickr custom classes (only once)
(function injectStyles() {
  const id = 'flatpickr-custom-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.innerHTML = `
    /* Booked day: greyed and muted */
    .flatpickr-day.booked {
      background: #e6e6e6 !important;
      color: #8a8a8a !important;
      pointer-events: none;
      position: relative;
    }
    .flatpickr-day.booked::after {
      content: "Booked";
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 9px;
      color: #666;
      background: rgba(255,255,255,0.0);
      padding: 0 2px;
    }
    /* Available day visual (green underline) */
    .flatpickr-day.available {
      box-shadow: inset 0 -4px 0 0 rgba(34,197,94,0.25);
    }
    /* Legend styling */
    .booking-legend {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-top: 0.75rem;
      font-size: 0.9rem;
    }
    .legend-item {
      display:flex;
      align-items:center;
      gap:0.5rem;
    }
    .legend-swatch {
      width: 18px;
      height: 12px;
      border-radius: 3px;
      display:inline-block;
      border: 1px solid #ccc;
    }
    .legend-swatch.booked { background: #e6e6e6; }
    .legend-swatch.available {
      background: linear-gradient(0deg, rgba(0,0,0,0) 50%, rgba(34,197,94,0.25) 50%);
    }
  `;
  document.head.appendChild(style);
})();

// === Fetch booked dates for a given house ===
// NOTE: this will block dates from checkin .. (checkout - 1 day) — checkout remains selectable
async function getBookedDates(houseName) {
  try {
    const snapshot = await db.collection("bookings")
      .where("house", "==", houseName)
      .get();

    const dates = new Set();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.checkin && data.checkout) {
        // Parse stored strings/dates robustly
        const start = new Date(data.checkin);
        const end = new Date(data.checkout);

        // Ensure start <= end
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

        // Loop from start to day before checkout (exclusive of checkout)
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          const iso = new Date(d).toISOString().split('T')[0];
          dates.add(iso);
        }
      }
    });

    bookedDates = Array.from(dates).sort();
    bookedSet = new Set(bookedDates);
    console.log(`Blocked dates for "${houseName}":`, bookedDates);
    return bookedDates;
  } catch (err) {
    console.error("Error fetching booked dates:", err);
    bookedDates = [];
    bookedSet = new Set();
    return [];
  }
}

// === Setup (or re-setup) Flatpickr instances using the current bookedSet ===
function setupDatePickers() {
  const checkinInput = document.getElementById("booking-checkin");
  const checkoutInput = document.getElementById("booking-checkout");
  if (!checkinInput || !checkoutInput) return;

  // Destroy previous instances if present
  if (checkinPicker && checkinPicker.destroy) {
    checkinPicker.destroy();
    checkinPicker = null;
  }
  if (checkoutPicker && checkoutPicker.destroy) {
    checkoutPicker.destroy();
    checkoutPicker = null;
  }

  // Helper: disable function using bookedSet
  const disableFn = function(date) {
    const iso = date.toISOString().split('T')[0];
    return bookedSet.has(iso);
  };

  // Create check-out first? We create both and then link them
  checkinPicker = flatpickr(checkinInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [disableFn],
    onChange: function(selectedDates, dateStr, instance) {
      if (selectedDates.length) {
        const sel = selectedDates[0];
        // set checkout min to next day after selected checkin
        const minCheckout = new Date(sel);
        minCheckout.setDate(minCheckout.getDate() + 1);
        checkoutPicker.set('minDate', minCheckout);

        // If checkout currently disabled due to being <= new min, clear it
        const currentCheckout = checkoutPicker.input.value;
        if (currentCheckout) {
          const curDate = new Date(currentCheckout);
          if (curDate <= sel) {
            checkoutPicker.clear();
          }
        }
      }
    },
    onDayCreate: function(dObj, dStr, fpDayElem) {
      // dObj is Date, fpDayElem is the DOM node for the day
      const iso = fpDayElem.dateObj.toISOString().split('T')[0];
      if (bookedSet.has(iso)) {
        fpDayElem.classList.add('booked');
        // pointer-events prevented by CSS; keep label via CSS ::after
      } else {
        fpDayElem.classList.add('available');
      }
    }
  });

  checkoutPicker = flatpickr(checkoutInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [disableFn],
    onDayCreate: function(dObj, dStr, fpDayElem) {
      const iso = fpDayElem.dateObj.toISOString().split('T')[0];
      if (bookedSet.has(iso)) {
        fpDayElem.classList.add('booked');
      } else {
        fpDayElem.classList.add('available');
      }
    }
  });
}

// === Ensure Preferred Check-in Time field + legend exist in booking modal ===
function ensurePreferredTimeAndLegend() {
  const form = document.getElementById('booking-form');
  if (!form) return;

  // Preferred time: If input not present, add a select after booking-email field
  if (!document.getElementById('preferred-checkin-time')) {
    // create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    wrapper.innerHTML = `
      <label for="preferred-checkin-time"><i class="fas fa-clock"></i> Preferred Check-in Time (optional)</label>
    `;
    // create select element with common time options
    const select = document.createElement('select');
    select.id = 'preferred-checkin-time';
    select.name = 'preferred_checkin_time';
    select.innerHTML = `
      <option value="">No preference</option>
      <option value="08:00">08:00 AM</option>
      <option value="09:00">09:00 AM</option>
      <option value="10:00">10:00 AM</option>
      <option value="11:00">11:00 AM</option>
      <option value="12:00">12:00 PM</option>
      <option value="14:00">02:00 PM</option>
      <option value="16:00">04:00 PM</option>
      <option value="18:00">06:00 PM</option>
    `;
    wrapper.appendChild(select);

    // insert the wrapper before the checkin row (so it appears above dates) if possible
    const checkinRow = document.getElementById('booking-checkin')?.closest('.form-row') || document.getElementById('booking-checkin');
    if (checkinRow && checkinRow.parentNode) {
      checkinRow.parentNode.insertBefore(wrapper, checkinRow);
    } else {
      form.appendChild(wrapper);
    }
  }

  // Add legend under modal body (only once)
  const modalBody = document.querySelector('#booking-modal-bg .modal-body');
  if (!modalBody) return;
  if (!modalBody.querySelector('.booking-legend')) {
    const legend = document.createElement('div');
    legend.className = 'booking-legend';
    legend.innerHTML = `
      <div class="legend-item"><span class="legend-swatch booked"></span> <span>Booked</span></div>
      <div class="legend-item"><span class="legend-swatch available"></span> <span>Available</span></div>
    `;
    // place legend near the top of modal body
    modalBody.insertBefore(legend, modalBody.firstChild.nextSibling);
  }
}

// === Booking Modal Functions ===
async function openBookingModal(house) {
  // Make sure this function can await
  try {
    const modal = document.getElementById('booking-modal-bg');
    const form = document.getElementById('booking-form');
    const confirmDiv = document.getElementById('booking-confirm');

    if (!(modal && form && confirmDiv)) return;

    modal.classList.add('active');
    document.getElementById('booking-house').value = house;
    form.style.display = 'block';
    confirmDiv.style.display = 'none';
    form.reset();

    // Ensure preferred time field + legend exists
    ensurePreferredTimeAndLegend();

    // Fetch blocked dates for this house, then setup pickers
    await getBookedDates(house);
    setupDatePickers();

    // Set minimum dates to today (HTML inputs fallback)
    const todayISO = new Date().toISOString().split('T')[0];
    const checkinInput = document.getElementById('booking-checkin');
    const checkoutInput = document.getElementById('booking-checkout');
    if (checkinInput) checkinInput.min = todayISO;
    if (checkoutInput) checkoutInput.min = todayISO;

    // Remove any existing change listeners to avoid duplicates:
    // We'll re-add a single change listener on the native input to also update flatpickr in case native changes happen
    const newListener = function () {
      const checkinVal = this.value;
      if (!checkinVal) return;
      const checkinDate = new Date(checkinVal);
      checkinDate.setDate(checkinDate.getDate() + 1);
      if (checkoutInput) {
        // set both native min and flatpickr min if exists
        checkoutInput.min = checkinDate.toISOString().split('T')[0];
        if (checkoutPicker) checkoutPicker.set('minDate', checkinDate);
      }
      // Clear checkout if before new min
      if (checkoutInput && checkoutInput.value) {
        const cur = new Date(checkoutInput.value);
        if (cur <= new Date(checkinVal)) {
          if (checkoutPicker) checkoutPicker.clear();
          else checkoutInput.value = '';
        }
      }
    };

    // Remove previously attached listener (best-effort)
    checkinInput.replaceWith(checkinInput.cloneNode(true));
    // Re-select the replaced node
    const newCheckinInput = document.getElementById('booking-checkin');
    if (newCheckinInput) newCheckinInput.addEventListener('change', newListener);

  } catch (err) {
    console.error("openBookingModal error:", err);
  }
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) {
    modal.classList.remove('active');
  }
}

// === Form Handlers & other UI code ===
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

function formatDate(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Mobile nav (unchanged logic)
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      navMenu.classList.toggle('active'); hamburger.classList.toggle('active');
    });
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active'); hamburger.classList.remove('active');
      });
    });
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        navMenu.classList.remove('active'); hamburger.classList.remove('active');
      }
    });
  }
}

// Render testimonials & load reviews (unchanged logic)
function renderTestimonials(reviews) {
  const testimonialsGrid = document.getElementById('testimonials-grid');
  if (!testimonialsGrid) return;
  if (!reviews || reviews.length === 0) {
    testimonialsGrid.innerHTML = `...`; // keep original placeholder or load your previous default HTML
    return;
  }
  let html = '';
  reviews.slice(0,6).forEach(review => {
    const rating = '★'.repeat(Number(review.rating || 5));
    const reviewDate = review.timestamp ? new Date(review.timestamp.toDate()).toLocaleDateString() : '';
    const userName = review.user?.name || review.user?.email?.split('@')[0] || 'Anonymous';
    const userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&size=100&background=800000&color=fff`;
    html += `
      <div class="testimonial-card">
        <div class="testimonial-rating">${rating.split('').map(()=>'<i class="fas fa-star"></i>').join('')}</div>
        <p class="testimonial-text">"${review.review}"</p>
        <div class="testimonial-author">
          <img src="${userAvatar}" alt="${userName}" class="author-avatar">
          <div class="author-info"><h4>${userName}</h4><span>Verified Guest ${reviewDate ? '• ' + reviewDate : ''}</span></div>
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
  }, err => {
    console.error('Error loading reviews', err);
    renderTestimonials([]);
  });
}

// initFormHandlers includes booking submit with preferred_checkin_time saved
function initFormHandlers() {
  // Email form for reviews
  const emailForm = document.getElementById('email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email-input').value.trim();
      if (email && email.includes('@')) {
        currentUser = { email }; showUserInfo(email);
      } else {
        showCustomAlert("Please enter a valid email address", "error");
      }
    });
  }

  // Sign out button
  const signOutBtn = document.getElementById('signout-btn');
  if (signOutBtn) signOutBtn.addEventListener('click', () => {
    currentUser = null; hideUserInfo(); document.getElementById('email-input').value = '';
  });

  // Review form
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentUser) { alert("Please enter your email to leave a review."); return; }
      const rating = document.querySelector('input[name="rating"]:checked')?.value || 0;
      const reviewText = document.getElementById('review-text').value.trim();
      if (!reviewText) { alert("Please write a review!"); return; }
      if (!rating) { alert("Please select a rating!"); return; }

      const submitBtn = reviewForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; submitBtn.disabled = true;

      const reviewData = {
        review: reviewText,
        rating,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        user: { name: currentUser.email.split('@')[0], email: currentUser.email },
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
      }).catch(err => {
        console.error("Error adding review", err); showCustomAlert("Error submitting review. Please try again.", "error");
      }).finally(() => { submitBtn.innerHTML = originalText; submitBtn.disabled = false; });
    });
  }

  // Booking form
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(bookingForm);
      const bookingData = Object.fromEntries(formData.entries());

      // grab preferred checkin time if present
      const pref = document.getElementById('preferred-checkin-time');
      if (pref) bookingData.preferred_checkin_time = pref.value || null;

      // Validation
      const today = new Date(); today.setHours(0,0,0,0);
      const checkinDate = new Date(bookingData.checkin);
      const checkoutDate = new Date(bookingData.checkout);

      if (!bookingData.name || !bookingData.guests || !bookingData.checkin || !bookingData.checkout || !bookingData.phone || !bookingData.email) {
        showCustomAlert("Please fill all required booking fields.", "error"); return;
      }
      if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
        showCustomAlert("Invalid dates provided.", "error"); return;
      }
      if (checkinDate < today) { showCustomAlert("Check-in date cannot be in the past.", "error"); return; }
      if (checkoutDate <= checkinDate) { showCustomAlert("Check-out date must be after check-in date.", "error"); return; }

      // Ensure no overlap with booked dates (we already disabled them in UI, but validate server-side too)
      // We'll check every day from checkin up to (but not including) checkout
      for (let d = new Date(checkinDate); d < checkoutDate; d.setDate(d.getDate() + 1)) {
        const iso = new Date(d).toISOString().split('T')[0];
        if (bookedSet.has(iso)) {
          showCustomAlert("Selected dates overlap with an existing booking. Please choose different dates.", "error");
          return;
        }
      }

      // Ensure at least one night stay
      const timeDiff = checkoutDate.getTime() - checkinDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      if (daysDiff < 1) { showCustomAlert("Minimum stay is one night.", "error"); return; }

      // Save booking
      const submitBtn = bookingForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; submitBtn.disabled = true;

      try {
        await db.collection("bookings").add({
          ...bookingData,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'pending'
        });

        showBookingConfirmation(bookingData);

        // notify admin
        await db.collection("notifications").add({
          type: 'new_booking',
          data: bookingData,
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // After booking, update bookedSet locally so new guests can't book immediately in same session
        for (let d = new Date(checkinDate); d < checkoutDate; d.setDate(d.getDate() + 1)) {
          bookedSet.add(new Date(d).toISOString().split('T')[0]);
        }
        // re-setup pickers to reflect new local block
        setupDatePickers();

      } catch (err) {
        console.error("Error saving booking:", err);
        showCustomAlert("Error processing booking. Please try again.", "error");
      } finally {
        submitBtn.innerHTML = originalText; submitBtn.disabled = false;
      }
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
      if (!name || !email || !message) { alert("Please fill all required fields."); return; }

      const submitBtn = contactForm.querySelector('[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; submitBtn.disabled = true;

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
      }).catch(err => {
        console.error("Error sending message:", err); showCustomAlert("Error sending message. Please try again.", "error");
      }).finally(() => { submitBtn.innerHTML = originalText; submitBtn.disabled = false; });
    });
  }
}

// Booking confirmation UI
function showBookingConfirmation(bookingData) {
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');
  const detailsDiv = document.getElementById('booking-details');
  if (form && confirmDiv && detailsDiv) {
    form.style.display = 'none'; confirmDiv.style.display = 'block';
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

// Small UI helpers
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
    userInfo.style.display = 'none'; emailForm.style.display = 'block'; reviewForm.style.display = 'none';
  }
}

// Smooth scrolling, animations, modal handlers, navbar scroll, slideshow, admin — keep as before
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initAnimations() {
  const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('fade-in'); });
  }, observerOptions);
  document.querySelectorAll('.accommodation-card, .feature-card, .testimonial-card, .quick-link-card').forEach(el => observer.observe(el));
}

function initModalHandlers() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeBookingModal(); });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBookingModal(); });
}

function initNavbarScroll() {
  const navbar = document.querySelector('.main-header');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      navbar.style.background = 'rgba(255,255,255,0.98)'; navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    } else {
      navbar.style.background = 'rgba(255,255,255,0.95)'; navbar.style.boxShadow = 'none';
    }
  });
}

let slideIndex = 0;
const slides = document.querySelectorAll('.slide');
const indicators = document.querySelectorAll('.indicator');
function showSlide(index) {
  if (!slides.length) return;
  slides.forEach(s => s.classList.remove('active'));
  indicators.forEach(i => i.classList.remove('active'));
  slides[index].classList.add('active'); indicators[index].classList.add('active');
}
function nextSlide() { slideIndex = (slideIndex + 1) % slides.length; showSlide(slideIndex); }
function currentSlide(index) { slideIndex = index - 1; showSlide(slideIndex); }
function initSlideshow() { if (slides.length) setInterval(nextSlide, 5000); }

function openAdminModal() {
  const modal = document.getElementById('admin-login-modal'); if (modal) modal.style.display = 'flex';
}
function closeAdminModal() {
  const modal = document.getElementById('admin-login-modal'); if (modal) {
    modal.style.display = 'none'; document.getElementById('admin-login-form').reset(); document.getElementById('admin-login-error').style.display = 'none';
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
    errorDiv.textContent = 'Invalid credentials. Please try again.'; errorDiv.style.display = 'block';
  }
}

function initAdminAccess() {
  const adminBtn = document.getElementById('admin-access-btn'); if (adminBtn) adminBtn.addEventListener('click', openAdminModal);
  const adminForm = document.getElementById('admin-login-form'); if (adminForm) adminForm.addEventListener('submit', handleAdminLogin);
  const adminModal = document.getElementById('admin-login-modal'); if (adminModal) adminModal.addEventListener('click', (e)=> { if (e.target === adminModal) closeAdminModal(); });
}

// Custom alerts (same style)
function showCustomAlert(message, type = "success") {
  const existingAlert = document.querySelector('.custom-alert'); if (existingAlert) existingAlert.remove();
  const alertBox = document.createElement('div'); alertBox.classList.add('custom-alert'); alertBox.classList.add(type);
  const messageBox = document.createElement('p'); messageBox.textContent = message;
  const closeBtn = document.createElement('span'); closeBtn.classList.add('alert-close-btn'); closeBtn.innerHTML = '&times;';
  alertBox.appendChild(messageBox); alertBox.appendChild(closeBtn); document.body.appendChild(alertBox);
  closeBtn.addEventListener('click', () => alertBox.remove());
  setTimeout(() => alertBox.remove(), 5000);
}

// Initialization on DOMContentLoaded
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
  console.log('Script initialized (booked-dates + flatpickr ready).');
});

// Expose functions globally so your HTML buttons can call them
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.scrollToSection = scrollToSection;
window.currentSlide = currentSlide;
