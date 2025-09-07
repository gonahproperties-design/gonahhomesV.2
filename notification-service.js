// Notification Service for Gonah Homes - Final Unified Version
class NotificationService {
  constructor() {
    this.emailConfig = {
      serviceID: 'service_ky2kj3t',
      adminTemplate: 'template_24gjzd3',  // Admin template
      clientTemplate: 'template_6duvs5n', // Client template
      adminEmail: 'gonahhomes0@gmail.com'
    };
  }

  // Show in-app notification
  showNotification(message, type = 'info') {
    if (typeof showCustomAlert === 'function') {
      showCustomAlert(message, type);
    } else {
      console.log(`Notification (${type}): ${message}`);
    }
  }

  // --- CORE SENDER FUNCTIONS ---
  async sendToAdmin(templateData) {
    try {
      if (typeof emailjs !== 'undefined') {
        await emailjs.send(this.emailConfig.serviceID, this.emailConfig.adminTemplate, {
          // Common fields
          to_email: this.emailConfig.adminEmail,
          to_name: "Admin",
          from_name: templateData.from_name || 'Website User',
          from_email: templateData.from_email || 'website@gonahhomes.com',
          message: templateData.message || '',

          // Booking placeholders
          booking_name: templateData.booking_name || '',
          booking_phone: templateData.booking_phone || '',
          booking_house: templateData.booking_house || '',
          booking_guests: templateData.booking_guests || '',
          booking_checkin: templateData.booking_checkin || '',
          booking_checkout: templateData.booking_checkout || '',

          // Review placeholders
          review_name: templateData.review_name || '',
          review_email: templateData.review_email || '',
          review_rating: templateData.review_rating || '',
          review_text: templateData.review_text || '',

          reply_to: templateData.from_email || this.emailConfig.adminEmail
        });
        console.log('✅ Admin notification sent successfully');
      }
    } catch (error) {
      console.error('❌ Error sending admin notification:', error);
    }
  }

  async sendToClient(templateData) {
    try {
      if (typeof emailjs !== 'undefined' && templateData.to_email) {
        await emailjs.send(this.emailConfig.serviceID, this.emailConfig.clientTemplate, {
          // Common fields
          to_email: templateData.to_email,
          to_name: templateData.to_name || 'Guest',
          from_name: "Gonah Homes",
          message: templateData.message || 'Thank you for contacting us!',

          // Booking placeholders
          booking_house: templateData.booking_house || '',
          booking_guests: templateData.booking_guests || '',
          booking_checkin: templateData.booking_checkin || '',
          booking_checkout: templateData.booking_checkout || '',

          // Review placeholders
          review_rating: templateData.review_rating || '',
          review_text: templateData.review_text || '',

          reply_to: this.emailConfig.adminEmail
        });
        console.log('✅ Client notification sent successfully');
      }
    } catch (error) {
      console.error('❌ Error sending client notification:', error);
    }
  }

  // --- HANDLERS ---
  async handleBookingNotification(bookingData) {
    // Notify Admin
    await this.sendToAdmin({
      from_name: bookingData.name,
      from_email: bookingData.email,
      booking_name: bookingData.name,
      booking_phone: bookingData.phone,
      booking_house: bookingData.house,
      booking_guests: bookingData.guests,
      booking_checkin: bookingData.checkin,
      booking_checkout: bookingData.checkout,
      message: `New booking received from ${bookingData.name}`
    });

    // Notify Client
    await this.sendToClient({
      to_email: bookingData.email,
      to_name: bookingData.name,
      message: `Thank you for your booking! We have received your request for ${bookingData.house}.`,
      booking_house: bookingData.house,
      booking_guests: bookingData.guests,
      booking_checkin: bookingData.checkin,
      booking_checkout: bookingData.checkout
    });
  }

  async handleReviewNotification(reviewData) {
    // Notify Admin
    await this.sendToAdmin({
      from_name: reviewData.user?.name || 'Guest',
      from_email: reviewData.user?.email,
      review_name: reviewData.user?.name || 'Guest',
      review_email: reviewData.user?.email || '',
      review_rating: reviewData.rating || '',
      review_text: reviewData.review || '',
      message: `New review received`
    });

    // Notify Client
    if (reviewData.user?.email) {
      await this.sendToClient({
        to_email: reviewData.user.email,
        to_name: reviewData.user.name || 'Guest',
        message: `Thank you for your ${reviewData.rating}-star review!`,
        review_rating: reviewData.rating,
        review_text: reviewData.review
      });
    }
  }

  async handleContactNotification(contactData) {
    // Notify Admin
    await this.sendToAdmin({
      from_name: contactData.name,
      from_email: contactData.email,
      message: contactData.message
    });

    // Notify Client
    await this.sendToClient({
      to_email: contactData.email,
      to_name: contactData.name,
      message: 'Thank you for your message! We will get back to you soon.'
    });
  }
}

// Initialize service
if (typeof window !== 'undefined') {
  window.notificationService = new NotificationService();
}
