// models/User.ts
import mongoose from 'mongoose';

// Subdocument schema for product metadata
const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  mergedImgUrl: {
    type: String,
    required: true,
  },
  images: {
    type: [
      {
        type: String,
        required: true,
      }
    ],
    required: true,
  },
});

const UserSchema = new mongoose.Schema({
  discordId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },
  accessToken: {
    type: String,
    unique: true,
    required: true
  },
  products: [ProductSchema],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // One month (30 days) from now
    index: { expireAfterSeconds: 0 },
  },
  
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
