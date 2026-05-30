const mongoose = require('mongoose');

const VolunteerVacancySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String },
  contactName: { type: String },
  contactEmail: { type: String },
  contactPhone: { type: String },
  tags: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creatorRole: { type: String, enum: ['volunteer', 'organization', 'company', 'admin'], required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('VolunteerVacancy', VolunteerVacancySchema);
