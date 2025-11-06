
const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// @desc    Submit contact form
// @route   POST /api/contact-us
// @access  Public
router.post('/contact-us', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    // Basic validation
    if (!name || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if similar contact was submitted recently (optional spam protection)
    const recentContact = await Contact.findOne({
      email,
      message,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    if (recentContact) {
      return res.status(429).json({
        success: false,
        message: 'Similar contact form submitted recently. Please wait 24 hours.'
      });
    }

    // Create new contact with additional info
    const newContact = new Contact({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      message: message.trim(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    // Save to database
    const savedContact = await newContact.save();

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: {
        id: savedContact._id,
        name: savedContact.name,
        email: savedContact.email,
        submittedAt: savedContact.createdAt
      }
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Duplicate key error (if any)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

// @desc    Get all contacts (with pagination and filtering)
// @route   GET /api/contacts
// @access  Public (consider adding authentication in production)
router.get('/contacts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search;
    
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Get contacts with pagination
    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v'); // Exclude version key

    // Get total count for pagination
    const total = await Contact.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: contacts,
      pagination: {
        current: page,
        pages: totalPages,
        total: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contacts'
    });
  }
});

// @desc    Get single contact by ID
// @route   GET /api/contacts/:id
// @access  Public
router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).select('-__v');
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Get contact error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching contact'
    });
  }
});

// @desc    Update contact status
// @route   PATCH /api/contacts/:id/status
// @access  Public
router.patch('/contacts/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['new', 'read', 'replied', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required: new, read, replied, or archived'
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Contact marked as ${status}`,
      data: contact
    });
  } catch (error) {
    console.error('Update contact status error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating contact status'
    });
  }
});

// @desc    Get contact statistics
// @route   GET /api/contacts/stats/summary
// @access  Public
router.get('/contacts/stats/summary', async (req, res) => {
  try {
    const totalContacts = await Contact.countDocuments();
    const newContacts = await Contact.countDocuments({ status: 'new' });
    const readContacts = await Contact.countDocuments({ status: 'read' });
    const repliedContacts = await Contact.countDocuments({ status: 'replied' });
    
    // Contacts from last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const recentContacts = await Contact.countDocuments({
      createdAt: { $gte: lastWeek }
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalContacts,
        new: newContacts,
        read: readContacts,
        replied: repliedContacts,
        recent: recentContacts
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});

// @desc    Delete contact
// @route   DELETE /api/contacts/:id
// @access  Public
router.delete('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error deleting contact'
    });
  }
});

module.exports = router;