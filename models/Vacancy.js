const mongoose = require("mongoose");

const vacancySchema = new mongoose.Schema({
  title: String,
  description: String,
  organization: String,
  location: String,
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

module.exports = mongoose.model("Vacancy", vacancySchema);