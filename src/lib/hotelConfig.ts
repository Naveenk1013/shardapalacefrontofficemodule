/**
 * Hotel Configuration
 * Centralized branding and contact information for Hotel Sharda Palace
 */

export const hotelConfig = {
  name: 'Hotel Sharda Palace',
  tagline: 'Experience Divine Hospitality',
  
  // Contact Information
  contact: {
    phone: '+91 98765 43210',
    email: 'info@shardapalace.com',
    website: 'www.shardapalace.com',
  },
  
  // Address
  address: {
    line1: 'Vrindavan, Mathura',
    line2: 'Uttar Pradesh, India',
    pincode: '281121',
    full: 'Vrindavan, Mathura, Uttar Pradesh, India - 281121',
  },
  
  // Tax Registration (Required for GST Invoices)
  gstin: 'XXGSTIN1234567XX', // Update with actual GSTIN
  
  // Invoice Settings
  invoice: {
    prefix: 'INV',
    termsAndConditions: [
      'Payment is due upon checkout.',
      'All disputes are subject to Mathura jurisdiction.',
      'This is a computer generated invoice.',
    ],
  },
  
  // GRC Settings
  grc: {
    prefix: 'GRC',
    formTitle: 'Guest Registration Certificate',
  },
};

export type HotelConfig = typeof hotelConfig;
