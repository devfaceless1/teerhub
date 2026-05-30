const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: { type: String },
  role: { type: String, enum: ['company', 'organization', 'volunteer', 'admin'], default: 'volunteer' },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationExpires: { type: Date },
  goal: { type: String },
  motivation: { type: String },
  joinedProgram: { type: Boolean, default: false },
  showEmail: { type: Boolean, default: true },
  savedVacancies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VolunteerVacancy' }],
  ratings: [{
    ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    createdAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

UserSchema.methods.setPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(password, salt);
};

UserSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);
