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

// === 🔹 BOOKED DATES HANDLING (PER HOUSE) ===
let bookedDates = []; // array of 'YYYY-MM-DD' strings (for current modal/house)
let checkinPicker = null;
let checkoutPicker = null;

// --- helper: get all dates between two ISO dates (inclusive) ---
function getDatesInRangeInclusive(startISO, endISO) {
  const arr = [];
  const cur = new Date(startISO);
  const end = new Date(endISO);
  while (cur <= end) {
    arr.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return arr;
}

// Fetch booked dates for the selected house (from bookings collection)
// Returns array of 'YYYY-MM-DD' strings
async function getBookedDatesForHouse(houseName) {
  if (!houseName) return [];

  try {
    const snapshot = await db.collection("bookings")
      .where("house", "==", houseName)
      .get();

    const datesSet = new Set();

    snapshot.forEach(doc => {
      const data = doc.data();
      // Expect stored checkin and checkout as ISO date strings (YYYY-MM-DD) or Date objects
      if (data.checkin && data.checkout) {
        // Normalize
        const startISO = (new Date(data.checkin)).toISOString().split('T')[0];
        const endISO = (new Date(data.checkout)).toISOString().split('T')[0];

        // We'll block the full range from checkin through checkout (inclusive)
        const rangeDates = getDatesInRangeInclusive(startISO, endISO);
        rangeDates.forEach(d => datesSet.add(d));
      }
    });

    const arr = Array.from(datesSet).sort();
    bookedDates = arr;
    window.bookedDates = arr; // optional global
    console.log(`Blocked dates for "${houseName}":`, arr);
    return arr;
  } catch (err) {
    console.error("Error fetching booked dates:", err);
    bookedDates = [];
    window.bookedDates = [];
    return [];
  }
}

// Initialize / re-initialize Flatpickr instances with bookedDates disabled
function setupDatePickers() {
  const checkinInput = document.getElementById("booking-checkin");
  const checkoutInput = document.getElementById("booking-checkout");
  if (!checkinInput || !checkoutInput) return;

  // Destroy old instances if present
  if (checkinPicker && typeof checkinPicker.destroy === 'function') {
    checkinPicker.destroy();
    checkinPicker = null;
  }
  if (checkoutPicker && typeof checkoutPicker.destroy === 'function') {
    checkoutPicker.destroy();
    checkoutPicker = null;
  }

  // Prepare disable option for flatpickr: array of ISO date strings or ranges
  // We have date strings; pass them directly to `disable`.
  const disableDates = bookedDates.slice(); // copy

  // We'll create checkoutPicker first so checkin onChange can reference it
  checkoutPicker = flatpickr("#booking-checkout", {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: disableDates,
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      // show "Booked" text for disabled days
      try {
        const dateStr = dayElem.dateObj.toISOString().split('T')[0];
        if (disableDates.includes(dateStr)) {
          dayElem.innerHTML = `<span class="booked-day">Booked</span>`;
        }
      } catch(e) { /* ignore */ }
    }
  });

  checkinPicker = flatpickr("#booking-checkin", {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: disableDates,
    onChange: function(selectedDates, dateStr) {
      if (selectedDates.length) {
        // set checkout minDate to the day after selected check-in
        const minCheckout = new Date(selectedDates[0]);
        minCheckout.setDate(minCheckout.getDate() + 1);
        const minCheckoutISO = minCheckout.toISOString().split('T')[0];
        checkoutPicker.set('minDate', minCheckoutISO);

        // if currently selected checkout is before new min, clear it
        const curCheckout = checkoutPicker.input.value;
        if (curCheckout) {
          const curCheckoutDate = new Date(curCheckout);
          if (curCheckoutDate <= selectedDates[0]) {
            checkoutPicker.clear();
          }
        }
      }
    },
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      try {
        const dateStr = dayElem.dateObj.toISOString().split('T')[0];
        if (disableDates.includes(dateStr)) {
          dayElem.innerHTML = `<span class="booked-day">Booked</span>`;
        }
      } catch(e) { /* ignore */ }
    }
  });
}

// -----------------------------
// BOOKING MODAL
// -----------------------------
async function openBookingModal(house) {
  const modal = document.getElementById('booking-modal-bg');
  const form = document.getElementById('booking-form');
  const confirmDiv = document.getElementById('booking-confirm');

  if (!modal || !form || !confirmDiv) return;

  modal.classList.add('active');
  document.getElementById('booking-house').value = house || '';
  form.style.display = 'block';
  confirmDiv.style.display = 'none';
  form.reset();

  // Fetch booked dates for this house and init flatpickr
  await getBookedDatesForHouse(house);
  setupDatePickers();

  // set minimum attributes on inputs (keeps native validation consistent)
  const todayISO = new Date().toISOString().split('T')[0];
  const checkinInput = document.getElementById('booking-checkin');
  const checkoutInput = document.getElementById('booking-checkout');
  checkinInput.min = todayISO;
  checkoutInput.min = todayISO;

  // ensure change handler for native / non-flatpickr fallback
  checkinInput.addEventListener('change', function onCheckinChange() {
    // set checkout min (next day)
    const checkinDate = new Date(this.value);
    if (isNaN(checkinDate)) return;
    checkinDate.setDate(checkinDate.getDate() + 1);
    checkoutInput.min = checkinDate.toISOString().split('T')[0];

    // clear checkout if before new min
    if (checkoutInput.value && new Date(checkoutInput.value) <= new Date(this.value)) {
      checkoutInput.value = '';
    }
  }, { once: true });
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) modal.classList.remove('active');
}

// -----------------------------
// Booking form submit: double-check conflicts and save
// -----------------------------
function parseISO(d) {
  // returns Date
  return new Date(d);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  // all Date objects
  return (aStart <= bEnd) && (bStart <= aEnd);
}

function bookingRangeToDates(startISO, endISO) {
  return getDatesInRangeInclusive(startISO, endISO); // inclusive
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
      ${bookingData.access ? `<p><strong>Accessibility Needs:</strong> ${bookingData.access}</p>` : ''}
      ${bookingData.requests ? `<p><strong>Special Requests:</strong> ${bookingData.requests}</p>` : ''}
    `;
  }
}

// Attach submit handler (this keeps original logic but adds conflict check)
function attachBookingFormHandler() {
  const bookingForm = document.getElementById('booking-form');
  if (!bookingForm) return;

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(bookingForm);
    const bookingData = Object.fromEntries(formData.entries());
    const house = bookingData.house || document.getElementById('booking-house').value || '';

    // validation
    const today = new Date(); today.setHours(0,0,0,0);
    const checkin = bookingData.checkin;
    const checkout = bookingData.checkout;
    if (!bookingData.name || !bookingData.guests || !checkin || !checkout || !bookingData.phone || !bookingData.email) {
      showCustomAlert("Please fill all required booking fields.", "error");
      return;
    }

    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    if (checkinDate < today) { showCustomAlert("Check-in date cannot be in the past.", "error"); return; }
    if (checkoutDate <= checkinDate) { showCustomAlert("Check-out date must be after check-in date.", "error"); return; }

    // ensure at least one night
    const daysDiff = Math.ceil((checkoutDate - checkinDate) / (1000*60*60*24));
    if (daysDiff < 1) { showCustomAlert("Minimum stay is one night.", "error"); return; }

    // Check for conflicts by fetching existing bookings for this house again (race-safety)
    try {
      const existingSnapshot = await db.collection("bookings")
        .where("house", "==", house)
        .get();

      // iterate and check overlap
      let conflict = false;
      existingSnapshot.forEach(doc => {
        const d = doc.data();
        if (d.checkin && d.checkout) {
          const exStart = new Date(d.checkin);
          const exEnd = new Date(d.checkout);
          if (rangesOverlap(checkinDate, checkoutDate, exStart, exEnd)) {
            conflict = true;
          }
        }
      });

      if (conflict) {
        showCustomAlert("Some of the selected dates are already booked for this accommodation. Please choose different dates.", "error");
        return;
      }

    } catch (err) {
      console.error("Error checking bookings for conflicts:", err);
      showCustomAlert("Error verifying availability. Please try again.", "error");
      return;
    }

    // Save booking
    const submitBtn = bookingForm.querySelector('[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;

    try {
      await db.collection("bookings").add({
        ...bookingData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });

      // update local bookedDates and datepickers immediately to block newly booked dates
      const newBlocked = bookingRangeToDates(bookingData.checkin, bookingData.checkout);
      newBlocked.forEach(d => {
        if (!bookedDates.includes(d)) bookedDates.push(d);
      });
      // re-init datepickers to apply new blocked list
      setupDatePickers();

      showBookingConfirmation(bookingData);

      // send notification document (keeps previous behavior)
      await db.collection("notifications").add({
        type: 'new_booking',
        data: bookingData,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

    } catch (err) {
      console.error("Error saving booking:", err);
      showCustomAlert("Error processing booking. Please try again.", "error");
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// -----------------------------
// The rest of your app: reviews, forms, UI helpers, etc.
// I'll keep your existing functions (slightly cleaned) so everything works.
// -----------------------------

// Utility Functions
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

// Reviews / testimonials rendering (kept from your code)
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
      </div>`;
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
          <div class="author-info">
            <h4>${userName}</h4>
            <span>Verified Guest ${reviewDate ? '• '+reviewDate : ''}</span>
          </div>
        </div>
        ${review.adminReply ? `<div class="admin-reply" style="margin-top:1rem;padding:1rem;background:var(--bg-light);border-radius:var(--border-radius);border-left:4px solid var(--primary-color);"><strong>Management Response:</strong><br>${review.adminReply}</div>` : ''}
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
    console.error("Error loading reviews:", err);
    renderTestimonials([]);
  });
}

// Form handlers: email/review, contact etc. (kept intact)
function initFormHandlers() {
  // email form -> show review UI
  const emailForm = document.getElementById('email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('email-input').value.trim();
      if (email && email.includes('@')) {
        currentUser = { email };
        showUserInfo(email);
      } else showCustomAlert("Please enter a valid email address", "error");
    });
  }

  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) signoutBtn.addEventListener('click', () => {
    currentUser = null; hideUserInfo(); document.getElementById('email-input').value = '';
  });

  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', e => {
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
        document.querySelectorAll('input[name="rating"]').forEach(i=>i.checked=false);
        showCustomAlert("Thank you for your review! It has been submitted successfully.");
        return db.collection("notifications").add({
          type: 'new_review',
          data: reviewData,
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }).catch(err => {
        console.error("Error adding review:", err);
        showCustomAlert("Error submitting review. Please try again.", "error");
      }).finally(() => {
        submitBtn.innerHTML = originalText; submitBtn.disabled = false;
      });
    });
  }

  // booking form handler (attach once)
  attachBookingFormHandler();

  // contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
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
        console.error("Error sending message:", err);
        showCustomAlert("Error sending message. Please try again.", "error");
      }).finally(() => {
        submitBtn.innerHTML = originalText; submitBtn.disabled = false;
      });
    });
  }
}

// UI helpers for review user-info
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
function hideUserInfo(){
  const userInfo = document.getElementById('user-info');
  const emailForm = document.getElementById('email-form');
  const reviewForm = document.getElementById('review-form');
  if (userInfo && emailForm && reviewForm) {
    userInfo.style.display = 'none';
    emailForm.style.display = 'block';
    reviewForm.style.display = 'none';
  }
}

// Animation, nav, slideshow, admin modal (kept from your original code)
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); navMenu.classList.toggle('active'); hamburger.classList.toggle('active'); });
    navMenu.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', ()=>{ navMenu.classList.remove('active'); hamburger.classList.remove('active'); }));
    document.addEventListener('click', (e) => { if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) { navMenu.classList.remove('active'); hamburger.classList.remove('active'); }});
  }
}

// Smooth scrolling
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// Simple intersection animation
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('fade-in'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.accommodation-card, .feature-card, .testimonial-card, .quick-link-card').forEach(el => observer.observe(el));
}

// Modal handlers
function initModalHandlers() {
  const modal = document.getElementById('booking-modal-bg');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeBookingModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBookingModal(); });
}

// Navbar scroll
function initNavbarScroll() {
  const navbar = document.querySelector('.main-header');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 100) { navbar.style.background = 'rgba(255,255,255,0.98)'; navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)'; }
      else { navbar.style.background = 'rgba(255,255,255,0.95)'; navbar.style.boxShadow = 'none'; }
    });
  }
}

// Slideshow (kept minimal)
let slideIndex = 0;
function initSlideshow() {
  const slides = document.querySelectorAll('.slide');
  if (slides.length === 0) return;
  setInterval(()=> {
    slideIndex = (slideIndex + 1) % slides.length;
    slides.forEach((s,i)=> s.classList.toggle('active', i===slideIndex));
    const indicators = document.querySelectorAll('.indicator');
    indicators.forEach((ind,i)=> ind.classList.toggle('active', i===slideIndex));
  }, 5000);
}
function currentSlide(index) {
  slideIndex = index - 1;
  const slides = document.querySelectorAll('.slide');
  slides.forEach((s,i)=> s.classList.toggle('active', i===slideIndex));
  const indicators = document.querySelectorAll('.indicator');
  indicators.forEach((ind,i)=> ind.classList.toggle('active', i===slideIndex));
}

// Admin modal functions (kept)
function openAdminModal() { const modal = document.getElementById('admin-login-modal'); if (modal) modal.style.display = 'flex'; }
function closeAdminModal() { const modal = document.getElementById('admin-login-modal'); if (modal) { modal.style.display = 'none'; const f = document.getElementById('admin-login-form'); if (f) f.reset(); const e = document.getElementById('admin-login-error'); if (e) e.style.display='none'; } }
function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('admin-login-error');
  const adminCredentials = { username: 'gonahhomes0@gmail.com', password: 'gonahhomes@0799466723' };
  if (username === adminCredentials.username && password === adminCredentials.password) {
    closeAdminModal();
    window.open('backend/dashboard.html', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  } else { errorDiv.textContent = 'Invalid credentials. Please try again.'; errorDiv.style.display = 'block'; }
}

function initAdminAccess() {
  const adminBtn = document.getElementById('admin-access-btn'); if (adminBtn) adminBtn.addEventListener('click', openAdminModal);
  const adminForm = document.getElementById('admin-login-form'); if (adminForm) adminForm.addEventListener('submit', handleAdminLogin);
  const adminModal = document.getElementById('admin-login-modal'); if (adminModal) adminModal.addEventListener('click', e => { if (e.target === adminModal) closeAdminModal(); });
}

// Custom alerts
function showCustomAlert(message, type = "success") {
  const existing = document.querySelector('.custom-alert'); if (existing) existing.remove();
  const alertBox = document.createElement('div'); alertBox.classList.add('custom-alert'); alertBox.classList.add(type);
  let backgroundColor = ''; if (type === 'success') { backgroundColor = '#d4edda'; alertBox.style.borderColor='#28a745'; }
  else if (type === 'error') { backgroundColor = '#f8d7da'; alertBox.style.borderColor='#dc3545'; }
  else if (type === 'info') { backgroundColor = '#d1ecf1'; alertBox.style.borderColor='#17a2b8'; }
  else { backgroundColor = 'maroon'; alertBox.style.color = 'white'; }
  alertBox.style.backgroundColor = backgroundColor;
  const messageBox = document.createElement('p'); messageBox.textContent = message;
  const closeBtn = document.createElement('span'); closeBtn.classList.add('alert-close-btn'); closeBtn.innerHTML = '&times;';
  alertBox.appendChild(messageBox); alertBox.appendChild(closeBtn);
  document.body.appendChild(alertBox);
  closeBtn.addEventListener('click', ()=> alertBox.remove());
  setTimeout(()=> { if (alertBox.parentNode) alertBox.remove(); }, 5000);
}

// Initialization
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
  console.log('Gonah Homes website initialized successfully!');
});

// Expose modal open/close for HTML onclick
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.scrollToSection = scrollToSection;
window.currentSlide = currentSlide;
