
// script.js (complete - ready to paste)
// Firebase Configuration (from your project)
const firebaseConfig = {
  apiKey: "AIzaSyABTVp797tNu353FBVLzsOp90aIX2mNF74",
  authDomain: "my-website-project2797.firebaseapp.com",
  projectId: "my-website-project2797",
  storageBucket: "my-website-project2797.appspot.com",
  messagingSenderId: "406226552922",
  appId: "1:406226552922:web:ffdf2ccf6f77a57964b063"
};

// Initialize Firebase (compat)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// UI elements
const bookingModal = document.getElementById('booking-modal-bg');
const bookingForm = document.getElementById('booking-form');
const bookingConfirm = document.getElementById('booking-confirm');
const bookingDetails = document.getElementById('booking-details');
const bookingHouseInput = document.getElementById('booking-house');
const closeButtons = document.querySelectorAll('.modal-close');

// Local state
let bookedDates = [];   // array strings YYYY-MM-DD
let bookedSet = new Set();
let checkinPicker = null;
let checkoutPicker = null;
let timePicker = null;

// Utility: show / hide modal
function openBookingModal(house) {
  bookingModal.classList.add('active');
  bookingHouseInput.value = house || '';
  bookingForm.style.display = 'block';
  bookingConfirm.style.display = 'none';
  bookingForm.reset();

  // Ensure we fetch blocked dates for that house and (re)init pickers
  fetchAndApplyBookedDates(house).then(() => {
    setupDatePickers();
    // set HTML min attributes fallback
    const todayISO = new Date().toISOString().split('T')[0];
    document.getElementById('booking-checkin').min = todayISO;
    document.getElementById('booking-checkout').min = todayISO;
  }).catch(err => {
    console.error("Error initializing booking modal:", err);
    setupDatePickers(); // even if fetch fails, allow picking
  });
}

function closeBookingModal() {
  bookingModal.classList.remove('active');
}

// Close icon(s)
closeButtons.forEach(btn => btn.addEventListener('click', closeBookingModal));
// click outside modal to close
bookingModal.addEventListener('click', (e) => { if (e.target === bookingModal) closeBookingModal(); });
// ESC key
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBookingModal(); });

// === Firestore: fetch bookings for house and convert to blocked days ===
async function fetchAndApplyBookedDates(houseName) {
  if (!houseName) { bookedDates = []; bookedSet = new Set(); return []; }
  try {
    const snapshot = await db.collection('bookings').where('house', '==', houseName).get();
    const dates = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data || !data.checkin || !data.checkout) return;
      const start = new Date(data.checkin);
      const end = new Date(data.checkout);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      // Mark each night from checkin inclusive to day before checkout (checkout exclusive)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) 
